import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { Compass, Database, AlertCircle, WifiOff, Lock, User, Info, Sun, Moon } from 'lucide-react';

export const SessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    user, 
    login, 
    signUp, 
    supabaseConfigured, 
    isConnected,
    reloadConfig
  } = useSession();

  // Screen/Tab States
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  const [error, setError] = useState('');

  // Credentials config inputs for the Connection Block screen
  const [cfgUrl, setCfgUrl] = useState('');
  const [cfgKey, setCfgKey] = useState('');
  const [cfgGemini, setCfgGemini] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      setError('Email and Password are required.');
      return;
    }

    if (authTab === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setIsAuthLoading(true);
    try {
      if (authTab === 'login') {
        await login(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgUrl.trim() || !cfgKey.trim()) {
      setError('Supabase URL and Anon Key are required to build a connection.');
      return;
    }
    
    localStorage.setItem('ATLAS_SUPABASE_URL', cfgUrl.trim());
    localStorage.setItem('ATLAS_SUPABASE_ANON_KEY', cfgKey.trim());
    if (cfgGemini.trim()) {
      localStorage.setItem('ATLAS_GEMINI_KEY', cfgGemini.trim());
    }

    setError('');
    setIsConfiguring(true);
    setTimeout(() => {
      reloadConfig();
      setIsConfiguring(false);
    }, 1000);
  };



  // 1. Connection Error Shield Block (Triggered if not configured or offline)
  if (!supabaseConfigured || !isConnected) {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="mx-auto h-16 w-16 bg-red-800 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
            <WifiOff className="h-8 w-8 text-cream-100" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-forest-800 tracking-tight">
            Supabase Connection Required
          </h2>
          <p className="mt-2 text-center text-sm text-sand-600">
            CPT requires a live connection to a Supabase backend to handle accounts and volunteer data.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
          <div className="bg-sand-50 py-8 px-4 border border-sand-200 shadow-xl rounded-xl sm:px-10">
            <form className="space-y-4" onSubmit={handleSaveConfig}>
              
              <div className="flex items-start gap-3 bg-cream-200 border border-sand-300 p-3 rounded text-xs text-sand-800 font-mono leading-relaxed">
                <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  No environment variables found. Paste your project credentials below. They will be saved in your local browser storage.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://your-project.supabase.co"
                  className="w-full atlas-input font-mono"
                  value={cfgUrl}
                  onChange={(e) => setCfgUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOi..."
                  className="w-full atlas-input font-mono"
                  value={cfgKey}
                  onChange={(e) => setCfgKey(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
                  Gemini API Key (Optional)
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  className="w-full atlas-input font-mono"
                  value={cfgGemini}
                  onChange={(e) => setCfgGemini(e.target.value)}
                />
              </div>

              {error && (
                <div className="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-xs font-mono">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isConfiguring}
                className="w-full btn-primary py-3 justify-center text-base"
              >
                {isConfiguring ? 'Testing Credentials...' : 'Save Configuration & Connect'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authentication Login/Signup screens
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-amber-500 hover:bg-slate-100'}`}
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>

        <div className="w-full max-w-md p-8">
          {/* Logo Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-500/20 mb-4">
              <Database className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent">
              CPT
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Convention Personnel Tool</p>
          </div>

          <div className={`rounded-2xl border p-6 shadow-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
            {/* Tabs */}
            <div className="flex border-b dark:border-slate-800 border-slate-200 mb-6">
              <button 
                onClick={() => { setAuthTab('login'); setError(''); }}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                  authTab === 'login' 
                  ? 'border-indigo-500 text-indigo-400 font-bold' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-300'
                }`}
              >
                Log In
              </button>
              <button 
                onClick={() => { setAuthTab('signup'); setError(''); }}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                  authTab === 'signup' 
                  ? 'border-indigo-500 text-indigo-400 font-bold' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-300'
                }`}
              >
                New Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">JWPub Email Address</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@jwpub.org"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200 font-mono' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {authTab === 'signup' && (
                <div>
                  <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs font-mono">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isAuthLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {isAuthLoading 
                  ? 'Authenticating...' 
                  : (authTab === 'login' ? 'Authorize CPT Session' : 'Create CPT Account')}
              </button>
            </form>

            <div className="px-6 pb-2 pt-4 text-center border-t dark:border-slate-850 border-slate-100 mt-6">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-mono bg-emerald-500/10 text-emerald-400">
                <Database className="w-3 h-3 text-emerald-500" />
                Supabase Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
