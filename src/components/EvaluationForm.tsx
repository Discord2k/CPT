import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import type { Volunteer, Evaluation, RatingType } from '../types/database';
import { db } from '../services/db';
import { Award, Save, X, Calendar, Clipboard, MapPin, Briefcase, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';

interface EvaluationFormProps {
  volunteer: Volunteer & { evaluations?: Evaluation[] };
  editingEvaluation?: Evaluation | null;
  onClose: () => void;
  onSaved: () => void;
}

const RATING_OPTIONS: RatingType[] = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];

export const EvaluationForm: React.FC<EvaluationFormProps> = ({
  volunteer,
  editingEvaluation,
  onClose,
  onSaved
}) => {
  const { activeSession } = useSession();
  
  // Evaluation States
  const [rating, setRating] = useState<RatingType>('A');
  const [year, setYear] = useState<number>(activeSession?.year || new Date().getFullYear());
  const [conventionIdentifier, setConventionIdentifier] = useState(activeSession?.identifier || '');
  const [location, setLocation] = useState(activeSession?.location || '');
  const [department, setDepartment] = useState('');
  const [assignment, setAssignment] = useState('');
  const [comments, setComments] = useState('');
  
  // Volunteer State (stored in Volunteer table)
  const [isCommitteeAssistant, setIsCommitteeAssistant] = useState(volunteer.is_committee_assistant);

  useEffect(() => {
    if (editingEvaluation) {
      setRating(editingEvaluation.rating);
      setYear(editingEvaluation.year);
      setConventionIdentifier(editingEvaluation.convention_identifier);
      setLocation(editingEvaluation.location);
      setDepartment(editingEvaluation.department);
      setAssignment(editingEvaluation.assignment);
      setComments(editingEvaluation.comments);
    } else if (activeSession) {
      setRating('A');
      setYear(activeSession.year);
      setConventionIdentifier(activeSession.identifier);
      setLocation(activeSession.location);
      setDepartment('');
      setAssignment('');
      setComments('');
    }
    setIsCommitteeAssistant(volunteer.is_committee_assistant);
  }, [editingEvaluation, volunteer, activeSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 1. Update volunteer's assistant status
      if (isCommitteeAssistant !== volunteer.is_committee_assistant) {
        await db.updateVolunteerAssistantStatus(volunteer.id, isCommitteeAssistant);
      }

      // 2. Save evaluation record
      const evaluationPayload: Omit<Evaluation, 'id'> & { id?: string } = {
        volunteer_id: volunteer.id,
        user_id: 'active.evaluator@jwpub.org', // dynamic evaluator
        rating,
        year: Number(year),
        convention_identifier: conventionIdentifier,
        location,
        department,
        assignment,
        comments
      };

      if (editingEvaluation) {
        evaluationPayload.id = editingEvaluation.id;
      }

      await db.saveEvaluation(evaluationPayload);
      
      confetti({
        particleCount: 30,
        spread: 40,
        colors: ['#1B4332', '#FDFBF7']
      });

      onSaved();
    } catch (err) {
      console.error(err);
      alert('Error saving evaluation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-cream-100 border border-sand-300 rounded-xl shadow-2xl p-6 overflow-hidden">
        
        <div className="flex justify-between items-center pb-4 border-b border-sand-200">
          <div>
            <h3 className="text-base font-bold text-forest-800">
              {editingEvaluation ? 'Edit Evaluation' : 'New Volunteer Evaluation'}
            </h3>
            <p className="text-xs text-sand-500 font-mono mt-0.5">
              Volunteer: {volunteer.name} ({volunteer.age} y/o)
            </p>
          </div>
          <button onClick={onClose} className="text-sand-500 hover:text-sand-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          
          {/* 1. Rating Dropdown (FIRST FIELD IN LAYOUT) */}
          <div className="bg-cream-200 border border-sand-300 p-3.5 rounded-lg">
            <label className="block text-xs font-bold text-forest-800 uppercase tracking-widest font-mono mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-forest-600 animate-pulse" />
              Volunteer Rating (Enforced order A+ to C-)
            </label>
            <select
              required
              className="w-full bg-white border border-sand-300 rounded px-3 py-2.5 text-base font-bold font-mono text-forest-800 focus:outline-none focus:ring-1 focus:ring-forest-600 focus:border-forest-600"
              value={rating}
              onChange={(e) => setRating(e.target.value as RatingType)}
            >
              {RATING_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <p className="text-[10px] text-sand-500 mt-1 font-mono">
              Evaluators select sorting bracket: A = High recommendation, B = Satisfactory, C = Needs growth.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 2. Year */}
            <div>
              <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-sand-400" />
                Convention Year
              </label>
              <input
                type="number"
                required
                className="w-full atlas-input"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            
            {/* 3. Convention */}
            <div>
              <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
                <Clipboard className="w-3.5 h-3.5 text-sand-400" />
                Convention ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CO-01"
                className="w-full atlas-input"
                value={conventionIdentifier}
                onChange={(e) => setConventionIdentifier(e.target.value)}
              />
            </div>
          </div>

          {/* 4. Location */}
          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-sand-400" />
              Location
            </label>
            <input
              type="text"
              required
              placeholder="e.g. East Valley Assembly Hall"
              className="w-full atlas-input font-sans"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 5. Department */}
            <div>
              <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-sand-400" />
                Department
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Attendants"
                className="w-full atlas-input font-sans"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>

            {/* 6. Assignment */}
            <div>
              <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-sand-400" />
                Assignment
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Row Captain"
                className="w-full atlas-input font-sans"
                value={assignment}
                onChange={(e) => setAssignment(e.target.value)}
              />
            </div>
          </div>

          {/* 7. Comments */}
          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-sand-400" />
              Evaluator Comments
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide specific notes regarding work ethic, demeanor, reliability, and capability..."
              className="w-full atlas-input font-sans"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          {/* 8. Committee Assistant Toggle (Prominent checkbox) */}
          <div className="relative flex items-start bg-sand-50 border border-sand-200 rounded p-3">
            <div className="flex items-center h-5">
              <input
                id="assistant-toggle"
                type="checkbox"
                className="focus:ring-forest-500 h-4 w-4 text-forest-600 border-sand-300 rounded cursor-pointer"
                checked={isCommitteeAssistant}
                onChange={(e) => setIsCommitteeAssistant(e.target.checked)}
              />
            </div>
            <div className="ml-3 text-xs">
              <label htmlFor="assistant-toggle" className="font-bold text-forest-800 cursor-pointer font-sans select-none">
                Has served as a convention committee assistant
              </label>
              <p className="text-sand-500 font-mono mt-0.5">
                Toggle this flag to mark this volunteer for special committee coordinator roles next session.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              <Save className="w-4 h-4" /> Save Evaluation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
