import React, { useState, useEffect } from 'react';
import { Recommendation, UserAction, WatchStatus } from '../types';
import { tmdbService } from '../services/tmdb';
import { motion, AnimatePresence } from 'motion/react';
import { Play, CheckCircle, Clock, Trash2, Heart, BookmarkPlus, BookmarkCheck, Loader2, Star } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDocs, getDoc, collection, deleteDoc, updateDoc, setDoc, query, where, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface MovieCardProps {
  rec: Recommendation;
  onDelete?: () => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ rec, onDelete }) => {
  const { user, profile } = useAuth();
  const [actions, setActions] = useState<UserAction[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `recommendations/${rec.id}/actions`), (snapshot) => {
      setActions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserAction)));
    });
    return unsub;
  }, [rec.id]);

  const userAction = user ? actions.find(a => a.userId === user.uid) : null;
  const completedCount = actions.filter(a => a.status === 'Completed').length;
  const watchingCount = actions.filter(a => a.status === 'Watching').length;

  const handleStatusChange = async (newStatus: WatchStatus | null) => {
    if (!user || !profile) return;
    const actionId = `${user.uid}_${rec.id}`;
    const actionPath = `recommendations/${rec.id}/actions/${user.uid}`;
    const userActionPath = `userActions/${actionId}`;
    
    // Get existing status to handle transitions
    const oldStatus = userAction?.status || null;
    if (oldStatus === newStatus) return; // No change

    try {
      if (!newStatus) {
        // Clear status - delete the record
        await deleteDoc(doc(db, actionPath));
        await deleteDoc(doc(db, userActionPath));
        
        // Decrement if we were in Completed status
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          let updates: any = {};
          
          if (oldStatus === 'Completed') {
            updates.watchedCount = Math.max(0, (userData.watchedCount || 0) - 1);
          }
          
          if (oldStatus === 'Watching' && userData.currentlyWatching?.id === rec.id) {
            updates.currentlyWatching = null;
          }
          
          if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
          }
        }
        return;
      }

      const actionData = {
        userId: user.uid,
        userName: profile?.name || user.displayName || 'Anonymous',
        recommendationId: rec.id,
        status: newStatus,
        createdAt: serverTimestamp(),
      };

      // Write to both places
      await setDoc(doc(db, actionPath), actionData, { merge: true });
      await setDoc(doc(db, userActionPath), actionData, { merge: true });

      // Handle watchedCount transitions
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        let updates: any = {};
        
        if (newStatus === 'Completed' && oldStatus !== 'Completed') {
          updates.watchedCount = (userData.watchedCount || 0) + 1;
        } else if (newStatus !== 'Completed' && oldStatus === 'Completed') {
          updates.watchedCount = Math.max(0, (userData.watchedCount || 0) - 1);
        }

        if (newStatus === 'Watching') {
          updates.currentlyWatching = { title: rec.title, id: rec.id };
        } else if (oldStatus === 'Watching' && userData.currentlyWatching?.id === rec.id) {
          updates.currentlyWatching = null;
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(userRef, updates);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, actionPath);
    }
  };

  const [isRating, setIsRating] = useState<number | null>(null);

  const handleRating = async (rating: number) => {
    if (!user || !profile) return;
    
    setIsRating(rating);
    const actionPath = `recommendations/${rec.id}/actions/${user.uid}`;
    const userActionPath = `userActions/${user.uid}_${rec.id}`;
    const recRef = doc(db, 'recommendations', rec.id);
    const authorId = rec.authorId;
    const authorRef = authorId ? doc(db, 'users', authorId) : null;
    
    const oldRating = userAction?.rating || 0;
    if (oldRating === rating) {
      setIsRating(null);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const recDoc = await transaction.get(recRef);
        if (!recDoc.exists()) throw new Error("Recommendation does not exist!");

        let authorDoc = null;
        if (authorRef) {
          authorDoc = await transaction.get(authorRef);
        }
        
        const actionData = { 
          rating,
          userId: user.uid,
          userName: profile.name,
          recommendationId: rec.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Update Action records
        transaction.set(doc(db, actionPath), actionData, { merge: true });
        transaction.set(doc(db, userActionPath), actionData, { merge: true });

        // Update Recommendation Stats
        const recData = recDoc.data();
        const currentRecSum = (recData.averageRating || 0) * (recData.ratingCount || 0);
        const newRecRatingSum = currentRecSum - oldRating + rating;
        const newRecRatingCount = (recData.ratingCount || 0) + (oldRating === 0 ? 1 : 0);
        
        transaction.update(recRef, {
          averageRating: newRecRatingSum / newRecRatingCount,
          ratingCount: newRecRatingCount
        });

        // Update Author Stats
        if (authorRef && authorDoc?.exists()) {
          const authorData = authorDoc.data();
          const currentAuthorSum = (authorData.totalRecommendationRatingSum || 0);
          const currentAuthorCount = (authorData.totalRecommendationRatingCount || 0);
          
          const newAuthorSum = currentAuthorSum - oldRating + rating;
          const newAuthorCount = currentAuthorCount + (oldRating === 0 ? 1 : 0);
          
          transaction.update(authorRef, {
            totalRecommendationRatingSum: newAuthorSum,
            totalRecommendationRatingCount: newAuthorCount,
            avgRecommendationRating: newAuthorSum / newAuthorCount
          });
        }
      });
      console.log('Rating updated successfully:', rating);
    } catch (err: any) {
      console.error('Rating failed:', err);
      // Attempt simpler update if transaction failed due to author doc issues
      if (err.message?.includes('permission-denied')) {
        alert("Permission denied. You can only rate other people's recommendations.");
      } else {
        handleFirestoreError(err, OperationType.WRITE, actionPath);
      }
    } finally {
      setIsRating(null);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!user) {
      alert('Error: No user session found.');
      return;
    }
    
    setIsDeleting(true);
    try {
      console.log(`Deleting: recommendations/${rec.id}`);
      await deleteDoc(doc(db, 'recommendations', rec.id));
      
      // Attempt stats update, but ignore if it fails (not critical for delete)
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          await updateDoc(userRef, {
            recsCount: Math.max(0, (userDoc.data().recsCount || 1) - 1)
          });
        }
      } catch (statsErr) {
        console.warn('Stats update failed:', statsErr);
      }
      
      if (onDelete) onDelete();
      alert('Successfully deleted!');
    } catch (err: any) {
      console.error('DELETE FAILED:', err);
      alert(`Delete permission denied or Firestore error. Details: ${err.message}`);
      handleFirestoreError(err, OperationType.DELETE, `recommendations/${rec.id}`);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <motion.div
      id={`rec-${rec.id}`}
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-yellow-400/5"
    >
      {/* Poster Image */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <img
          src={tmdbService.getPosterUrl(rec.posterPath)}
          alt={rec.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Overlay on Hover */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 pointer-events-none max-w-[calc(100%-20px)]">
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-indigo-600/90 backdrop-blur-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-xl ring-1 ring-white/10">
              {rec.type === 'tv' ? 'TV' : 'Movie'}
            </span>
            <span className="rounded-full bg-yellow-400/90 backdrop-blur-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-950 shadow-xl ring-1 ring-white/10">
              {rec.year}
            </span>
          </div>
          
          {rec.voteAverage && (
            <div className="flex">
              <span className="flex items-center gap-1 rounded-full bg-slate-950/80 backdrop-blur-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-yellow-400 shadow-xl ring-1 ring-white/10">
                <Star className="h-2 w-2 fill-current" />
                {rec.voteAverage.toFixed(1)} <span className="text-white/60 text-[6px] ml-0.5">TMDB</span>
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {rec.type === 'movie' && rec.runtime && (
              <span className="rounded-full bg-slate-950/70 backdrop-blur-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-200 shadow-xl ring-1 ring-white/5">
                {rec.runtime}m
              </span>
            )}
            {rec.type === 'tv' && rec.seasons && (
              <span className="rounded-full bg-slate-950/70 backdrop-blur-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-200 shadow-xl ring-1 ring-white/5">
                {rec.seasons}s {rec.episodesCount && `• ${rec.episodesCount}e`}
              </span>
            )}
          </div>
        </div>

        {/* Delete button for author - hidden by default, visible on hover */}
        {(user?.uid === rec.authorId || profile?.name.toLowerCase() === rec.authorName.toLowerCase()) && (
          <div className="absolute top-4 right-4 z-[100] flex flex-col items-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            {!showConfirm ? (
              <button
                onClick={(e) => { 
                  e.preventDefault();
                  e.stopPropagation(); 
                  setShowConfirm(true);
                  console.log('Delete intent initiated for:', rec.title);
                }}
                className="rounded-full bg-red-500/20 p-3 text-red-500 backdrop-blur-md hover:bg-red-500 hover:text-white transition-all shadow-lg"
                title="Delete Recommendation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-xl bg-red-600 p-1 pr-3 text-[10px] font-black uppercase text-white shadow-2xl"
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Delete confirmed for:', rec.title);
                    handleDelete();
                  }}
                  disabled={isDeleting}
                  className="rounded-lg bg-white px-3 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowConfirm(false);
                  }}
                  className="px-2 py-1.5 hover:bg-white/10 rounded-lg"
                >
                  Cancel
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* Quick Actions (On Hover) */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-3 left-2 right-2 z-20 flex flex-col gap-1.5"
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-1.5">
                <button
                  onClick={() => handleStatusChange(userAction?.status === 'Watching' ? null : 'Watching')}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[9px] font-black uppercase transition-all",
                    userAction?.status === 'Watching' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-slate-800/90 text-white backdrop-blur-md hover:bg-slate-700"
                  )}
                >
                  <Play className={cn("h-2.5 w-2.5", userAction?.status === 'Watching' ? "fill-current" : "")} />
                  <span className="tracking-tight whitespace-nowrap">Watching</span>
                </button>
                <button
                  onClick={() => handleStatusChange(userAction?.status === 'Completed' ? null : 'Completed')}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[9px] font-black uppercase transition-all",
                    userAction?.status === 'Completed' ? "bg-green-600 text-white shadow-lg shadow-green-500/20" : "bg-slate-800/90 text-white backdrop-blur-md hover:bg-slate-700"
                  )}
                >
                  <CheckCircle className="h-2.5 w-2.5" />
                  <span className="tracking-tight whitespace-nowrap">Watched</span>
                </button>
              </div>
              <button
                onClick={() => handleStatusChange(userAction?.status === 'Plan to Watch' ? null : 'Plan to Watch')}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[9px] font-black uppercase transition-all border",
                  userAction?.status === 'Plan to Watch' 
                    ? "bg-yellow-400 text-slate-950 border-yellow-400 shadow-lg shadow-yellow-400/20" 
                    : "bg-slate-800/90 text-white backdrop-blur-md border-transparent hover:bg-slate-700 hover:border-slate-600"
                )}
              >
                {userAction?.status === 'Plan to Watch' ? <BookmarkCheck className="h-3 w-3" /> : <BookmarkPlus className="h-3 w-3" />}
                <span className="tracking-tight whitespace-nowrap">{userAction?.status === 'Plan to Watch' ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em] mb-1.5 drop-shadow-sm">@{rec.authorName.toLowerCase()}</div>
        <h3 className="line-clamp-1 text-sm font-black uppercase tracking-wider leading-tight text-white transition-colors group-hover:text-yellow-400">
          {rec.title}
        </h3>
        <div className="mt-3 flex items-start justify-between gap-3 min-h-[4.5rem]">
          <p className="line-clamp-3 text-[11px] italic text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed grow">
            "{rec.comment}"
          </p>
          {rec.averageRating && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1 rounded-xl bg-yellow-400/10 px-2.5 py-1.5 border border-yellow-400/20 shadow-inner">
                <Star className="h-3 w-3 text-yellow-400 fill-current" />
                <span className="text-xs font-black text-yellow-400">{rec.averageRating.toFixed(1)}</span>
              </div>
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">
                {rec.ratingCount} {rec.ratingCount === 1 ? 'rating' : 'ratings'}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 mb-2 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 ring-1 ring-inset ring-white/5 shadow-2xl">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => {
              const isAuthor = user && rec.authorId ? user.uid === rec.authorId : (profile?.name && rec.authorName && profile.name.toLowerCase() === rec.authorName.toLowerCase());
              const isRatingThis = isRating === star;
              
              return (
                <button
                  key={star}
                  disabled={!!isRating}
                  className={cn(
                    "transition-all duration-300 transform active:scale-90",
                    !isAuthor && !isRating && "hover:scale-125 cursor-pointer",
                    (isAuthor || isRating) && "cursor-default",
                    isAuthor && "opacity-30",
                    (userAction?.rating || 0) >= star 
                      ? "text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]" 
                      : "text-slate-400 hover:text-slate-300"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Star clicked:', star, 'isAuthor:', isAuthor, 'recAuthorId:', rec.authorId, 'userUid:', user?.uid);
                    if (!isAuthor && !isRating) {
                      handleRating(star);
                    }
                  }}
                >
                  {isRatingThis ? (
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                  ) : (
                    <Star 
                      className={cn(
                        "h-4 w-4", 
                        (userAction?.rating || 0) >= star && "fill-current"
                      )} 
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="h-4 flex items-center px-2 overflow-hidden w-full justify-center">
            {profile?.name?.toLowerCase() === rec.authorName?.toLowerCase() ? (
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.1em] whitespace-nowrap">Office Average Rating</span>
            ) : (
              <span className={cn(
                "text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap",
                userAction?.rating ? "text-yellow-400" : "text-slate-200"
              )}>
                {isRating ? 'Updating...' : (userAction?.rating ? `Your Rating: ${userAction.rating} / 5` : 'Rate this experience')}
              </span>
            )}
          </div>
        </div>

        {/* Individual Ratings Feed */}
        {actions.filter(a => a.rating).length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-[7px] font-black text-slate-600 uppercase tracking-wider mb-2">Community Feedback</p>
            <div className="max-h-20 overflow-y-auto pr-1 custom-scrollbar">
              {actions.filter(a => a.rating).sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).map((action) => (
                <div key={action.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-[9px] font-bold text-slate-400 truncate max-w-[100px]">
                    {action.userId === user?.uid ? 'You' : action.userName}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({length: 5}).map((_, i) => (
                      <Star key={i} className={cn("h-1.5 w-1.5", i < action.rating ? "text-yellow-500 fill-current" : "text-slate-800")} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-800/50">
          <div className="flex items-center -space-x-2">
             <img 
               src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rec.authorName}`}
               alt={rec.authorName}
               className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700"
             />
          </div>
          
          <div className="flex gap-3 text-slate-500">
            {completedCount > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                <span className="text-[10px] font-bold">{completedCount}</span>
              </div>
            )}
            {watchingCount > 0 && (
              <div className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                <span className="text-[10px] font-bold">{watchingCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
