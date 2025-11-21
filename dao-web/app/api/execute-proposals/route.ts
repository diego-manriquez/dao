import { NextResponse } from 'next/server';
import { Contract, Wallet, JsonRpcProvider } from 'ethers';
import { DAOVotingABI } from '@/lib/contracts/DAOVotingABI';

const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS!;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

export async function POST() {
  try {
    // Setup provider and signer
    const provider = new JsonRpcProvider(RPC_URL);
    const executor = new Wallet(RELAYER_PRIVATE_KEY, provider);
    
    // Create DAO contract instance
    const dao = new Contract(DAO_ADDRESS, DAOVotingABI, executor);

    // Get total number of proposals
    const proposalCount = await dao.proposalCount();
    const executed: { id: number; txHash: string }[] = [];
    const errors: { id: number; error: string }[] = [];

    // Check each proposal
    for (let i = 1; i <= proposalCount; i++) {
      try {
        const proposal = await dao.proposals(i);
        const now = Math.floor(Date.now() / 1000);

        // Check if proposal can be executed
        if (
          !proposal.executed &&
          now > proposal.votingDeadline &&
          now >= proposal.executionDelay &&
          proposal.forVotes > proposal.againstVotes
        ) {
          console.log(`Executing proposal ${i}...`);
          const tx = await dao.executeProposal(i);
          const receipt = await tx.wait();
          
          executed.push({
            id: i,
            txHash: receipt.hash,
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error executing proposal ${i}:`, errorMessage);
        errors.push({
          id: i,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalProposals: Number(proposalCount),
      executed: executed.length,
      executedProposals: executed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: unknown) {
    console.error('Execute proposals error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to execute proposals', details: errorMessage },
      { status: 500 }
    );
  }
}

// Allow GET requests to check status
export async function GET() {
  try {
    const provider = new JsonRpcProvider(RPC_URL);
    const dao = new Contract(DAO_ADDRESS, DAOVotingABI, provider);
    
    const proposalCount = await dao.proposalCount();
    const executable: number[] = [];

    for (let i = 1; i <= proposalCount; i++) {
      const proposal = await dao.proposals(i);
      const now = Math.floor(Date.now() / 1000);

      if (
        !proposal.executed &&
        now > proposal.votingDeadline &&
        now >= proposal.executionDelay &&
        proposal.forVotes > proposal.againstVotes
      ) {
        executable.push(i);
      }
    }

    return NextResponse.json({
      totalProposals: Number(proposalCount),
      executableProposals: executable,
      count: executable.length,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to check proposals', details: errorMessage },
      { status: 500 }
    );
  }
}
