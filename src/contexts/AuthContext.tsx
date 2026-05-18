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
    // Normalize ID to be URL/ID friendly and consistent
    const usernameId = cleanedName.toLowerCase().replace(/\s+/g, '_');
    const email = `${usernameId}@office-cinema.local`;
    
    console.log(`[Login] Attempting login for: ${cleanedName} (ID: ${usernameId})`);
    
    // 1. Check if username exists in our index
    const usernameRef = doc(db, 'usernames', usernameId);
    const usernameDoc = await getDoc(usernameRef);
    
    const createNewProfile = async (uid: string, userEmail: string) => {
      const batch = writeBatch(db);
      batch.set(usernameRef, { ownerId: uid, passcode });
      
      const userRef = doc(db, 'users', uid);
      const profileData = {
        name: cleanedName,
        passcode,
        avatar: getRandomAvatar(uid),
        watchedCount: 0,
        recsCount: 0,
        avgRating: 0,
        uid: uid,
        email: userEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(userRef, profileData);
      await batch.commit();
      return profileData;
    };

    if (usernameDoc.exists()) {
      // Username exists in Firestore index
      try {
        await signInWithEmailAndPassword(auth, email, passcode);
        
        // Successfully signed in - double check and repair profile if needed
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          await createNewProfile(auth.currentUser!.uid, email);
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // GHOST INDEX: Username doc exists but Auth user is gone.
          // Allow creating a new user and overwrite the ghost index.
          try {
            const result = await createUserWithEmailAndPassword(auth, email, passcode);
            await createNewProfile(result.user.uid, email);
          } catch (createError: any) {
            throw createError;
          }
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          throw new Error('WRONG_PASSCODE');
        } else {
          throw error;
        }
      }
    } else {
      // Username NOT in Firestore index - try to create new user
      try {
        const result = await createUserWithEmailAndPassword(auth, email, passcode);
        await createNewProfile(result.user.uid, email);
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          // GHOST AUTH: Auth record exists but Firestore index doesn't.
          // Attempt to claim it by signing in.
          try {
            await signInWithEmailAndPassword(auth, email, passcode);
            // Success! The user knew the passcode. Restore Firestore docs.
            await createNewProfile(auth.currentUser!.uid, email);
          } catch (signInError: any) {
            // If sign-in fails with wrong password, it means someone else owns this email/name
            if (signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
              throw new Error('USERNAME_TAKEN');
            }
            throw signInError;
          }
        } else {
          throw error;
        }
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
