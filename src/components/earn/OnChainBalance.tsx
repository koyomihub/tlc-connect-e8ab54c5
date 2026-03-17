import { useState, useEffect } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';

const TLC_CONTRACT = '0xf95368bF95bAB7E83447E249B6C7e53B3bb858b0';
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

export function OnChainBalance() {
  const { account } = useWallet();
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOnChainBalance = async () => {
    if (!account || !window.ethereum) return;

    setLoading(true);
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(TLC_CONTRACT, ERC20_BALANCE_ABI, provider);
      const balance = await contract.balanceOf(account);
      setOnChainBalance(ethers.formatUnits(balance, 18));
    } catch (e) {
      console.error('Error fetching on-chain balance:', e);
      setOnChainBalance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnChainBalance();
  }, [account]);

  if (!account) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10 border border-white/20">
      <Coins className="h-5 w-5 text-yellow-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/60">On-Chain $TLC Balance</p>
        <p className="text-lg font-bold text-white font-mono truncate">
          {loading ? '...' : onChainBalance !== null ? parseFloat(onChainBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={fetchOnChainBalance}
        disabled={loading}
        className="text-white/60 hover:text-white hover:bg-white/10 shrink-0"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
