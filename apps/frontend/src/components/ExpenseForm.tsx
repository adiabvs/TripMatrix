'use client';

import { useState, useEffect } from 'react';
import type { TripExpense, TripParticipant } from '@tripmatrix/types';
import { getCurrencyFromCountry, commonCurrencies, formatCurrency } from '@/lib/currencyUtils';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ExpenseFormProps {
  tripId: string;
  participants: TripParticipant[];
  onSubmit: (expense: Partial<TripExpense>) => Promise<void>;
  onCancel: () => void;
  placeId?: string;
  placeCountry?: string; // Country code for currency detection
}

export default function ExpenseForm({
  tripId,
  participants,
  onSubmit,
  onCancel,
  placeId,
  placeCountry,
}: ExpenseFormProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paidBy, setPaidBy] = useState('');
  const [splitMode, setSplitMode] = useState<'equal' | 'everyone' | 'people'>('equal');
  const [splitBetween, setSplitBetween] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Determine default currency and place currency
  const defaultCurrency = user?.defaultCurrency || (user?.country ? getCurrencyFromCountry(user.country) : 'USD');
  const placeCurrency = placeCountry ? getCurrencyFromCountry(placeCountry) : null;
  
  useEffect(() => {
    // Set initial currency to user's default
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  // Update splitBetween when splitMode changes
  useEffect(() => {
    if (splitMode === 'everyone') {
      // Include all participants (fixed, cannot be modified)
      const allIds = participants.map(p => p.uid || p.guestName || '').filter(Boolean);
      setSplitBetween(new Set(allIds));
    } else if (splitMode === 'equal') {
      // Start with all selected, but user can modify
      const allIds = participants.map(p => p.uid || p.guestName || '').filter(Boolean);
      setSplitBetween(new Set(allIds));
    }
    // 'people' mode: user manually selects (starts empty)
  }, [splitMode, participants]);

  const [userMap, setUserMap] = useState<Record<string, { name: string; email: string }>>({});

  // Fetch user data for participants with UIDs
  useEffect(() => {
    const fetchUserData = async () => {
      const userIds = participants
        .filter(p => !p.isGuest && p.uid)
        .map(p => p.uid!);
      
      if (userIds.length === 0) return;

      const userDataPromises = userIds.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return { uid, name: userData.name || 'Unknown', email: userData.email || '' };
          }
        } catch (error) {
          console.error(`Failed to fetch user ${uid}:`, error);
        }
        return null;
      });

      const results = await Promise.all(userDataPromises);
      const newUserMap: Record<string, { name: string; email: string }> = {};
      results.forEach(result => {
        if (result) {
          newUserMap[result.uid] = { name: result.name, email: result.email };
        }
      });
      setUserMap(newUserMap);
    };

    fetchUserData();
  }, [participants]);

  const participantOptions = participants.map((p) => ({
    id: p.uid || p.guestName || '',
    label: p.isGuest 
      ? (p.guestName || 'Guest')
      : (p.uid && userMap[p.uid]
          ? userMap[p.uid].name
          : (p.uid ? `User ${p.uid.substring(0, 8)}...` : 'Unknown')),
    isGuest: p.isGuest,
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
        currency,
        paidBy,
        splitBetween: Array.from(splitBetween),
        description: description || undefined,
        placeId: placeId || undefined,
      });
      // Reset form
      setAmount('');
      setCurrency(defaultCurrency);
      setPaidBy('');
      setSplitMode('equal');
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
          Currency *
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
          required
        >
          {/* Option 1: Default Currency (always first, selected by default) */}
          <option value={defaultCurrency}>
            Default: {defaultCurrency} - {commonCurrencies.find(c => c.code === defaultCurrency)?.name || defaultCurrency}
          </option>
          
          {/* Option 2: Step Location Currency (only if different from default, shown second) */}
          {placeCurrency && placeCurrency !== defaultCurrency && (
            <option value={placeCurrency}>
              Step Location: {placeCurrency} - {commonCurrencies.find(c => c.code === placeCurrency)?.name || placeCurrency}
            </option>
          )}
          
          {/* Option 3: All other currencies */}
          {commonCurrencies
            .filter((curr) => curr.code !== defaultCurrency && curr.code !== placeCurrency)
            .map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.code} - {curr.name} ({curr.symbol})
              </option>
            ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount *
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">{formatCurrency(0, currency).replace('0.00', '')}</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
            required
          />
        </div>
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
          Split Mode *
        </label>
        <div className="space-y-2 mb-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="splitMode"
              value="equal"
              checked={splitMode === 'equal'}
              onChange={() => setSplitMode('equal')}
              className="mr-2"
            />
            <span>Equal - Select people to split with</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="splitMode"
              value="everyone"
              checked={splitMode === 'everyone'}
              onChange={() => setSplitMode('everyone')}
              className="mr-2"
            />
            <span>Everyone - All trip participants (fixed)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="splitMode"
              value="people"
              checked={splitMode === 'people'}
              onChange={() => setSplitMode('people')}
              className="mr-2"
            />
            <span>Select People - Choose specific people</span>
          </label>
        </div>
        
        {(splitMode === 'equal' || splitMode === 'people') && (
          <div className="space-y-2 border-t pt-3 mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {splitMode === 'equal' ? 'Select People to Split With (Equal Split)' : 'Select People to Split With *'}
            </label>
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
        )}
        
        {splitMode === 'everyone' && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              This expense will be split equally among all {participants.length} trip participants.
            </p>
          </div>
        )}
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

