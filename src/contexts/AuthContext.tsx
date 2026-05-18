import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  query as fsQuery, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  onSnapshot, 
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';

import { getRandomAvatar } from '../lib/avatars';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  login: (name: string, passcode: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // Automatically fetch user doc for returning users
        const userRef = doc(db, 'users', authUser.uid);
        
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            // If the profile document is missing, we don't automatically recreate it here.
            // This prevents "Circle Member" auto-login if the doc was deleted.
            // We set profile to null, which will trigger the Login screen in App.tsx
            setProfile(null);
            auth.signOut();
          }
        });
      } else {
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async (name: string, passcode: string) => {
    const cleanedName = name.trim();
    const usernameId = cleanedName.toLowerCase();
    const email = `${usernameId}@office-cinema.local`;
    
    // 1. Check if username exists in our index
    const usernameRef = doc(db, 'usernames', usernameId);
    const usernameDoc = await getDoc(usernameRef);
    
    if (usernameDoc.exists()) {
      // Returning user - attempt sign in
      try {
        await signInWithEmailAndPassword(auth, email, passcode);
      } catch (error: any) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          throw new Error('WRONG_PASSCODE');
        }
        throw error;
      }
    } else {
      // New user - attempt sign up
      try {
        const result = await createUserWithEmailAndPassword(auth, email, passcode);
        const newUser = result.user;
        
        // Atomically reserve username and create profile
        const batch = writeBatch(db);
        batch.set(usernameRef, { ownerId: newUser.uid, passcode });
        
        const userRef = doc(db, 'users', newUser.uid);
        const profileData = {
          name: cleanedName,
          passcode,
          avatar: getRandomAvatar(newUser.uid),
          watchedCount: 0,
          recsCount: 0,
          avgRating: 0,
          uid: newUser.uid,
          email: email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(userRef, profileData);
        
        await batch.commit();
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          throw new Error('USERNAME_TAKEN');
        }
        throw error;
      }
    }
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      login, 
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
