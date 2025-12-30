import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { UserModel } from '../models/User.js';
import { getAuth } from '../config/firebase.js';

const router = express.Router();

// Search users by email or name (for @username tagging)
router.get('/search', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    // Search by email, name, or username (case-insensitive contains)
    // Escape special regex characters for safe searching
    const searchQuery = q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const usersDocs = await UserModel.find({
      $or: [
        { email: { $regex: searchQuery, $options: 'i' } },
        { name: { $regex: searchQuery, $options: 'i' } },
        { username: { $regex: searchQuery, $options: 'i' } }
      ]
    }).limit(10);

    const users = usersDocs.map(doc => doc.toJSON());

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get current user profile
router.get('/me', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const uid = req.uid;
    const user = await UserModel.findOne({ uid });

    if (!user) {
      // User doesn't exist yet, try to get info from Firebase user record
      let displayName = req.user?.name || req.user?.email?.split('@')[0] || 'User';
      let photoUrl = req.user?.picture || '';
      
      try {
        const auth = getAuth();
        const firebaseUser = await auth.getUser(uid);
        displayName = firebaseUser.displayName || displayName;
        photoUrl = firebaseUser.photoURL || photoUrl;
      } catch (error) {
        // If we can't fetch from Firebase, use token data
      }
      
      return res.json({
        success: true,
        data: {
          uid,
          email: req.user?.email || '',
          name: displayName,
          photoUrl: photoUrl,
          country: '',
          defaultCurrency: '',
          isProfilePublic: false,
          follows: [],
          createdAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update user profile (country, currency, isProfilePublic, etc.)
router.patch('/me', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const { country, defaultCurrency, isProfilePublic, name, email, photoUrl } = req.body;
    const uid = req.uid;

    let user = await UserModel.findOne({ uid });

    // Create user if doesn't exist
    if (!user) {
      // Try to get display name from Firebase user record (for Google sign-in)
      let displayName = name;
      let userPhotoUrl = photoUrl;
      
      if (!displayName || !userPhotoUrl) {
        try {
          const auth = getAuth();
          const firebaseUser = await auth.getUser(uid);
          // Firebase user record has displayName and photoURL for Google sign-in
          displayName = displayName || firebaseUser.displayName || req.user?.name || req.user?.email?.split('@')[0] || 'User';
          userPhotoUrl = userPhotoUrl || firebaseUser.photoURL || req.user?.picture || '';
        } catch (error) {
          // If we can't fetch from Firebase, use token data or fallback
          displayName = displayName || req.user?.name || req.user?.email?.split('@')[0] || 'User';
          userPhotoUrl = userPhotoUrl || req.user?.picture || '';
        }
      } else {
        // If name not provided, use fallback
        displayName = displayName || req.user?.name || req.user?.email?.split('@')[0] || 'User';
      }
      
      user = new UserModel({
        _id: uid,
        uid,
        name: displayName,
        email: email || req.user?.email || '',
        photoUrl: userPhotoUrl,
        country: country || '',
        defaultCurrency: defaultCurrency || '',
        isProfilePublic: isProfilePublic || false,
        follows: [],
        createdAt: new Date(),
      });
    } else {
      // Update existing user
      if (name !== undefined) user.name = name;
      if (email !== undefined) user.email = email;
      if (photoUrl !== undefined) user.photoUrl = photoUrl;
    }

    if (country !== undefined) {
      user.country = country;
    }
    if (defaultCurrency !== undefined) {
      user.defaultCurrency = defaultCurrency;
    }
    if (isProfilePublic !== undefined) {
      user.isProfilePublic = isProfilePublic;
    }

    await user.save();
    const updatedUser = user.toJSON();

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Follow a user
router.post('/:userId/follow', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const currentUserId = req.uid;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot follow yourself',
      });
    }

    const currentUser = await UserModel.findOne({ uid: currentUserId });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const follows = currentUser.follows || [];

    if (follows.includes(targetUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Already following this user',
      });
    }

    // Add targetUserId to follows array
    currentUser.follows = [...follows, targetUserId];
    await currentUser.save();

    res.json({
      success: true,
      data: { message: 'User followed successfully' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Unfollow a user
router.post('/:userId/unfollow', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const currentUserId = req.uid;
    const targetUserId = req.params.userId;

    const currentUser = await UserModel.findOne({ uid: currentUserId });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const follows = currentUser.follows || [];

    if (!follows.includes(targetUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Not following this user',
      });
    }

    // Remove targetUserId from follows array
    currentUser.follows = follows.filter((uid: string) => uid !== targetUserId);
    await currentUser.save();

    res.json({
      success: true,
      data: { message: 'User unfollowed successfully' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get users that current user follows
router.get('/me/following', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const currentUserId = req.uid;
    const currentUser = await UserModel.findOne({ uid: currentUserId });

    if (!currentUser) {
      // User doesn't exist yet, return empty array (user will be created on first profile update)
      return res.json({
        success: true,
        data: [],
      });
    }

    const follows = currentUser.follows || [];

    if (follows.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Fetch all followed users
    const followedUsersDocs = await UserModel.find({ uid: { $in: follows } });
    const followedUsers = followedUsersDocs.map(doc => doc.toJSON());

    res.json({
      success: true,
      data: followedUsers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get followers of a user (users that follow the specified user)
router.get('/:userId/followers', async (req: OptionalAuthRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.uid; // May be null for unauthenticated requests

    // Check if target user exists
    const targetUser = await UserModel.findOne({ uid: targetUserId });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const targetUserData = targetUser.toJSON();
    const isProfilePublic = targetUserData.isProfilePublic || false;
    const isOwnProfile = currentUserId === targetUserId;

    // If profile is private and not own profile, check access
    if (!isProfilePublic && !isOwnProfile) {
      if (!currentUserId) {
        return res.status(403).json({
          success: false,
          error: 'Profile is private',
        });
      }

      const currentUser = await UserModel.findOne({ uid: currentUserId });
      const follows = currentUser?.follows || [];
      
      // Check if current user follows this user
      if (!follows.includes(targetUserId)) {
        // Check if they're in a trip together
        const { TripModel } = await import('../models/Trip.js');
        const sharedTrip = await TripModel.findOne({
          $or: [
            { creatorId: currentUserId, 'participants.uid': targetUserId },
            { creatorId: targetUserId, 'participants.uid': currentUserId }
          ]
        });
        
        if (!sharedTrip) {
          return res.status(403).json({
            success: false,
            error: 'Cannot view followers of private profile',
          });
        }
      }
    }

    // Find all users that follow the target user
    const followersDocs = await UserModel.find({ 
      follows: { $in: [targetUserId] }
    });
    const followers = followersDocs.map(doc => doc.toJSON());

    res.json({
      success: true,
      data: followers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get users that a specific user follows
router.get('/:userId/following', async (req: OptionalAuthRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.uid; // May be null for unauthenticated requests

    // Check if target user exists
    const targetUser = await UserModel.findOne({ uid: targetUserId });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const targetUserData = targetUser.toJSON();
    const isProfilePublic = targetUserData.isProfilePublic || false;
    const isOwnProfile = currentUserId === targetUserId;

    // If profile is private and not own profile, check access
    if (!isProfilePublic && !isOwnProfile) {
      if (!currentUserId) {
        return res.status(403).json({
          success: false,
          error: 'Profile is private',
        });
      }

      const currentUser = await UserModel.findOne({ uid: currentUserId });
      const follows = currentUser?.follows || [];
      
      // Check if current user follows this user
      if (!follows.includes(targetUserId)) {
        // Check if they're in a trip together
        const { TripModel } = await import('../models/Trip.js');
        const sharedTrip = await TripModel.findOne({
          $or: [
            { creatorId: currentUserId, 'participants.uid': targetUserId },
            { creatorId: targetUserId, 'participants.uid': currentUserId }
          ]
        });
        
        if (!sharedTrip) {
          return res.status(403).json({
            success: false,
            error: 'Cannot view following list of private profile',
          });
        }
      }
    }

    const follows = targetUser.follows || [];

    if (follows.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Fetch all followed users
    const followedUsersDocs = await UserModel.find({ uid: { $in: follows } });
    const followedUsers = followedUsersDocs.map(doc => doc.toJSON());

    res.json({
      success: true,
      data: followedUsers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user by ID (public profile)
// Note: Private profiles can still be viewed, but followers/following lists are hidden
router.get('/:userId', async (req: OptionalAuthRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.uid; // May be null for unauthenticated requests

    const targetUser = await UserModel.findOne({ uid: targetUserId });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const targetUserData = targetUser.toJSON();
    const isProfilePublic = targetUserData.isProfilePublic || false;
    const isOwnProfile = currentUserId === targetUserId;

    // For private profiles, we still return the profile data but without follows array
    // The frontend will handle hiding followers/following lists
    // Only hide the follows array if profile is private and user doesn't have access
    if (!isProfilePublic && !isOwnProfile) {
      let hasAccess = false;
      
      if (currentUserId) {
        const currentUser = await UserModel.findOne({ uid: currentUserId });
        const follows = currentUser?.follows || [];
        
        // Check if current user follows this user
        if (follows.includes(targetUserId)) {
          hasAccess = true;
        } else {
          // Check if they're in a trip together (either as creator/participant)
          const { TripModel } = await import('../models/Trip.js');
          const sharedTrip = await TripModel.findOne({
            $or: [
              { creatorId: currentUserId, 'participants.uid': targetUserId },
              { creatorId: targetUserId, 'participants.uid': currentUserId }
            ]
          });
          
          if (sharedTrip) {
            hasAccess = true;
          }
        }
      }
      
      // If no access, remove follows array from response (but still return profile)
      if (!hasAccess) {
        delete targetUserData.follows;
      }
    }

    res.json({
      success: true,
      data: targetUserData,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

