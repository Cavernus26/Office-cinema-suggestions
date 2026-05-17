import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User, 
  GoogleAuthProvider, 
  signInWithPopup,
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

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  login: (name: string, passcode: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize or fetch user document
  const ensureUserDoc = async (authUser: User, name?: string, passcode?: string) => {
    const userRef = doc(db, 'users', authUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      const initialProfile = {
        name: name || authUser.displayName || 'Circle Member',
        passcode: passcode || null,
        avatar: authUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.uid}`,
        watchedCount: 0,
        recsCount: 0,
        avgRating: 0,
        uid: authUser.uid,
        isAnonymous: authUser.isAnonymous,
        email: authUser.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, initialProfile);
      return initialProfile;
    } else {
      // Update existing doc with latest auth info if needed
      const data = userDoc.data();
      const updates: any = { 
        updatedAt: serverTimestamp(),
        isAnonymous: authUser.isAnonymous
      };
      
      let hasChanges = false;
      if (authUser.email && data.email !== authUser.email) {
        updates.email = authUser.email;
        hasChanges = true;
      }
      if (authUser.photoURL && !data.avatar) {
        updates.avatar = authUser.photoURL;
        hasChanges = true;
      }
      if (name && data.name !== name) {
        updates.name = name;
        hasChanges = true;
      }

      if (hasChanges) {
        await updateDoc(userRef, updates);
        return { ...data, ...updates };
      }
      return data;
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // Automatically ensure user doc exists for returning users
        const userRef = doc(db, 'users', authUser.uid);
        
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            // If the listener finds no doc, create it with current auth info
            await ensureUserDoc(authUser);
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
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.uid}`,
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

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await ensureUserDoc(result.user);
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
      loginWithGoogle, 
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
