import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { collection, query as fsQuery, where, getDocs, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';

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

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Use onSnapshot to listen for profile changes (like avatar)
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
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
    try {
      // 1. Sign in anonymously first to get a UID
      const result = await signInAnonymously(auth);
      const user = result.user;
      
      const usernameId = name.toLowerCase().trim();
      const usernameRef = doc(db, 'usernames', usernameId);
      const userRef = doc(db, 'users', user.uid);
      
      // 2. Check if username is already taken
      const usernameDoc = await getDoc(usernameRef).catch(err => {
        console.error("Username check failed:", err);
        handleFirestoreError(err, OperationType.GET, `usernames/${usernameId}`);
      });
      
      let isReturningUser = false;

      if (usernameDoc && usernameDoc.exists()) {
        const data = usernameDoc.data();
        console.log(`Checking existing name "${name}" owned by ${data.ownerId}, provided passcode: ${passcode === data.passcode ? 'MATCH' : 'MISMATCH'}`);
        if (data.ownerId !== user.uid) {
          // If the name is taken by a different UID:
          // 1. Check if user provided the correct passcode to "log in"
          if (data.passcode !== passcode) {
            console.warn(`Username "${name}" is taken and passcode was incorrect.`);
            throw new Error('USERNAME_TAKEN');
          }
          console.log(`Username "${name}" correctly claimed by providing matching passcode.`);
          isReturningUser = true;
        } else {
          console.log(`Current session already owns the username "${name}".`);
          isReturningUser = true;
        }
      } else {
        console.log(`Username "${name}" is available. Claiming it now...`);
      }
      
      // 3. Prepare profile
      const userDoc = await getDoc(userRef).catch(() => null);
      const existingData = userDoc?.exists() ? userDoc.data() : null;

      const profileData = {
        name,
        passcode, // Keep passcode in profile for easy re-auth/verification if needed
        avatar: existingData?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        watchedCount: existingData?.watchedCount || 0,
        recsCount: existingData?.recsCount || 0,
        avgRating: existingData?.avgRating || 0,
        createdAt: existingData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      try {
        // Reserve/Update the name
        await setDoc(usernameRef, { ownerId: user.uid, passcode }, { merge: true });
        // Update user profile
        await setDoc(userRef, profileData);
        setProfile(profileData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid} or usernames/${usernameId}`);
      }
    } catch (error) {
      console.error('AuthContext Login failed:', error);
      if (error instanceof Error && (error.message !== 'WRONG_PASSCODE' && error.message !== 'USERNAME_TAKEN')) {
        await auth.signOut();
      }
      throw error;
    }
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
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
