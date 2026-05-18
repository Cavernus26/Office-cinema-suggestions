import React from 'react';
import { motion } from 'motion/react';
import { ChevronDown, X, User, Film, Tv, LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';

export interface FilterState {
  userId: string | null;
  genre: string | null;
  type: 'all' | 'movie' | 'tv';
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableUsers: { id: string; name: string }[];
  availableGenres: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  availableUsers,
  availableGenres,
}) => {
  const currentUserName = availableUsers.find(u => u.id === filters.userId)?.name || 'All Users';

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* User Selection (Horizontal Chips) */}
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1 block italic">Filter by Sharer</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onFilterChange({ ...filters, userId: null })}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
              filters.userId === null 
                ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20" 
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-100"
            )}
          >
            All Users
          </button>
          {availableUsers.map(user => (
            <button
              key={user.id}
              onClick={() => onFilterChange({ ...filters, userId: user.id })}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5",
                filters.userId === user.id
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-100"
              )}
            >
              <User className="h-3 w-3" />
              {user.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Genre Dropdown */}
        <div className="flex-1 space-y-3">
           <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1 block italic">Genre</label>
           <div className="relative group">
              <select
                value={filters.genre || ''}
                onChange={(e) => onFilterChange({ ...filters, genre: e.target.value || null })}
                className="w-full appearance-none bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all cursor-pointer hover:border-slate-700 uppercase tracking-widest"
              >
                <option value="">All Genres</option>
                {availableGenres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none group-hover:text-slate-300 transition-colors" />
           </div>
        </div>

        {/* Content Type (Segmented Controls) */}
        <div className="shrink-0 space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1 block italic">Content Type</label>
          <div className="flex p-1.5 rounded-2xl bg-slate-900 border border-slate-800 h-[50px]">
            {[
              { id: 'all', icon: LayoutGrid, label: 'All' },
              { id: 'movie', icon: Film, label: 'Movies' },
              { id: 'tv', icon: Tv, label: 'TV Shows' }
            ].map((type) => {
              const Icon = type.icon;
              const isActive = filters.type === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => onFilterChange({ ...filters, type: type.id as any })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    isActive ? "bg-yellow-400 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-100"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex items-end pb-0 sm:pb-1">
          <button
            onClick={() => onFilterChange({ userId: null, genre: null, type: 'all' })}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800/50 text-slate-400 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/30 border border-transparent transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <X className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
