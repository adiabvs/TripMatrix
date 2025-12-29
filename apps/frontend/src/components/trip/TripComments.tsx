'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripComment, User } from '@tripmatrix/types';
import { getTripComments, addTripComment, getUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MdComment, MdSend } from 'react-icons/md';

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
        <div className="mb-4 bg-gray-900 rounded-lg p-3 border border-gray-800">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-gray-800 text-white rounded-lg p-2 text-sm resize-none mb-2 border border-gray-700 focus:outline-none focus:border-[#1976d2]"
            rows={3}
            disabled={addingComment}
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
          comments.map((comment) => (
            <div key={comment.commentId} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#1976d2] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-white font-semibold">
                    {commentUserNamesMap[comment.userId]?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {commentUserNamesMap[comment.userId] || 'Loading...'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(toDate(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-200 ml-10">{comment.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

