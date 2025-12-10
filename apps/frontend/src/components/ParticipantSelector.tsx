'use client';

import { useState, useEffect } from 'react';
import type { TripParticipant, User } from '@tripmatrix/types';
import { searchUsers } from '@/lib/api';

interface ParticipantSelectorProps {
  participants: TripParticipant[];
  onParticipantsChange: (participants: TripParticipant[]) => void;
  token: string | null;
}

export default function ParticipantSelector({
  participants,
  onParticipantsChange,
  token,
}: ParticipantSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (searchQuery.trim().length >= 2 && token) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, token]);

  const performSearch = async () => {
    if (!token) return;
    setIsSearching(true);
    try {
      const results = await searchUsers(searchQuery, token);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addUser = (user: User) => {
    const newParticipant: TripParticipant = {
      uid: user.uid,
      isGuest: false,
    };
    if (!participants.some((p) => p.uid === user.uid)) {
      onParticipantsChange([...participants, newParticipant]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const addGuest = () => {
    if (!guestName.trim()) {
      alert('Please enter a guest name');
      return;
    }
    const newParticipant: TripParticipant = {
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim() || undefined,
      isGuest: true,
    };
    if (!participants.some((p) => p.guestName === guestName.trim())) {
      onParticipantsChange([...participants, newParticipant]);
    }
    setGuestName('');
    setGuestEmail('');
    setShowGuestForm(false);
  };

  const removeParticipant = (index: number) => {
    const newParticipants = [...participants];
    newParticipants.splice(index, 1);
    onParticipantsChange(newParticipants);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Add People
      </label>

      {/* Search for users */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for users by name or email..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        {isSearching && (
          <div className="absolute right-3 top-2.5">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((user) => (
              <button
                key={user.uid}
                type="button"
                onClick={() => addUser(user)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
              >
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-600">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Guest Button */}
      {!showGuestForm && (
        <button
          type="button"
          onClick={() => setShowGuestForm(true)}
          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          + Add Guest
        </button>
      )}

      {/* Guest Form */}
      {showGuestForm && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Guest Name *
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter guest name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addGuest}
              className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Add Guest
            </button>
            <button
              type="button"
              onClick={() => {
                setShowGuestForm(false);
                setGuestName('');
                setGuestEmail('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Participants List */}
      {participants.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Participants:</p>
          {participants.map((participant, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs font-semibold text-gray-600">
                    {participant.isGuest
                      ? participant.guestName?.charAt(0).toUpperCase() || 'G'
                      : 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {participant.isGuest
                      ? participant.guestName
                      : `User ${participant.uid?.substring(0, 8)}...`}
                  </p>
                  {participant.isGuest && participant.guestEmail && (
                    <p className="text-xs text-gray-500">{participant.guestEmail}</p>
                  )}
                  {participant.isGuest && (
                    <span className="text-xs text-gray-500">(Guest)</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeParticipant(index)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

