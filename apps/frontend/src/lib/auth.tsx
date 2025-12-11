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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { User as UserType } from '@tripmatrix/types';
import { updateUser } from './api';
import { getCurrencyFromCountry } from './currencyUtils';
import dynamic from 'next/dynamic';

const CountrySelector = dynamic(() => import('@/components/CountrySelector'), { ssr: false });

interface AuthContextType {
  user: UserType | null;
  firebaseUser: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // Fetch or create user document
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserType;
          setUser(userData);
          // Check if country is missing - show country selector
          if (!userData.country) {
            setShowCountrySelector(true);
          }
        } else {
          // Create new user document (country will be set by CountrySelectorModal)
          const newUser: UserType = {
            uid: user.uid,
            name: user.displayName || '',
            email: user.email || '',
            photoUrl: user.photoURL || '',
            createdAt: new Date(),
          };
          await setDoc(userDocRef, newUser);
          setUser(newUser);
          // Show country selector for new users
          setShowCountrySelector(true);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  const getIdToken = async () => {
    if (!firebaseUser) return null;
    return await firebaseUser.getIdToken();
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

