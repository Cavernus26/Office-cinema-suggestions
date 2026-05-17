import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { Recommendation, UserAction } from '../types';
import { MovieCard } from './MovieCard';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, Filter, Bookmark } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface RecommendationFeedProps {
  view?: 'feed' | 'watchlist';
}

export const RecommendationFeed: React.FC<RecommendationFeedProps> = ({ view = 'feed' }) => {
  const { user, profile } = useAuth();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');

  useEffect(() => {
    const q = query(collection(db, 'recommendations'), orderBy('createdAt', 'desc'));
    const unsubRecs = onSnapshot(q, (snapshot) => {
      setRecs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recommendation)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recommendations');
    });

    let unsubActions = () => {};
    if (profile) {
      const actionsQ = query(collection(db, 'userActions'), where('userName', '==', profile.name));
      unsubActions = onSnapshot(actionsQ, (snapshot) => {
        setUserActions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAction)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'userActions');
      });
    }

    return () => {
      unsubRecs();
      unsubActions();
    };
  }, [profile?.name]);

  const filteredRecs = recs.filter(r => {
    const typeMatch = filter === 'all' || r.type === filter;
    if (!typeMatch) return false;

    if (view === 'watchlist') {
      const action = userActions.find(a => a.recommendationId === r.id);
      return action?.status === 'Plan to Watch';
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-500">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600 mb-4" />
        <p className="animate-pulse">Fetching the latest recs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tight text-white">
            {view === 'watchlist' ? 'Your Watchlist' : 'Recommendations'}
          </h2>
          <p className="text-slate-500 text-xs font-bold tracking-widest uppercase mt-2">
            {view === 'watchlist' ? 'Movies you want to experience' : 'Discover what the team is binging'}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-slate-900 p-1 border border-slate-800">
          {(['all', 'movie', 'tv'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === t ? 'bg-yellow-400 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-100'
              }`}
            >
              {t === 'all' ? 'All' : (t === 'movie' ? 'Movies' : 'TV Shows')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredRecs.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-800 py-32 text-center bg-slate-900/30">
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
            {view === 'watchlist' 
              ? 'Your watchlist is empty. Browse the feed to find gems! 🍿' 
              : 'No picks yet. Share your first gems! 📽️'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          <AnimatePresence mode="popLayout">
            {filteredRecs.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.05 }}
              >
                <MovieCard rec={rec} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
