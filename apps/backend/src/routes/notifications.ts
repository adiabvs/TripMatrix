import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { NotificationModel } from '../models/Notification.js';
import { TripModel } from '../models/Trip.js';
import { UserModel } from '../models/User.js';
import type { Notification } from '@tripmatrix/types';

const router = express.Router();

// Get all notifications for current user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const notifications = await NotificationModel.find({ userId: req.uid })
      .sort({ createdAt: -1 })
      .limit(100);

    const notificationsData = notifications.map(doc => doc.toJSON() as Notification);

    res.json({
      success: true,
      data: notificationsData,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get unread notification count
router.get('/unread/count', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const count = await NotificationModel.countDocuments({
      userId: req.uid,
      isRead: false,
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { notificationId } = req.params;
    const notification = await NotificationModel.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    if (notification.userId !== req.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      data: notification.toJSON(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    await NotificationModel.updateMany(
      { userId: req.uid, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Accept trip invitation
router.post('/:notificationId/accept-invitation', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { notificationId } = req.params;
    const notification = await NotificationModel.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    if (notification.userId !== req.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    if (notification.type !== 'trip_invitation' || !notification.tripId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification type',
      });
    }

    // Update trip participant status
    const trip = await TripModel.findById(notification.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    const participantIndex = tripData.participants.findIndex(
      (p) => p.uid === req.uid && p.status === 'pending'
    );

    if (participantIndex >= 0) {
      trip.participants[participantIndex].status = 'accepted';
      await trip.save();
    }

    // Mark notification as read
    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      data: { trip: trip.toJSON() },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Reject trip invitation
router.post('/:notificationId/reject-invitation', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { notificationId } = req.params;
    const notification = await NotificationModel.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    if (notification.userId !== req.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    if (notification.type !== 'trip_invitation' || !notification.tripId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification type',
      });
    }

    // Remove participant from trip
    const trip = await TripModel.findById(notification.tripId);
    if (trip) {
      const tripData = trip.toJSON();
      trip.participants = tripData.participants.filter(
        (p) => !(p.uid === req.uid && p.status === 'pending')
      );
      await trip.save();
    }

    // Mark notification as read
    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

