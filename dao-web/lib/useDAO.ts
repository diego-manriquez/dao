'use client';

import { Contract, formatEther, parseEther } from 'ethers';
import { useWallet } from './wallet-context';
import { useState, useEffect, useCallback } from 'react';
import { DAOVotingABI } from './contracts/DAOVotingABI';
import { MinimalForwarderABI } from './contracts/MinimalForwarderABI';

const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS!;
const FORWARDER_ADDRESS = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS!;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);

export enum VoteType {
  ABSTAIN = 0,
  FOR = 1,
  AGAINST = 2,
}

export interface Proposal {
  id: number;
  recipient: string;
  amount: string;
  votingDeadline: number;
  executionDelay: number;
  executed: boolean;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  description: string;
}

export function useDAO() {
  const { signer, provider, address, isConnected } = useWallet();
  const [daoContract, setDaoContract] = useState<Contract | null>(null);
  const [forwarderContract, setForwarderContract] = useState<Contract | null>(null);
  const [userBalance, setUserBalance] = useState('0');
  const [totalDeposited, setTotalDeposited] = useState('0');
  const [proposalCount, setProposalCount] = useState(0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletEthBalance, setWalletEthBalance] = useState('0');

  // Initialize contracts
  useEffect(() => {
    if (signer) {
      const dao = new Contract(DAO_ADDRESS, DAOVotingABI, signer);
      const forwarder = new Contract(FORWARDER_ADDRESS, MinimalForwarderABI, signer);
      setDaoContract(dao);
      setForwarderContract(forwarder);
    } else if (provider) {
      const dao = new Contract(DAO_ADDRESS, DAOVotingABI, provider);
      const forwarder = new Contract(FORWARDER_ADDRESS, MinimalForwarderABI, provider);
      setDaoContract(dao);
      setForwarderContract(forwarder);
    }
  }, [signer, provider]);

  // Fetch user balance
  const fetchUserBalance = useCallback(async () => {
    if (!daoContract || !address) return;
    try {
      // Chain verification (optional, warns if mismatch)
      const network = await daoContract.runner?.provider?.getNetwork().catch(() => undefined);
      if (network && network.chainId !== BigInt(CHAIN_ID)) {
        console.warn(`Chain mismatch: expected ${CHAIN_ID} got ${network.chainId}. Skipping user balance fetch.`);
        return;
      }
      // Prefer explicit getter; fallback to public mapping accessor balances(address)
      let raw: bigint;
      const getUserBalanceFn = (daoContract as unknown as { getUserBalance?: (addr: string) => Promise<bigint> }).getUserBalance;
      if (typeof getUserBalanceFn === 'function') {
        raw = await getUserBalanceFn(address);
      } else {
        const balancesFn = (daoContract as unknown as { balances?: (addr: string) => Promise<bigint> }).balances;
        if (typeof balancesFn === 'function') {
          raw = await balancesFn(address);
        } else {
          console.warn('No method to read user balance (getUserBalance / balances) found on DAO contract');
          return;
        }
      }
      setUserBalance(formatEther(raw));
    } catch (error) {
      console.error('Error fetching user balance:', error);
    }
  }, [daoContract, address]);

  // Fetch total deposited
  const fetchTotalDeposited = useCallback(async () => {
    if (!daoContract) return;
    try {
      // Validate chain matches expected
      const network = await daoContract.runner?.provider?.getNetwork().catch(() => undefined);
      if (network && network.chainId !== BigInt(CHAIN_ID)) {
        console.warn(`Chain mismatch: expected ${CHAIN_ID} got ${network.chainId}. Skipping totalDeposited fetch.`);
        return;
      }
      // Prefer explicit getter, fallback to public variable accessor
      let total: bigint;
      const getter = (daoContract as unknown as { getTotalDeposited?: () => Promise<bigint> }).getTotalDeposited;
      if (typeof getter === 'function') {
        total = await getter();
      } else {
        const publicVar = (daoContract as unknown as { totalDeposited?: () => Promise<bigint> }).totalDeposited;
        if (typeof publicVar === 'function') {
          total = await publicVar();
        } else {
          console.warn('No method to read totalDeposited found');
          return;
        }
      }
      setTotalDeposited(formatEther(total));
    } catch (error) {
      console.error('Error fetching total deposited:', error);
    }
  }, [daoContract]);

  // Fetch native wallet balance
  const fetchWalletBalance = useCallback(async () => {
    if (!provider || !address) return;
    try {
      const bal = await provider.getBalance(address);
      setWalletEthBalance(formatEther(bal));
    } catch (e) {
      console.error('Error fetching wallet balance:', e);
    }
  }, [provider, address]);

  // Fetch proposal count
  const fetchProposalCount = useCallback(async () => {
    if (!daoContract) return;
    // Defensive: ensure function exists in ABI
    // Access dynamically, ethers Contract typing is reflective
    const fn = (daoContract as unknown as { proposalCount?: () => Promise<bigint> }).proposalCount;
    if (typeof fn !== 'function') {
      console.warn('proposalCount() not found on contract instance');
      return;
    }
    try {
      // Optional: verify network before calling
      const network = await daoContract.runner?.provider?.getNetwork().catch(() => undefined);
      if (network && network.chainId !== BigInt(CHAIN_ID)) {
        console.warn(`Chain mismatch: expected ${CHAIN_ID} got ${network.chainId}. Skipping proposalCount fetch.`);
        return;
      }
      const count: bigint = await fn();
      // Avoid unsafe Number conversion for very large counts
      const numeric = count > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(count);
      setProposalCount(numeric);
    } catch (error) {
      console.error('Error fetching proposal count:', error);
    }
  }, [daoContract]);

  // Fetch all proposals
  const fetchProposals = useCallback(async () => {
    if (!daoContract || proposalCount === 0) return;
    try {
      const proposalsArray: Proposal[] = [];
      for (let i = 1; i <= proposalCount; i++) {
        const proposal = await daoContract.getProposal(i);
        proposalsArray.push({
          id: Number(proposal.id),
          recipient: proposal.recipient,
          amount: formatEther(proposal.amount),
          votingDeadline: Number(proposal.votingDeadline),
          executionDelay: Number(proposal.executionDelay),
          executed: proposal.executed,
          forVotes: Number(proposal.forVotes),
          againstVotes: Number(proposal.againstVotes),
          abstainVotes: Number(proposal.abstainVotes),
          description: proposal.description,
        });
      }
      setProposals(proposalsArray);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    }
  }, [daoContract, proposalCount]);

  // Fund DAO
  const fundDAO = async (amount: string) => {
    if (!daoContract || !signer) throw new Error('Contract or signer not initialized');
    setLoading(true);
    try {
      const tx = await daoContract.fundDAO({ value: parseEther(amount) });
      await tx.wait();
      await fetchUserBalance();
      await fetchTotalDeposited();
      return tx.hash;
    } catch (error) {
      console.error('Error funding DAO:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Create proposal
  const createProposal = async (recipient: string, amount: string, durationDays: number) => {
    if (!daoContract || !signer) throw new Error('Contract or signer not initialized');
    setLoading(true);
    try {
      const durationSeconds = durationDays * 24 * 60 * 60;
      const tx = await daoContract.createProposal(
        recipient,
        parseEther(amount),
        durationSeconds
      );
      await tx.wait();
      await fetchProposalCount();
      await fetchProposals();
      return tx.hash;
    } catch (error) {
      console.error('Error creating proposal:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Vote (regular, with gas)
  const vote = async (proposalId: number, voteType: VoteType) => {
    if (!daoContract || !signer) throw new Error('Contract or signer not initialized');
    setLoading(true);
    try {
      const tx = await daoContract.vote(proposalId, voteType);
      await tx.wait();
      await fetchProposals();
      return tx.hash;
    } catch (error) {
      console.error('Error voting:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Vote gasless (with meta-transaction)
  const voteGasless = async (proposalId: number, voteType: VoteType) => {
    if (!signer || !address || !forwarderContract) throw new Error('Signer not initialized');
    
    setLoading(true);
    try {
      // Get nonce
      const nonce = await forwarderContract.getNonce(address);
      
      // Prepare vote data
      const voteData = daoContract!.interface.encodeFunctionData('vote', [proposalId, voteType]);
      
      // Create forward request
      const forwardRequest = {
        from: address,
        to: DAO_ADDRESS,
        value: 0,
        gas: 200000,
        nonce: Number(nonce),
        data: voteData,
      };
      
      // Resolve chainId directly from provider to avoid mismatch with env
      const network = await forwarderContract.runner?.provider?.getNetwork();
      const derivedChainId = network ? Number(network.chainId) : CHAIN_ID;
      if (derivedChainId !== CHAIN_ID) {
        console.warn(`Gasless vote: using network chainId ${derivedChainId} instead of env ${CHAIN_ID}`);
      }
      // Create EIP-712 typed data domain matching forwarder contract deployment
      const domain = {
        name: 'MinimalForwarder',
        version: '1',
        chainId: derivedChainId,
        verifyingContract: FORWARDER_ADDRESS,
      } as const;
      
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      };
      
      // Sign the request
      const signature = await signer.signTypedData(domain, types, forwardRequest);
      // Optional local verification to catch issues early
      try {
        const localValid = await forwarderContract.verify(forwardRequest, signature);
        if (!localValid) {
          console.warn('Local forwarder.verify returned false before relay submission');
        }
      } catch (verifyErr) {
        console.warn('Local verification threw error', verifyErr);
      }
      
      // Send to relayer
      const response = await fetch('/api/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: forwardRequest, signature }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`${error.error || 'Failed gasless vote'}${error.details ? ': ' + error.details : ''}`);
      }
      
      const result = await response.json();
      await fetchProposals();
      return result.txHash;
    } catch (error) {
      console.error('Error voting gasless:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Execute proposal
  const executeProposal = async (proposalId: number) => {
    if (!daoContract || !signer) throw new Error('Contract or signer not initialized');
    setLoading(true);
    try {
      const tx = await daoContract.executeProposal(proposalId);
      await tx.wait();
      await fetchProposals();
      await fetchTotalDeposited();
      return tx.hash;
    } catch (error) {
      console.error('Error executing proposal:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get user vote
  const getUserVote = async (proposalId: number): Promise<VoteType | null> => {
    if (!daoContract || !address) return null;
    try {
      const voteType = await daoContract.getUserVote(proposalId, address);
      return Number(voteType) as VoteType;
    } catch (error) {
      console.error('Error fetching user vote:', error);
      return null;
    }
  };

  // Check if proposal can be executed
  const canExecute = async (proposalId: number): Promise<boolean> => {
    if (!daoContract) return false;
    try {
      return await daoContract.canExecute(proposalId);
    } catch (error) {
      console.error('Error checking if proposal can be executed:', error);
      return false;
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (daoContract && isConnected) {
      fetchUserBalance();
      fetchTotalDeposited();
      fetchProposalCount();
    }
  }, [daoContract, isConnected, fetchUserBalance, fetchTotalDeposited, fetchProposalCount, fetchWalletBalance]);

  // Fetch proposals when count changes
  useEffect(() => {
    if (proposalCount > 0) {
      fetchProposals();
    }
  }, [proposalCount, fetchProposals]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (daoContract && isConnected) {
        fetchUserBalance();
        fetchTotalDeposited();
        fetchProposalCount();
        fetchWalletBalance();
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [daoContract, isConnected, fetchUserBalance, fetchTotalDeposited, fetchProposalCount]);

  // Listen to new blocks for near real-time updates (throttled)
  useEffect(() => {
    if (!provider || !isConnected) return;
    let lastUpdate = 0;
    const handler = async () => {
      const now = Date.now();
      if (now - lastUpdate < 5000) return; // throttle 5s
      lastUpdate = now;
      await fetchWalletBalance();
    };
    provider.on('block', handler);
    return () => {
      provider.off('block', handler);
    };
  }, [provider, isConnected, fetchWalletBalance]);

  // Contract event listeners for instant refresh
  useEffect(() => {
    if (!daoContract || !isConnected) return;

  const onFundsDeposited = async (from: string) => {
      if (address && from.toLowerCase() === address.toLowerCase()) {
        await fetchUserBalance();
      }
      await fetchTotalDeposited();
    };

  const onProposalCreated = async () => {
      await fetchProposalCount();
      await fetchProposals();
    };

  const onVoted = async () => {
      await fetchProposals();
    };

  const onProposalExecuted = async () => {
      await fetchProposals();
      await fetchTotalDeposited();
    };

    // Attach listeners (event names must match contract events; adjust if different)
    try {
      daoContract.on('FundsDeposited', onFundsDeposited);
      daoContract.on('ProposalCreated', onProposalCreated);
      daoContract.on('Voted', onVoted);
      daoContract.on('ProposalExecuted', onProposalExecuted);
    } catch (e) {
      console.warn('Failed attaching DAO event listeners (check event names).', e);
    }

    return () => {
      try {
        daoContract.off('FundsDeposited', onFundsDeposited);
        daoContract.off('ProposalCreated', onProposalCreated);
        daoContract.off('Voted', onVoted);
        daoContract.off('ProposalExecuted', onProposalExecuted);
      } catch {}
    };
  }, [daoContract, isConnected, address, fetchUserBalance, fetchTotalDeposited, fetchProposalCount, fetchProposals]);

  return {
    userBalance,
    totalDeposited,
    proposalCount,
    proposals,
    walletEthBalance,
    loading,
    fundDAO,
    createProposal,
    vote,
    voteGasless,
    executeProposal,
    getUserVote,
    canExecute,
    refetch: () => {
      fetchUserBalance();
      fetchTotalDeposited();
      fetchProposalCount();
    },
  };
}
