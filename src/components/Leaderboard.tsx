import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Trophy, Medal, Target, CheckCircle, Send, Crown, Star, Play } from 'lucide-react';
import { cn } from '../lib/utils';

export const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('recsCount', 'desc'), limit(12));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return unsub;
  }, []);

  // Sort users for display and filter duplicates (case-insensitive name)
  const uniqueUsers = users.reduce((acc, current) => {
    const nameKey = current.name.toLowerCase().trim();
    if (!acc[nameKey]) {
      acc[nameKey] = current;
    } else {
      // Keep the one with more recommendations or currently active session
      const isCurrentSession = current.id === auth.currentUser?.uid;
      const isPrevSessionCurrent = acc[nameKey].id === auth.currentUser?.uid;
      
      if (isCurrentSession) {
        acc[nameKey] = current;
      } else if (!isPrevSessionCurrent && (current.recsCount || 0) > (acc[nameKey].recsCount || 0)) {
        acc[nameKey] = current;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const sortedUsers = (Object.values(uniqueUsers) as any[]).sort((a: any, b: any) => {
    // Primary sort: recsCount
    const countDiff = (b.recsCount || 0) - (a.recsCount || 0);
    if (countDiff !== 0) return countDiff;
    // Secondary sort: avgRating
    return (b.avgRecommendationRating || 0) - (a.avgRecommendationRating || 0);
  });

  // Find the Curator from the deduplicated and sorted list
  const curator = sortedUsers
    .filter((u: any) => (u.totalRecommendationRatingCount || 0) >= 1)
    .sort((a: any, b: any) => (b.avgRecommendationRating || 0) - (a.avgRecommendationRating || 0))[0];

  return (
    <div className="w-full space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Community stats</h4>
        <div className="h-[1px] flex-1 bg-slate-800 mx-4" />
        <div className="flex items-center gap-1 text-[10px] font-black text-yellow-400 uppercase tracking-widest">
          <Star className="h-3 w-3 fill-current" />
          Rankings
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedUsers.map((user) => {
          const isCurator = curator && user.id === curator.id;
          
          return (
            <div 
              key={user.id} 
              className={cn(
                "p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm flex flex-col gap-4 group hover:border-yellow-400/30 transition-all duration-300",
                user.id === auth.currentUser?.uid && "ring-1 ring-yellow-400/50 bg-slate-800/80",
                isCurator && "ring-1 ring-yellow-500 bg-yellow-500/5 shadow-[0_0_20px_rgba(234,179,8,0.1)]"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
                    className={cn(
                      "w-12 h-12 rounded-xl bg-slate-800 object-cover border border-slate-700",
                      isCurator && "border-yellow-500"
                    )} 
                    alt={user.name} 
                  />
                  {isCurator ? (
                    <div className="absolute -top-2 -right-2 bg-yellow-500 p-1 rounded-full shadow-lg border border-yellow-400 animate-bounce">
                      <Crown className="w-3 h-3 text-slate-950 fill-current" />
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-slate-900 shadow-xl" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-slate-100 uppercase truncate tracking-wide">
                    {user.name}
                    {user.id === auth.currentUser?.uid && <span className="ml-2 text-[8px] bg-yellow-400 text-slate-950 px-1.5 py-0.5 rounded-full">YOU</span>}
                  </h3>
                  {user.currentlyWatching && (
                    <div className="flex items-center gap-1 mt-0.5 text-indigo-400">
                      <Play className="w-2 h-2 fill-current animate-pulse" />
                      <span className="text-[8px] font-black uppercase tracking-tight truncate max-w-[120px]">
                        Watching: {user.currentlyWatching.title}
                      </span>
                    </div>
                  )}
                  <p className={cn(
                    "text-[9px] font-bold uppercase tracking-widest mt-0.5",
                    isCurator ? "text-yellow-500" : "text-slate-500"
                  )}>
                    {isCurator ? 'The Curator' : 'Top Critic'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/50 rounded-xl p-2.5 border border-white/5 flex flex-col items-center justify-center text-center group/stat">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Send className="h-3 w-3 text-indigo-400" />
                    <span className="text-lg font-black text-white leading-none">{user.recsCount || 0}</span>
                  </div>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter leading-tight group-hover/stat:text-indigo-400 transition-colors">Shared</span>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-2.5 border border-white/5 flex flex-col items-center justify-center text-center group/stat">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle className="h-3 w-3 text-yellow-500" />
                    <span className="text-lg font-black text-yellow-400 leading-none">{user.watchedCount || 0}</span>
                  </div>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter leading-tight group-hover/stat:text-yellow-400 transition-colors">Watched</span>
                </div>
              </div>

              {((user.totalRecommendationRatingCount || 0) > 0) && (
                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Score</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 text-yellow-500 fill-current" />
                    <span className="text-xs font-black text-yellow-500">{(user.avgRecommendationRating || 0).toFixed(1)}</span>
                    <span className="text-[7px] text-slate-600 font-bold ml-0.5">({user.totalRecommendationRatingCount})</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
