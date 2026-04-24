import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, ShoppingBag, Sparkles, Wallet, ExternalLink, CheckCircle2, Info, Share2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface NFTItem {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  available_supply: number;
  total_supply: number;
}

interface OwnedNFT {
  id: string;
  purchased_at: string | null;
  transaction_hash: string | null;
  nft_items: {
    name: string;
    description: string | null;
    image_url: string;
  } | null;
}

const TLC_CONTRACT = '0xf95368bF95bAB7E83447E249B6C7e53B3bb858b0';
const AMOY_CHAIN_ID = '0x13882'; // 80002
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export default function NFTs() {
  const { user } = useAuth();
  const { account, connectWallet } = useWallet();
  const [nftItems, setNftItems] = useState<NFTItem[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [onChainBalance, setOnChainBalance] = useState<number>(0);
  const [selectedItem, setSelectedItem] = useState<NFTItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set());
  const [ownedNFTs, setOwnedNFTs] = useState<OwnedNFT[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const shareToFeed = async (nft: OwnedNFT) => {
    if (!user || !nft.nft_items) return;
    setSharingId(nft.id);
    try {
      const name = nft.nft_items.name;
      const content = `Just minted "${name}" on TLC-Connect! 🎉✨\n\nAnother piece added to my on-chain collection — earned through the $TLC token economy. Who's next?`;
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content,
        image_url: nft.nft_items.image_url,
        image_urls: [nft.nft_items.image_url],
        privacy: 'public',
      });
      if (error) throw error;
      toast({
        title: 'Shared to Feed! 🚀',
        description: 'Your NFT is now showing off in everyone\'s feed.',
      });
    } catch (err: any) {
      toast({
        title: 'Could not share',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSharingId(null);
    }
  };

  useEffect(() => {
    fetchNFTItems();
    fetchUserBalance();
    fetchOwnedNFTs();
  }, [user]);

  useEffect(() => {
    const fetchOnChain = async () => {
      if (!account || !window.ethereum) {
        setOnChainBalance(0);
        return;
      }
      try {
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(TLC_CONTRACT, ERC20_ABI, provider);
        const bal = await contract.balanceOf(account);
        setOnChainBalance(parseFloat(ethers.formatUnits(bal, 18)));
      } catch (e) {
        console.error('Error fetching on-chain $TLC balance:', e);
        setOnChainBalance(0);
      }
    };
    fetchOnChain();
  }, [account]);

  const fetchNFTItems = async () => {
    const { data } = await supabase
      .from('nft_items')
      .select('*')
      .gt('available_supply', 0)
      .order('price', { ascending: true });

    setNftItems(data || []);
  };

  const fetchOwnedNFTs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_nfts')
      .select('id, purchased_at, transaction_hash, nft_item_id, nft_items(name, description, image_url)')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });
    const rows = (data || []) as any[];
    setOwnedItemIds(new Set(rows.map((r) => r.nft_item_id)));
    setOwnedNFTs(rows as OwnedNFT[]);
  };

  const fetchUserBalance = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();

    setUserBalance(data?.token_balance || 0);
  };

  const purchaseNFT = async () => {
    if (!selectedItem || !user) return;

    if (!account || !window.ethereum) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to mint NFTs",
        variant: "destructive",
      });
      return;
    }

    setPurchasing(true);

    try {
      const { ethers } = await import('ethers');

      // Ensure user is on Amoy
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: AMOY_CHAIN_ID }],
        });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: AMOY_CHAIN_ID,
              chainName: 'Polygon Amoy',
              rpcUrls: ['https://rpc-amoy.polygon.technology'],
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              blockExplorerUrls: ['https://amoy.polygonscan.com'],
            }],
          });
        } else {
          throw switchErr;
        }
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();
      const tlc = new ethers.Contract(TLC_CONTRACT, ERC20_ABI, signer);
      const priceWei = ethers.parseUnits(String(selectedItem.price), 18);

      // First call to learn the minter (spender) address from the edge function
      const callMintFunction = async () => {
        const result = await supabase.functions.invoke('purchase-nft', {
          body: { nftItemId: selectedItem.id, userWallet: account },
        });

        if (result.error instanceof FunctionsHttpError) {
          const ctx = result.error.context;
          if (ctx instanceof Response) {
            const errorBody = await ctx.json().catch(() => null);
            return { data: errorBody, error: result.error };
          }
        }

        return result;
      };

      const probe = await callMintFunction();

      const probeData: any = probe.data;
      const probeErrMsg: string | undefined = probe.error?.message;

      if (probeData?.needsApproval && probeData?.spender) {
        toast({
          title: "Approval needed",
          description: "Approve $TLC spending in your wallet to continue.",
        });
        const approveTx = await tlc.approve(probeData.spender, priceWei);
        await approveTx.wait();

        // Retry mint
        const retry = await callMintFunction();
        if (retry.error) {
          const detailText = retry.data?.details?.claimPricePol
            ? ` On-chain claim price: ${retry.data.details.claimPricePol} POL. Owner POL balance: ${retry.data.details.ownerPolBalance ?? '0'}.`
            : '';
          throw new Error((retry.data?.error || retry.error.message) + detailText);
        }
        if (retry.data?.error) throw new Error(retry.data.error);

        toast({
          title: "Mint successful! 🎉",
          description: `${selectedItem.name} is now in your wallet.`,
        });
      } else if (probe.error || probeData?.error) {
        const detailText = probeData?.details?.claimPricePol
          ? ` On-chain claim price: ${probeData.details.claimPricePol} POL. Owner POL balance: ${probeData.details.ownerPolBalance ?? '0'}.`
          : '';
        throw new Error((probeData?.error || probeErrMsg || 'Mint failed') + detailText);
      } else {
        toast({
          title: "Mint successful! 🎉",
          description: `${selectedItem.name} is now in your wallet.`,
        });
      }

      setSelectedItem(null);
      fetchNFTItems();
      fetchUserBalance();
      fetchOwnedNFTs();
    } catch (error: any) {
      toast({
        title: "Mint failed",
        description: error.message || 'Something went wrong',
        variant: "destructive",
      });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center">
              <Sparkles className="h-8 w-8 mr-2 text-primary" />
              NFT Minting Station
            </h1>
            <p className="text-muted-foreground mt-1">
              Use your test tokens to mint exclusive test NFTs
            </p>
          </div>

          <Card className="shadow-md">
            <CardContent className="flex items-center space-x-3 p-4">
              <Coins className="h-6 w-6 text-success" />
              <div>
                <div className="text-xs text-muted-foreground">Token Balance</div>
                <div className="text-2xl font-bold">
                  {account ? onChainBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                  <span className="text-sm font-normal text-muted-foreground ml-1">$TLC</span>
                </div>
              </div>
              {!account && (
                <Button onClick={connectWallet} size="sm" variant="outline">
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle>Heads up: Minting requires POL on the platform wallet</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Each NFT mint costs the platform's owner wallet ~<span className="font-semibold text-foreground">0.1 POL</span> (claim fee) plus gas.
            Admins should keep at least <span className="font-semibold text-foreground">0.2 POL</span> in the minter wallet to ensure mints don't fail.
            Users only spend $TLC — no POL needed from your wallet.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="available">Available NFTs</TabsTrigger>
            <TabsTrigger value="mine">My NFTs {ownedNFTs.length > 0 && `(${ownedNFTs.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nftItems.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-all group">
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="line-clamp-1">{item.name}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                          {item.description}
                        </CardDescription>
                      </div>
                      {item.available_supply < 10 && (
                        <Badge variant="destructive" className="ml-2">
                          {item.available_supply} left
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-success font-bold text-xl">
                        <Coins className="h-5 w-5 mr-1" />
                        {item.price.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.available_supply}/{item.total_supply}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full shadow-sm"
                      onClick={() => setSelectedItem(item)}
                      disabled={!account || ownedItemIds.has(item.id) || onChainBalance < item.price}
                    >
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      {ownedItemIds.has(item.id)
                        ? 'Already Minted'
                        : !account
                          ? 'Connect Wallet'
                          : onChainBalance >= item.price
                            ? 'Mint NFT'
                            : 'Insufficient $TLC'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {nftItems.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No NFTs available at the moment. Check back later!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            {ownedNFTs.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    You haven't minted any NFTs yet. Head to "Available NFTs" to mint your first one!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownedNFTs.map((nft) => (
                  <Card key={nft.id} className="overflow-hidden hover:shadow-lg transition-all">
                    <div className="aspect-square overflow-hidden bg-muted relative">
                      {nft.nft_items?.image_url && (
                        <img
                          src={nft.nft_items.image_url}
                          alt={nft.nft_items?.name || 'NFT'}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <Badge className="absolute top-2 right-2 bg-success text-success-foreground shadow-md">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Minted
                      </Badge>
                    </div>
                    <CardHeader>
                      <CardTitle className="line-clamp-1">{nft.nft_items?.name || 'NFT'}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {nft.nft_items?.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {nft.purchased_at && (
                        <div className="text-xs text-muted-foreground">
                          Minted {new Date(nft.purchased_at).toLocaleString()}
                        </div>
                      )}
                      {nft.transaction_hash && (
                        <div className="text-xs font-mono text-muted-foreground truncate">
                          Tx: {nft.transaction_hash.slice(0, 10)}…{nft.transaction_hash.slice(-8)}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      {nft.transaction_hash ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          asChild
                        >
                          <a
                            href={`https://amoy.polygonscan.com/tx/${nft.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View on Blockchain
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full" disabled>
                          Tx hash unavailable
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Mint</DialogTitle>
              <DialogDescription>
                You are about to mint this NFT
              </DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-4">
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="w-full rounded-lg"
                />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{selectedItem.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Price:</span>
                    <span className="font-bold text-success flex items-center">
                      <Coins className="h-4 w-4 mr-1" />
                      {selectedItem.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Your Balance:</span>
                    <span className="font-bold">{onChainBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} $TLC</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Balance After:</span>
                    <span className="font-bold">
                      {(onChainBalance - selectedItem.price).toLocaleString(undefined, { maximumFractionDigits: 2 })} $TLC
                    </span>
                  </div>
                </div>

                {!account && (
                  <div className="bg-warning/10 border border-warning rounded-lg p-3 text-sm">
                    <p className="font-semibold">Wallet Required</p>
                    <p className="text-muted-foreground">Connect your wallet to complete the purchase</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedItem(null)}>
                Cancel
              </Button>
              <Button onClick={purchaseNFT} disabled={purchasing || !account}>
                {purchasing ? "Processing..." : "Confirm Mint"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
