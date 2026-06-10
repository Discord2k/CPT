import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { Compass, Settings, LogOut, Calendar, Database, Server, ShieldAlert } from 'lucide-react';
import { SettingsModal } from './SettingsModal';
import { AdminPanel } from './AdminPanel';

export const Header: React.FC = () => {
  const { user, activeSession, sessions, selectSession, logout, supabaseConfigured } = useSession();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  return (
    <header className="bg-sand-50 border-b border-sand-200 font-sans sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-forest-600 rounded-lg flex items-center justify-center shadow text-cream-100">
              <Compass className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-forest-800 tracking-tight uppercase leading-none font-mono">
                CPT
              </h1>
              <span className="text-[10px] text-sand-500 font-mono">
                Convention Personnel Tool
              </span>
            </div>
          </div>

          {/* Session Switcher & Actions */}
          <div className="flex items-center gap-4">
            
            {/* Active Session Dropdown */}
            {activeSession && (
              <div className="flex items-center bg-white border border-sand-300 rounded px-2.5 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-forest-600 mr-1.5" />
                <span className="font-mono text-sand-500 mr-2 uppercase text-[10px]">Context:</span>
                <select
                  className="font-mono font-bold text-forest-800 focus:outline-none bg-transparent cursor-pointer"
                  value={JSON.stringify(activeSession)}
                  onChange={(e) => selectSession(JSON.parse(e.target.value))}
                >
                  {sessions.map((s) => (
                    <option key={`${s.year}-${s.identifier}`} value={JSON.stringify(s)}>
                      {s.year} - {s.identifier} ({s.location.substring(0, 15)}...)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status indicator */}
            <span 
              title={supabaseConfigured ? 'Supabase cloud storage active' : 'Offline sandbox storage active'} 
              className={`p-1.5 rounded-full border ${supabaseConfigured ? 'bg-forest-50 border-forest-200 text-forest-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}
            >
              {supabaseConfigured ? <Database className="w-4 h-4" /> : <Server className="w-4 h-4" />}
            </span>

            {/* Admin Panel Link (Only visible to admin role) */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setIsAdminOpen(true)}
                className="p-1.5 rounded-full border border-forest-300 bg-forest-50 text-forest-700 hover:bg-forest-600 hover:text-cream-50 transition-all flex items-center justify-center cursor-pointer animate-pulse"
                title="Open Admin Panel"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            )}

            {/* Settings Trigger */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-full border border-sand-300 text-sand-600 hover:text-forest-700 hover:bg-cream-50 transition-colors cursor-pointer"
              title="CPT settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Logout */}
            {user && (
              <div className="flex items-center gap-2 border-l border-sand-200 pl-4">
                <div className="hidden sm:block text-right">
                  <div className="text-[10px] text-sand-400 font-mono leading-none">Logged in ({user.role})</div>
                  <div className="text-xs font-semibold text-sand-700 font-mono mt-0.5">{user.email}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </header>
  );
};
