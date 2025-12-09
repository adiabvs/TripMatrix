'use client';

import { useState } from 'react';
import type { TripExpense, TripParticipant } from '@tripmatrix/types';

interface ExpenseFormProps {
  tripId: string;
  participants: TripParticipant[];
  onSubmit: (expense: Partial<TripExpense>) => Promise<void>;
  onCancel: () => void;
  placeId?: string;
}

export default function ExpenseForm({
  tripId,
  participants,
  onSubmit,
  onCancel,
  placeId,
}: ExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitBetween, setSplitBetween] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const participantOptions = participants.map((p) => ({
    id: p.uid || p.guestName || '',
    label: p.isGuest ? p.guestName : `User ${p.uid?.substring(0, 8)}`,
  }));

  const toggleParticipant = (id: string) => {
    const newSet = new Set(splitBetween);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSplitBetween(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !paidBy || splitBetween.size === 0) {
      alert('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        tripId,
        amount: parseFloat(amount),
        paidBy,
        splitBetween: Array.from(splitBetween),
        description: description || undefined,
        placeId: placeId || undefined,
      });
      // Reset form
      setAmount('');
      setPaidBy('');
      setSplitBetween(new Set());
      setDescription('');
    } catch (error) {
      console.error('Failed to create expense:', error);
      alert('Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Add Expense</h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount ($) *
        </label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paid By *
        </label>
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Select person</option>
          {participantOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Split Between *
        </label>
        <div className="space-y-2">
          {participantOptions.map((p) => (
            <label key={p.id} className="flex items-center">
              <input
                type="checkbox"
                checked={splitBetween.has(p.id)}
                onChange={() => toggleParticipant(p.id)}
                className="mr-2"
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="What was this expense for?"
        />
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add Expense'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

