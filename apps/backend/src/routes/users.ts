import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { UserModel } from '../models/User.js';

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

    // Search by email, name, or username
    const searchQuery = q.toLowerCase();
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
      // User doesn't exist yet, return basic info from Firebase token
      return res.json({
        success: true,
        data: {
          uid,
          email: req.user?.email || '',
          name: '',
          photoUrl: '',
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
      user = new UserModel({
        _id: uid,
        uid,
        name: name || req.user?.email?.split('@')[0] || 'User',
        email: email || req.user?.email || '',
        photoUrl: photoUrl || '',
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

// Get user by ID (public profile)
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

    // If profile is not public, check if current user is following or is the user themselves
    if (!isProfilePublic) {
      if (!currentUserId || (currentUserId !== targetUserId)) {
        // Check if current user follows this user
        if (currentUserId) {
          const currentUser = await UserModel.findOne({ uid: currentUserId });
          const follows = currentUser?.follows || [];
          if (!follows.includes(targetUserId)) {
            return res.status(403).json({
              success: false,
              error: 'Profile is private',
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            error: 'Profile is private',
          });
        }
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

