'use client';

import { useDAO } from '@/lib/useDAO';
import { useState } from 'react';

export default function CreateProposal() {
  const { createProposal, loading } = useDAO();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('7');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipient || !amount || parseFloat(amount) <= 0 || parseInt(durationDays) <= 0) {
      return;
    }

    const success = await createProposal(recipient, amount, parseInt(durationDays));
    
    if (success) {
      setRecipient('');
      setAmount('');
      setDurationDays('7');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Create New Proposal</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-400 bg-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount (ETH)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-400 bg-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration (Days)
          </label>
          <input
            type="number"
            min="1"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-400 bg-white"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Creating...' : 'Create Proposal'}
        </button>
      </form>
    </div>
  );
}
