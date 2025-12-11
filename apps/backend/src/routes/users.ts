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

// Update user profile (country, currency, etc.)
router.patch('/me', async (req: AuthenticatedRequest, res) => {
  try {
    const { country, defaultCurrency } = req.body;
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

export default router;

