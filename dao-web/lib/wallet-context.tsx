'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

interface WalletContextType {
  address: string | null;
  signer: JsonRpcSigner | null;
  provider: BrowserProvider | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>; // nuevo
  refreshAccounts: () => Promise<void>; // opcional
  ensureNetwork: () => Promise<boolean>; // fuerza cambiar/red agregar
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);

  const initProvider = () => {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    return new BrowserProvider(window.ethereum);
  };

  const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337); // 31337 anvil/hardhat
  const TARGET_CHAIN_ID_HEX = '0x' + TARGET_CHAIN_ID.toString(16);

  // Intenta cambiar a la red correcta; si no existe la agrega.
  const ensureNetwork = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.ethereum) return false;
    try {
      const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      if (parseInt(currentChainHex, 16) === TARGET_CHAIN_ID) return true;
      // Intentar switch primero
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: TARGET_CHAIN_ID_HEX }],
        });
        return true;
      } catch (switchErr: unknown) {
        // 4902 = chain no añadida
        if ((switchErr as { code?: number }).code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: TARGET_CHAIN_ID_HEX,
                  chainName: 'Anvil Local',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['http://127.0.0.1:8545'],
                  blockExplorerUrls: [],
                },
              ],
            });
            return true;
          } catch (addErr) {
            console.error('Error adding chain:', addErr);
            return false;
          }
        } else {
          console.warn('Chain switch rejected or failed:', switchErr);
          return false;
        }
      }
    } catch (e) {
      console.error('ensureNetwork unexpected error:', e);
      return false;
    }
  }, [TARGET_CHAIN_ID, TARGET_CHAIN_ID_HEX]);

  const applyConnection = useCallback(async (browserProvider: BrowserProvider, accounts: string[]) => {
    if (!accounts.length) {
      disconnect();
      return;
    }
    const signer = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();
    setProvider(browserProvider);
    setSigner(signer);
    setAddress(accounts[0]);
    setChainId(Number(network.chainId));
  }, []);

  const connect = async () => {
    const browserProvider = initProvider();
    if (!browserProvider) {
      alert('Please install MetaMask!');
      return;
    }
    try {
      setIsConnecting(true);
      // Forzar red correcta antes de pedir cuentas (si falla, igual pedimos cuentas para mostrar mismatch)
      await ensureNetwork();
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      await applyConnection(browserProvider, accounts);
      // Revalidar red tras conexión (por si usuario rechazó switch inicial y acepta después)
      const net = await browserProvider.getNetwork();
      if (Number(net.chainId) !== TARGET_CHAIN_ID) {
        console.warn(`Conectado a chainId ${net.chainId} pero se esperaba ${TARGET_CHAIN_ID}. Algunas lecturas pueden ignorarse.`);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const reconnect = async () => {
    const browserProvider = initProvider();
    if (!browserProvider) return;
    try {
      setIsConnecting(true);
      // Re-pedir permisos (puede no mostrar modal si ya dado).
      await window.ethereum?.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      await ensureNetwork();
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      await applyConnection(browserProvider, accounts);
    } catch (e) {
      console.error('Reconnect failed:', e);
    } finally {
      setIsConnecting(false);
    }
  };

  const refreshAccounts = async () => {
    const browserProvider = initProvider();
    if (!browserProvider) return;
    try {
      const accounts = await browserProvider.send('eth_accounts', []);
      if (accounts[0] !== address) {
        await applyConnection(browserProvider, accounts);
      }
    } catch (e) {
      console.error('Refresh accounts failed:', e);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setChainId(null);
  };

  // Auto-conexión inicial (solo una vez)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts.length) {
        disconnect();
      } else {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
      // Evitar reload completo; si necesitas resetear caches hazlo aquí.
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [ensureNetwork]);

  useEffect(() => {
    const autoConnect = async () => {
      const browserProvider = initProvider();
      if (!browserProvider) return;
      try {
        // Intentar forzar red silenciosamente; si falla no bloquea autoconnect
        await ensureNetwork();
        const accounts = await browserProvider.send('eth_accounts', []);
        if (accounts.length > 0) {
          await applyConnection(browserProvider, accounts);
          const net = await browserProvider.getNetwork();
          if (Number(net.chainId) !== TARGET_CHAIN_ID) {
            console.warn(`AutoConnect: chainId ${net.chainId} diferente a esperado ${TARGET_CHAIN_ID}`);
          }
        }
      } catch (error) {
        console.error('Auto-connect failed:', error);
      }
    };
    autoConnect();
  }, [applyConnection, ensureNetwork, TARGET_CHAIN_ID]);

  return (
    <WalletContext.Provider
      value={{
        address,
        signer,
        provider,
        isConnected: !!address,
        isConnecting,
        chainId,
        connect,
        disconnect,
        reconnect,
        refreshAccounts,
        ensureNetwork,
      }}
    >
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
    ethereum?: EthereumProvider;
  }
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on(event: 'accountsChanged', callback: (accounts: string[]) => void): void;
  on(event: 'chainChanged', callback: (chainIdHex: string) => void): void;
  removeListener(event: 'accountsChanged', callback: (accounts: string[]) => void): void;
  removeListener(event: 'chainChanged', callback: (chainIdHex: string) => void): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  removeListener(event: string, callback: (...args: unknown[]) => void): void;
}