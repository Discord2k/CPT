import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Congregation, Volunteer, Evaluation, ConventionSession } from '../types/database';
import { UploadSection } from './UploadSection';
import { StagingGrid } from './StagingGrid';
import type { ExtractedVolunteer } from '../services/gemini';
import { Layers, Users, ArrowLeft, Plus } from 'lucide-react';
import { EvaluationForm } from './EvaluationForm';

interface ConventionDetailProps {
  session: ConventionSession;
  onBack: () => void;
}

export const ConventionDetail: React.FC<ConventionDetailProps> = ({ session, onBack }) => {
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [volunteers, setVolunteers] = useState<(Volunteer & { congregation?: Congregation; evaluations?: Evaluation[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Volunteer Upload and Staging inside the convention details
  const [stagedVolunteers, setStagedVolunteers] = useState<ExtractedVolunteer[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  // Manual rating form states
  const [selectedVolunteer, setSelectedVolunteer] = useState<(Volunteer & { evaluations?: Evaluation[] }) | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const sessionKey = `${session.year}-${session.identifier}`;

  useEffect(() => {
    const loadConventionData = async () => {
      try {
        setLoading(true);
        const [congsList, volsList] = await Promise.all([
          db.getCongregations(sessionKey),
          db.getVolunteers(sessionKey)
        ]);
        setCongregations(congsList);
        setVolunteers(volsList);
      } catch (err) {
        console.error('Error loading convention details:', err);
      } finally {
        setLoading(false);
      }
    };
    loadConventionData();
  }, [sessionKey, refreshKey]);

  const handleVolunteersExtracted = (vols: ExtractedVolunteer[]) => {
    setStagedVolunteers(vols);
    setShowUploadPanel(false);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCreateEvaluation = (vol: Volunteer & { evaluations?: Evaluation[] }) => {
    setSelectedVolunteer(vol);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Back Button and Convention Title Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-sand-50 border border-sand-200 p-5 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-cream-100 rounded-lg transition-colors border border-sand-200 bg-white">
            <ArrowLeft className="w-4 h-4 text-forest-700" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-forest-800 font-mono tracking-tight uppercase">
              {session.year} - {session.identifier}
            </h2>
            <p className="text-xs text-sand-600 font-sans mt-0.5">
              {session.location} • Held on: {session.date}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadPanel(!showUploadPanel)}
            className="btn-secondary text-xs"
          >
            {showUploadPanel ? 'Close Import Tool' : 'Bulk Ingest / Upload'}
          </button>
        </div>
      </div>

      {/* Upload and Staging Panels */}
      {showUploadPanel && (
        <UploadSection 
          onVolunteersExtracted={handleVolunteersExtracted}
          onRefreshData={handleRefresh}
        />
      )}

      {stagedVolunteers.length > 0 && (
        <StagingGrid 
          extractedData={stagedVolunteers}
          onClear={() => setStagedVolunteers([])}
          onConfirm={() => {
            setStagedVolunteers([]);
            handleRefresh();
          }}
        />
      )}

      {loading ? (
        <div className="p-12 text-center text-sand-500 font-mono">
          Loading convention metadata...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Assigned Congregations List */}
          <div className="md:col-span-1 bg-white border border-sand-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-forest-800 font-mono tracking-tight uppercase flex items-center gap-1.5 border-b border-sand-200 pb-2">
              <Layers className="w-4 h-4 text-forest-700" />
              Linked Congregations ({congregations.length})
            </h3>
            {congregations.length === 0 ? (
              <div className="text-center py-6 text-sand-400 italic text-xs">
                No congregations linked to this convention.
              </div>
            ) : (
              <div className="space-y-2 max-h-[450px] overflow-y-auto">
                {congregations.map(c => (
                  <div key={c.id} className="border border-sand-200 rounded p-2.5 bg-sand-50/50 hover:bg-cream-50 transition-colors flex justify-between items-center">
                    <span className="font-semibold text-xs text-sand-800">{c.name}</span>
                    <span className="font-mono text-[10px] text-sand-500">#{c.number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Volunteers and Evaluations List */}
          <div className="md:col-span-2 bg-white border border-sand-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-forest-800 font-mono tracking-tight uppercase flex items-center gap-1.5 border-b border-sand-200 pb-2">
              <Users className="w-4 h-4 text-forest-700" />
              Registered Volunteers ({volunteers.length})
            </h3>
            {volunteers.length === 0 ? (
              <div className="text-center py-12 text-sand-400 italic text-xs">
                No volunteers registered for this convention session yet. Upload a roster or recommendations to start.
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {volunteers.map(v => {
                  const rating = v.evaluations?.find(e => e.convention_identifier === session.identifier)?.rating;
                  const dept = v.evaluations?.find(e => e.convention_identifier === session.identifier)?.department;
                  const assignment = v.evaluations?.find(e => e.convention_identifier === session.identifier)?.assignment;

                  return (
                    <div key={v.id} className="border border-sand-200 rounded-lg p-3 hover:border-forest-500 transition-all bg-sand-50/30 flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm text-forest-900">{v.name}</div>
                        <div className="text-xs text-sand-600 font-medium">Congregation: {v.congregation?.name || 'Unlinked'}</div>
                        <div className="text-xs text-sand-500 mt-1">
                          {dept ? `Department: ${dept} (${assignment || 'Assistant'})` : 'No active department assignment'}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {rating ? (
                          <span className="bg-forest-600 text-cream-50 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                            Rating: {rating}
                          </span>
                        ) : (
                          <span className="text-[10px] text-sand-400 font-mono italic">Unrated</span>
                        )}
                        <button
                          onClick={() => handleCreateEvaluation(v)}
                          className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> Rate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Evaluation Form Dialog */}
      {isFormOpen && selectedVolunteer && (
        <EvaluationForm
          volunteer={selectedVolunteer}
          editingEvaluation={null}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedVolunteer(null);
          }}
          onSaved={() => {
            setIsFormOpen(false);
            setSelectedVolunteer(null);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
};
