import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { extractCongregationsFromDoc } from '../services/gemini';
import type { ExtractedCongregation } from '../services/gemini';
import type { Congregation, ConventionSession } from '../types/database';
import { X, Check, Upload, RefreshCw, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ConventionFormProps {
  onClose: () => void;
  onSaved: () => void;
}

export const ConventionForm: React.FC<ConventionFormProps> = ({ onClose, onSaved }) => {
  // Wizard Steps: 'details' -> 'congregations'
  const [step, setStep] = useState<'details' | 'congregations'>('details');

  // Step 1: Convention Details
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [identifier, setIdentifier] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');

  // Step 2: Congregation selection
  const [availableCongregations, setAvailableCongregations] = useState<Congregation[]>([]);
  const [selectedCongregations, setSelectedCongregations] = useState<string[]>([]); // list of unique names/numbers to copy/assign
  
  // AI upload states
  const [uploadMode, setUploadMode] = useState<'select' | 'ai'>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stagedCongregations, setStagedCongregations] = useState<ExtractedCongregation[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadAllCongregations = async () => {
      try {
        const congs = await db.getAllCongregations();
        // Remove duplicates in the selection list by mapping to unique names
        const uniqueMap = new Map<string, Congregation>();
        congs.forEach(c => {
          const key = `${c.name.toLowerCase()}-${c.number}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, c);
          }
        });
        setAvailableCongregations(Array.from(uniqueMap.values()));
      } catch (err) {
        console.error(err);
      }
    };
    if (step === 'congregations') {
      loadAllCongregations();
    }
  }, [step]);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !location || !date) {
      setError('Please fill in all convention details.');
      return;
    }
    setError('');
    setStep('congregations');
  };

  const handleToggleCongregationSelection = (congKey: string) => {
    setSelectedCongregations(prev =>
      prev.includes(congKey) ? prev.filter(k => k !== congKey) : [...prev, congKey]
    );
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = err => reject(err);
    });
  };

  const getExcelText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
          resolve(csv);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = err => reject(err);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsProcessing(true);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const isExcel = ['xlsx', 'xls', 'csv'].includes(fileExt || '');
      const isPdf = fileExt === 'pdf';

      if (!isExcel && !isPdf) {
        throw new Error('Unsupported format. Please upload a PDF or Excel/CSV sheet.');
      }

      let extracted: ExtractedCongregation[] = [];
      if (isPdf) {
        const base64 = await getBase64(file);
        extracted = await extractCongregationsFromDoc(file, base64);
      } else {
        const excelText = await getExcelText(file);
        extracted = await extractCongregationsFromDoc(file, '', excelText);
      }

      if (extracted.length === 0) {
        throw new Error('No congregations could be extracted.');
      }

      setStagedCongregations(prev => [...prev, ...extracted]);
    } catch (err: any) {
      setError(err.message || 'Error processing document.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveAll = async () => {
    try {
      setError('');
      const sessionKey = `${year}-${identifier.toUpperCase()}`;

      // 1. Create Convention Session
      const sessionData: ConventionSession = {
        year,
        identifier: identifier.toUpperCase(),
        location,
        date
      };
      await db.addSession(sessionData);

      // 2. Prep congregations list to save
      const congregationsToUpsert: Omit<Congregation, 'id'>[] = [];

      // A. Add selected existing congregations
      selectedCongregations.forEach(congKey => {
        const match = availableCongregations.find(c => `${c.name.toLowerCase()}-${c.number}` === congKey);
        if (match) {
          congregationsToUpsert.push({
            name: match.name,
            number: match.number,
            assigned_convention_id: sessionKey
          });
        }
      });

      // B. Add staged AI-extracted congregations
      stagedCongregations.forEach(sc => {
        congregationsToUpsert.push({
          name: sc.name,
          number: sc.number || Math.floor(10000 + Math.random() * 90000).toString(),
          assigned_convention_id: sessionKey
        });
      });

      // C. Save congregations to DB if any
      if (congregationsToUpsert.length > 0) {
        await db.upsertCongregations(congregationsToUpsert);
      }

      onSaved();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save convention context.');
    }
  };

  return (
    <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-sand-200 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden font-sans flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-forest-800 text-cream-50 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold font-mono tracking-tight uppercase">
              Initialize New Convention Session
            </h3>
            <p className="text-xs text-forest-200 mt-0.5">
              Step {step === 'details' ? '1: Main Info' : '2: Congregation Setup'}
            </p>
          </div>
          <button onClick={onClose} className="text-forest-300 hover:text-cream-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-red-800 bg-red-50 border border-red-200 p-3 rounded text-xs font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
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
                <div>
                  <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
                    Identifier / Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CO-01"
                    className="w-full atlas-input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
                  Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="Assembly Hall or Arena Location"
                  className="w-full atlas-input font-sans"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1 font-mono">
                  Convention Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full atlas-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-sand-200">
                <button type="submit" className="btn-primary">
                  Next: Setup Congregations
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Selector Mode Tabs */}
              <div className="flex border-b border-sand-200 pb-2 gap-4">
                <button
                  onClick={() => setUploadMode('select')}
                  className={`pb-2 text-xs font-semibold uppercase font-mono border-b-2 transition-all ${
                    uploadMode === 'select'
                      ? 'border-forest-600 text-forest-800'
                      : 'border-transparent text-sand-500 hover:text-sand-800'
                  }`}
                >
                  Choose From Roster ({selectedCongregations.length} selected)
                </button>
                <button
                  onClick={() => setUploadMode('ai')}
                  className={`pb-2 text-xs font-semibold uppercase font-mono border-b-2 transition-all ${
                    uploadMode === 'ai'
                      ? 'border-forest-600 text-forest-800'
                      : 'border-transparent text-sand-500 hover:text-sand-800'
                  }`}
                >
                  AI Extract / Bulk Ingestion ({stagedCongregations.length} staged)
                </button>
              </div>

              {uploadMode === 'select' ? (
                <div className="space-y-2">
                  <p className="text-xs text-sand-600 leading-relaxed mb-3">
                    Select existing congregations in CPT database to link to this new session.
                  </p>
                  
                  {availableCongregations.length === 0 ? (
                    <div className="text-center py-6 text-sand-500 border border-dashed border-sand-300 rounded font-mono text-xs">
                      No congregations previously entered. Try AI Bulk Ingestion instead.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-sand-200 rounded p-3 bg-sand-50">
                      {availableCongregations.map(cong => {
                        const congKey = `${cong.name.toLowerCase()}-${cong.number}`;
                        const isSelected = selectedCongregations.includes(congKey);
                        return (
                          <label
                            key={congKey}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all select-none text-xs font-semibold ${
                              isSelected
                                ? 'bg-forest-50 border-forest-500 text-forest-900'
                                : 'bg-white border-sand-200 text-sand-700 hover:bg-cream-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="focus:ring-forest-500 h-3.5 w-3.5 text-forest-600 border-sand-300 rounded cursor-pointer"
                              checked={isSelected}
                              onChange={() => handleToggleCongregationSelection(congKey)}
                            />
                            <div>
                              <div>{cong.name}</div>
                              <div className="text-[10px] text-sand-500 font-mono">#{cong.number}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                      accept=".pdf,.xlsx,.xls,.csv"
                      className="hidden"
                      id="cong-file-upload"
                    />
                    <label
                      htmlFor="cong-file-upload"
                      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-cream-50 ${
                        isProcessing
                          ? 'border-forest-400 bg-cream-50 opacity-70 pointer-events-none'
                          : 'border-sand-300 hover:border-forest-600'
                      }`}
                    >
                      {isProcessing ? (
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="w-8 h-8 text-forest-600 animate-spin" />
                          <span className="text-xs font-semibold text-forest-800 font-mono">
                            Gemini reading & extracting congregations...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <div className="bg-cream-200 p-2.5 rounded-full text-forest-700 mb-2">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-sand-800">
                            Upload Congregation Directory (PDF or Excel)
                          </span>
                        </div>
                      )}
                    </label>
                  </div>

                  {stagedCongregations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold font-mono text-sand-600 uppercase tracking-widest">
                        Staged Congregations ({stagedCongregations.length})
                      </h4>
                      <div className="border border-sand-200 rounded max-h-40 overflow-y-auto divide-y divide-sand-200 bg-white">
                        {stagedCongregations.map((sc, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 text-xs font-mono">
                            <span className="font-semibold text-sand-800">{sc.name}</span>
                            <span className="text-sand-500">#{sc.number || 'Pending'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="btn-secondary text-xs"
                >
                  Back to Details
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  className="btn-primary text-xs"
                >
                  <Check className="w-4 h-4" /> Initialize & Link Congregations
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
