'use client';

import { useDAO } from '@/lib/useDAO';
import ProposalCard from './ProposalCard';

export default function ProposalList() {
  const { proposals, proposalCount, loading, refetch } = useDAO();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Proposals ({proposalCount})
        </h2>
        <button
          onClick={refetch}
          disabled={loading}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No proposals yet</p>
          <p className="text-sm mt-2">Create the first proposal to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}
    </div>
  );
}
