import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Film, User, Settings, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const TopBar: React.FC<{ onOpenAdd: () => void }> = ({ onOpenAdd }) => {
  const { profile, logout, user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const handleSelectAvatar = async (avatarUrl: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { avatar: avatarUrl });
    } catch (err) {
      console.error(err);
    }
  };

  const AVATAR_OPTIONS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Coco',
    'https://api.dicebear.com/7.x/pixel-art/svg?seed=Mario',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Alice',
    'https://api.dicebear.com/7.x/notionists/svg?seed=Bob',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Sparkle',
  ];

  return (
    <header className="h-24 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-2 lg:hidden">
        <Film className="h-6 w-6 text-yellow-400" />
        <span className="text-xl font-black tracking-tight text-yellow-400">CINE<span className="text-white">SHARE</span></span>
      </div>
      
      <div className="hidden lg:block">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Dashboard</h2>
      </div>

      <div className="flex items-center space-x-6">
        <button
          onClick={onOpenAdd}
          className="bg-yellow-400 text-slate-950 px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-yellow-400/10"
        >
          <span className="text-xl">+</span> Recommend
        </button>
        
        <div className="relative">
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-100">{profile?.name}</div>
              <div className="text-[10px] text-yellow-400 uppercase tracking-widest font-black">Member</div>
            </div>
            <button 
              onClick={() => { setShowMenu(!showMenu); setShowAvatarPicker(false); }}
              className="group relative"
            >
              <img
                src={profile?.avatar}
                alt="Avatar"
                className="w-10 h-10 rounded-full border-2 border-slate-800 transition-transform group-hover:scale-110"
              />
              <div className="absolute -top-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-slate-950" />
            </button>
          </div>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-64 origin-top-right rounded-2xl bg-slate-900 border border-slate-800 p-2 shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-800 mb-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Signed in as</p>
                    <p className="text-sm font-bold text-white truncate">{profile?.name}</p>
                  </div>

                  {!showAvatarPicker ? (
                    <>
                      <button 
                        onClick={() => setShowAvatarPicker(true)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
                      >
                        <Palette className="w-4 h-4" />
                        Change Avatar
                      </button>
                    </>
                  ) : (
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-3 px-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pick Avatar</span>
                        <button onClick={() => setShowAvatarPicker(false)} className="text-[10px] font-bold text-yellow-400 hover:underline">Back</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {AVATAR_OPTIONS.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => { handleSelectAvatar(opt); setShowMenu(false); }}
                            className="aspect-square rounded-lg border border-slate-800 p-1 hover:border-yellow-400/50 hover:bg-slate-800 transition-all"
                          >
                            <img src={opt} alt="Avatar option" className="w-full h-full rounded-md" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-slate-800 my-2" />

                  <button 
                    onClick={logout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
