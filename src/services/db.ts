import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Congregation, Volunteer, Evaluation, ConventionSession } from '../types/database';
import { HARDCODED_SUPABASE_URL, HARDCODED_SUPABASE_ANON_KEY } from '../config';

// ----------------------------------------------------
// DB Provider & State Management
// ----------------------------------------------------

let supabase: SupabaseClient | null = null;

const getSupabaseKeys = () => {
  const url = HARDCODED_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('ATLAS_SUPABASE_URL');
  const key = HARDCODED_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('ATLAS_SUPABASE_ANON_KEY');
  return { url, key };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseKeys();
  return !!(url && url.trim() && key && key.trim());
};

export const initSupabase = () => {
  try {
    const { url, key } = getSupabaseKeys();
    if (url && url.trim() && key && key.trim()) {
      supabase = createClient(url.trim(), key.trim());
    } else {
      supabase = null;
    }
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    supabase = null;
  }
};

// Initialize on import
initSupabase();

export const getSupabaseInstance = (): SupabaseClient => {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
};

// ----------------------------------------------------
// Database Operations (Supabase Exclusive)
// ----------------------------------------------------

export const db = {
  // --- Connection Verification ---
  async testConnection(): Promise<boolean> {
    if (!supabase) return false;
    try {
      // Test querying convention sessions
      const { error } = await supabase.from('convention_sessions').select('year').limit(1);
      return !error;
    } catch {
      return false;
    }
  },

  // --- User Profiles (Admin & Session Context) ---
  async getUserProfiles(): Promise<{ id: string; email: string; role: string }[]> {
    const client = getSupabaseInstance();
    const { data, error } = await client.from('user_profiles').select('*');
    if (error) throw error;
    return data || [];
  },

  async getUserProfile(userId: string): Promise<{ id: string; email: string; role: string } | null> {
    const client = getSupabaseInstance();
    const { data, error } = await client.from('user_profiles').select('*').eq('id', userId).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No profile found
      throw error;
    }
    return data;
  },

  async updateUserProfileRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    const client = getSupabaseInstance();
    const { error } = await client.from('user_profiles').update({ role }).eq('id', userId);
    if (error) throw error;
  },

  async deleteUserProfile(userId: string): Promise<void> {
    const client = getSupabaseInstance();
    // Deleting the user profile. (Note: Cascade deletes should remove profiles if auth user is deleted, 
    // but deleting here clears profile records. In client Supabase, admins can toggle roles or delete profiles).
    const { error } = await client.from('user_profiles').delete().eq('id', userId);
    if (error) throw error;
  },

  // --- Sessions ---
  async getSessions(): Promise<ConventionSession[]> {
    const client = getSupabaseInstance();
    const { data, error } = await client.from('convention_sessions').select('*');
    if (error) throw error;
    return data || [];
  },

  async addSession(session: ConventionSession): Promise<void> {
    const client = getSupabaseInstance();
    const { error } = await client.from('convention_sessions').insert(session);
    if (error) throw error;
  },

  // --- Congregations ---
  async getCongregations(assignedConventionId: string): Promise<Congregation[]> {
    const client = getSupabaseInstance();
    const { data, error } = await client
      .from('congregations')
      .select('*')
      .eq('assigned_convention_id', assignedConventionId);
    if (error) throw error;
    return data || [];
  },

  async getAllCongregations(): Promise<Congregation[]> {
    const client = getSupabaseInstance();
    const { data, error } = await client.from('congregations').select('*');
    if (error) throw error;
    return data || [];
  },

  async upsertCongregations(congList: Omit<Congregation, 'id'>[]): Promise<void> {
    const client = getSupabaseInstance();
    const { error } = await client.from('congregations').upsert(congList, { onConflict: 'number,assigned_convention_id' });
    if (error) throw error;
  },

  // --- Volunteers ---
  async getVolunteers(assignedConventionId: string): Promise<(Volunteer & { congregation?: Congregation; evaluations?: Evaluation[] })[]> {
    const client = getSupabaseInstance();
    
    // First fetch congregations in session
    const congregations = await this.getCongregations(assignedConventionId);
    const congIds = congregations.map(c => c.id);

    if (congIds.length === 0) return [];

    const { data, error } = await client
      .from('volunteers')
      .select('*, evaluations(*)')
      .in('home_congregation_id', congIds);

    if (error) throw error;

    return (data || []).map((v: any) => ({
      ...v,
      congregation: congregations.find(c => c.id === v.home_congregation_id),
      evaluations: v.evaluations || []
    }));
  },

  async getAllVolunteers(): Promise<(Volunteer & { congregation?: Congregation; evaluations?: Evaluation[] })[]> {
    const client = getSupabaseInstance();
    
    const congregations = await this.getAllCongregations();

    const { data, error } = await client
      .from('volunteers')
      .select('*, evaluations(*)');

    if (error) throw error;

    return (data || []).map((v: any) => ({
      ...v,
      congregation: congregations.find(c => c.id === v.home_congregation_id),
      evaluations: v.evaluations || []
    }));
  },

  async upsertVolunteers(volList: Omit<Volunteer, 'id'>[]): Promise<void> {
    const client = getSupabaseInstance();
    const { error } = await client.from('volunteers').upsert(volList, { onConflict: 'jwpub_email' });
    if (error) throw error;
  },

  async updateVolunteerAssistantStatus(volunteerId: string, isAssistant: boolean): Promise<void> {
    const client = getSupabaseInstance();
    const { error } = await client.from('volunteers').update({ is_committee_assistant: isAssistant }).eq('id', volunteerId);
    if (error) throw error;
  },

  // --- Evaluations ---
  async getAllEvaluations(): Promise<Evaluation[]> {
    const client = getSupabaseInstance();
    const { data, error } = await client.from('evaluations').select('*');
    if (error) throw error;
    return data || [];
  },

  async getEvaluationsForVolunteer(volunteerId: string): Promise<Evaluation[]> {
    const client = getSupabaseInstance();
    const { data, error } = await client.from('evaluations').select('*').eq('volunteer_id', volunteerId);
    if (error) throw error;
    return data || [];
  },

  async saveEvaluation(evalData: Omit<Evaluation, 'id'> & { id?: string }): Promise<void> {
    const client = getSupabaseInstance();
    if (evalData.id) {
      const { error } = await client.from('evaluations').update(evalData).eq('id', evalData.id);
      if (error) throw error;
    } else {
      const { error } = await client.from('evaluations').insert(evalData);
      if (error) throw error;
    }
  },

  async deleteEvaluation(evaluationId: string): Promise<void> {
    const client = getSupabaseInstance();
    const { error } = await client.from('evaluations').delete().eq('id', evaluationId);
    if (error) throw error;
  },

  async deleteVolunteer(volunteerId: string): Promise<void> {
    const client = getSupabaseInstance();
    // Delete associated evaluations first to prevent key constraints issues
    await client.from('evaluations').delete().eq('volunteer_id', volunteerId);
    const { error } = await client.from('volunteers').delete().eq('id', volunteerId);
    if (error) throw error;
  },

  // --- Purge Database Records (Admin action) ---
  async clearAllData(): Promise<void> {
    // 1. Wipe local browser cache tables
    localStorage.removeItem('ATLAS_SESSIONS');
    localStorage.removeItem('ATLAS_CONGREGATIONS');
    localStorage.removeItem('ATLAS_VOLUNTEERS');
    localStorage.removeItem('ATLAS_EVALUATIONS');
    localStorage.removeItem('ATLAS_ACTIVE_SESSION');
    // Set seeded to true so they do not auto-repopulate on reload
    localStorage.setItem('ATLAS_SEEDED', 'true');

    // 2. Wipe Supabase tables if configured
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseInstance();
        
        // Purge evaluations first (foreign key dependency)
        const { error: errorE } = await client.from('evaluations').delete().gt('year', 0);
        if (errorE) console.warn('Supabase evaluations clear warning:', errorE.message);

        // Purge volunteers
        const { error: errorV } = await client.from('volunteers').delete().neq('name', '___non_existent___');
        if (errorV) console.warn('Supabase volunteers clear warning:', errorV.message);

        // Purge congregations
        const { error: errorC } = await client.from('congregations').delete().neq('name', '___non_existent___');
        if (errorC) console.warn('Supabase congregations clear warning:', errorC.message);
      } catch (err) {
        console.error('Failed to purge Supabase tables:', err);
      }
    }
  }
};
