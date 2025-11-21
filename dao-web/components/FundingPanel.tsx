'use client';

import { useDAO } from '@/lib/useDAO';
import { useState } from 'react';

export default function FundingPanel() {
  const { userBalance, totalDeposited, fundDAO, loading } = useDAO();
  const [amount, setAmount] = useState('');

  const handleFund = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    const success = await fundDAO(amount);
    if (success) {
      setAmount('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">DAO Funding</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-sm text-gray-600">Your Balance</div>
          <div className="text-2xl font-bold text-blue-600">{userBalance} ETH</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-sm text-gray-600">Total DAO Funds</div>
          <div className="text-2xl font-bold text-green-600">{totalDeposited} ETH</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount to Fund (ETH)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-400 bg-white"
          />
        </div>
        
        <button
          onClick={handleFund}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Processing...' : 'Fund DAO'}
        </button>
      </div>
    </div>
  );
}
