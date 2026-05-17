import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  linkWithPopup,
  unlink,
  updateProfile
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
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  upgradeToGoogle: () => Promise<void>;
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
        name: name || authUser.displayName || 'Anonymous Guest',
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

  const continueAsGuest = async () => {
    setLoading(true);
    try {
      const result = await signInAnonymously(auth);
      await ensureUserDoc(result.user);
    } catch (error) {
      console.error("Guest login failed", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (name: string, passcode: string) => {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    const currentUser = auth.currentUser!;
    
    const usernameId = name.toLowerCase().trim();
    const usernameRef = doc(db, 'usernames', usernameId);
    const usernameDoc = await getDoc(usernameRef);
    
    if (usernameDoc.exists()) {
      const data = usernameDoc.data();
      if (data.passcode !== passcode) {
        throw new Error('WRONG_PASSCODE');
      }
      if (data.ownerId !== currentUser.uid) {
        // Linking this name to this UID
        await updateDoc(usernameRef, { ownerId: currentUser.uid });
      }
    } else {
      await setDoc(usernameRef, { ownerId: currentUser.uid, passcode });
    }

    await ensureUserDoc(currentUser, name, passcode);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const upgradeToGoogle = async () => {
    if (!auth.currentUser) return;
    const provider = new GoogleAuthProvider();
    try {
      await linkWithPopup(auth.currentUser, provider);
      // After linking, fetch profile updates
      await ensureUserDoc(auth.currentUser);
    } catch (error: any) {
      if (error.code === 'auth/credential-already-in-use') {
        // Handle case where Google account is already linked to another UID
        // You might want to sign in with Google instead and merge data manually
        console.error("Credentials already in use");
        throw error;
      }
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('office_cinema_name');
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      login, 
      loginWithGoogle, 
      continueAsGuest,
      logout,
      upgradeToGoogle 
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
