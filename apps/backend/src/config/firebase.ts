import admin from 'firebase-admin';

let initialized = false;

export function initializeFirebase() {
  if (initialized) {
    return;
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is not set');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
}

export function getFirestore() {
  return admin.firestore();
}

export function getAuth() {
  return admin.auth();
}

export function getStorage() {
  return admin.storage();
}

