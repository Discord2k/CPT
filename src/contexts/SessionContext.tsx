import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ConventionSession } from '../types/database';
import { db, initSupabase, isSupabaseConfigured, getSupabaseInstance } from '../services/db';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

interface SessionContextType {
  user: UserProfile | null;
  activeSession: ConventionSession | null;
  sessions: ConventionSession[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changeCredentials: (newEmail: string, newPassword?: string) => Promise<void>;
  selectSession: (session: ConventionSession) => void;
  createSession: (session: ConventionSession) => Promise<void>;
  refreshSessions: () => Promise<void>;
  supabaseConfigured: boolean;
  isConnected: boolean;
  reloadConfig: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeSession, setActiveSession] = useState<ConventionSession | null>(null);
  const [sessions, setSessions] = useState<ConventionSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const checkConfigAndConnection = async () => {
    const configured = isSupabaseConfigured();
    setSupabaseConfigured(configured);
    
    if (configured) {
      const connected = await db.testConnection();
      setIsConnected(connected);
      return connected;
    } else {
      setIsConnected(false);
      return false;
    }
  };

  const loadSessionData = async () => {
    try {
      const list = await db.getSessions();
      setSessions(list);

      // Load session filter selection if stored
      const savedSession = localStorage.getItem('ATLAS_ACTIVE_SESSION');
      if (savedSession) {
        try {
          setActiveSession(JSON.parse(savedSession));
        } catch (e) {
          localStorage.removeItem('ATLAS_ACTIVE_SESSION');
        }
      } else if (list.length > 0) {
        setActiveSession(list[0]);
      }
    } catch (e) {
      console.error('Failed to load session data:', e);
    }
  };

  const fetchUserProfile = async (authUserId: string, email: string): Promise<UserProfile> => {
    try {
      const profile = await db.getUserProfile(authUserId);
      if (profile) {
        return {
          id: profile.id,
          email: profile.email,
          role: profile.role as 'admin' | 'user'
        };
      }
    } catch (err) {
      console.error('Failed to retrieve user profile:', err);
    }
    // Fallback to default user role if profiles table lookup fails or hasn't triggered yet
    return { id: authUserId, email, role: 'user' };
  };

  // Sync auth state
  useEffect(() => {
    const syncAuth = async () => {
      setLoading(true);
      const connected = await checkConfigAndConnection();
      
      if (connected) {
        try {
          const client = getSupabaseInstance();
          
          // Get current session
          const { data: { session } } = await client.auth.getSession();
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id, session.user.email || '');
            setUser(profile);
            await loadSessionData();
          }

          // Listen for auth changes
          const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, currentSession) => {
            if (currentSession?.user) {
              const profile = await fetchUserProfile(currentSession.user.id, currentSession.user.email || '');
              setUser(profile);
              await loadSessionData();
            } else {
              setUser(null);
              setActiveSession(null);
            }
          });

          return () => {
            subscription.unsubscribe();
          };
        } catch (e) {
          console.error('Auth sync failed:', e);
        }
      }
      setLoading(false);
    };

    syncAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const client = getSupabaseInstance();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) {
      const profile = await fetchUserProfile(data.user.id, data.user.email || '');
      setUser(profile);
      await loadSessionData();
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    const client = getSupabaseInstance();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    if (data?.user) {
      const profile = await fetchUserProfile(data.user.id, data.user.email || '');
      setUser(profile);
      await loadSessionData();
    }
  };

  const logout = async (): Promise<void> => {
    const client = getSupabaseInstance();
    await client.auth.signOut();
    setUser(null);
    setActiveSession(null);
    localStorage.removeItem('ATLAS_ACTIVE_SESSION');
  };

  const changeCredentials = async (newEmail: string, newPassword?: string): Promise<void> => {
    const client = getSupabaseInstance();
    const updateData: { email?: string; password?: string } = { email: newEmail };
    if (newPassword && newPassword.trim()) {
      updateData.password = newPassword.trim();
    }
    const { error } = await client.auth.updateUser(updateData);
    if (error) throw error;
  };

  const selectSession = (session: ConventionSession) => {
    setActiveSession(session);
    localStorage.setItem('ATLAS_ACTIVE_SESSION', JSON.stringify(session));
  };

  const createSession = async (session: ConventionSession) => {
    await db.addSession(session);
    await loadSessionData();
    selectSession(session);
  };

  const refreshSessions = async () => {
    const list = await db.getSessions();
    setSessions(list);
  };

  const reloadConfig = async () => {
    initSupabase();
    setLoading(true);
    const connected = await checkConfigAndConnection();
    if (connected) {
      await loadSessionData();
    }
    setLoading(false);
  };

  return (
    <SessionContext.Provider value={{
      user,
      activeSession,
      sessions,
      loading,
      login,
      signUp,
      logout,
      changeCredentials,
      selectSession,
      createSession,
      refreshSessions,
      supabaseConfigured,
      isConnected,
      reloadConfig
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
