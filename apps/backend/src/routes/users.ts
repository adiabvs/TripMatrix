import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Search users by email or name (for @username tagging)
router.get('/search', async (req: AuthenticatedRequest, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    // Search by email (exact match or contains)
    const emailQuery = q.toLowerCase();
    const db = getDb();
    const snapshot = await db.collection('users')
      .where('email', '>=', emailQuery)
      .where('email', '<=', emailQuery + '\uf8ff')
      .limit(10)
      .get();

    const users = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update user profile (country, currency, isProfilePublic, etc.)
router.patch('/me', async (req: AuthenticatedRequest, res) => {
  try {
    const { country, defaultCurrency, isProfilePublic } = req.body;
    const uid = req.uid!;
    const db = getDb();

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const updates: any = {};
    if (country !== undefined) {
      updates.country = country;
    }
    if (defaultCurrency !== undefined) {
      updates.defaultCurrency = defaultCurrency;
    }
    if (isProfilePublic !== undefined) {
      updates.isProfilePublic = isProfilePublic;
    }

    await userRef.update(updates);

    const updatedDoc = await userRef.get();
    const updatedUser = { uid: updatedDoc.id, ...updatedDoc.data() };

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
router.post('/:userId/follow', async (req: AuthenticatedRequest, res) => {
  try {
    const currentUserId = req.uid!;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot follow yourself',
      });
    }

    const db = getDb();
    const currentUserRef = db.collection('users').doc(currentUserId);
    const currentUserDoc = await currentUserRef.get();

    if (!currentUserDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const currentUserData = currentUserDoc.data();
    const follows = currentUserData?.follows || [];

    if (follows.includes(targetUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Already following this user',
      });
    }

    // Add targetUserId to follows array
    await currentUserRef.update({
      follows: [...follows, targetUserId],
    });

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
router.post('/:userId/unfollow', async (req: AuthenticatedRequest, res) => {
  try {
    const currentUserId = req.uid!;
    const targetUserId = req.params.userId;

    const db = getDb();
    const currentUserRef = db.collection('users').doc(currentUserId);
    const currentUserDoc = await currentUserRef.get();

    if (!currentUserDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const currentUserData = currentUserDoc.data();
    const follows = currentUserData?.follows || [];

    if (!follows.includes(targetUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Not following this user',
      });
    }

    // Remove targetUserId from follows array
    await currentUserRef.update({
      follows: follows.filter((uid: string) => uid !== targetUserId),
    });

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
router.get('/me/following', async (req: AuthenticatedRequest, res) => {
  try {
    const currentUserId = req.uid!;
    const db = getDb();
    const currentUserDoc = await db.collection('users').doc(currentUserId).get();

    if (!currentUserDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const follows = currentUserDoc.data()?.follows || [];

    if (follows.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Fetch all followed users
    const followedUsersPromises = follows.map((uid: string) =>
      db.collection('users').doc(uid).get()
    );
    const followedUsersDocs = await Promise.all(followedUsersPromises);

    const followedUsers = followedUsersDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));

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
router.get('/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.uid; // May be null for unauthenticated requests
    const db = getDb();

    const targetUserDoc = await db.collection('users').doc(targetUserId).get();

    if (!targetUserDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const targetUserData = targetUserDoc.data();
    const isProfilePublic = targetUserData?.isProfilePublic || false;

    // If profile is not public, check if current user is following or is the user themselves
    if (!isProfilePublic) {
      if (!currentUserId || (currentUserId !== targetUserId)) {
        // Check if current user follows this user
        if (currentUserId) {
          const currentUserDoc = await db.collection('users').doc(currentUserId).get();
          const follows = currentUserDoc.data()?.follows || [];
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
      data: {
        uid: targetUserDoc.id,
        ...targetUserData,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

