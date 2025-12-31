import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import type { Trip, User, TripComment } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdPerson, MdShare, MdContentCopy, MdCheck, MdChatBubbleOutline, MdSend, MdEdit, MdDelete, MdClose } from 'react-icons/md';
import TripStatusBadge from './TripStatusBadge';
import CountdownTimer from './CountdownTimer';
import TripParticipants from './TripParticipants';
import { getTripComments, addTripComment, updateTripComment, deleteTripComment, getUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import BottomModal from '@/components/ui/BottomModal';
import MentionAutocomplete from '@/components/MentionAutocomplete';

interface TripInfoCardProps {
  trip: Trip;
  creator: User | null;
  participants: User[];
  isUpcoming: boolean;
  placesCount?: number;
  canShare?: boolean; // Whether user has access to share this trip
  className?: string;
  onCommentClick?: () => void; // Callback when comment icon is clicked
  commentCount?: number; // Number of comments to display
  highlightCommentId?: string; // Comment ID to highlight and scroll to
}

export default function TripInfoCard({ 
  trip, 
  creator, 
  participants, 
  isUpcoming, 
  placesCount = 0,
  canShare = false,
  className = '',
  onCommentClick,
  commentCount = 0,
  highlightCommentId
}: TripInfoCardProps) {
  const { user, getIdToken } = useAuth();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<TripComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentUserNamesMap, setCommentUserNamesMap] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [longPressCommentId, setLongPressCommentId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressPosition, setLongPressPosition] = useState<{ x: number; y: number } | null>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const highlightedCommentRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareMenu]);

  const getTripUrl = () => {
    if (typeof window === 'undefined') return '';
    return trip.isPublic 
      ? `${window.location.origin}/trip/${trip.tripId}`
      : `${window.location.origin}/trips/${trip.tripId}`;
  };

  const handleWhatsAppShare = () => {
    if (typeof window === 'undefined') return;
    
    const tripUrl = getTripUrl();
    const shareText = `Check out this trip: ${trip.title}${trip.description ? ` - ${trip.description}` : ''}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${tripUrl}`)}`;
    
    window.open(whatsappUrl, '_blank');
    setShowShareMenu(false);
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    
    const tripUrl = getTripUrl();
    
    try {
      await navigator.clipboard.writeText(tripUrl);
      setLinkCopied(true);
      setShowShareMenu(false);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = tripUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setLinkCopied(true);
        setShowShareMenu(false);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const token = user ? await getIdToken() : null;
      const commentsData = await getTripComments(trip.tripId, token);
      setComments(commentsData);

      // Load user names for comment authors
      const uniqueUserIds = [...new Set(commentsData.map((c: TripComment) => c.userId))];
      const userNames: Record<string, string> = {};
      for (const uid of uniqueUserIds) {
        try {
          const userData = await getUser(uid, token);
          userNames[uid] = userData.name || 'Unknown User';
        } catch (error) {
          console.error(`Failed to fetch user ${uid}:`, error);
          userNames[uid] = 'Unknown User';
        }
      }
      setCommentUserNamesMap(userNames);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentClick = () => {
    const newShowComments = !showComments;
    setShowComments(newShowComments);
    if (newShowComments && comments.length === 0) {
      loadComments();
    }
    if (onCommentClick) {
      onCommentClick();
    }
  };

  // Handle highlighting comment from URL
  useEffect(() => {
    if (highlightCommentId && !showComments) {
      setShowComments(true);
      loadComments();
    }
  }, [highlightCommentId]);

  // Scroll to highlighted comment when comments are loaded
  useEffect(() => {
    if (highlightCommentId && showComments && comments.length > 0 && highlightedCommentRef.current) {
      setTimeout(() => {
        highlightedCommentRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        // Add highlight effect
        highlightedCommentRef.current?.classList.add('ring-2', 'ring-blue-500', 'rounded-lg');
        setTimeout(() => {
          highlightedCommentRef.current?.classList.remove('ring-2', 'ring-blue-500');
        }, 3000);
      }, 300);
    }
  }, [highlightCommentId, showComments, comments]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    
    setAddingComment(true);
    try {
      const token = await getIdToken();
      const newComment = await addTripComment(trip.tripId, commentText.trim(), token);
      setComments([newComment, ...comments]);
      setCommentText('');
      
      // Load user name for the new comment
      if (user) {
        setCommentUserNamesMap(prev => ({
          ...prev,
          [user.uid]: user.name,
        }));
      }
      
      // Notify parent that a comment was added
      if (onCommentClick) {
        // Refresh comment count
        setTimeout(() => {
          if (onCommentClick) onCommentClick();
        }, 100);
      }
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      alert(`Failed to add comment: ${error.message || 'Unknown error'}`);
    } finally {
      setAddingComment(false);
    }
  };

  const handleStartEdit = (comment: TripComment) => {
    setEditingCommentId(comment.commentId);
    setEditCommentText(comment.text);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editCommentText.trim() || !user) return;
    
    try {
      const token = await getIdToken();
      const updatedComment = await updateTripComment(trip.tripId, commentId, editCommentText.trim(), token);
      setComments(comments.map(c => c.commentId === commentId ? updatedComment : c));
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error: any) {
      console.error('Failed to update comment:', error);
      alert(`Failed to update comment: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user || !confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      setDeletingCommentId(commentId);
      setLongPressCommentId(null);
      const token = await getIdToken();
      await deleteTripComment(trip.tripId, commentId, token);
      setComments(comments.filter(c => c.commentId !== commentId));
      
      // Notify parent that a comment was deleted
      if (onCommentClick) {
        setTimeout(() => {
          if (onCommentClick) onCommentClick();
        }, 100);
      }
    } catch (error: any) {
      console.error('Failed to delete comment:', error);
      alert(`Failed to delete comment: ${error.message || 'Unknown error'}`);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleLongPressStart = (commentId: string, e: React.TouchEvent | React.MouseEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    
    const timer = setTimeout(() => {
      const touch = 'touches' in e ? e.touches[0] : null;
      const position = touch 
        ? { x: touch.clientX, y: touch.clientY }
        : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
      
      setLongPressCommentId(commentId);
      setLongPressPosition(position);
    }, 500); // 500ms for long press
    
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleCloseLongPressMenu = () => {
    setLongPressCommentId(null);
    setLongPressPosition(null);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
        {/* Instagram-style Header */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {creator?.photoUrl ? (
                <img
                  src={creator.photoUrl}
                  alt={creator.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <MdPerson className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <Link
                  href={`/users/${trip.creatorId}`}
                  className="text-white font-semibold text-sm hover:opacity-70"
                >
                  {creator?.name || 'Trip Creator'}
                </Link>
                <p className="text-gray-400 text-xs">
                  {format(toDate(trip.createdAt), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TripStatusBadge status={trip.status} isUpcoming={isUpcoming} />
              <button
                onClick={handleCommentClick}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors active:scale-95 relative"
                aria-label="View comments"
                title={`View comments (${commentCount})`}
              >
                <MdChatBubbleOutline className={`w-5 h-5 ${showComments ? 'text-[#1976d2]' : 'text-white'}`} />
                {commentCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#1976d2] text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                    {commentCount > 99 ? '99+' : commentCount}
                  </span>
                )}
              </button>
              {canShare && (
                <div className="relative" ref={shareMenuRef}>
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="p-2 hover:bg-gray-800 rounded-full transition-colors active:scale-95 relative"
                    aria-label="Share trip"
                    title="Share trip"
                  >
                    {linkCopied ? (
                      <MdCheck className="w-5 h-5 text-green-500" />
                    ) : (
                      <MdShare className="w-5 h-5 text-white" />
                    )}
                  </button>
                  
                  {showShareMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[180px]">
                      <button
                        onClick={handleWhatsAppShare}
                        className="w-full px-4 py-3 text-left text-white hover:bg-gray-800 active:scale-[0.98] active:bg-gray-700 flex items-center gap-3 transition-all first:rounded-t-lg"
                      >
                        <MdShare className="w-5 h-5" />
                        <span className="text-sm">Share on WhatsApp</span>
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="w-full px-4 py-3 text-left text-white hover:bg-gray-800 active:scale-[0.98] active:bg-gray-700 flex items-center gap-3 transition-all last:rounded-b-lg border-t border-gray-700"
                      >
                        <MdContentCopy className="w-5 h-5" />
                        <span className="text-sm">Copy Link</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-4 py-3">
          <h2 className="text-white font-semibold text-base mb-2">{trip.title}</h2>
          {trip.description && (
            <p className="text-gray-300 text-sm mb-4 whitespace-pre-wrap">{trip.description}</p>
          )}
          
          {/* Participants Section */}
          <TripParticipants 
            trip={trip} 
            creator={creator} 
            participants={participants}
            isUpcoming={isUpcoming}
            placesCount={placesCount}
            totalDistance={trip.totalDistance}
          />
        </div>
      </div>

      {/* Instagram-style Comments Modal */}
      <BottomModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        title={`Comments (${comments.length || commentCount})`}
        maxHeight="90vh"
      >
        {/* Comments List */}
        <div className="px-4 py-3">
          {loadingComments ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No comments yet</p>
          ) : (
            <div className="space-y-4 pb-4">
              {comments.map((comment) => {
                const isOwner = user && comment.userId === user.uid;
                const isEditing = editingCommentId === comment.commentId;
                const isDeleting = deletingCommentId === comment.commentId;

                const isHighlighted = highlightCommentId === comment.commentId;
                return (
                  <div 
                    key={comment.commentId} 
                    ref={isHighlighted ? highlightedCommentRef : null}
                    className={`flex items-start gap-3 relative ${isHighlighted ? 'bg-blue-900/20' : ''}`}
                    onTouchStart={(e) => isOwner && !isEditing && handleLongPressStart(comment.commentId, e)}
                    onTouchEnd={handleLongPressEnd}
                    onMouseDown={(e) => isOwner && !isEditing && handleLongPressStart(comment.commentId, e)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1976d2] flex items-center justify-center flex-shrink-0">
                      <span className="text-sm text-white font-semibold">
                        {commentUserNamesMap[comment.userId]?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">
                              {commentUserNamesMap[comment.userId] || 'Loading...'}
                            </span>
                            {!isEditing && (
                              <span 
                                className="text-sm text-gray-200"
                                dangerouslySetInnerHTML={{ 
                                  __html: comment.text.replace(/@([a-zA-Z0-9._-]+)/g, '<span class="text-blue-400 font-semibold">@$1</span>')
                                }}
                              />
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                className="w-full bg-gray-800 text-white rounded-lg p-2 text-sm resize-none border border-gray-700 focus:outline-none focus:border-[#1976d2]"
                                rows={3}
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(comment.commentId)}
                                  disabled={!editCommentText.trim()}
                                  className="bg-[#1976d2] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#1565c0] transition-colors flex items-center gap-1"
                                >
                                  <MdCheck className="w-4 h-4" />
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors flex items-center gap-1"
                                >
                                  <MdClose className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        {format(toDate(comment.createdAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    
                    {/* Long Press Menu */}
                    {isOwner && !isEditing && longPressCommentId === comment.commentId && longPressPosition && (
                      <div 
                        className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
                        style={{
                          top: `${longPressPosition.y + 10}px`,
                          left: `${longPressPosition.x}px`,
                          transform: 'translateX(-50%)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            handleStartEdit(comment);
                            handleCloseLongPressMenu();
                          }}
                          className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 flex items-center gap-2 transition-colors"
                        >
                          <MdEdit className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            handleDelete(comment.commentId);
                            handleCloseLongPressMenu();
                          }}
                          disabled={isDeleting}
                          className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 transition-colors disabled:opacity-50 border-t border-gray-700"
                        >
                          <MdDelete className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Comment Input at Bottom (Instagram style) */}
        {user && (trip.isPublic || trip.creatorId === user.uid || trip.participants?.some(p => p.uid === user.uid)) && (
          <div className="sticky bottom-0 px-4 py-3 border-t border-gray-800 bg-black flex items-center gap-2 relative">
            <div className="w-10 h-10 rounded-full bg-[#1976d2] flex items-center justify-center flex-shrink-0">
              <span className="text-sm text-white font-semibold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <input
              ref={commentInputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              onKeyDown={(e) => {
                // Let MentionAutocomplete handle arrow keys and enter
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
                  return;
                }
              }}
              placeholder="Add a comment... (use @ to mention)"
              className="flex-1 bg-gray-900 text-white text-sm placeholder-gray-500 focus:outline-none px-4 py-2 rounded-full border border-gray-700 focus:border-[#1976d2]"
              disabled={addingComment}
            />
            <MentionAutocomplete
              text={commentText}
              onTextChange={setCommentText}
              inputRef={commentInputRef}
            />
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim() || addingComment}
              className="text-[#1976d2] hover:text-[#1565c0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-2"
              aria-label="Post comment"
            >
              {addingComment ? (
                <span className="text-xs">Posting...</span>
              ) : (
                <MdSend className="w-6 h-6" />
              )}
            </button>
          </div>
        )}
      </BottomModal>
    </div>
  );
}

