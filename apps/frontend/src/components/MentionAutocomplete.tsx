'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@tripmatrix/types';
import { searchUsers } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface MentionAutocompleteProps {
  text: string;
  onTextChange: (text: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export default function MentionAutocomplete({
  text,
  onTextChange,
  textareaRef,
  inputRef,
}: MentionAutocompleteProps) {
  const { getIdToken } = useAuth();
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mentionsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleTextChange = () => {
      const input = textareaRef?.current || inputRef?.current;
      if (!input) return;

      const cursorPosition = input.selectionStart || 0;
      const textBeforeCursor = text.substring(0, cursorPosition);
      
      // Find the last @ symbol before cursor
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1) {
        // Check if there's a space after @ (which would mean it's not a mention)
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Check if there's a space or newline in the text after @
        const hasSpaceOrNewline = textAfterAt.includes(' ') || textAfterAt.includes('\n');
        
        if (!hasSpaceOrNewline) {
          const query = textAfterAt.trim();
          
          // Only update if query changed to avoid unnecessary re-renders
          if (query !== mentionQuery) {
            setMentionQuery(query);
            setShowMentions(true);
            setMentionIndex(-1);
            
            // Get position for dropdown using getBoundingClientRect for fixed positioning
            const inputRect = input.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const dropdownHeight = 256; // max-h-64 = 256px
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;
            
            // Prefer positioning below the input (more natural)
            // Only position above if there's less than 100px below AND significantly more space above
            const minSpaceBelow = 100; // Minimum space needed below
            const showAbove = spaceBelow < minSpaceBelow && spaceAbove > spaceBelow + 50;
            
            let top: number;
            if (showAbove) {
              // Position above the input, but ensure it doesn't go too far up
              top = Math.max(10, inputRect.top - dropdownHeight - 5);
            } else {
              // Position below the input (preferred)
              top = inputRect.bottom + 5;
            }
            
            // Ensure dropdown doesn't go off-screen vertically
            top = Math.max(10, Math.min(top, viewportHeight - Math.min(dropdownHeight, spaceBelow || 100) - 10));
            
            // Calculate left position, ensuring it doesn't go off-screen
            let left = inputRect.left;
            const dropdownWidth = 300; // maxWidth
            if (left + dropdownWidth > viewportWidth) {
              left = viewportWidth - dropdownWidth - 10;
            }
            left = Math.max(10, left);
            
            // For fixed positioning, use viewport coordinates (no scroll offset)
            setMentionPosition({
              top,
              left,
            });

            // Search for users
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }
            
            searchTimeoutRef.current = setTimeout(async () => {
              try {
                setLoadingUsers(true);
                const token = await getIdToken();
                const users = await searchUsers(query, token);
                // Show up to 10 results (more when no query, filtered when query exists)
                const limitedUsers = users.slice(0, 10);
                setMentionUsers(limitedUsers);
                // Ensure showMentions is still true when users are loaded
                // Double-check that we're still in mention context
                const currentInput = textareaRef?.current || inputRef?.current;
                if (currentInput) {
                  const currentCursor = currentInput.selectionStart || 0;
                  const currentTextBefore = text.substring(0, currentCursor);
                  const currentLastAt = currentTextBefore.lastIndexOf('@');
                  if (currentLastAt !== -1) {
                    const currentTextAfter = currentTextBefore.substring(currentLastAt + 1);
                    if (!currentTextAfter.includes(' ') && !currentTextAfter.includes('\n')) {
                      setShowMentions(true);
                      console.log('Mention users loaded:', limitedUsers.length);
                    } else {
                      setShowMentions(false);
                    }
                  } else {
                    setShowMentions(false);
                  }
                }
              } catch (error) {
                console.error('Failed to search users:', error);
                setMentionUsers([]);
              } finally {
                setLoadingUsers(false);
              }
            }, query.length === 0 ? 100 : 300); // Faster response when just @ is typed
          }
        } else {
          setShowMentions(false);
          setMentionUsers([]);
        }
      } else {
        setShowMentions(false);
        setMentionUsers([]);
      }
    };

    handleTextChange();
  }, [text, textareaRef, inputRef, getIdToken, mentionQuery]);

  const insertMention = useCallback((user: User) => {
    const input = textareaRef?.current || inputRef?.current;
    if (!input) return;

    const cursorPosition = input.selectionStart || 0;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const textAfterCursor = text.substring(cursorPosition);
    
    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Replace @query with @username
      const username = user.username || user.name.split(' ')[0] || user.email.split('@')[0];
      const newText = 
        textBeforeCursor.substring(0, lastAtIndex) + 
        `@${username} ` + 
        textAfterCursor;
      
      onTextChange(newText);
      setShowMentions(false);
      setMentionUsers([]);
      
      // Set cursor position after the inserted mention
      setTimeout(() => {
        const newPosition = lastAtIndex + username.length + 2; // +2 for @ and space
        input.setSelectionRange(newPosition, newPosition);
        input.focus();
      }, 0);
    }
  }, [text, textareaRef, inputRef, onTextChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentions || mentionUsers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => 
        prev < mentionUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && mentionIndex >= 0) {
      e.preventDefault();
      insertMention(mentionUsers[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  // Close mentions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionsRef.current && !mentionsRef.current.contains(event.target as Node)) {
        const input = textareaRef?.current || inputRef?.current;
        if (input && !input.contains(event.target as Node)) {
          setShowMentions(false);
        }
      }
    };

    if (showMentions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMentions, textareaRef, inputRef]);

  // Update position on scroll and handle keyboard events
  useEffect(() => {
    if (!showMentions) return;

    const input = textareaRef?.current || inputRef?.current;
    if (!input) return;

    const updatePosition = () => {
      const inputRect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = 256; // max-h-64 = 256px
      const spaceBelow = viewportHeight - inputRect.bottom;
      const spaceAbove = inputRect.top;
      
      // Prefer positioning below the input (more natural)
      // Only position above if there's less than 100px below AND significantly more space above
      const minSpaceBelow = 100; // Minimum space needed below
      const showAbove = spaceBelow < minSpaceBelow && spaceAbove > spaceBelow + 50;
      
      let top: number;
      if (showAbove) {
        // Position above the input, but ensure it doesn't go too far up
        top = Math.max(10, inputRect.top - dropdownHeight - 5);
      } else {
        // Position below the input (preferred)
        top = inputRect.bottom + 5;
      }
      
      // Ensure dropdown doesn't go off-screen vertically
      top = Math.max(10, Math.min(top, viewportHeight - Math.min(dropdownHeight, spaceBelow || 100) - 10));
      
      // Calculate left position, ensuring it doesn't go off-screen
      let left = inputRect.left;
      const dropdownWidth = 300; // maxWidth
      if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 10;
      }
      left = Math.max(10, left);
      
      // For fixed positioning, use viewport coordinates (no scroll offset)
      setMentionPosition({
        top,
        left,
      });
    };

    const handleKeyDownEvent = (e: Event) => {
      if (!showMentions) return;
      
      const keyboardEvent = e as KeyboardEvent;
      
      if (keyboardEvent.key === 'ArrowDown') {
        keyboardEvent.preventDefault();
        setMentionIndex(prev => {
          const currentUsers = mentionUsers;
          return prev < currentUsers.length - 1 ? prev + 1 : prev;
        });
      } else if (keyboardEvent.key === 'ArrowUp') {
        keyboardEvent.preventDefault();
        setMentionIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (keyboardEvent.key === 'Enter') {
        keyboardEvent.preventDefault();
        const currentIndex = mentionIndex;
        const currentUsers = mentionUsers;
        if (currentIndex >= 0 && currentIndex < currentUsers.length) {
          insertMention(currentUsers[currentIndex]);
        }
      } else if (keyboardEvent.key === 'Escape') {
        setShowMentions(false);
      }
    };

    // Update position on events (not continuously)
    updatePosition();
    
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    input.addEventListener('keydown', handleKeyDownEvent);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      input.removeEventListener('keydown', handleKeyDownEvent);
    };
  }, [showMentions, mentionUsers, mentionIndex, textareaRef, inputRef, insertMention]);

  // Show dropdown if we have users OR if we're loading (to show loading state)
  const shouldShow = showMentions && mounted && (mentionUsers.length > 0 || loadingUsers);
  
  if (!shouldShow) {
    return null;
  }

  // Ensure position is valid - recalculate if needed
  const input = textareaRef?.current || inputRef?.current;
  let validPosition = mentionPosition;
  let dynamicMaxHeight = 256; // Default max-h-64
  
  if (input) {
    // Always recalculate position to ensure it's correct (handles scroll, resize, etc.)
    const inputRect = input.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = 256; // max-h-64 = 256px
    const spaceBelow = viewportHeight - inputRect.bottom;
    const spaceAbove = inputRect.top;
    
    // Prefer positioning below the input (more natural)
    // Only position above if there's less than 100px below AND significantly more space above
    const minSpaceBelow = 100; // Minimum space needed below
    const showAbove = spaceBelow < minSpaceBelow && spaceAbove > spaceBelow + 50;
    
    let top: number;
    if (showAbove) {
      // Position above the input, but ensure it doesn't go too far up
      top = Math.max(10, inputRect.top - dropdownHeight - 5);
    } else {
      // Position below the input (preferred)
      top = inputRect.bottom + 5;
    }
    
    // Ensure dropdown doesn't go off-screen vertically
    top = Math.max(10, Math.min(top, viewportHeight - Math.min(dropdownHeight, spaceBelow || 100) - 10));
    
    // Calculate left position, ensuring it doesn't go off-screen
    let left = inputRect.left;
    const dropdownWidth = 300; // maxWidth
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 10;
    }
    left = Math.max(10, left);
    
    // For fixed positioning, use viewport coordinates (no scroll offset)
    validPosition = {
      top,
      left,
    };
    
    // Calculate dynamic max-height based on available space
    const availableSpace = showAbove ? spaceAbove - 10 : spaceBelow - 10;
    dynamicMaxHeight = Math.min(256, Math.max(100, availableSpace));
  }

  const dropdownContent = (
    <div
      ref={mentionsRef}
      className="fixed bg-gray-900 border-2 border-blue-500 rounded-lg shadow-2xl overflow-y-auto"
      style={{
        top: `${validPosition.top}px`,
        left: `${validPosition.left}px`,
        minWidth: '250px',
        maxWidth: '300px',
        maxHeight: `${dynamicMaxHeight}px`,
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        zIndex: 2147483647, // Maximum z-index value for iOS (same as BottomModal)
        position: 'fixed',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        isolation: 'isolate', // Create new stacking context
        willChange: 'transform', // Optimize for iOS
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
    >
      {loadingUsers ? (
        <div className="px-3 py-2 text-gray-400 text-sm">Loading users...</div>
      ) : mentionUsers.length === 0 ? (
        <div className="px-3 py-2 text-gray-400 text-sm">No users found</div>
      ) : (
        <>
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700">
            {mentionUsers.length} user{mentionUsers.length !== 1 ? 's' : ''} found
          </div>
          {mentionUsers.map((user, index) => {
          const username = user.username || user.name.split(' ')[0] || user.email.split('@')[0];
          return (
            <button
              key={user.uid}
              type="button"
              onClick={() => insertMention(user)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors ${
                index === mentionIndex ? 'bg-gray-800' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1976d2] flex items-center justify-center">
                    <span className="text-xs text-white font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.name}
                  </p>
                  {user.username && (
                    <p className="text-xs text-gray-400 truncate">@{user.username}</p>
                  )}
                  {!user.username && user.email && (
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        </>
      )}
    </div>
  );

  return createPortal(dropdownContent, document.body);
}

