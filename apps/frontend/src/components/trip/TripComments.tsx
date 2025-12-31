'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripComment, User } from '@tripmatrix/types';
import { getTripComments, addTripComment, updateTripComment, deleteTripComment, getUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MdComment, MdSend, MdEdit, MdDelete, MdClose, MdCheck } from 'react-icons/md';
import MentionAutocomplete from '@/components/MentionAutocomplete';

interface TripCommentsProps {
  tripId: string;
  tripIsPublic: boolean;
  canComment: boolean; // User has access to comment (logged in + has trip access)
  isOpen: boolean; // Whether comments section is open
  commentCount: number; // Comment count to display on icon
  onCommentAdded?: () => void; // Callback when a comment is added
}

export default function TripComments({ tripId, tripIsPublic, canComment, isOpen, commentCount, onCommentAdded }: TripCommentsProps) {
  const { user, getIdToken } = useAuth();
  const [comments, setComments] = useState<TripComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commentUserNamesMap, setCommentUserNamesMap] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [longPressCommentId, setLongPressCommentId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressPosition, setLongPressPosition] = useState<{ x: number; y: number } | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = async () => {
    try {
      setLoading(true);
      const token = user ? await getIdToken() : null;
      const commentsData = await getTripComments(tripId, token);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, isOpen]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    
    setAddingComment(true);
    try {
      const token = await getIdToken();
      const newComment = await addTripComment(tripId, commentText.trim(), token);
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
      if (onCommentAdded) {
        onCommentAdded();
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
      const updatedComment = await updateTripComment(tripId, commentId, editCommentText.trim(), token);
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
      await deleteTripComment(tripId, commentId, token);
      setComments(comments.filter(c => c.commentId !== commentId));
      
      // Notify parent that a comment was deleted
      if (onCommentAdded) {
        onCommentAdded();
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

  if (!isOpen) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-black border-b border-gray-800 px-4 py-4">
        <p className="text-gray-400 text-sm">Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="bg-black border-b border-gray-800 px-4 py-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <MdComment className="w-5 h-5" />
        Comments ({comments.length || commentCount})
      </h3>
      
      {/* Add Comment Form */}
      {canComment && user && (
        <div className="mb-4 bg-gray-900 rounded-lg p-3 border border-gray-800 relative">
          <textarea
            ref={commentTextareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              // Let MentionAutocomplete handle arrow keys and enter
              // The MentionAutocomplete component will handle these via its own logic
            }}
            placeholder="Add a comment... (use @ to mention someone)"
            className="w-full bg-gray-800 text-white rounded-lg p-2 text-sm resize-none mb-2 border border-gray-700 focus:outline-none focus:border-[#1976d2]"
            rows={3}
            disabled={addingComment}
          />
          <MentionAutocomplete
            text={commentText}
            onTextChange={setCommentText}
            textareaRef={commentTextareaRef}
          />
          <button
            onClick={handleAddComment}
            disabled={!commentText.trim() || addingComment}
            className="w-full bg-[#1976d2] text-white py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#1565c0] transition-colors flex items-center justify-center gap-2"
          >
            {addingComment ? (
              'Adding...'
            ) : (
              <>
                <MdSend className="w-4 h-4" />
                <span>Add Comment</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
        ) : (
          comments.map((comment) => {
            const isOwner = user && comment.userId === user.uid;
            const isEditing = editingCommentId === comment.commentId;
            const isDeleting = deletingCommentId === comment.commentId;

            return (
              <div 
                key={comment.commentId} 
                className="bg-gray-900 rounded-lg p-3 border border-gray-800 relative"
                onTouchStart={(e) => isOwner && !isEditing && handleLongPressStart(comment.commentId, e)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={(e) => isOwner && !isEditing && handleLongPressStart(comment.commentId, e)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#1976d2] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-white font-semibold">
                      {commentUserNamesMap[comment.userId]?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {commentUserNamesMap[comment.userId] || 'Loading...'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(toDate(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
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
                {isEditing ? (
                  <div className="ml-10 space-y-2">
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
                ) : (
                  <p 
                    className="text-sm text-gray-200 ml-10"
                    dangerouslySetInnerHTML={{ 
                      __html: comment.text.replace(/@([a-zA-Z0-9._-]+)/g, '<span class="text-blue-400 font-semibold">@$1</span>')
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Overlay to close long press menu */}
      {longPressCommentId && (
        <div 
          className="fixed inset-0 z-40"
          onClick={handleCloseLongPressMenu}
        />
      )}
    </div>
  );
}

