'use client';

import ConnectWallet from '@/components/ConnectWallet';
import FundingPanel from '@/components/FundingPanel';
import CreateProposal from '@/components/CreateProposal';
import ProposalList from '@/components/ProposalList';
import { useWallet } from '@/lib/wallet-context';

export default function Home() {
  const { isConnected } = useWallet();

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">DAO Voting DApp</h1>
            <ConnectWallet />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <div className="bg-white rounded-lg shadow-lg p-12 max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-4">Welcome to DAO Voting</h2>
              <p className="text-gray-600 mb-6">
                Connect your MetaMask wallet to start participating in DAO governance
              </p>
              <ConnectWallet />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FundingPanel />
              <CreateProposal />
            </div>
            
            <ProposalList />
          </div>
        )}
      </main>

      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-600">
          <p>DAO Voting DApp with Meta-Transactions (EIP-2771)</p>
        </div>
      </footer>
    </div>
  );
}
