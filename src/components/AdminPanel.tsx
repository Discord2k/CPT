import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { X, Users, Database, Shield, ShieldAlert, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'database'>('users');
  const [profiles, setProfiles] = useState<{ id: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Stats
  const [stats, setStats] = useState({ vols: 0, congs: 0, evals: 0 });

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'users') {
        const usersList = await db.getUserProfiles();
        setProfiles(usersList);
      } else {
        const [, congsList, evalsList] = await Promise.all([
          db.getSessions().then(() => db.getAllCongregations()), // dummy call sequence to fetch related stats
          db.getAllCongregations(),
          db.getAllEvaluations()
        ]);
        // Since getVolunteers requires session context, we estimate total volumes via db queries
        const allVols = await db.getAllCongregations().then(async (congs) => {
          let total = 0;
          for (const c of congs) {
            const list = await db.getVolunteers(c.assigned_convention_id);
            total += list.length;
          }
          return total;
        }).catch(() => 0);

        setStats({
          vols: allVols,
          congs: congsList.length,
          evals: evalsList.length
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load administrative records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen, activeTab]);

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      setError('');
      await db.updateUserProfileRole(userId, newRole);
      setSuccess(`Updated user role to ${newRole}!`);
      loadAdminData();
      
      confetti({
        particleCount: 20,
        spread: 30,
        colors: ['#1B4332', '#DEC9A3']
      });
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to modify role.');
    }
  };

  const handleDeleteProfile = async (userId: string, email: string) => {
    if (confirm(`Are you sure you want to delete the profile for ${email}? This will remove their roles and permissions.`)) {
      try {
        setError('');
        await db.deleteUserProfile(userId);
        setSuccess('Profile record deleted successfully!');
        loadAdminData();
        setTimeout(() => setSuccess(''), 2000);
      } catch (err: any) {
        setError(err.message || 'Failed to delete user profile.');
      }
    }
  };

  const handlePurgeDatabase = async () => {
    if (confirm("DANGER: Are you sure you want to delete all volunteers, congregations, and evaluations from Supabase? This action is permanent and cannot be undone.")) {
      try {
        setLoading(true);
        setError('');
        await db.clearAllData();
        
        confetti({
          particleCount: 80,
          spread: 50,
          colors: ['#880808', '#FFFFFF']
        });
        
        alert("Database records have been purged. Page will reload.");
        window.location.reload();
      } catch (err: any) {
        setError(err.message || 'Failed to purge database.');
        setLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-3xl bg-cream-100 border border-sand-300 rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-sand-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-forest-600 animate-pulse" />
            <div>
              <h3 className="text-lg font-bold text-forest-800">CPT Admin Control Center</h3>
              <p className="text-xs text-sand-500 font-mono">Configure roles, monitor database capacities, and purge data.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-sand-500 hover:text-sand-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-sand-200 mt-4 flex-shrink-0">
          <button
            onClick={() => { setActiveTab('users'); setError(''); }}
            className={`pb-2.5 px-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'users' 
                ? 'border-forest-600 text-forest-800' 
                : 'border-transparent text-sand-500 hover:text-sand-800'
            }`}
          >
            <Users className="w-4 h-4" />
            User Access Roles
          </button>
          <button
            onClick={() => { setActiveTab('database'); setError(''); }}
            className={`pb-2.5 px-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'database' 
                ? 'border-forest-600 text-forest-800' 
                : 'border-transparent text-sand-500 hover:text-sand-800'
            }`}
          >
            <Database className="w-4 h-4" />
            Database Control
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-xs font-mono flex-shrink-0">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 bg-forest-50 border border-forest-100 text-forest-800 p-2.5 rounded text-xs font-mono flex-shrink-0">
            {success}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-grow overflow-y-auto py-4">
          {loading ? (
            <div className="py-12 text-center text-sand-500 font-mono text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-forest-600" />
              Loading console dashboard...
            </div>
          ) : activeTab === 'users' ? (
            <div className="border border-sand-200 rounded overflow-hidden">
              <table className="min-w-full divide-y divide-sand-200 font-mono text-xs text-left">
                <thead className="bg-sand-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-sand-700">User Email</th>
                    <th className="px-4 py-3 font-bold text-sand-700 text-center">Active Role</th>
                    <th className="px-4 py-3 font-bold text-sand-700">Supabase Auth ID</th>
                    <th className="px-4 py-3 font-bold text-sand-700 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sand-200">
                  {profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-cream-50 transition-colors">
                      <td className="px-4 py-3 font-sans font-semibold text-sand-900">{p.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.role === 'admin' ? 'bg-forest-100 text-forest-800 border border-forest-200' : 'bg-sand-100 text-sand-700 border border-sand-300'
                        }`}>
                          <Shield className="w-3 h-3" /> {p.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sand-500 font-mono text-[10px]">{p.id}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleToggleRole(p.id, p.role)}
                            className="bg-sand-100 hover:bg-forest-50 hover:text-forest-800 text-sand-700 px-2 py-1 rounded border border-sand-300 hover:border-forest-300 transition-colors"
                          >
                            Toggle Role
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(p.id, p.email)}
                            className="p-1 rounded text-red-600 hover:bg-red-50 hover:text-red-950 transition-colors"
                            title="Delete user profile mapping"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-sand-200 rounded p-4 text-center">
                  <div className="text-[10px] font-bold font-mono text-sand-500 uppercase tracking-wide">Total Congregations</div>
                  <div className="text-2xl font-bold font-mono text-forest-800 mt-1">{stats.congs}</div>
                </div>
                <div className="bg-white border border-sand-200 rounded p-4 text-center">
                  <div className="text-[10px] font-bold font-mono text-sand-500 uppercase tracking-wide">Staged Volunteers</div>
                  <div className="text-2xl font-bold font-mono text-forest-800 mt-1">{stats.vols}</div>
                </div>
                <div className="bg-white border border-sand-200 rounded p-4 text-center">
                  <div className="text-[10px] font-bold font-mono text-sand-500 uppercase tracking-wide">Evaluation Forms</div>
                  <div className="text-2xl font-bold font-mono text-forest-800 mt-1">{stats.evals}</div>
                </div>
              </div>

              {/* Purge block */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                <h4 className="text-sm font-bold text-red-800 flex items-center gap-1.5 uppercase font-mono">
                  <AlertTriangle className="w-4 h-4 text-red-700" />
                  Danger Zone
                </h4>
                <p className="text-xs text-red-700 mt-2 leading-relaxed font-sans">
                  Executing a database purge will permanently delete all records of volunteers, matched congregations, and evaluations from your Supabase tables. User login profiles will remain active, but all rosters will be wiped.
                </p>
                <div className="mt-4">
                  <button
                    onClick={handlePurgeDatabase}
                    className="bg-red-700 hover:bg-red-800 text-white font-semibold px-4 py-2 rounded text-xs transition-colors shadow-sm inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Purge Supabase Roster Tables
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-sand-200 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
