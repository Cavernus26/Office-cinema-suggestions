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
    const savedName = localStorage.getItem('office_cinema_name');

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user && savedName) {
        // Auto-recover profile if we have a saved name
        const usernameId = savedName.toLowerCase().trim();
        const userRef = doc(db, 'users', usernameId);
        
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        });
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
      const userRef = doc(db, 'users', usernameId); // Use usernameId instead of user.uid for persistent profile
      
      const usernameDoc = await getDoc(usernameRef).catch(err => {
        console.error("Username check failed:", err);
        handleFirestoreError(err, OperationType.GET, `usernames/${usernameId}`);
      });
      
      let isReturningUser = false;

      if (usernameDoc && usernameDoc.exists()) {
        const data = usernameDoc.data();
        if (data.ownerId !== user.uid) {
          if (data.passcode !== passcode) {
            throw new Error('USERNAME_TAKEN');
          }
          // Matching passcode - we allow this user to "take over" the name
          // In a real app we'd link accounts, here we just use the name-based userRef
        }
      }
      
      // 3. Prepare profile
      const userDoc = await getDoc(userRef).catch(() => null);
      const existingData = userDoc?.exists() ? userDoc.data() : null;

      const profileData = {
        name,
        nameLower: usernameId,
        passcode,
        uid: user.uid, // Store current UID
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
        // Update user profile (keyed by username)
        await setDoc(userRef, profileData, { merge: true });
        
        localStorage.setItem('office_cinema_name', name);
        setProfile(profileData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${usernameId} or usernames/${usernameId}`);
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
    localStorage.removeItem('office_cinema_name');
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
