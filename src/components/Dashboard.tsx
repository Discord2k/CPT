import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import { db } from '../services/db';
import { extractVolunteersFromDoc } from '../services/gemini';
import type { Congregation, Volunteer, Evaluation } from '../types/database';
import { 
  Search, Plus, Edit2, Trash2, Moon, Sun, Check, X, 
  Upload, Download, Users, Award, 
  ShieldAlert, Sparkles, Filter, Database, AlertCircle, RefreshCw,
  Sliders, Calendar, MapPin, Phone, Mail, Globe, LogOut
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';

const calculateAge = (dobString?: string) => {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const Dashboard: React.FC = () => {
  const { activeSession, user, logout } = useSession();
  
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'dark';
  });

  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('ATLAS_GEMINI_KEY') || '';
  });

  // Search, Filters & Panel states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCongregation, setFilterCongregation] = useState<string[]>([]);
  const [filterPrivilege, setFilterPrivilege] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Volunteer Modal State (For Add / Edit / Evaluate)
  const [volunteerModal, setVolunteerModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'edit' | 'evaluate';
    data: any | null;
  }>({
    isOpen: false,
    type: 'add',
    data: null
  });

  // Edit / Add Form fields
  const [formName, setFormName] = useState('');
  const [formDob, setFormDob] = useState('1995-01-01');
  const [formPrivilege, setFormPrivilege] = useState('Publisher');
  const [formCongregation, setFormCongregation] = useState('');
  const [formLastConventionDate, setFormLastConventionDate] = useState('');
  const [formAssignmentHeld, setFormAssignmentHeld] = useState('General Volunteer');
  const [formRecommended, setFormRecommended] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formJwpubEmail, setFormJwpubEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');

  // Evaluation Form fields
  const [evalGrade, setEvalGrade] = useState('B');
  const [evalComments, setEvalComments] = useState('');
  const [evalRecommendation, setEvalRecommendation] = useState('Keep in current assignment');

  // Intelligent Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileBase64, setImportFileBase64] = useState('');
  const [importFileMime, setImportFileMime] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseStep, setParseStep] = useState('');
  const [pendingImports, setPendingImports] = useState<any[]>([]);

  // Expanded card state for mobile
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Toast / System Notification Modal State
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve active API key
  const activeApiKey = useMemo(() => {
    return customApiKey;
  }, [customApiKey]);

  // Toast helper
  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Custom Confirmation Modal trigger
  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      },
      onCancel: () => setConfirmModal(null)
    });
  };

  // Fetch Data from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!activeSession) return;
      setIsLoading(true);
      try {
        const sessionKey = `${activeSession.year}-${activeSession.identifier}`;
        const [volsList, congsList] = await Promise.all([
          db.getVolunteers(sessionKey),
          db.getCongregations(sessionKey)
        ]);

        setCongregations(congsList);

        // Map database volunteers with their session-specific active evaluation
        const mapped = volsList.map(v => {
          const activeEval = v.evaluations?.find(e => e.year === activeSession.year && e.convention_identifier === activeSession.identifier);
          return {
            id: v.id,
            name: v.name,
            dob: v.dob || "1995-01-01",
            age: calculateAge(v.dob),
            privilege: v.privilege || "Publisher",
            congregation: v.congregation?.name || "Unassigned",
            congregationId: v.home_congregation_id,
            lastConventionDate: v.last_convention_date || "",
            assignmentHeld: v.assignment_held || "",
            recommendedForCommitteeAssistant: v.recommended_for_committee_assistant || v.is_committee_assistant || false,
            phone: v.phone || "",
            email: v.email || "",
            jwpubEmail: v.jwpub_email || "",
            address: v.address || "",
            evaluation: {
              id: activeEval?.id,
              grade: activeEval?.grade || activeEval?.rating || null,
              comments: activeEval?.comments || "",
              recommendation: activeEval?.recommendation || "",
              evaluatedAt: activeEval?.evaluated_at || null
            }
          };
        });

        setVolunteers(mapped);
      } catch (err) {
        console.error('Error loading Supabase data:', err);
        showToast("Error connecting to Supabase database.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [activeSession, refreshTrigger]);

  // Sync states
  useEffect(() => {
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (customApiKey) {
      localStorage.setItem('ATLAS_GEMINI_KEY', customApiKey);
    } else {
      localStorage.removeItem('ATLAS_GEMINI_KEY');
    }
  }, [customApiKey]);

  // Toggle Dark Mode
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Dynamic filter options
  const uniqueCongregations = useMemo(() => {
    const set = new Set(volunteers.map(v => v.congregation).filter(Boolean));
    return Array.from(set).sort();
  }, [volunteers]);

  const uniquePrivileges = useMemo(() => {
    return ["Elder", "Ministerial Servant", "Pioneer", "Publisher"];
  }, []);

  // Filter application
  const filteredVolunteers = useMemo(() => {
    return volunteers.filter(v => {
      // 1. Unified Search
      const textToSearch = `
        ${v.name} 
        ${v.congregation} 
        ${v.assignmentHeld} 
        ${v.phone || ''} 
        ${v.email || ''} 
        ${v.jwpubEmail || ''} 
        ${v.address || ''}
      `.toLowerCase();
      if (searchQuery && !textToSearch.includes(searchQuery.toLowerCase())) {
        return false;
      }

      // 2. Congregation Multi-select
      if (filterCongregation.length > 0 && !filterCongregation.includes(v.congregation)) {
        return false;
      }

      // 3. Privilege Multi-select
      if (filterPrivilege.length > 0 && !filterPrivilege.includes(v.privilege)) {
        return false;
      }

      // 4. Status Filter
      if (filterStatus !== 'all') {
        const hasGraded = v.evaluation && v.evaluation.grade !== null;
        if (filterStatus === 'graded' && !hasGraded) return false;
        if (filterStatus === 'ungraded' && hasGraded) return false;
        if (filterStatus === 'committee' && !v.recommendedForCommitteeAssistant) return false;
        if (filterStatus === 'grade_A' && (!hasGraded || v.evaluation.grade !== 'A')) return false;
        if (filterStatus === 'grade_B' && (!hasGraded || v.evaluation.grade !== 'B')) return false;
        if (filterStatus === 'grade_C' && (!hasGraded || v.evaluation.grade !== 'C')) return false;
        if (filterStatus === 'grade_D' && (!hasGraded || v.evaluation.grade !== 'D')) return false;
      }

      // 5. Age Range
      const age = calculateAge(v.dob);
      if (filterAgeMin && age < parseInt(filterAgeMin)) return false;
      if (filterAgeMax && age > parseInt(filterAgeMax)) return false;

      // 6. Last Worked Date Range
      if (v.lastConventionDate) {
        if (filterStartDate && v.lastConventionDate < filterStartDate) return false;
        if (filterEndDate && v.lastConventionDate > filterEndDate) return false;
      } else if (filterStartDate || filterEndDate) {
        return false;
      }

      return true;
    });
  }, [volunteers, searchQuery, filterCongregation, filterPrivilege, filterStatus, filterAgeMin, filterAgeMax, filterStartDate, filterEndDate]);

  // Summary Metrics Computation
  const metrics = useMemo(() => {
    const total = volunteers.length;
    const gradedCount = volunteers.filter(v => v.evaluation && v.evaluation.grade !== null).length;
    const committeeCount = volunteers.filter(v => v.recommendedForCommitteeAssistant).length;
    const gradeACount = volunteers.filter(v => v.evaluation && v.evaluation.grade === 'A').length;
    const percentGraded = total > 0 ? Math.round((gradedCount / total) * 100) : 0;

    return {
      total,
      percentGraded,
      committeeCount,
      gradeACount
    };
  }, [volunteers]);

  // ==========================================
  // LOCAL FILE PARSING LOGIC
  // ==========================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportFileMime(file.type);
    setImportFileBase64('');
    setImportText('');

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();
    const isWord = fileName.endsWith('.docx') || fileName.endsWith('.doc') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type === 'application/msword';
    const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
    const isText = file.type === 'text/plain' || file.type === 'text/csv' || fileName.endsWith('.csv') || fileName.endsWith('.txt');

    if (isImage || isPdf || isWord) {
      reader.onload = (event: any) => {
        const base64Data = event.target.result.split(',')[1];
        setImportFileBase64(base64Data);
        if (isWord) {
          showToast(`Word document "${file.name}" loaded as Base64 payload. Ready for Gemini OCR parsing.`, "info");
        }
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      reader.onload = (event: any) => {
        setImportText(event.target.result);
      };
      reader.readAsText(file);
    } else {
      // Excel/Office Docs - convert to text using xlsx parser and pass as base64 or csv text representation
      reader.onload = (event: any) => {
        try {
          const base64Data = event.target.result.split(',')[1];
          setImportFileBase64(base64Data);
          
          const arrayBuffer = reader.result as ArrayBuffer;
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csv = XLSX.utils.sheet_to_csv(firstSheet);
          setImportText(csv);
          showToast(`Office document "${file.name}" loaded. Ready for AI extraction.`, "info");
        } catch (err) {
          console.error(err);
          showToast("Failed to parse document structure.", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // ==========================================
  // GEMINI API PARSE INTEGRATION
  // ==========================================
  const handleParseWithGemini = async () => {
    if (importFileMime) {
      console.log("Parsing file with mime type:", importFileMime);
    }
    if (!activeApiKey) {
      setIsApiKeyModalOpen(true);
      showToast("Please save a valid Gemini API Key first.", "error");
      return;
    }
    if (!importText.trim() && !importFileBase64) {
      showToast("Please provide some text or load a valid file (Image, PDF, Document, Spreadsheet).", "error");
      return;
    }

    setIsParsing(true);
    setParseStep("Authenticating with Gemini API & initiating parsing pipeline...");

    try {
      const parsed = await extractVolunteersFromDoc(
        importFile || new File([], "text-import.txt"),
        importFileBase64,
        importText
      );
      setPendingImports(parsed);
      showToast(`AI successfully parsed ${parsed.length} volunteers!`, "success");
    } catch (error: any) {
      console.error(error);
      showToast(`Import Error: ${error.message || "Failed to parse document structure."}`, "error");
    } finally {
      setIsParsing(false);
      setParseStep("");
    }
  };

  // Confirm and Merge Gemini Imports into Supabase
  const handleConfirmMergeImports = async () => {
    if (pendingImports.length === 0 || !activeSession) return;
    setIsLoading(true);
    
    try {
      const sessionKey = `${activeSession.year}-${activeSession.identifier}`;
      
      // 1. Identify missing congregations and create them on the fly
      const uniqueCongMap = new Map<string, string>();
      let currentCongs = await db.getCongregations(sessionKey);
      currentCongs.forEach(c => uniqueCongMap.set(c.name.toLowerCase(), c.id));

      const newCongregationsToCreate: Omit<Congregation, 'id'>[] = [];
      pendingImports.forEach(item => {
        const congName = item.congregationName || 'Unassigned';
        if (!uniqueCongMap.has(congName.toLowerCase())) {
          newCongregationsToCreate.push({
            name: congName,
            number: item.congregationNumber || Math.floor(10000 + Math.random() * 90000).toString(),
            assigned_convention_id: sessionKey
          });
          uniqueCongMap.set(congName.toLowerCase(), 'pending');
        }
      });

      if (newCongregationsToCreate.length > 0) {
        await db.upsertCongregations(newCongregationsToCreate);
        currentCongs = await db.getCongregations(sessionKey);
      }

      // 2. Map volunteers & insert them
      const volunteersToInsert: Omit<Volunteer, 'id'>[] = [];
      const evaluationsToInsert: any[] = [];

      pendingImports.forEach(item => {
        const congMatch = currentCongs.find(c => c.name.toLowerCase() === (item.congregationName || 'Unassigned').toLowerCase());
        const homeCongId = congMatch ? congMatch.id : '';
        const jwEmail = item.jwpubEmail || `${item.name.toLowerCase().replace(/\s+/g, '.')}@jwpub.org`;

        volunteersToInsert.push({
          name: item.name,
          age: item.age || calculateAge(item.dob),
          jwpub_email: jwEmail,
          home_congregation_id: homeCongId,
          is_committee_assistant: item.recommendedForCommitteeAssistant || false,
          
          dob: item.dob,
          privilege: item.privilege,
          last_convention_date: item.lastConventionDate,
          assignment_held: item.assignmentHeld,
          phone: item.phone,
          email: item.email,
          address: item.address,
          recommended_for_committee_assistant: item.recommendedForCommitteeAssistant || false
        });

        if (item.evaluation?.grade) {
          evaluationsToInsert.push({
            volunteerEmail: jwEmail,
            rating: item.evaluation.grade,
            comments: item.evaluation.comments,
            grade: item.evaluation.grade,
            recommendation: item.evaluation.recommendation,
            year: activeSession.year,
            convention_identifier: activeSession.identifier,
            location: activeSession.location,
            department: item.assignmentHeld || 'General Volunteer',
            assignment: item.assignmentHeld || 'Assistant',
            user_id: user?.email || 'system.importer@jwpub.org'
          });
        }
      });

      // Commit volunteers
      await db.upsertVolunteers(volunteersToInsert);

      // Fetch refreshed list to bind evaluations correctly
      const refreshedVols = await db.getVolunteers(sessionKey);
      
      const evalsCommits: Omit<Evaluation, 'id'>[] = [];
      evaluationsToInsert.forEach(evalRecord => {
        const vMatch = refreshedVols.find(v => v.jwpub_email.toLowerCase() === evalRecord.volunteerEmail.toLowerCase());
        if (vMatch) {
          evalsCommits.push({
            volunteer_id: vMatch.id,
            user_id: evalRecord.user_id,
            rating: evalRecord.rating,
            year: evalRecord.year,
            convention_identifier: evalRecord.convention_identifier,
            location: evalRecord.location,
            department: evalRecord.department,
            assignment: evalRecord.assignment,
            comments: evalRecord.comments,
            
            grade: evalRecord.grade,
            recommendation: evalRecord.recommendation,
            evaluated_at: new Date().toISOString()
          });
        }
      });

      for (const ev of evalsCommits) {
        await db.saveEvaluation(ev);
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      showToast(`Successfully registered and evaluated ${pendingImports.length} volunteers!`, "success");
      setPendingImports([]);
      setImportText('');
      setImportFile(null);
      setImportFileBase64('');
      setIsImportOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast("Could not commit import database transaction.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePendingImport = (indexToRemove: number) => {
    setPendingImports(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleEditPendingField = (idx: number, field: string, value: any) => {
    setPendingImports(prev => prev.map((item, i) => {
      if (i === idx) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // ==========================================
  // EXPORT / IMPORT BACKUPS
  // ==========================================
  const exportDatabase = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(volunteers, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `volungrader_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Master database backup file downloaded successfully.", "success");
  };

  const importDatabaseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (!e.target.files?.[0] || !activeSession) return;
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = async (event: any) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          setIsLoading(true);
          const sessionKey = `${activeSession.year}-${activeSession.identifier}`;
          
          // Upsert congregations first
          const uniqueCongs = Array.from(new Set(parsed.map(p => p.congregation).filter(Boolean)));
          const congregationsToInsert = uniqueCongs.map(name => ({
            name: String(name),
            number: Math.floor(10000 + Math.random() * 90000).toString(),
            assigned_convention_id: sessionKey
          }));
          await db.upsertCongregations(congregationsToInsert);
          const currentCongs = await db.getCongregations(sessionKey);

          // Map and upsert volunteers
          const volunteersToInsert = parsed.map(v => {
            const congMatch = currentCongs.find(c => c.name.toLowerCase() === (v.congregation || 'Unassigned').toLowerCase());
            return {
              name: v.name,
              age: v.age || calculateAge(v.dob),
              jwpub_email: v.jwpubEmail || `${v.name.toLowerCase().replace(/\s+/g, '.')}@jwpub.org`,
              home_congregation_id: congMatch?.id || '',
              is_committee_assistant: v.recommendedForCommitteeAssistant || false,
              dob: v.dob,
              privilege: v.privilege,
              last_convention_date: v.lastConventionDate,
              assignment_held: v.assignmentHeld,
              phone: v.phone,
              email: v.email,
              address: v.address,
              recommended_for_committee_assistant: v.recommendedForCommitteeAssistant || false
            };
          });

          await db.upsertVolunteers(volunteersToInsert);

          // Re-fetch volunteers and add evaluations if existing in file
          const refreshedVols = await db.getVolunteers(sessionKey);
          for (const rawVal of parsed) {
            if (rawVal.evaluation?.grade) {
              const vMatch = refreshedVols.find(v => v.jwpub_email === rawVal.jwpubEmail);
              if (vMatch) {
                await db.saveEvaluation({
                  volunteer_id: vMatch.id,
                  user_id: user?.email || 'backup.restorer@jwpub.org',
                  rating: rawVal.evaluation.grade,
                  year: activeSession.year,
                  convention_identifier: activeSession.identifier,
                  location: activeSession.location,
                  department: rawVal.assignmentHeld || 'General Volunteer',
                  assignment: rawVal.assignmentHeld || 'Assistant',
                  comments: rawVal.evaluation.comments || '',
                  grade: rawVal.evaluation.grade,
                  recommendation: rawVal.evaluation.recommendation,
                  evaluated_at: rawVal.evaluation.evaluatedAt || new Date().toISOString()
                });
              }
            }
          }

          showToast(`Master database restored with ${parsed.length} volunteer logs!`, "success");
          setRefreshTrigger(prev => prev + 1);
        } else {
          showToast("Error restoring backup. File schema is invalid.", "error");
        }
      } catch (err) {
        showToast("Corrupt file or invalid JSON backup document.", "error");
      } finally {
        setIsLoading(false);
      }
    };
  };

  // ==========================================
  // DELETE VOLUNTEER
  // ==========================================
  const handleDeleteVolunteer = (id: string, name: string) => {
    triggerConfirm(
      "Confirm Deletion",
      `Are you sure you want to permanently delete the profile and evaluations for "${name}"? This action is irreversible.`,
      async () => {
        try {
          setIsLoading(true);
          await db.deleteVolunteer(id);
          showToast(`Successfully removed "${name}" from the database.`, "success");
          setRefreshTrigger(prev => prev + 1);
        } catch (err) {
          console.error(err);
          showToast("Failed to delete volunteer.", "error");
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  // ==========================================
  // EVALUATION & PROFILE MODAL SAVE
  // ==========================================
  const handleOpenVolunteerModal = (type: 'add' | 'edit' | 'evaluate', data: any = null) => {
    setVolunteerModal({ isOpen: true, type, data });
    
    if (type === 'add') {
      setFormName('');
      setFormDob('1995-01-01');
      setFormPrivilege('Publisher');
      setFormCongregation('');
      setFormLastConventionDate(new Date().toISOString().split('T')[0]);
      setFormAssignmentHeld('General Volunteer');
      setFormRecommended(false);
      setFormPhone('');
      setFormEmail('');
      setFormJwpubEmail('');
      setFormAddress('');
    } else if (type === 'edit' && data) {
      setFormName(data.name || '');
      setFormDob(data.dob || '1995-01-01');
      setFormPrivilege(data.privilege || 'Publisher');
      setFormCongregation(data.congregation || '');
      setFormLastConventionDate(data.lastConventionDate || '');
      setFormAssignmentHeld(data.assignmentHeld || 'General Volunteer');
      setFormRecommended(data.recommendedForCommitteeAssistant || false);
      setFormPhone(data.phone || '');
      setFormEmail(data.email || '');
      setFormJwpubEmail(data.jwpubEmail || '');
      setFormAddress(data.address || '');
    } else if (type === 'evaluate' && data) {
      setEvalGrade(data.evaluation?.grade || 'B');
      setEvalComments(data.evaluation?.comments || '');
      setEvalRecommendation(data.evaluation?.recommendation || 'Keep in current assignment');
    }
  };

  const handleSaveVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setIsLoading(true);

    try {
      const sessionKey = `${activeSession.year}-${activeSession.identifier}`;
      
      // Upsert Congregation on the fly
      let congId = '';
      const congName = formCongregation.trim() || 'Unassigned';
      const congMatch = congregations.find(c => c.name.toLowerCase() === congName.toLowerCase());
      if (congMatch) {
        congId = congMatch.id;
      } else {
        const newCong = {
          name: congName,
          number: Math.floor(10000 + Math.random() * 90000).toString(),
          assigned_convention_id: sessionKey
        };
        await db.upsertCongregations([newCong]);
        const updatedCongs = await db.getCongregations(sessionKey);
        congId = updatedCongs.find(c => c.name.toLowerCase() === congName.toLowerCase())?.id || '';
      }

      const isEdit = volunteerModal.type === 'edit';
      const volPayload: any = {
        name: formName,
        age: calculateAge(formDob),
        jwpub_email: formJwpubEmail.trim() || `${formName.toLowerCase().replace(/\s+/g, '.')}@jwpub.org`,
        home_congregation_id: congId,
        is_committee_assistant: formRecommended,
        dob: formDob,
        privilege: formPrivilege,
        last_convention_date: formLastConventionDate,
        assignment_held: formAssignmentHeld,
        phone: formPhone,
        email: formEmail,
        address: formAddress,
        recommended_for_committee_assistant: formRecommended
      };

      if (isEdit && volunteerModal.data) {
        volPayload.id = volunteerModal.data.id;
      }

      await db.upsertVolunteers([volPayload]);
      showToast(`${isEdit ? 'Updated' : 'Registered'} profile for "${formName}".`, "success");
      setVolunteerModal({ isOpen: false, type: 'add', data: null });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast("Failed to save volunteer profile.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !volunteerModal.data) return;
    setIsLoading(true);

    try {
      const evalPayload: Omit<Evaluation, 'id'> & { id?: string } = {
        volunteer_id: volunteerModal.data.id,
        user_id: user?.email || 'admin@jwpub.org',
        rating: evalGrade as any,
        year: activeSession.year,
        convention_identifier: activeSession.identifier,
        location: activeSession.location,
        department: volunteerModal.data.assignmentHeld || 'General Volunteer',
        assignment: volunteerModal.data.assignmentHeld || 'Assistant',
        comments: evalComments,
        
        grade: evalGrade,
        recommendation: evalRecommendation,
        evaluated_at: new Date().toISOString()
      };

      if (volunteerModal.data.evaluation?.id) {
        evalPayload.id = volunteerModal.data.evaluation.id;
      }

      await db.saveEvaluation(evalPayload);
      showToast(`Evaluation completed for "${volunteerModal.data.name}".`, "success");
      setVolunteerModal({ isOpen: false, type: 'add', data: null });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast("Failed to save evaluation.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* ==========================================
          HEADER / NAVIGATION
          ========================================== */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent">
                VolunGrader
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Convention Volunteer Evaluation Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Badge Indicator */}
            <button 
              onClick={() => setIsApiKeyModalOpen(true)}
              className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl border font-semibold transition-all hover:opacity-90 ${
                activeApiKey 
                ? (theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600')
                : (theme === 'dark' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600')
              }`}
            >
              {activeApiKey ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>Gemini Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>No Gemini Key Configured</span>
                </>
              )}
            </button>

            {/* Local backup controls */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={exportDatabase}
                title="Backup Data"
                className={`p-2 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-105 border-slate-200 text-slate-750 hover:bg-slate-200'}`}
              >
                <Download className="w-4.5 h-4.5" />
              </button>
              <label 
                title="Restore Backup"
                className={`p-2 rounded-xl border cursor-pointer transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-105 border-slate-200 text-slate-750 hover:bg-slate-200'}`}
              >
                <Upload className="w-4.5 h-4.5" />
                <input type="file" accept=".json" onChange={importDatabaseFile} className="hidden" />
              </label>
            </div>

            {/* Dark/Light Toggle */}
            <button 
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-slate-105 border-slate-205 text-amber-500 hover:bg-slate-202'}`}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Logout Gate Switcher / Lock Switcher */}
            <button 
              onClick={logout}
              title="Lock & Change Convention"
              className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-rose-450 hover:bg-slate-700' : 'bg-slate-105 border-slate-205 text-rose-650 hover:bg-slate-202'}`}
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ==========================================
          MAIN CONTENT CONTAINER
          ========================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Banner with Active Session details */}
        {activeSession && (
          <div className={`p-4 mb-6 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
            theme === 'dark' ? 'bg-slate-900/50 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
          }`}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-indigo-500" />
              <span className="font-semibold font-mono text-sm uppercase">Active Session: {activeSession.year} - {activeSession.identifier}</span>
              <span className="text-slate-400 text-xs">|</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{activeSession.date}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span>{activeSession.location}</span>
            </div>
          </div>
        )}

        {/* ==========================================
            METRICS STRIP PANEL
            ========================================== */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          <div className={`p-5 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-slate-950/20' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Volunteers</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight">{metrics.total}</span>
              <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                Active roster
              </span>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-slate-950/20' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Grading Progress</span>
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-500">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight">{metrics.percentGraded}%</span>
                <span className="text-xs text-slate-400">Evaluated</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-gradient-to-r from-pink-500 to-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${metrics.percentGraded}%` }}></div>
              </div>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-slate-950/20' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Committee Candidates</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight">{metrics.committeeCount}</span>
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Recommended</span>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-slate-950/20' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Grade "A" Performers</span>
              <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight">{metrics.gradeACount}</span>
              <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Exemplary</span>
            </div>
          </div>

        </section>

        {/* ==========================================
            SEARCH & FILTER CONTROL CENTER
            ========================================== */}
        <section className={`p-5 rounded-2xl border mb-8 transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            
            {/* Search Input */}
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, congregation, department, phone, email, or address..."
                className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                  theme === 'dark' 
                  ? 'bg-slate-950 border-slate-800 placeholder-slate-500 text-slate-100' 
                  : 'bg-slate-50 border-slate-200 placeholder-slate-400 text-slate-900'
                }`}
              />
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <button 
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className={`flex-1 md:flex-initial flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border font-semibold transition-all ${
                  isFilterPanelOpen
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : (theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-750' : 'bg-slate-100 border-slate-200 hover:bg-slate-200')
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(filterCongregation.length > 0 || filterPrivilege.length > 0 || filterStatus !== 'all' || filterAgeMin || filterAgeMax || filterStartDate || filterEndDate) && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>

              <button 
                onClick={() => setIsImportOpen(true)}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold transition-all duration-300 shadow-lg shadow-indigo-500/25"
              >
                <Sparkles className="w-4.5 h-4.5" />
                AI Import File / Roster
              </button>

              <button 
                onClick={() => handleOpenVolunteerModal('add')}
                className={`p-3 rounded-xl border hover:scale-105 active:scale-95 transition-all ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-750' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                }`}
                title="Add New Volunteer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* Advanced Multi-Filter Drawer */}
          {isFilterPanelOpen && (
            <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeIn`}>
              
              {/* Dynamic Congregation Selector */}
              <div>
                <span className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">Filter by Congregation</span>
                {uniqueCongregations.length === 0 ? (
                  <p className="text-xs text-slate-500">No congregations found in database.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {uniqueCongregations.map(cong => {
                      const isSelected = filterCongregation.includes(cong);
                      return (
                        <button
                          key={cong}
                          onClick={() => {
                            if (isSelected) {
                              setFilterCongregation(prev => prev.filter(c => c !== cong));
                            } else {
                              setFilterCongregation(prev => [...prev, cong]);
                            }
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full transition-all border ${
                            isSelected 
                            ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500' 
                            : (theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300')
                          }`}
                        >
                          {cong}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dynamic Privilege Selector */}
              <div>
                <span className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">Filter by Privilege</span>
                <div className="flex flex-wrap gap-1.5">
                  {uniquePrivileges.map(priv => {
                    const isSelected = filterPrivilege.includes(priv);
                    return (
                      <button
                        key={priv}
                        onClick={() => {
                          if (isSelected) {
                            setFilterPrivilege(prev => prev.filter(p => p !== priv));
                          } else {
                            setFilterPrivilege(prev => [...prev, priv]);
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full transition-all border ${
                          isSelected 
                          ? 'bg-violet-500/20 text-violet-400 border-violet-500' 
                          : (theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300')
                        }`}
                      >
                        {priv}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Filter Dropdown */}
              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">Evaluation Status</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`w-full text-sm px-3.5 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="all">Show All Volunteers</option>
                  <option value="graded">Only Evaluated (Graded)</option>
                  <option value="ungraded">Not Evaluated (Needs Grade)</option>
                  <option value="committee">Recommended for Committee</option>
                  <option value="grade_A">Grade A</option>
                  <option value="grade_B">Grade B</option>
                  <option value="grade_C">Grade C</option>
                  <option value="grade_D">Grade D</option>
                </select>

                <div className="mt-4 flex gap-2 items-center">
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">Dynamic Age Range</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input 
                    type="number" 
                    placeholder="Min"
                    value={filterAgeMin}
                    onChange={(e) => setFilterAgeMin(e.target.value)}
                    className={`w-1/2 text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input 
                    type="number" 
                    placeholder="Max"
                    value={filterAgeMax}
                    onChange={(e) => setFilterAgeMax(e.target.value)}
                    className={`w-1/2 text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Date Ranges */}
              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">Convention Date Range</label>
                <div className="space-y-2">
                  <input 
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  <input 
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                
                <button
                  onClick={() => {
                    setFilterCongregation([]);
                    setFilterPrivilege([]);
                    setFilterStatus('all');
                    setFilterAgeMin('');
                    setFilterAgeMax('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  className="w-full mt-4 py-2 rounded-xl border border-dashed border-rose-500/30 text-xs font-bold uppercase tracking-wider text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 transition-all"
                >
                  Clear Active Filters
                </button>
              </div>

            </div>
          )}
        </section>

        {/* ==========================================
            ROSTER VIEW GRID & TABLE
            ========================================== */}
        <section className={`rounded-2xl border overflow-hidden transition-all ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-slate-950/20' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          
          {isLoading ? (
            <div className="p-16 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="font-semibold text-xs tracking-wider text-slate-400 font-mono uppercase">Retrieving master registry records...</span>
            </div>
          ) : filteredVolunteers.length === 0 ? (
            <div className="p-16 text-center">
              <Database className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-bold">No Volunteers Found</h3>
              <p className="text-sm text-slate-400 mt-1">Try relaxing filters or import an evaluation roster using the AI Portal.</p>
            </div>
          ) : (
            <>
              {/* Desktop view table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left">
                  <thead className={theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50'}>
                    <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                      <th className="px-6 py-4">Volunteer Profile</th>
                      <th className="px-6 py-4">Status & Privilege</th>
                      <th className="px-6 py-4">Department & Date</th>
                      <th className="px-6 py-4">Grade</th>
                      <th className="px-6 py-4">Contact Info</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {filteredVolunteers.map(v => (
                      <tr key={v.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group`}>
                        {/* Volunteer Name */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{v.name}</div>
                          <div className="text-xs text-indigo-500 dark:text-indigo-400 font-mono mt-0.5">{v.congregation}</div>
                        </td>

                        {/* Status/Privilege */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              v.privilege === 'Elder' ? 'bg-indigo-500/10 text-indigo-400' :
                              v.privilege === 'Ministerial Servant' ? 'bg-sky-500/10 text-sky-400' :
                              v.privilege === 'Pioneer' ? 'bg-emerald-500/10 text-emerald-400' :
                              'bg-slate-500/10 text-slate-400'
                            }`}>
                              {v.privilege}
                            </span>
                            {v.recommendedForCommitteeAssistant && (
                              <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                                Committee Assistant Candidate
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Assignment/Date */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{v.assignmentHeld || 'Unassigned'}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">Last Convention: {v.lastConventionDate || 'N/A'}</div>
                        </td>

                        {/* Grade */}
                        <td className="px-6 py-4">
                          {v.evaluation?.grade ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-extrabold text-sm px-2.5 py-1 rounded-lg ${
                                v.evaluation.grade === 'A' ? 'bg-emerald-500/10 text-emerald-400' :
                                v.evaluation.grade === 'B' ? 'bg-indigo-500/10 text-indigo-400' :
                                v.evaluation.grade === 'C' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-rose-500/10 text-rose-400'
                              }`}>
                                {v.evaluation.grade}
                              </span>
                              <div className="max-w-[180px] text-xs text-slate-400 truncate" title={v.evaluation.comments}>
                                {v.evaluation.comments}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-600 font-mono italic">Pending evaluation</span>
                          )}
                        </td>

                        {/* Contact details */}
                        <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400 space-y-1">
                          {v.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-indigo-400" /> {v.phone}</div>}
                          {v.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-indigo-400" /> {v.email}</div>}
                          {v.jwpubEmail && <div className="flex items-center gap-1.5 font-semibold text-indigo-400"><Globe className="w-3.5 h-3.5" /> {v.jwpubEmail}</div>}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenVolunteerModal('evaluate', v)}
                              className="text-xs px-3 py-1.5 rounded-lg border font-semibold border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                            >
                              Evaluate
                            </button>
                            <button 
                              onClick={() => handleOpenVolunteerModal('edit', v)}
                              className={`p-2 rounded-lg border hover:bg-slate-800 ${theme === 'dark' ? 'border-slate-800 text-slate-400' : 'border-slate-205 text-slate-600'}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteVolunteer(v.id, v.name)}
                              className={`p-2 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10`}
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

              {/* Mobile View responsive card format */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {filteredVolunteers.map(v => {
                  const isExpanded = !!expandedCards[v.id];
                  return (
                    <div key={v.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-base">{v.name}</h4>
                          <p className="text-xs text-indigo-400 font-mono">{v.congregation} • Age: {v.age}</p>
                        </div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          v.privilege === 'Elder' ? 'bg-indigo-500/10 text-indigo-400' :
                          v.privilege === 'Ministerial Servant' ? 'bg-sky-500/10 text-sky-400' :
                          v.privilege === 'Pioneer' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {v.privilege}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Assignment: {v.assignmentHeld || 'Unassigned'}</span>
                        {v.evaluation?.grade ? (
                          <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-mono font-bold text-xs">{v.evaluation.grade}</span>
                        ) : (
                          <span className="text-slate-500 italic text-xs">Ungraded</span>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-800 space-y-2 text-xs font-mono text-slate-400">
                          {v.phone && <p>Phone: {v.phone}</p>}
                          {v.email && <p>Email: {v.email}</p>}
                          {v.jwpubEmail && <p className="text-indigo-400">JWPub: {v.jwpubEmail}</p>}
                          {v.address && <p className="font-sans leading-relaxed">Address: {v.address}</p>}
                          {v.evaluation?.comments && (
                            <div className="bg-slate-900/50 p-2.5 border border-slate-800 rounded-lg mt-2 font-sans text-slate-300">
                              <p className="font-bold text-[10px] uppercase text-indigo-400 tracking-wider">Evaluation Comments</p>
                              <p className="mt-1">{v.evaluation.comments}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 justify-end pt-2">
                        <button 
                          onClick={() => setExpandedCards(prev => ({ ...prev, [v.id]: !isExpanded }))}
                          className="flex-1 text-xs border border-slate-800 py-2 rounded-lg font-semibold flex items-center justify-center gap-1"
                        >
                          {isExpanded ? "Collapse Details" : "View Details"}
                        </button>
                        <button 
                          onClick={() => handleOpenVolunteerModal('evaluate', v)}
                          className="text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold"
                        >
                          Grade
                        </button>
                        <button 
                          onClick={() => handleOpenVolunteerModal('edit', v)}
                          className="p-2 border border-slate-800 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </section>

      </main>

      {/* ==========================================
          MODALS & SYSTEM OVERLAYS
          ========================================== */}
      
      {/* 1. API KEY / GEMINI CONNECTION KEY MODAL */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border animate-scaleIn ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-205 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Gemini API Credentials
              </h3>
              <button onClick={() => setIsApiKeyModalOpen(false)} className="p-1 hover:bg-slate-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                VolunGrader utilizes Gemini 2.5 Flash model pipeline to analyze unstructured document text, PDF recommendation files, and Excel rosters to extract structured databases on the fly.
              </p>
              <div>
                <label className="block text-xs font-bold font-mono uppercase text-slate-400 mb-1">Enter Gemini API Key</label>
                <input 
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full font-mono text-sm px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => {
                  setCustomApiKey('');
                  localStorage.removeItem('ATLAS_GEMINI_KEY');
                  showToast("Credentials cleared successfully.");
                  setIsApiKeyModalOpen(false);
                }} 
                className="text-xs px-4 py-2.5 rounded-xl border border-rose-500/20 text-rose-500 font-semibold"
              >
                Clear Key
              </button>
              <button 
                onClick={() => {
                  if (customApiKey.trim()) {
                    localStorage.setItem('ATLAS_GEMINI_KEY', customApiKey.trim());
                    showToast("Credentials saved successfully.");
                  }
                  setIsApiKeyModalOpen(false);
                }} 
                className="text-xs px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. GEMINI PARSE INTELLIGENT IMPORTER PANEL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl border animate-scaleIn ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-205 text-slate-900'
          }`}>
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Multimodal AI Ingestion Portal
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Drag-and-drop rosters, PDF letters, spreadsheets, or images. Gemini will structuralize data.</p>
              </div>
              <button onClick={() => { setIsImportOpen(false); setPendingImports([]); }} className="p-1 hover:bg-slate-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Uploader Column */}
              <div className="lg:col-span-1 space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-indigo-500 transition-all rounded-xl p-8 text-center cursor-pointer bg-slate-950/20 flex flex-col items-center justify-center"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    className="hidden" 
                    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  />
                  <Upload className="w-8 h-8 text-slate-500 mb-2" />
                  <span className="text-sm font-semibold block">{importFile ? importFile.name : "Select Document / List"}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Accepts Images, PDFs, spreadsheets, Word documents</span>
                </div>

                <div>
                  <label className="block text-xs font-bold font-mono uppercase text-slate-400 mb-1">Or Paste Roster/Email Text</label>
                  <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={4}
                    placeholder="John Doe Elder Metro Heights - Attendant Captain. recommended as assistant..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button 
                  onClick={handleParseWithGemini}
                  disabled={isParsing || (!importText.trim() && !importFileBase64)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Parsing with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4.5 h-4.5" />
                      <span>Start AI Parse</span>
                    </>
                  )}
                </button>

                {isParsing && (
                  <p className="text-[10px] text-indigo-400 font-mono animate-pulse">{parseStep}</p>
                )}
              </div>

              {/* Staging & Validation Column */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-bold text-sm flex items-center justify-between">
                  <span>Staging Queue Validation ({pendingImports.length})</span>
                  {pendingImports.length > 0 && (
                    <button 
                      onClick={handleConfirmMergeImports}
                      className="text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Check className="w-4 h-4" /> Commit Import
                    </button>
                  )}
                </h4>

                {pendingImports.length === 0 ? (
                  <div className="border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs italic bg-slate-950/10">
                    Parse a roster file using the Gemini AI Engine to populate this staging grid. You'll be able to review and resolve typos before saving to Supabase.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-800 text-xs">
                      <thead className="bg-slate-950">
                        <tr className="text-slate-400 font-mono">
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Privilege</th>
                          <th className="px-3 py-2 text-left">Congregation</th>
                          <th className="px-3 py-2 text-left">Assignment</th>
                          <th className="px-3 py-2 text-left">Grade</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                        {pendingImports.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="px-3 py-2">
                              <input 
                                type="text"
                                value={item.name}
                                onChange={(e) => handleEditPendingField(idx, 'name', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-indigo-500 outline-none w-full py-0.5"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.privilege}
                                onChange={(e) => handleEditPendingField(idx, 'privilege', e.target.value)}
                                className="bg-slate-900 border-slate-800 rounded outline-none px-1 py-0.5 text-xs text-slate-300"
                              >
                                <option value="Elder">Elder</option>
                                <option value="Ministerial Servant">Ministerial Servant</option>
                                <option value="Pioneer">Pioneer</option>
                                <option value="Publisher">Publisher</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text"
                                value={item.congregationName}
                                onChange={(e) => handleEditPendingField(idx, 'congregationName', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-indigo-500 outline-none w-full py-0.5"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text"
                                value={item.assignmentHeld}
                                onChange={(e) => handleEditPendingField(idx, 'assignmentHeld', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-indigo-500 outline-none w-full py-0.5 animate-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.evaluation?.grade || 'B'}
                                onChange={(e) => {
                                  const updatedEval = { ...item.evaluation, grade: e.target.value };
                                  handleEditPendingField(idx, 'evaluation', updatedEval);
                                }}
                                className="bg-slate-900 border-slate-800 rounded outline-none px-1 py-0.5 text-xs text-slate-300"
                              >
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button 
                                onClick={() => handleRemovePendingImport(idx)}
                                className="p-1.5 hover:bg-slate-800 rounded text-rose-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT VOLUNTEER PROFILE MODAL */}
      {volunteerModal.isOpen && (volunteerModal.type === 'add' || volunteerModal.type === 'edit') && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl p-6 rounded-2xl border animate-scaleIn ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-205 text-slate-900'
          }`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-lg">
                {volunteerModal.type === 'edit' ? "Edit Volunteer Profile" : "Add New Volunteer"}
              </h3>
              <button onClick={() => setVolunteerModal({ isOpen: false, type: 'add', data: null })} className="p-1 hover:bg-slate-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVolunteer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date of Birth</label>
                  <input 
                    type="date"
                    required
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* Privilege */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Privilege Bracket</label>
                  <select 
                    value={formPrivilege}
                    onChange={(e) => setFormPrivilege(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  >
                    <option value="Elder">Elder</option>
                    <option value="Ministerial Servant">Ministerial Servant</option>
                    <option value="Pioneer">Pioneer</option>
                    <option value="Publisher">Publisher</option>
                  </select>
                </div>

                {/* Congregation */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Congregation</label>
                  <input 
                    type="text"
                    required
                    value={formCongregation}
                    onChange={(e) => setFormCongregation(e.target.value)}
                    placeholder="e.g. Oakwood Pines"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                  <input 
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="407-555-0100"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* Personal Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address</label>
                  <input 
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* JWPub Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">JWPub Domain Email (Optional)</label>
                  <input 
                    type="email"
                    value={formJwpubEmail}
                    onChange={(e) => setFormJwpubEmail(e.target.value)}
                    placeholder="name@jwpub.org"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* Department / Assignment */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assignment Department</label>
                  <input 
                    type="text"
                    value={formAssignmentHeld}
                    onChange={(e) => setFormAssignmentHeld(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* Last Convention date */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Last Convention Date</label>
                  <input 
                    type="date"
                    value={formLastConventionDate}
                    onChange={(e) => setFormLastConventionDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                  />
                </div>

                {/* Committee recommendation */}
                <div className="flex items-center gap-3 pt-6">
                  <input 
                    type="checkbox"
                    id="recommended"
                    checked={formRecommended}
                    onChange={(e) => setFormRecommended(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <label htmlFor="recommended" className="text-xs font-bold text-slate-400 uppercase cursor-pointer selection:bg-transparent">
                    Recommend for Committee Assistant
                  </label>
                </div>
              </div>

              {/* Physical Address */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Physical Address</label>
                <input 
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="123 Street Dr, Orlando, FL 32801"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-850">
                <button 
                  type="button" 
                  onClick={() => setVolunteerModal({ isOpen: false, type: 'add', data: null })}
                  className="text-xs px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="text-xs px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. GRADE / EVALUATE VOLUNTEER DIALOG */}
      {volunteerModal.isOpen && volunteerModal.type === 'evaluate' && volunteerModal.data && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className={`w-full max-w-lg p-6 rounded-2xl border animate-scaleIn ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-205 text-slate-900'
          }`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg">Evaluate Volunteer</h3>
                <p className="text-xs text-slate-400 mt-0.5">Grade performance logs for {volunteerModal.data.name}</p>
              </div>
              <button onClick={() => setVolunteerModal({ isOpen: false, type: 'add', data: null })} className="p-1 hover:bg-slate-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-4">
              {/* Grade Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Performance Grade</label>
                <div className="grid grid-cols-4 gap-2">
                  {['A', 'B', 'C', 'D'].map(gradeOption => (
                    <button
                      key={gradeOption}
                      type="button"
                      onClick={() => setEvalGrade(gradeOption)}
                      className={`py-3 rounded-xl border font-mono font-bold text-base transition-all ${
                        evalGrade === gradeOption 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-[1.03]'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      {gradeOption}
                      <span className="block text-[8px] font-sans font-normal opacity-75 mt-0.5">
                        {gradeOption === 'A' ? "Exemplary" :
                         gradeOption === 'B' ? "Proficient" :
                         gradeOption === 'C' ? "Developing" : "Needs Assist"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recommendation Bracket */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Committee Advancement Recommendation</label>
                <select 
                  value={evalRecommendation}
                  onChange={(e) => setEvalRecommendation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-350"
                >
                  <option value="Recommend for advancement">Recommend for advancement</option>
                  <option value="Keep in current assignment">Keep in current assignment</option>
                  <option value="Needs adjustment / training">Needs adjustment / training</option>
                </select>
              </div>

              {/* Evaluation Comments */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Evaluator Notes / Comments</label>
                <textarea 
                  required
                  value={evalComments}
                  onChange={(e) => setEvalComments(e.target.value)}
                  rows={4}
                  placeholder="Detail coordinate qualities, technical capability, spiritual qualifications, and reliability during the session sessions..."
                  className="w-full text-sm p-3.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-205 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-850">
                <button 
                  type="button" 
                  onClick={() => setVolunteerModal({ isOpen: false, type: 'add', data: null })}
                  className="text-xs px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="text-xs px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Save Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DYNAMIC TOAST NOTIFICATION CONTAINER */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-slideUp">
          <div className={`px-4.5 py-3 rounded-xl border flex items-center gap-2 shadow-2xl text-xs font-semibold ${
            toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
            toast.type === 'info' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' :
            'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <Sparkles className="w-4 h-4" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* 6. GENERAL DIALOG CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl border border-slate-800 bg-slate-900 text-slate-100">
            <h4 className="font-bold text-lg mb-2">{confirmModal.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={confirmModal.onCancel}
                className="text-xs px-4 py-2 rounded-lg border border-slate-800 text-slate-400 font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="text-xs px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
