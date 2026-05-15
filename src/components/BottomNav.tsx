import React from 'react';
import { Sparkles, Bookmark, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  currentView: 'feed' | 'watchlist' | 'community';
  onViewChange: (view: 'feed' | 'watchlist' | 'community') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onViewChange }) => {
  const tabs = [
    { id: 'feed', label: 'Feed', icon: Sparkles },
    { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
    { id: 'community', label: 'Community', icon: Trophy },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 px-6 py-3 lg:hidden">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                isActive ? "text-yellow-400" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                isActive && "bg-yellow-400/10 shadow-[0_0_20px_rgba(234,179,8,0.1)]"
              )}>
                <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
