import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, ShoppingBag, Sparkles, Wallet } from 'lucide-react';
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

interface NFTItem {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  available_supply: number;
  total_supply: number;
}

const TLC_CONTRACT = '0xf95368bF95bAB7E83447E249B6C7e53B3bb858b0';
const AMOY_CHAIN_ID = '0x13882'; // 80002
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export default function Rewards() {
  const { user } = useAuth();
  const { account, connectWallet } = useWallet();
  const [nftItems, setNftItems] = useState<NFTItem[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [onChainBalance, setOnChainBalance] = useState<number>(0);
  const [selectedItem, setSelectedItem] = useState<NFTItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchNFTItems();
    fetchUserBalance();
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
        const contract = new ethers.Contract(TLC_CONTRACT, ERC20_BALANCE_ABI, provider);
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

    if (!account) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to purchase NFTs",
        variant: "destructive",
      });
      return;
    }

    setPurchasing(true);

    try {
      const { data, error } = await supabase.functions.invoke('purchase-nft', {
        body: { nftItemId: selectedItem.id },
      });

      if (error) throw new Error(error.message || 'Purchase failed');
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Purchase successful!",
        description: `${selectedItem.name} has been added to your collection.`,
      });

      setSelectedItem(null);
      fetchNFTItems();
      fetchUserBalance();
    } catch (error: any) {
      toast({
        title: "Purchase failed",
        description: error.message,
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
                  disabled={userBalance < item.price}
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  {userBalance >= item.price ? 'Purchase NFT' : 'Insufficient Balance'}
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

        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Purchase</DialogTitle>
              <DialogDescription>
                You are about to purchase this NFT reward
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
                    <span className="font-bold">{userBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Balance After:</span>
                    <span className="font-bold">
                      {(userBalance - selectedItem.price).toLocaleString()}
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
                {purchasing ? "Processing..." : "Confirm Purchase"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
