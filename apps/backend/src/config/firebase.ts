import admin from 'firebase-admin';

let initialized = false;

export function initializeFirebase() {
  if (initialized) {
    return;
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    console.warn('⚠️  FIREBASE_PROJECT_ID is not set. Some features may not work.');
    return;
  }

  // Check if we have service account credentials
  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.warn('⚠️  Firebase service account credentials not found. Backend will run in limited mode.');
    console.warn('   Set FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in .env for full functionality.');
    return;
  }

  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/\\n/g, '\n'); // Replace \n with actual newlines
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL.replace(/^["']|["']$/g, ''), // Remove quotes
      }),
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (error: any) {
    console.error('❌ Firebase initialization error:', error.message);
    console.warn('⚠️  Continuing without Firebase Admin. Some features will not work.');
    // Don't throw - allow server to start in limited mode
  }
}

export function getFirestore() {
  if (!initialized) {
    throw new Error('Firebase Admin is not initialized. Check your .env file for FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.');
  }
  return admin.firestore();
}

export function getAuth() {
  if (!initialized) {
    throw new Error('Firebase Admin is not initialized. Check your .env file for FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.');
  }
  return admin.auth();
}

export function getStorage() {
  if (!initialized) {
    throw new Error('Firebase Admin is not initialized. Check your .env file for FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.');
  }
  return admin.storage();
}

export function isFirebaseInitialized() {
  return initialized;
}

