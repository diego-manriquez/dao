import { Contract, ethers } from 'ethers';
import { DAOVotingABI } from './contracts/DAOVotingABI';
import { VoteType } from './useDAO';

const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS!;

// Minimal typed interface of the DAO contract functions we use
// (ethers v6 returns bigint for uint256 values)
// Narrowed interface using declaration merging pattern (not indexing contract internal map)
export type DAOVotingContract = Contract & {
  createProposal(recipient: string, amount: bigint, votingDuration: number): Promise<ethers.TransactionResponse>;
  createProposalWithDescription(recipient: string, amount: bigint, votingDuration: number, description: string): Promise<ethers.TransactionResponse>;
  vote(proposalId: number, voteType: VoteType): Promise<ethers.TransactionResponse>;
  fundDAO(overrides?: { value: bigint }): Promise<ethers.TransactionResponse>;
  executeProposal(proposalId: number): Promise<ethers.TransactionResponse>;
  getUserBalance(user: string): Promise<bigint>;
  getTotalDeposited(): Promise<bigint>;
  getBalance(): Promise<bigint>;
  proposalCount(): Promise<bigint>;
  getProposal(proposalId: number): Promise<{
    id: bigint;
    recipient: string;
    amount: bigint;
    votingDeadline: bigint;
    executionDelay: bigint;
    executed: boolean;
    forVotes: bigint;
    againstVotes: bigint;
    abstainVotes: bigint;
    description: string;
  }>;
  canExecute(proposalId: number): Promise<boolean>;
  getUserVote(proposalId: number, user: string): Promise<VoteType>;
};

export function getDAOContract(signerOrProvider: ethers.Signer | ethers.Provider): DAOVotingContract {
  return new Contract(DAO_ADDRESS, DAOVotingABI, signerOrProvider) as DAOVotingContract;
}

/** Create a proposal (gas-paying) */
export async function createProposalDirect(
  signer: ethers.Signer,
  recipient: string,
  amount: bigint,
  votingDuration: number,
  description?: string
) {
  const dao = getDAOContract(signer);
  const tx = description && description.length > 0
    ? await dao.createProposalWithDescription(recipient, amount, votingDuration, description)
    : await dao.createProposal(recipient, amount, votingDuration);
  return tx.wait();
}

/** Vote on a proposal (gas-paying) */
export async function voteDirect(
  signer: ethers.Signer,
  proposalId: number,
  voteType: VoteType
) {
  const dao = getDAOContract(signer);
  const tx = await dao.vote(proposalId, voteType);
  return tx.wait();
}

/** Deposit ETH to DAO (gas-paying) */
export async function fundDAODirect(
  signer: ethers.Signer,
  amount: bigint
) {
  const dao = getDAOContract(signer);
  const tx = await dao.fundDAO({ value: amount });
  return tx.wait();
}

/** Execute approved proposal */
export async function executeProposalDirect(
  signer: ethers.Signer,
  proposalId: number
) {
  const dao = getDAOContract(signer);
  const tx = await dao.executeProposal(proposalId);
  return tx.wait();
}

/** Get user's balance in DAO */
export async function getUserBalance(
  signerOrProvider: ethers.Signer | ethers.Provider,
  userAddress: string
): Promise<bigint> {
  const dao = getDAOContract(signerOrProvider);
  return dao.getUserBalance(userAddress);
}

/** Get total deposited in DAO */
export async function getTotalDeposited(
  signerOrProvider: ethers.Signer | ethers.Provider
): Promise<bigint> {
  const dao = getDAOContract(signerOrProvider);
  return dao.getTotalDeposited();
}

/** Get DAO balance (same as totalDeposited) */
export async function getDAOBalance(
  signerOrProvider: ethers.Signer | ethers.Provider
): Promise<bigint> {
  const dao = getDAOContract(signerOrProvider);
  return dao.getBalance();
}

/** Get number of proposals */
export async function getProposalCount(
  signerOrProvider: ethers.Signer | ethers.Provider
): Promise<bigint> {
  const dao = getDAOContract(signerOrProvider);
  return dao.proposalCount();
}

/** Get proposal details */
export async function getProposal(
  signerOrProvider: ethers.Signer | ethers.Provider,
  proposalId: number
) {
  const dao = getDAOContract(signerOrProvider);
  return dao.getProposal(proposalId);
}

/** Check if proposal can be executed */
export async function canExecuteProposal(
  signerOrProvider: ethers.Signer | ethers.Provider,
  proposalId: number
): Promise<boolean> {
  const dao = getDAOContract(signerOrProvider);
  return dao.canExecute(proposalId);
}

/** Get user's vote */
export async function getUserVote(
  signerOrProvider: ethers.Signer | ethers.Provider,
  proposalId: number,
  userAddress: string
): Promise<VoteType> {
  const dao = getDAOContract(signerOrProvider);
  return dao.getUserVote(proposalId, userAddress);
}
