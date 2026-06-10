import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { X, Key, Database, RefreshCw, Sparkles, CheckCircle2, User, Eye, EyeOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import { db, getSupabaseInstance } from '../services/db';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, reloadConfig, supabaseConfigured, changeCredentials } = useSession();
  const [activeSettingsTab, setActiveSettingsTab] = useState<'api' | 'profile'>('api');

  // API Config States
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  // Profile Change States
  const [profileEmail, setProfileEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status/Feedback
  const [savedStatus, setSavedStatus] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSupabaseUrl(localStorage.getItem('ATLAS_SUPABASE_URL') || '');
      setSupabaseAnonKey(localStorage.getItem('ATLAS_SUPABASE_ANON_KEY') || '');
      setGeminiKey(localStorage.getItem('ATLAS_GEMINI_KEY') || '');
      
      if (user) {
        setProfileEmail(user.email);
      }
      setNewPassword('');
      setConfirmNewPassword('');
      setCurrentPassword('');
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, user]);

  const handleSaveAPI = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (supabaseUrl.trim() && supabaseAnonKey.trim()) {
      localStorage.setItem('ATLAS_SUPABASE_URL', supabaseUrl.trim());
      localStorage.setItem('ATLAS_SUPABASE_ANON_KEY', supabaseAnonKey.trim());
    } else {
      localStorage.removeItem('ATLAS_SUPABASE_URL');
      localStorage.removeItem('ATLAS_SUPABASE_ANON_KEY');
    }

    if (geminiKey.trim()) {
      localStorage.setItem('ATLAS_GEMINI_KEY', geminiKey.trim());
    } else {
      localStorage.removeItem('ATLAS_GEMINI_KEY');
    }

    reloadConfig();
    setSavedStatus(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#1B4332', '#386B47', '#DEC9A3']
    });

    setTimeout(() => {
      setSavedStatus(false);
      onClose();
    }, 1200);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!currentPassword) {
      setError('You must confirm your current password to authorize changes.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const client = getSupabaseInstance();

      // 1. Verify current password by logging in first
      const { error: authError } = await client.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      });

      if (authError) {
        throw new Error('Current password is incorrect. Verification failed.');
      }

      // 2. Perform credentials updates
      await changeCredentials(profileEmail, newPassword || undefined);

      setSuccessMsg('Account profile successfully updated!');
      confetti({
        particleCount: 30,
        colors: ['#1B4332', '#FFFFFF']
      });

      // Clear fields
      setNewPassword('');
      setConfirmNewPassword('');
      setCurrentPassword('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update account credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('ATLAS_SUPABASE_URL');
    localStorage.removeItem('ATLAS_SUPABASE_ANON_KEY');
    localStorage.removeItem('ATLAS_GEMINI_KEY');
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setGeminiKey('');
    reloadConfig();
    
    setSavedStatus(true);
    setTimeout(() => {
      setSavedStatus(false);
    }, 1000);
  };

  const handlePurgeData = async () => {
    if (confirm("Are you sure you want to purge all volunteer, congregation, and evaluation records? This cannot be undone.")) {
      await db.clearAllData();
      alert("All sandbox records purged. Refreshing workspace...");
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-cream-100 border border-sand-300 rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-sand-200 flex-shrink-0">
          <h3 className="text-lg font-bold text-forest-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-forest-600" />
            CPT Setup & Account Panel
          </h3>
          <button onClick={onClose} className="text-sand-500 hover:text-sand-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-sand-200 mt-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setActiveSettingsTab('api'); setError(''); setSuccessMsg(''); }}
            className={`pb-2 px-4 text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 border-b-2 transition-all ${
              activeSettingsTab === 'api' 
                ? 'border-forest-600 text-forest-800' 
                : 'border-transparent text-sand-500 hover:text-sand-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            System API Keys
          </button>
          {user && (
            <button
              type="button"
              onClick={() => { setActiveSettingsTab('profile'); setError(''); setSuccessMsg(''); }}
              className={`pb-2 px-4 text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 border-b-2 transition-all ${
                activeSettingsTab === 'profile' 
                  ? 'border-forest-600 text-forest-800' 
                  : 'border-transparent text-sand-500 hover:text-sand-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              My Profile Settings
            </button>
          )}
        </div>

        {/* Success/Error Banners */}
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-xs font-mono flex-shrink-0">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-3 bg-forest-50 border border-forest-100 text-forest-800 p-2.5 rounded text-xs font-mono flex-shrink-0">
            {successMsg}
          </div>
        )}

        {/* Form Body */}
        <div className="flex-grow overflow-y-auto py-4">
          {savedStatus ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-16 h-16 text-forest-600 animate-bounce" />
              <h4 className="mt-4 text-lg font-bold text-forest-800">Configurations Saved</h4>
              <p className="text-sand-600 text-sm mt-1">Reloading database contexts...</p>
            </div>
          ) : activeSettingsTab === 'api' ? (
            <form onSubmit={handleSaveAPI} className="space-y-4">
              
              <div className="bg-sand-50 border border-sand-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-forest-600" />
                  <h4 className="text-xs font-bold font-mono text-sand-800 uppercase tracking-wide">
                    Supabase Integration
                  </h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-sand-600 uppercase tracking-widest font-mono mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://xyz.supabase.co"
                      className="w-full atlas-input font-mono"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sand-600 uppercase tracking-widest font-mono mb-1">
                      Supabase Anon Key
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOi..."
                      className="w-full atlas-input font-mono"
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-mono text-sand-600">
                  <span>Connection Status:</span>
                  <span className={`font-bold ${supabaseConfigured ? 'text-forest-600' : 'text-red-600'}`}>
                    {supabaseConfigured ? 'Live Connection Active' : 'Offline Connection Blocked'}
                  </span>
                </div>
              </div>

              <div className="bg-sand-50 border border-sand-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-forest-600" />
                  <h4 className="text-xs font-bold font-mono text-sand-800 uppercase tracking-wide">
                    Gemini API Gateway
                  </h4>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sand-600 uppercase tracking-widest font-mono mb-1">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      className="w-full atlas-input pl-9 font-mono"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                    />
                    <Key className="w-4 h-4 text-sand-400 absolute left-3 top-3" />
                  </div>
                  <p className="text-[10px] text-sand-500 mt-1.5 leading-relaxed">
                    Required to parse recommendation letters and Excel rosters.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-sand-200">
                <div className="flex flex-col items-start gap-1.5">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-red-700 hover:text-red-900 font-mono font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Clear API Keys
                  </button>
                  <button
                    type="button"
                    onClick={handlePurgeData}
                    className="text-xs text-red-700 hover:text-red-900 font-mono font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Purge Sandbox Records
                  </button>
                </div>
                
                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Config
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              <div className="bg-sand-50 border border-sand-200 p-4 rounded-lg space-y-3">
                
                {/* 1. Email field */}
                <div>
                  <label className="block text-[10px] font-bold text-sand-600 uppercase tracking-widest font-mono mb-1">
                    Sign-in Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@jwpub.org"
                    className="w-full atlas-input font-mono"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                  />
                </div>

                {/* 2. New Password */}
                <div>
                  <label className="block text-[10px] font-bold text-sand-600 uppercase tracking-widest font-mono mb-1">
                    New Password (Leave blank to keep current)
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full atlas-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                {/* 3. Confirm New Password */}
                {newPassword && (
                  <div>
                    <label className="block text-[10px] font-bold text-sand-600 uppercase tracking-widest font-mono mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="w-full atlas-input"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* 4. Current Password verification block (DANGER ACTION VERIFICATION) */}
              <div className="bg-cream-200 border border-sand-300 p-4 rounded-lg">
                <label className="block text-xs font-bold text-forest-800 uppercase tracking-widest font-mono mb-1.5 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-forest-600 animate-pulse" />
                  Confirm Current Password (Required)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Verify your identity to apply modifications..."
                    className="w-full atlas-input pr-10"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-sand-400 hover:text-sand-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-sand-500 mt-1 font-mono leading-normal">
                  To safeguard account security, please type your active password before saving any profile changes.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="btn-primary"
                >
                  {isSubmitting ? 'Updating...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
