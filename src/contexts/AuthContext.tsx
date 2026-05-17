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
        name: name || authUser.displayName || 'Anonymous',
        passcode: passcode || null,
        avatar: authUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || authUser.uid}`,
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
      // Update existing doc with latest auth info
      const updates: any = { 
        updatedAt: serverTimestamp(),
        isAnonymous: authUser.isAnonymous
      };
      if (authUser.email) updates.email = authUser.email;
      if (authUser.photoURL && !userDoc.data().avatar) updates.avatar = authUser.photoURL;
      
      await updateDoc(userRef, updates);
      return { ...userDoc.data(), ...updates };
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // Automatically ensure user doc exists
        const userRef = doc(db, 'users', authUser.uid);
        
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            // First time this UID is seen, create the doc
            await ensureUserDoc(authUser);
          }
        });
      } else {
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
        
        // Auto-login anonymously if no session
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Auto-anonymous login failed", e);
        }
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async (name: string, passcode: string) => {
    if (!auth.currentUser) await signInAnonymously(auth);
    const currentUser = auth.currentUser!;
    
    const usernameId = name.toLowerCase().trim();
    const usernameRef = doc(db, 'usernames', usernameId);
    const usernameDoc = await getDoc(usernameRef);
    
    if (usernameDoc.exists()) {
      const data = usernameDoc.data();
      if (data.passcode !== passcode) {
        throw new Error('WRONG_PASSCODE');
      }
      // If the owner matches or we're claiming it
      if (data.ownerId !== currentUser.uid) {
        // Re-claiming: User re-entered their name/passcode on a new device/session
        // Note: In a full system we'd merge profiles, but here we just update the owner index
        await updateDoc(usernameRef, { ownerId: currentUser.uid });
      }
    } else {
      // First time claiming this name
      await setDoc(usernameRef, { ownerId: currentUser.uid, passcode });
    }

    // Update the profile with the chosen name
    await ensureUserDoc(currentUser, name, passcode);
    localStorage.setItem('office_cinema_name', name);
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
