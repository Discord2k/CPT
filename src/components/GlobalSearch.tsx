import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Volunteer, Congregation, Evaluation, ConventionSession } from '../types/database';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { RATING_SORT_ORDER } from '../types/database';

export const GlobalSearch: React.FC = () => {
  const [volunteers, setVolunteers] = useState<(Volunteer & { congregation?: Congregation; evaluations?: Evaluation[] })[]>([]);
  const [sessions, setSessions] = useState<ConventionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [nameQuery, setNameQuery] = useState('');
  const [ageQuery, setAgeQuery] = useState('');
  const [congregationQuery, setCongregationQuery] = useState('');
  const [conventionQuery, setConventionQuery] = useState('');
  const [conventionCodeQuery, setConventionCodeQuery] = useState('');
  const [conventionDateQuery, setConventionDateQuery] = useState('');
  const [ratingQuery, setRatingQuery] = useState('all');

  const [expandedVolunteers, setExpandedVolunteers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [volsList, sessList] = await Promise.all([
          db.getAllVolunteers(),
          db.getSessions()
        ]);
        setVolunteers(volsList);
        setSessions(sessList);
      } catch (err: any) {
        console.error('Error loading global search data:', err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedVolunteers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter volunteers based on all search criteria
  const filteredVolunteers = volunteers.filter(v => {
    // 1. Name match
    if (nameQuery && !v.name.toLowerCase().includes(nameQuery.toLowerCase()) && !v.jwpub_email.toLowerCase().includes(nameQuery.toLowerCase())) {
      return false;
    }

    // 2. Age match
    if (ageQuery && v.age.toString() !== ageQuery) {
      return false;
    }

    // 3. Congregation match (name or number)
    if (congregationQuery) {
      const congName = v.congregation?.name.toLowerCase() || '';
      const congNum = v.congregation?.number || '';
      const q = congregationQuery.toLowerCase();
      if (!congName.includes(q) && !congNum.includes(q)) {
        return false;
      }
    }

    // Filters that depend on evaluations or convention sessions:
    const evals = v.evaluations || [];
    const hasMatchingEvaluation = evals.some(ev => {
      // Find corresponding session for details if needed
      const session = sessions.find(s => s.identifier === ev.convention_identifier && s.year === ev.year);

      // 4. Convention location/name match
      if (conventionQuery) {
        const locationMatch = ev.location.toLowerCase().includes(conventionQuery.toLowerCase()) || 
                             (session?.location || '').toLowerCase().includes(conventionQuery.toLowerCase());
        if (!locationMatch) return false;
      }

      // 5. Convention Code (e.g. CO-01) match
      if (conventionCodeQuery) {
        const codeMatch = ev.convention_identifier.toLowerCase().includes(conventionCodeQuery.toLowerCase()) || 
                          (session?.identifier || '').toLowerCase().includes(conventionCodeQuery.toLowerCase());
        if (!codeMatch) return false;
      }

      // 6. Convention Date match
      if (conventionDateQuery) {
        const dateMatch = (session?.date || '').includes(conventionDateQuery);
        if (!dateMatch) return false;
      }

      // 7. Rating match
      if (ratingQuery !== 'all' && ev.rating !== ratingQuery) {
        return false;
      }

      return true;
    });

    // If any evaluation-based filters are set, the volunteer must have a matching evaluation
    const evalFiltersActive = conventionQuery || conventionCodeQuery || conventionDateQuery || ratingQuery !== 'all';
    if (evalFiltersActive && !hasMatchingEvaluation) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-sand-50 border border-sand-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-sand-200 pb-2">
          <Search className="w-5 h-5 text-forest-700" />
          <h3 className="text-sm font-bold text-forest-800 font-mono tracking-tight uppercase">
            Global Search Engine
          </h3>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
              Volunteer Name / Email
            </label>
            <input
              type="text"
              placeholder="Search name..."
              className="w-full atlas-input py-1.5 text-xs"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
              Age
            </label>
            <input
              type="number"
              placeholder="e.g. 25"
              className="w-full atlas-input py-1.5 text-xs"
              value={ageQuery}
              onChange={(e) => setAgeQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
              Congregation (Name / No.)
            </label>
            <input
              type="text"
              placeholder="Search congregation..."
              className="w-full atlas-input py-1.5 text-xs"
              value={congregationQuery}
              onChange={(e) => setCongregationQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
              Rating
            </label>
            <select
              className="w-full atlas-input py-1.5 text-xs"
              value={ratingQuery}
              onChange={(e) => setRatingQuery(e.target.value)}
            >
              <option value="all">All Ratings</option>
              {Object.keys(RATING_SORT_ORDER).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
              Convention Location / Name
            </label>
            <input
              type="text"
              placeholder="e.g. Arena"
              className="w-full atlas-input py-1.5 text-xs"
              value={conventionQuery}
              onChange={(e) => setConventionQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
              Convention Code
            </label>
            <input
              type="text"
              placeholder="e.g. CO-01"
              className="w-full atlas-input py-1.5 text-xs"
              value={conventionCodeQuery}
              onChange={(e) => setConventionCodeQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
              Convention Date
            </label>
            <input
              type="date"
              className="w-full atlas-input py-1.5 text-xs"
              value={conventionDateQuery}
              onChange={(e) => setConventionDateQuery(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setNameQuery('');
                setAgeQuery('');
                setCongregationQuery('');
                setConventionQuery('');
                setConventionCodeQuery('');
                setConventionDateQuery('');
                setRatingQuery('all');
              }}
              className="w-full bg-sand-200 hover:bg-sand-300 text-sand-800 py-2 rounded text-xs font-semibold font-mono uppercase tracking-wider transition-colors border border-sand-300"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-xs font-mono">
          <strong>Database Connection Error:</strong> {error}
        </div>
      )}

      {/* Results Section */}
      <div className="bg-white border border-sand-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sand-500 font-mono">
              Searching database...
            </div>
          ) : filteredVolunteers.length === 0 ? (
            <div className="p-12 text-center text-sand-500 font-mono">
              No results match your search filters.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-sand-200">
              <thead className="bg-sand-50 font-mono text-xs text-sand-700 uppercase">
                <tr>
                  <th className="w-10"></th>
                  <th className="px-6 py-3.5 text-left font-bold tracking-wider">Name</th>
                  <th className="px-6 py-3.5 text-center font-bold tracking-wider">Age</th>
                  <th className="px-6 py-3.5 text-left font-bold tracking-wider">Congregation</th>
                  <th className="px-6 py-3.5 text-center font-bold tracking-wider">Active Assignments</th>
                  <th className="px-6 py-3.5 text-center font-bold tracking-wider">Latest Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200 font-sans text-sm text-sand-800">
                {filteredVolunteers.map((vol) => {
                  const evals = vol.evaluations || [];
                  const sortedEvals = [...evals].sort((a, b) => b.year - a.year);
                  const latestEval = sortedEvals[0];
                  const isExpanded = !!expandedVolunteers[vol.id];

                  return (
                    <React.Fragment key={vol.id}>
                      <tr className="hover:bg-cream-50 transition-colors">
                        <td className="pl-4 py-4 text-center">
                          <button onClick={() => toggleExpand(vol.id)} className="text-sand-400 hover:text-forest-700">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-forest-800">{vol.name}</div>
                          <div className="text-[10px] text-sand-500 font-mono">{vol.jwpub_email}</div>
                        </td>
                        <td className="px-6 py-4 text-center">{vol.age || '—'}</td>
                        <td className="px-6 py-4">
                          {vol.congregation ? (
                            <div>
                              <div className="font-semibold text-sand-700">{vol.congregation.name}</div>
                              <div className="text-[10px] text-sand-500 font-mono">#{vol.congregation.number}</div>
                            </div>
                          ) : (
                            <span className="text-sand-400 italic text-xs">Unlinked</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs bg-sand-100 text-sand-700 px-2 py-1 rounded font-mono">
                            {evals.length} evaluation(s)
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {latestEval ? (
                            <span className="inline-flex items-center justify-center font-mono font-bold text-xs bg-forest-600 text-cream-50 px-2.5 py-0.5 rounded-full">
                              {latestEval.rating}
                            </span>
                          ) : (
                            <span className="text-sand-400 font-mono text-xs">Unrated</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable History */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-sand-50 border-t border-b border-sand-200 px-8 py-4">
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold font-mono text-sand-600 uppercase tracking-widest">
                                Complete Evaluation History
                              </h4>
                              {evals.length === 0 ? (
                                <p className="text-xs text-sand-500 italic">No evaluations logged.</p>
                              ) : (
                                <div className="space-y-2">
                                  {sortedEvals.map(ev => {
                                    const session = sessions.find(s => s.identifier === ev.convention_identifier && s.year === ev.year);
                                    return (
                                      <div key={ev.id} className="bg-white border border-sand-200 rounded p-3 flex justify-between items-start gap-4">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-xs bg-sand-200 px-1.5 py-0.5 rounded text-sand-800">
                                              {ev.rating}
                                            </span>
                                            <span className="font-bold text-xs text-forest-800 font-mono">
                                              {ev.year} - {ev.convention_identifier}
                                            </span>
                                            <span className="text-xs text-sand-400">•</span>
                                            <span className="text-xs text-sand-600 font-semibold">{ev.department} ({ev.assignment})</span>
                                            {session && (
                                              <>
                                                <span className="text-xs text-sand-400">•</span>
                                                <span className="text-xs text-sand-500">{session.location} ({session.date})</span>
                                              </>
                                            )}
                                          </div>
                                          <p className="text-xs text-sand-600 leading-relaxed font-sans mt-1">{ev.comments}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
