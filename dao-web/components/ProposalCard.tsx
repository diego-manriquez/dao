'use client';

import { type Proposal, VoteType } from '@/lib/useDAO';
import { useState, useEffect } from 'react';

interface ProposalCardProps {
  proposal: Proposal;
  vote: (proposalId: number, voteType: VoteType) => Promise<string> | Promise<void>;
  voteGasless: (proposalId: number, voteType: VoteType) => Promise<string> | Promise<void>;
  executeProposal: (proposalId: number) => Promise<string> | Promise<void>;
  loading: boolean;
}

export default function ProposalCard({ proposal, vote, voteGasless, executeProposal, loading }: ProposalCardProps) {
  const [useGasless, setUseGasless] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  // Update 'now' every 15s so status badges refresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleVote = async (support: boolean) => {
    const voteType = support ? VoteType.FOR : VoteType.AGAINST;
    if (useGasless) {
      await voteGasless(proposal.id, voteType);
    } else {
      await vote(proposal.id, voteType);
    }
  };

  const handleExecute = async () => {
    await executeProposal(proposal.id);
  };

  const getStatusBadge = () => {
    const votingEnded = now > proposal.votingDeadline;
    const canExecute = votingEnded && now >= proposal.executionDelay && !proposal.executed;
    
    if (proposal.executed) {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Executed</span>;
    }
    if (votingEnded && !canExecute) {
      return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">Voting Ended</span>;
    }
    if (canExecute) {
      return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Ready to Execute</span>;
    }
    return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Active</span>;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const votingActive = now <= proposal.votingDeadline && !proposal.executed;
  const canExecute = now > proposal.votingDeadline && now >= proposal.executionDelay && !proposal.executed;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">Proposal #{proposal.id}</h3>
        {getStatusBadge()}
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <span className="text-sm text-gray-600">Recipient:</span>
          <div className="font-mono text-sm break-all">{proposal.recipient}</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">Amount:</span>
            <div className="text-lg font-semibold">{proposal.amount} ETH</div>
          </div>
          <div>
            <span className="text-sm text-gray-600">Description:</span>
            <div className="text-sm">{proposal.description || 'No description'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">Voting Deadline:</span>
            <div className="text-sm">{formatDate(proposal.votingDeadline)}</div>
          </div>
          <div>
            <span className="text-sm text-gray-600">Execution Time:</span>
            <div className="text-sm">{formatDate(proposal.executionDelay)}</div>
          </div>
        </div>

        <div>
          <span className="text-sm text-gray-600 mb-2 block">Votes:</span>
          <div className="flex gap-4 items-center">
            <span className="text-green-600 font-semibold">✓ For: {proposal.forVotes}</span>
            <span className="text-red-600 font-semibold">✗ Against: {proposal.againstVotes}</span>
            <span className="text-gray-600 font-semibold">○ Abstain: {proposal.abstainVotes}</span>
          </div>
        </div>
      </div>

      {votingActive && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id={`gasless-${proposal.id}`}
              checked={useGasless}
              onChange={(e) => setUseGasless(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor={`gasless-${proposal.id}`} className="text-sm text-gray-700">
              Use Gasless Vote (Meta-Transaction)
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleVote(true)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Vote For
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Vote Against
            </button>
          </div>
        </div>
      )}

      {canExecute && (
        <div className="border-t pt-4 mt-4">
          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Execute Proposal
          </button>
        </div>
      )}
    </div>
  );
}
