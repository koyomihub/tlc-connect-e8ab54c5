import { ethers } from 'ethers';

export const TLC_CONTRACT = '0xf95368bF95bAB7E83447E249B6C7e53B3bb858b0';
export const AMOY_RPC = 'https://rpc-amoy.polygon.technology';
export const AMOY_CHAIN_ID = 80002;

const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

let cachedProvider: ethers.JsonRpcProvider | null = null;
function getAmoyProvider() {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(AMOY_RPC, AMOY_CHAIN_ID, {
      staticNetwork: true,
    });
  }
  return cachedProvider;
}

/**
 * Reads the $TLC ERC-20 balance for `address` directly from Polygon Amoy RPC,
 * regardless of which network the user's wallet is currently switched to.
 * Returns the balance formatted as a decimal string, or null on error.
 */
export async function readTlcBalance(address: string): Promise<string | null> {
  try {
    const provider = getAmoyProvider();
    const contract = new ethers.Contract(TLC_CONTRACT, ERC20_BALANCE_ABI, provider);
    const bal: bigint = await contract.balanceOf(address);
    return ethers.formatUnits(bal, 18);
  } catch (e) {
    console.error('readTlcBalance failed:', e);
    return null;
  }
}
