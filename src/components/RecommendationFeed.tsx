import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { Recommendation, UserAction } from '../types';
import { MovieCard } from './MovieCard';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, Filter, Bookmark, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { FilterBar, FilterState } from './FilterBar';
import { cn } from '../lib/utils';

interface RecommendationFeedProps {
  view?: 'feed' | 'watchlist';
}

export const RecommendationFeed: React.FC<RecommendationFeedProps> = ({ view = 'feed' }) => {
  const { user, profile } = useAuth();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    userId: null,
    genre: null,
    type: 'all'
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'recommendations'), orderBy('createdAt', 'desc'));
    const unsubRecs = onSnapshot(q, (snapshot) => {
      setRecs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recommendation)));
      setLoading(false);
    }, (error) => {
      // Log but don't re-throw in onSnapshot error handler
      console.warn('Snapshot error (recommendations):', error.message);
      // We don't call handleFirestoreError here because it throws
    });

    let unsubActions = () => {};
    if (user) {
      const actionsQ = query(collection(db, 'userActions'), where('userId', '==', user.uid));
      unsubActions = onSnapshot(actionsQ, (snapshot) => {
        const actions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAction));
        console.log(`[Watchlist] Found ${actions.length} actions for user ${user.uid}`);
        setUserActions(actions);
      }, (error) => {
        console.warn('Snapshot error (userActions):', error.message);
      });
    }

    return () => {
      unsubRecs();
      unsubActions();
    };
  }, [user?.uid, profile?.name]);

  // Background migration for recommendations missing genres
  useEffect(() => {
    if (loading || recs.length === 0) return;

    const itemsToPatch = recs.filter(r => !r.genres || r.genres.length === 0);
    if (itemsToPatch.length === 0) return;

    const patchGenres = async () => {
      console.log(`[Migration] Found ${itemsToPatch.length} items missing genres. Patching...`);
      const { tmdbService } = await import('../services/tmdb');
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      for (const item of itemsToPatch) {
        try {
          const details = await tmdbService.getDetails(item.tmdbId, item.type);
          if (details && details.genres) {
            const genres = details.genres.map((g: any) => {
              if (g.name === 'Science Fiction') return 'Sci-Fi';
              if (g.name === 'Sci-Fi & Fantasy') return 'Sci-Fi';
              return g.name;
            });
            
            await updateDoc(doc(db, 'recommendations', item.id), { genres });
            console.log(`[Migration] Patched genres for: ${item.title}`);
          }
        } catch (err) {
          console.error(`[Migration] Failed to patch ${item.title}:`, err);
        }
      }
    };

    patchGenres();
  }, [recs.length, loading]);

  const availableUsers = React.useMemo(() => {
    const userMap = new Map<string, string>();
    recs.forEach(r => {
      userMap.set(r.authorId, r.authorName);
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [recs]);

  const availableGenres = React.useMemo(() => {
    const genreSet = new Set<string>();
    recs.forEach(r => {
      if (r.genres) {
        r.genres.forEach(g => genreSet.add(g));
      }
    });
    return Array.from(genreSet).sort();
  }, [recs]);

  const filteredRecs = React.useMemo(() => {
    return recs.filter(r => {
      // 1. Content Type Filter
      const typeMatch = filters.type === 'all' || r.type === filters.type;
      if (!typeMatch) return false;

      // 2. User Filter
      const userMatch = !filters.userId || r.authorId === filters.userId;
      if (!userMatch) return false;

      // 3. Genre Filter
      const genreMatch = !filters.genre || (r.genres && r.genres.some(g => {
        if (filters.genre === 'Sci-Fi') {
          return g === 'Sci-Fi' || g === 'Science Fiction' || g === 'Sci-Fi & Fantasy';
        }
        return g === filters.genre;
      }));
      if (!genreMatch) return false;

      // 4. View Specific Logic
      if (view === 'watchlist') {
        const action = userActions.find(a => a.recommendationId === r.id);
        return action?.status === 'Plan to Watch';
      }

      return true;
    });
  }, [recs, filters, userActions, view]);

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
      {/* Header & Main Toggle */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tight text-white">
            {view === 'watchlist' ? 'Your Watchlist' : 'Recommendations'}
          </h2>
          <p className="text-slate-500 text-xs font-bold tracking-widest uppercase mt-2">
            {view === 'watchlist' ? 'Movies you want to experience' : 'Discover what the team is binging'}
          </p>
        </div>

        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={cn(
            "flex items-center gap-3 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border",
            isFilterOpen 
              ? "bg-yellow-400 text-slate-950 border-yellow-300 shadow-xl shadow-yellow-400/20" 
              : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-100"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {(filters.userId || filters.genre || filters.type !== 'all') && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-[8px] text-yellow-400">
              !
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filter Bar */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-8 p-6 rounded-3xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
              <FilterBar
                filters={filters}
                onFilterChange={setFilters}
                availableUsers={availableUsers}
                availableGenres={availableGenres}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
