import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, ShoppingBag, Sparkles, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

export default function Rewards() {
  const { user } = useAuth();
  const [nftItems, setNftItems] = useState<NFTItem[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [selectedItem, setSelectedItem] = useState<NFTItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchNFTItems();
    fetchUserBalance();
  }, [user]);

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

    if (userBalance < selectedItem.price) {
      toast({
        title: "Insufficient balance",
        description: `You need ${selectedItem.price - userBalance} more tokens to purchase this NFT.`,
        variant: "destructive",
      });
      return;
    }

    setPurchasing(true);

    try {
      // Deduct tokens
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ token_balance: userBalance - selectedItem.price })
        .eq('id', user.id);

      if (balanceError) throw balanceError;

      // Record purchase
      const { error: nftError } = await supabase
        .from('user_nfts')
        .insert({
          user_id: user.id,
          nft_item_id: selectedItem.id,
        });

      if (nftError) throw nftError;

      // Update available supply
      await supabase
        .from('nft_items')
        .update({ available_supply: selectedItem.available_supply - 1 })
        .eq('id', selectedItem.id);

      // Record transaction
      await supabase
        .from('token_transactions')
        .insert({
          user_id: user.id,
          amount: -selectedItem.price,
          type: 'nft_purchase',
          description: `Purchased ${selectedItem.name}`,
        });

      toast({
        title: "Purchase successful!",
        description: `${selectedItem.name} has been added to your wallet.`,
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center">
              <Sparkles className="h-8 w-8 mr-2 text-primary" />
              NFT Rewards Store
            </h1>
            <p className="text-muted-foreground mt-1">
              Spend your tokens on exclusive NFT rewards
            </p>
          </div>

          <Card className="shadow-md">
            <CardContent className="flex items-center space-x-2 p-4">
              <Coins className="h-5 w-5 text-success" />
              <div>
                <div className="text-sm text-muted-foreground">Your Balance</div>
                <div className="text-2xl font-bold">{userBalance.toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* NFT Grid */}
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

        {/* Purchase Confirmation Dialog */}
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
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedItem(null)}>
                Cancel
              </Button>
              <Button onClick={purchaseNFT} disabled={purchasing}>
                {purchasing ? "Processing..." : "Confirm Purchase"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
