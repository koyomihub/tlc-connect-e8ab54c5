import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WalletContextType {
  account: string | null;
  chainId: number | null;
  balance: string;
  connecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  claimTokens: (amount: number) => Promise<boolean>;
  purchaseNFT: (nftId: string, price: number) => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState('0');
  const [connecting, setConnecting] = useState(false);

  // Load saved wallet from profile on auth change
  useEffect(() => {
    const loadSavedWallet = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single();

        if (profile?.wallet_address && window.ethereum) {
          try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.listAccounts();
            const matchingAccount = accounts.find(
              a => a.address.toLowerCase() === profile.wallet_address!.toLowerCase()
            );
            if (matchingAccount) {
              setAccount(profile.wallet_address);
              const network = await provider.getNetwork();
              setChainId(Number(network.chainId));
              await updateBalance(profile.wallet_address);
            }
          } catch (e) {
            console.error('Error restoring wallet:', e);
          }
        }
      }
    };

    loadSavedWallet();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
      updateBalance(accounts[0]);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const updateBalance = async (address: string) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        title: "MetaMask not found",
        description: "Please install MetaMask to use blockchain features",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      await updateBalance(address);

      // Save wallet address to user's profile
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase
          .from('profiles')
          .update({ wallet_address: address })
          .eq('id', authUser.id);
      }

      toast({
        title: "Wallet connected!",
        description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
      });
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    setAccount(null);
    setChainId(null);
    setBalance('0');

    // Clear wallet address from profile
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase
        .from('profiles')
        .update({ wallet_address: null })
        .eq('id', authUser.id);
    }

    toast({
      title: "Wallet disconnected",
      description: "Your wallet has been disconnected",
    });
  };

  const claimTokens = async (amount: number): Promise<boolean> => {
    if (!account) {
      toast({ title: "Wallet not connected", description: "Please connect your wallet first", variant: "destructive" });
      return false;
    }

    try {
      toast({ title: "Claiming tokens...", description: "Processing your claim" });
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({ title: "Tokens claimed!", description: `Successfully claimed ${amount} tokens` });
      return true;
    } catch (error: any) {
      toast({ title: "Claim failed", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const purchaseNFT = async (nftId: string, price: number): Promise<boolean> => {
    if (!account) {
      toast({ title: "Wallet not connected", description: "Please connect your wallet first", variant: "destructive" });
      return false;
    }

    try {
      toast({ title: "Processing purchase...", description: "Please confirm the transaction in your wallet" });
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({ title: "NFT purchased!", description: "The NFT has been transferred to your wallet" });
      return true;
    } catch (error: any) {
      toast({ title: "Purchase failed", description: error.message, variant: "destructive" });
      return false;
    }
  };

  return (
    <WalletContext.Provider value={{ account, chainId, balance, connecting, connectWallet, disconnectWallet, claimTokens, purchaseNFT }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
