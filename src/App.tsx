import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TopBar } from './components/TopBar';
import { RecommendationFeed } from './components/RecommendationFeed';
import { Leaderboard } from './components/Leaderboard';
import { BottomNav } from './components/BottomNav';
import { AddRecommendationModal } from './components/AddRecommendationModal';
import { Film, Play, Sparkles, Loader2, ArrowRight, Bookmark, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { cn } from './lib/utils';
import { collection, getDocs, query, limit, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firebase';

const LoginScreen = () => {
  const { login, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !passcode.trim()) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      await login(name.trim(), passcode.trim());
    } catch (err: any) {
      console.error('Login error detail:', err);
      if (err.message === 'WRONG_PASSCODE') {
        setError('Incorrect passcode for this name!');
      } else if (err.message === 'USERNAME_TAKEN') {
        setError('This name is already taken! Try another one.');
      } else {
        setError(err.message || 'Something went wrong. Try again.');
      }
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google login error:', err);
      setError('Google sign-in failed. Please try again.');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 selection:bg-yellow-400/30">
      <div className="absolute inset-0 overflow-hidden">
        <div className="atmosphere absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-950 to-slate-950 opacity-40 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-10 text-center">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-yellow-400 shadow-2xl shadow-yellow-400/20"
          >
            <Film className="h-10 w-10 text-slate-950" />
          </motion.div>
          <h1 className="mb-2 text-5xl font-black tracking-tight text-yellow-400 uppercase italic">CINE<span className="text-white">SHARE</span></h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Premium team recommendations</p>
        </div>

        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Your display name..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  className={cn(
                    "w-full rounded-2xl bg-slate-900/50 border py-4 pl-6 pr-6 text-white outline-none transition-all placeholder:text-slate-600 font-bold",
                    error ? 'border-red-500/50' : 'border-slate-800 focus:border-yellow-400/50 focus:bg-slate-900'
                  )}
                />
              </div>
              
              <div className="relative group">
                <input
                  type="password"
                  placeholder="Enter a passcode (to claim your name)"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setError(null);
                  }}
                  className={cn(
                    "w-full rounded-2xl bg-slate-900/50 border py-4 pl-6 pr-6 text-white outline-none transition-all placeholder:text-slate-600 font-bold",
                    error ? 'border-red-500/50' : 'border-slate-800 focus:border-yellow-400/50 focus:bg-slate-900'
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={!name.trim() || !passcode.trim() || isLoggingIn}
                className="w-full rounded-2xl bg-yellow-400 py-4 font-black text-slate-950 uppercase tracking-widest shadow-xl shadow-yellow-400/10 transition-all hover:bg-yellow-300 disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Entering...</span>
                  </>
                ) : (
                  <>
                    <span>Join the circle</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-slate-950 px-4 font-black text-slate-600 tracking-[0.2em]">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full rounded-2xl bg-white/5 border border-slate-800 py-4 font-bold text-white transition-all hover:bg-white/10 disabled:opacity-30 flex items-center justify-center gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center"
              >
                <p className="text-[10px] font-black text-red-400 uppercase tracking-wider">
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center gap-4 pt-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 font-black text-center max-w-[250px] leading-relaxed">
              New here? Pick a name and passcode. <br/>
              Returning? Use the same ones to log back in.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const MainApp = () => {
  const { user, profile } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [randomRolling, setRandomRolling] = useState(false);
  const [currentView, setCurrentView] = useState<'feed' | 'watchlist' | 'community'>('feed');

  const handleRandomRoll = async () => {
    if (randomRolling) return;
    setRandomRolling(true);
    
    try {
      const recsRef = collection(db, 'recommendations');
      const snapshot = await getDocs(recsRef).catch(err => handleFirestoreError(err, OperationType.LIST, 'recommendations'));
      if (!snapshot || snapshot.empty) {
        alert("No recommendations yet! Add one first.");
        setRandomRolling(false);
        return;
      }
      
      const docs = snapshot.docs;
      const winnerDoc = docs[Math.floor(Math.random() * docs.length)];
      const winnerId = winnerDoc.id;
      
      // Identify visible card IDs in the DOM for the "shuffle" effect
      const cardElements = Array.from(document.querySelectorAll('[id^="rec-"]')) as HTMLElement[];
      
      if (cardElements.length > 1) {
        // Lootbox shuffle animation
        let delay = 40;
        const totalSteps = 12;
        
        for (let i = 0; i < totalSteps; i++) {
          const randomIdx = Math.floor(Math.random() * cardElements.length);
          const el = cardElements[randomIdx];
          
          // Temporary highlight
          el.classList.add('ring-2', 'ring-white/30', 'bg-white/5', 'scale-[1.02]');
          await new Promise(r => setTimeout(r, delay));
          el.classList.remove('ring-2', 'ring-white/30', 'bg-white/5', 'scale-[1.02]');
          
          // Gradually slow down the "spin"
          delay += (i * 8);
        }
      }
      
      // Flash animation effectively by selecting the actual winner
      const element = document.getElementById(`rec-${winnerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait a tiny bit for the scroll to start/finish
        await new Promise(r => setTimeout(r, 150));
        
        element.classList.add('ring-4', 'ring-yellow-400', 'ring-offset-4', 'ring-offset-slate-950', 'scale-105', 'z-50', 'shadow-2xl', 'shadow-yellow-400/20');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-yellow-400', 'ring-offset-4', 'ring-offset-slate-950', 'scale-105', 'z-50', 'shadow-2xl', 'shadow-yellow-400/20');
        }, 4000);
      } else {
        const data = winnerDoc.data();
        alert(`Random Pick: ${data.title}! (It's currently hidden by your search filter)`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRandomRolling(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-6 space-y-8 hidden lg:flex">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-400 p-2 rounded-xl text-slate-950">
            <Film className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-yellow-400">CINE<span className="text-white">SHARE</span></h1>
        </div>

        <nav className="space-y-4 flex-1">
          <button 
            onClick={() => setCurrentView('feed')}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold border transition-all",
              currentView === 'feed' 
                ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20 shadow-lg shadow-yellow-400/5" 
                : "text-slate-400 hover:text-white border-transparent hover:bg-slate-800"
            )}
          >
            <Sparkles className="h-5 w-5" />
            <span>Feed</span>
          </button>
          <button 
            onClick={() => setCurrentView('watchlist')}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold border transition-all",
              currentView === 'watchlist' 
                ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20 shadow-lg shadow-yellow-400/5" 
                : "text-slate-400 hover:text-white border-transparent hover:bg-slate-800"
            )}
          >
            <Bookmark className="h-5 w-5" />
            <span>Watchlist</span>
          </button>
          <button 
            onClick={() => setCurrentView('community')}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold border transition-all",
              currentView === 'community' 
                ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20 shadow-lg shadow-yellow-400/5" 
                : "text-slate-400 hover:text-white border-transparent hover:bg-slate-800"
            )}
          >
            <Trophy className="h-5 w-5" />
            <span>Community</span>
          </button>
        </nav>

        <button 
          onClick={handleRandomRoll}
          disabled={randomRolling}
          className="w-full bg-gradient-to-br from-indigo-600 to-purple-600 p-4 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 flex flex-col items-center transition-transform hover:scale-[1.02] active:scale-95 group disabled:opacity-50"
        >
          <span className="text-[10px] uppercase tracking-widest opacity-80 mb-1">
            {randomRolling ? 'Rolling...' : "Can't decide?"}
          </span>
          <span className="flex items-center gap-2">
            {randomRolling ? <Loader2 className="h-4 w-4 animate-spin" /> : '🎲 Random Roll'}
          </span>
        </button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden pb-16 lg:pb-0">
        <TopBar onOpenAdd={() => setIsAddModalOpen(true)} />
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
            {currentView === 'community' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Critics Circle</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Community rankings & curators</p>
                </div>
                <Leaderboard />
              </div>
            ) : (
              <>
                <RecommendationFeed view={currentView} />
                <div className="mt-24 pt-12 border-t border-slate-900 flex flex-col items-center text-center">
                  <Film className="h-8 w-8 text-slate-800 mb-4" />
                  <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">End of the line</p>
                  <button 
                    onClick={() => setCurrentView('community')}
                    className="mt-4 text-yellow-400 hover:text-yellow-300 text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Check community stats →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <BottomNav currentView={currentView} onViewChange={setCurrentView} />

      <AnimatePresence>
        {isAddModalOpen && (
          <AddRecommendationModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const Root = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-white/5" />
          <div className="absolute inset-0 rounded-full border-4 border-t-orange-600 animate-spin" />
          <Film className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white" />
        </div>
      </div>
    );
  }

  // If we have a user but no profile yet, we are likely waiting for the firestore snapshot
  if (user && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return user && profile ? <MainApp /> : <LoginScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
