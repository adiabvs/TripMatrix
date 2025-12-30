'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';
import type { User as UserType } from '@tripmatrix/types';
import { updateUser, getCurrentUser } from './api';
import { getCurrencyFromCountry } from './currencyUtils';
import dynamic from 'next/dynamic';

const CountrySelector = dynamic(() => import('@/components/CountrySelector'), { ssr: false });

interface AuthContextType {
  user: UserType | null;
  firebaseUser: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [countrySelectorShown, setCountrySelectorShown] = useState(false);

  useEffect(() => {
    // Only run on client side and when auth is initialized
    if (typeof window === 'undefined' || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setFirebaseUser(firebaseUser);
        if (firebaseUser) {
          // Fetch user from MongoDB via API (not Firestore)
          try {
            const token = await firebaseUser.getIdToken();
            const userData = await getCurrentUser(token);
            setUser(userData);
            // Check if country is missing - show country selector only if not already shown
            if (!userData.country && !countrySelectorShown) {
              setShowCountrySelector(true);
              setCountrySelectorShown(true);
            } else if (userData.country) {
              // If country exists, reset the flag
              setCountrySelectorShown(false);
            }
          } catch (apiError: any) {
            console.error('Error fetching user from API:', apiError);
            // User doesn't exist in MongoDB yet, will be created on first profile update
            // Don't show country selector yet - wait for user to be created in MongoDB first
            const newUser: UserType = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              photoUrl: firebaseUser.photoURL || '',
              country: '',
              defaultCurrency: '',
              isProfilePublic: false,
              follows: [],
              createdAt: new Date(),
            };
            setUser(newUser);
            // Only show country selector if user doesn't exist in MongoDB (404 or similar)
            if ((apiError.message?.includes('not found') || apiError.message?.includes('404')) && !countrySelectorShown) {
              setShowCountrySelector(true);
              setCountrySelectorShown(true);
            }
          }
        } else {
          setUser(null);
          setCountrySelectorShown(false);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        // Don't clear user on error - only clear if Firebase explicitly signs out
        // This prevents accidental logouts due to network errors
        if (!firebaseUser) {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    if (!auth) {
      console.error('Firebase Auth is not initialized. Please check your Firebase configuration.');
      alert('Authentication is not available. Please check your Firebase configuration in .env.local');
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      // Add scopes if needed
      provider.addScope('profile');
      provider.addScope('email');
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Provide helpful error messages
      if (error.code === 'auth/configuration-not-found') {
        alert('Firebase configuration error. Please check:\n1. Your Firebase project is set up correctly\n2. Authorized domains include ' + window.location.hostname + '\n3. Google Sign-In is enabled in Firebase Console');
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, don't show error
        return;
      } else {
        alert('Failed to sign in: ' + (error.message || 'Unknown error'));
      }
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  const getIdToken = async (forceRefresh = false) => {
    if (!firebaseUser) return null;
    try {
      // Force refresh if requested, otherwise use cached token
      return await firebaseUser.getIdToken(forceRefresh);
    } catch (error) {
      console.error('Failed to get ID token:', error);
      // Don't throw - return null instead to allow graceful degradation
      // This prevents automatic logout on token errors
      return null;
    }
  };

  const handleCountrySelect = async (countryCode: string, currency: string) => {
    if (!firebaseUser) return;
    
    try {
      const token = await firebaseUser.getIdToken();
      const updatedUser = await updateUser(
        { country: countryCode, defaultCurrency: currency },
        token
      );
      setUser(updatedUser);
      setShowCountrySelector(false);
      setCountrySelectorShown(false);
    } catch (error) {
      console.error('Failed to update user country:', error);
      alert('Failed to save country. Please try again.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        signIn,
        signOut,
        getIdToken,
      }}
    >
      {children}
      {showCountrySelector && user && (
        <CountrySelector
          onSelect={handleCountrySelect}
          currentCountry={user.country}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

