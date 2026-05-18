import React, { useState, useEffect } from 'react';
import { tmdbService, TMDBResult } from '../services/tmdb';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Loader2, Send, Star } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getRandomAvatar } from '../lib/avatars';

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddRecommendationModal: React.FC<AddModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const searchResults = await tmdbService.search(query);
        setResults(searchResults.slice(0, 5));
        
        // Check if there was an error hidden in the response (our backend sends it)
        // Note: tmdbService.search returns [] on error, so we rely on console logs usually,
        // but let's make it smarter.
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !profile || !auth.currentUser) return;

    setIsSubmitting(true);
    try {
      const recData = {
        tmdbId: selectedItem.id,
        title: selectedItem.title || selectedItem.name,
        type: selectedItem.media_type,
        posterPath: selectedItem.poster_path,
        backdropPath: selectedItem.backdrop_path,
        year: (selectedItem.release_date || selectedItem.first_air_date || '').split('-')[0],
        runtime: selectedItem.runtime || null,
        seasons: selectedItem.number_of_seasons || null,
        episodesCount: selectedItem.number_of_episodes || null,
        voteAverage: selectedItem.vote_average || null,
        comment,
        authorId: auth.currentUser.uid,
        authorName: profile.name,
        authorAvatar: profile.avatar || getRandomAvatar(auth.currentUser.uid),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'recommendations'), recData).catch(err => handleFirestoreError(err, OperationType.CREATE, 'recommendations'));
      
      // Increment user's rec count
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef).catch(err => handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser?.uid}`));
        if (userDoc && userDoc.exists()) {
          await updateDoc(userRef, {
            recsCount: (userDoc.data().recsCount || 0) + 1
          }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser?.uid}`));
        }
      }

      onClose();
      // Reset
      setQuery('');
      setSelectedItem(null);
      setComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'recommendations');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-8">
          <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">Share a Movie</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-800 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="space-y-8">
            {/* Search Input */}
            {!selectedItem ? (
              <div className="relative">
                <Search className="absolute top-4 left-5 h-5 w-5 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search movies or TV shows..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-[1.5rem] bg-slate-800 py-4 pl-14 pr-6 text-slate-100 placeholder-slate-500 outline-none ring-2 ring-transparent transition-all focus:ring-yellow-400/30 border border-slate-700 tracking-wide"
                />
                
                {/* Search Results */}
                <div className="mt-4 space-y-3">
                  {isSearching && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-widest">{error}</p>
                    </div>
                  )}

                  {!isSearching && !error && query.length >= 2 && results.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No results found</p>
                    </div>
                  )}

                    {results.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={async () => {
                          setIsSearching(true);
                          try {
                            const details = await tmdbService.getDetails(item.id, item.media_type);
                            setSelectedItem(details);
                          } catch (err) {
                            console.error(err);
                            setSelectedItem(item); // Fallback to basic search result
                          } finally {
                            setIsSearching(false);
                          }
                        }}
                        className="flex w-full items-center gap-5 rounded-2xl bg-slate-800/40 p-3 text-left transition-all hover:bg-slate-800 hover:scale-[1.02]"
                      >
                      <img
                        src={tmdbService.getPosterUrl(item.poster_path, 'w92')}
                        alt="Poster"
                        className="h-20 w-14 rounded-xl object-cover shadow-lg"
                      />
                      <div>
                        <div className="font-black uppercase text-sm text-slate-100 leading-tight tracking-wide">{item.title || item.name}</div>
                        <div className="text-[10px] font-black text-yellow-400 uppercase tracking-widest mt-1">
                          {item.media_type === 'movie' ? 'Movie' : 'TV Show'} • {(item.release_date || item.first_air_date || '').split('-')[0]}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Selected Item Preview */
              <div className="space-y-8">
                <div className="flex gap-5 rounded-3xl bg-slate-800/50 p-6 border border-slate-800">
                  <img
                    src={tmdbService.getPosterUrl(selectedItem.poster_path, 'w185')}
                    alt="Poster"
                    className="h-28 w-20 rounded-xl object-cover shadow-xl"
                  />
                  <div className="flex flex-1 flex-col justify-center">
                    <div className="flex justify-between items-start">
                      <h3 className="font-black uppercase text-xl text-slate-100 leading-none tracking-wide">{selectedItem.title || selectedItem.name}</h3>
                      <button 
                        type="button"
                        onClick={() => setSelectedItem(null)}
                        className="text-[10px] font-black text-yellow-400 uppercase tracking-widest hover:underline"
                      >
                        Change
                      </button>
                    </div>
                    {selectedItem.vote_average && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-current" />
                        <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">{selectedItem.vote_average.toFixed(1)} TMDB Score</span>
                      </div>
                    )}
                    <p className="line-clamp-2 text-xs text-slate-400 mt-2 italic leading-relaxed">{selectedItem.overview}</p>
                  </div>
                </div>

                {/* Comment Input */}
                <div className="space-y-5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1">Why watch it?</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Drop your thoughts here..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full rounded-[1.5rem] bg-slate-800 p-5 text-slate-100 placeholder-slate-500 outline-none ring-2 ring-transparent transition-all focus:ring-yellow-400/30 border border-slate-700 tracking-wide"
                  />
                </div>

                <button
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-yellow-400 py-5 font-black uppercase tracking-widest text-slate-950 transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50 shadow-xl shadow-yellow-400/20"
                  type="submit"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Blast Recommendation
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
};
