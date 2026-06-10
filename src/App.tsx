import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Moon, Sun, Check, X, 
  Upload, Download, Users, Award, 
  ShieldAlert, Sparkles, Filter, Database, AlertCircle, RefreshCw,
  Sliders, Phone, Mail, Globe, MapPin, FileUp, Lock, User, LogOut
} from 'lucide-react';

// ==========================================
// TYPES AND INTERFACES
// ==========================================
interface Evaluation {
  grade: string | null;
  comments: string;
  recommendation: string | null;
  evaluatedAt: string | null;
}

interface Volunteer {
  id: string;
  name: string;
  dob: string;
  privilege: string;
  congregation: string;
  circuit: string;
  lastConventionDate: string;
  assignmentHeld: string;
  recommendedForCommitteeAssistant: boolean;
  phone: string;
  email: string;
  jwpubEmail: string;
  address: string;
  evaluation: Evaluation;
}

interface Convention {
  id: string;
  name: string;
  username: string;
  password?: string;
  place?: string;
  date?: string;
  language?: string;
  number?: string;
}

// ==========================================
// GEMINI API KEY INTERFACE (AUTOMATIC KEY INJECTION)
// ==========================================
const apiKey = "";

// ==========================================
// INITIAL ENRICHED MOCK DATA
// ==========================================
const INITIAL_VOLUNTEERS: Volunteer[] = [];



// ==========================================
// UTILITY FUNCTIONS
// ==========================================
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

// Exponential Backoff API Fetcher
const fetchWithBackoff = async (url: string, options: any, retries = 5, delay = 1000): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithBackoff(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

export default function App() {
  // ==========================================
  // CONVENTION LIST & AUTHENTICATION STATES
  // ==========================================
  const [accounts, setAccounts] = useState<any[]>(() => {
    const saved = localStorage.getItem('user_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  const [conventions, setConventions] = useState<Convention[]>(() => {
    const saved = localStorage.getItem('convention_list');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentConvention, setCurrentConvention] = useState<Convention | null>(() => {
    const savedId = localStorage.getItem('current_convention_id');
    const savedList = localStorage.getItem('convention_list');
    const conventionList: Convention[] = savedList ? JSON.parse(savedList) : [];
    return conventionList.find(c => c.id === savedId) || null;
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('is_authenticated') === 'true';
  });

  const [authForm, setAuthForm] = useState({
    username: '',
    password: ''
  });

  const [createAccountForm, setCreateAccountForm] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [activeLoginTab, setActiveLoginTab] = useState<string>('login'); // 'login' | 'create'

  // ==========================================
  // MASTER VOLUNTEER STATE (Isolating per Convention)
  // ==========================================
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);

  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('app_theme') || 'dark';
  });

  // Fallback API Key State for local manual override (prevents hard 401s if system key is missing/unauthorized)
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('custom_gemini_api_key') || '';
  });

  // Search, Filters & Panel states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCongregation, setFilterCongregation] = useState<string[]>([]);
  const [filterPrivilege, setFilterPrivilege] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAgeMin, setFilterAgeMin] = useState<string>('');
  const [filterAgeMax, setFilterAgeMax] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  // Volunteer Modal State
  const [volunteerModal, setVolunteerModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'edit' | 'evaluate';
    data: Volunteer | null;
  }>({
    isOpen: false,
    type: 'add',
    data: null
  });

  // Intelligent Import State
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileBase64, setImportFileBase64] = useState<string>('');
  const [importFileMime, setImportFileMime] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseStep, setParseStep] = useState<string>('');
  const [pendingImports, setPendingImports] = useState<Volunteer[]>([]);

  // Add/Import Convention State
  const [isAddConventionOpen, setIsAddConventionOpen] = useState<boolean>(false);
  const [convPlace, setConvPlace] = useState<string>('');
  const [convDate, setConvDate] = useState<string>('');
  const [convLanguage, setConvLanguage] = useState<string>('Spanish');
  const [convNumber, setConvNumber] = useState<string>('');
  const [convFile, setConvFile] = useState<File | null>(null);
  const [convFileBase64, setConvFileBase64] = useState<string>('');
  const [convFileMime, setConvFileMime] = useState<string>('');
  const [isConvParsing, setIsConvParsing] = useState<boolean>(false);
  const [convParseStep, setConvParseStep] = useState<string>('');

  // Congregational Sidebar View States
  const [activeCongregations, setActiveCongregations] = useState<any[]>([]);
  const [selectedCongregation, setSelectedCongregation] = useState<string | null>(null);

  // Toast / System Notification Modal State
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mobile drawer states
  const [isMobileCongListOpen, setIsMobileCongListOpen] = useState<boolean>(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Resolve active API key
  const activeApiKey = useMemo(() => {
    return customApiKey || apiKey;
  }, [customApiKey]);

  // Save conventions on change
  useEffect(() => {
    localStorage.setItem('convention_list', JSON.stringify(conventions));
  }, [conventions]);

  // Save accounts on change
  useEffect(() => {
    localStorage.setItem('user_accounts', JSON.stringify(accounts));
  }, [accounts]);

  // Load volunteers specifically from the shared master database
  useEffect(() => {
    if (isLoggedIn) {
      const dbKey = 'volunteer_db_shared';
      const saved = localStorage.getItem(dbKey);
      if (saved) {
        setVolunteers(JSON.parse(saved));
      } else {
        // Seed first-time session with initial mock data
        setVolunteers(INITIAL_VOLUNTEERS);
        localStorage.setItem(dbKey, JSON.stringify(INITIAL_VOLUNTEERS));
      }
    }
  }, [isLoggedIn]);

  // Sync volunteers database to shared LocalStorage
  useEffect(() => {
    if (isLoggedIn) {
      const dbKey = 'volunteer_db_shared';
      localStorage.setItem(dbKey, JSON.stringify(volunteers));
    }
  }, [volunteers, isLoggedIn]);

  // Load and derive congregations list for active convention session (shared)
  useEffect(() => {
    setSelectedCongregation(null);
    if (isLoggedIn) {
      const saved = localStorage.getItem('congregations_db_shared');
      if (saved) {
        setActiveCongregations(JSON.parse(saved));
      } else {
        const uniqueNames = Array.from(new Set(volunteers.map(v => v.congregation).filter(Boolean)));
        const derived = uniqueNames.map(name => {
          const matchingVols = volunteers.filter(v => v.congregation === name);
          const coord = matchingVols.find(v => v.privilege === 'Coordinator' || v.assignmentHeld === 'Coordinator');
          return {
            name,
            number: "",
            circuit: matchingVols[0]?.circuit || "",
            coordinatorName: coord?.name || "Unassigned",
            coordinatorPhone: coord?.phone || "",
            coordinatorEmail: coord?.email || "",
            coordinatorJwpubEmail: coord?.jwpubEmail || ""
          };
        });
        setActiveCongregations(derived);
        localStorage.setItem('congregations_db_shared', JSON.stringify(derived));
      }
    } else {
      setActiveCongregations([]);
    }
  }, [volunteers, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('custom_gemini_api_key', customApiKey);
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
      // 0. Selected Sidebar Congregation filter
      if (selectedCongregation && v.congregation !== selectedCongregation) {
        return false;
      }

      // 1. Unified Search (Enhanced to search phone, email, address, jwpubEmail)
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
  }, [volunteers, searchQuery, filterCongregation, filterPrivilege, filterStatus, filterAgeMin, filterAgeMax, filterStartDate, filterEndDate, selectedCongregation]);

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
  // CONVENTION AUTHENTICATION ACTION PROCEDURES
  // ==========================================
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetUser = accounts.find(
      u => u.username.toLowerCase() === authForm.username.trim().toLowerCase()
    );

    if (!targetUser) {
      showToast("Invalid username or password credentials.", "error");
      return;
    }

    if (targetUser.password === authForm.password) {
      setIsLoggedIn(true);
      sessionStorage.setItem('is_authenticated', 'true');
      showToast("Welcome! Logged in successfully.", "success");
    } else {
      showToast("Invalid username or password credentials.", "error");
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createAccountForm.username.trim() || !createAccountForm.password) {
      showToast("Please complete all fields.", "error");
      return;
    }
    if (createAccountForm.password !== createAccountForm.confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    const duplicateCheck = accounts.find(
      u => u.username.toLowerCase() === createAccountForm.username.trim().toLowerCase()
    );
    if (duplicateCheck) {
      showToast("An account with this username already exists.", "error");
      return;
    }

    const newAccount = {
      username: createAccountForm.username.trim(),
      password: createAccountForm.password
    };

    setAccounts(prev => [...prev, newAccount]);
    setActiveLoginTab('login');
    setAuthForm({ username: newAccount.username, password: '' });
    setCreateAccountForm({ username: '', password: '', confirmPassword: '' });
    showToast(`Account for "${newAccount.username}" created successfully! Please log in.`, "success");
  };

  const handleLogout = () => {
    triggerConfirm(
      "Log Out",
      "This will end your current user session. Are you sure?",
      () => {
        setIsLoggedIn(false);
        setCurrentConvention(null);
        localStorage.removeItem('current_convention_id');
        sessionStorage.removeItem('is_authenticated');
        showToast("Logged out of administrative session.", "success");
      }
    );
  };

  const handleSwitchConvention = () => {
    setCurrentConvention(null);
    localStorage.removeItem('current_convention_id');
    showToast("Convention registry unlocked. Select another setup.", "info");
  };

  const handleClearVolunteers = () => {
    triggerConfirm(
      "Wipe Volunteers Database",
      "Are you sure you want to permanently delete ALL volunteer logs from this system? This is irreversible.",
      () => {
        setVolunteers([]);
        localStorage.removeItem('volunteer_db_shared');
        showToast("All volunteer records wiped.", "success");
      }
    );
  };

  const handleClearCongregations = () => {
    triggerConfirm(
      "Wipe Congregations List",
      "Are you sure you want to permanently clear the congregations configuration? Roster lists will need to be re-imported.",
      () => {
        setActiveCongregations([]);
        localStorage.removeItem('congregations_db_shared');
        showToast("All congregation configuration records wiped.", "success");
      }
    );
  };

  const handleDeleteCurrentConvention = () => {
    if (!currentConvention) return;
    triggerConfirm(
      "Delete Current Convention",
      `Are you sure you want to delete "${currentConvention.name}"? This removes the convention config, but keeps volunteer records intact.`,
      () => {
        const targetId = currentConvention.id;
        setConventions(prev => prev.filter(c => c.id !== targetId));
        setCurrentConvention(null);
        localStorage.removeItem('current_convention_id');
        setIsApiKeyModalOpen(false);
        showToast("Current convention database session deleted.", "success");
      }
    );
  };

  const handleWipeAllData = () => {
    triggerConfirm(
      "FACTORY RESET - WIPE ALL DATA",
      "This will permanently delete all volunteers, congregations, conventions, and user accounts on this device. You will be logged out. Are you sure?",
      () => {
        localStorage.clear();
        sessionStorage.clear();
        setVolunteers([]);
        setActiveCongregations([]);
        setConventions([]);
        setAccounts([]);
        setCurrentConvention(null);
        setIsLoggedIn(false);
        setIsApiKeyModalOpen(false);
        showToast("System factory reset completed.", "success");
      }
    );
  };

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

    // Check file types
    if (isImage || isPdf || isWord) {
      // Process binary/multimodal data as base64 for Gemini (supports Word .docx/.doc!)
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          const base64Data = result.split(',')[1] || result;
          setImportFileBase64(base64Data);
          if (isWord) {
            showToast(`Word document "${file.name}" loaded as Base64 payload. Ready for Gemini OCR parsing.`, "info");
          }
        }
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      // Read plain text directly
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          setImportText(result);
        }
      };
      reader.readAsText(file);
    } else {
      // Fallback binary reader
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          const base64Data = result.split(',')[1] || result;
          setImportFileBase64(base64Data);
          showToast(`Document "${file.name}" loaded for AI extraction.`, "info");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // ==========================================
  // GEMINI API PARSE INTEGRATION
  // ==========================================
  const handleParseWithGemini = async () => {
    if (!activeApiKey) {
      setIsApiKeyModalOpen(true);
      showToast("Please save a valid Gemini API Key first.", "error");
      return;
    }
    if (!importText.trim() && !importFileBase64) {
      showToast("Please provide some text or load a valid file (Image, PDF, Word, Document, Spreadsheet).", "error");
      return;
    }

    setIsParsing(true);
    setParseStep("Authenticating with Gemini API & initiating parsing pipeline...");

    const systemPrompt = `You are an expert parsing assistant. Analyze the provided list, image, spreadsheet, Microsoft Word document, PDF, or text describing convention volunteers.
Extract the details into a valid JSON array of objects. Map and find fields strictly matching:
- name (String)
- dob (String in YYYY-MM-DD format. If completely unknown, guess an estimated date like "1995-01-01" or calculate from guessed ages)
- privilege (String, must strictly map to one of: "Elder", "Ministerial Servant", "Pioneer", "Publisher". Map "MS", "Servant" to "Ministerial Servant")
- congregation (String)
- circuit (String, search explicitly for circuit or circuito identifiers in formats like fl-**-** or **-** where * represents any digit or letter, e.g. "FL-10-A" or "12-B". If not found, leave as empty string)
- lastConventionDate (String in YYYY-MM-DD format, fallback to current year or 2025 if unspecified)
- assignmentHeld (String, e.g. "Attendants", "First Aid", "Food Service", "Cleaning & Maintenance", "Media & Audio Visual")
- recommendedForCommitteeAssistant (Boolean, look for notes implying recommendation, outstanding attitude, potential, or leadership capability)
- phone (String, format neatly if found, e.g., "123-456-7890")
- email (String, standard email address if found)
- jwpubEmail (String, search explicitly for emails ending with "@jwpub.org", otherwise leave blank)
- address (String, full physical address if found, e.g. street, city, state, zip)
- evaluation (Object) containing:
  - grade (String, must strictly map to one of: "A", "B", "C", "D". If they have a rating like A+, A-, map to A, B, etc., or set to null if completely unknown)
  - comments (String, description, performance notes, remarks, comments, or comentarios about the volunteer. Auto-populate from any notes or feedback found in the document)
  - recommendation (String, e.g., "Recommend for advancement", "Keep in current assignment", "Needs adjustment", if specified, otherwise null)
  - evaluatedAt (String in ISO format if dates are specified, otherwise leave null)

If a field is missing from the document, set it to an empty string ("") or null as appropriate.
Only output a raw JSON array. Do not wrap the JSON output inside Markdown brackets or add prefix/suffix comments. Use valid double-quoted JSON formats.`;

    // Setup contents structure dynamically based on file type inputs
    const partsArray = [];

    // 1. Text description part
    let userTextPrompt = `Parse this roster list or document contents for volunteer evaluations.`;
    if (importText) {
      userTextPrompt += `\n\nText Contents:\n${importText}`;
    }
    partsArray.push({ text: userTextPrompt });

    // 2. Binary / Inline file part
    if (importFileBase64) {
      // Determine safe mime-type mappings
      let mimeTypeToSend = importFileMime || 'application/octet-stream';
      if (importFile?.name.endsWith('.docx')) mimeTypeToSend = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (importFile?.name.endsWith('.xlsx')) mimeTypeToSend = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (importFile?.name.endsWith('.xls')) mimeTypeToSend = 'application/vnd.ms-excel';
      if (importFile?.name.endsWith('.doc')) mimeTypeToSend = 'application/msword';

      partsArray.push({
        inlineData: {
          mimeType: mimeTypeToSend,
          data: importFileBase64
        }
      });
    }

    const payload = {
      contents: [{
        parts: partsArray
      }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    try {
      setParseStep(`Uploading content (${importFile ? importFile.name : 'Raw Text'}) to Gemini 2.5 Engine...`);
      const response = await fetchWithBackoff(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        5, // retries
        1500 // initial delay
      );

      setParseStep("Extracting entities, phone records, emails, and physical addresses...");
      const data = await response.json();
      
      const parsedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!parsedText) {
        throw new Error("No parsed structural result received from AI engine.");
      }

      const parsedJSON = JSON.parse(parsedText.trim());
      if (!Array.isArray(parsedJSON)) {
        throw new Error("Parsed response format is not a JSON array of objects.");
      }

      // Complete missing metadata fields on parsed output
      const finalCleanedList = parsedJSON.map((v, index) => ({
        id: `imported-${Date.now()}-${index}`,
        name: v.name || "Unknown Volunteer",
        dob: v.dob || "1995-01-01",
        privilege: v.privilege || "Publisher",
        congregation: v.congregation || "Unassigned",
        circuit: v.circuit || "",
        lastConventionDate: v.lastConventionDate || new Date().toISOString().split('T')[0],
        assignmentHeld: v.assignmentHeld || "General Volunteer",
        recommendedForCommitteeAssistant: !!v.recommendedForCommitteeAssistant,
        phone: v.phone || "",
        email: v.email || "",
        jwpubEmail: v.jwpubEmail || "",
        address: v.address || "",
        evaluation: {
          grade: v.evaluation?.grade || null,
          comments: v.evaluation?.comments || "",
          recommendation: v.evaluation?.recommendation || null,
          evaluatedAt: v.evaluation?.evaluatedAt || null
        }
      }));

      setPendingImports(finalCleanedList);
      showToast(`AI successfully parsed ${finalCleanedList.length} volunteers!`, "success");
    } catch (error: any) {
      console.error(error);
      const isAuthError = error.message?.includes("401") || error.message?.includes("403");
      if (isAuthError) {
        setIsApiKeyModalOpen(true);
        showToast("Gemini key unauthorized or invalid. Please check your credentials.", "error");
      } else {
        showToast(`Import Error: ${error.message || "Failed to parse document structure."}`, "error");
      }
    } finally {
      setIsParsing(false);
      setParseStep("");
    }
  };

  const handleConvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConvFile(file);
    setConvFileMime(file.type);
    setConvFileBase64('');

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        const base64Data = result.split(',')[1] || result;
        setConvFileBase64(base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleParseConventionWithGemini = async () => {
    if (!activeApiKey) {
      setIsApiKeyModalOpen(true);
      showToast("Please save a valid Gemini API Key first.", "error");
      return;
    }
    if (!convPlace.trim() || !convDate.trim() || !convLanguage.trim() || !convNumber.trim()) {
      showToast("Please complete all convention metadata fields (Place, Date, Language, Number).", "error");
      return;
    }
    if (!convFileBase64) {
      showToast("Please select and load a valid congregation roster file.", "error");
      return;
    }

    setIsConvParsing(true);
    setConvParseStep("Initializing convention parsing pipeline...");

    const systemPrompt = `You are an expert document data parser. Analyze the provided congregation roster directory or coordinator spreadsheet describing regional congregations.
Extract each row describing a congregation and its coordinator details into a valid JSON array of objects. Map and find fields strictly matching:
- congregationName (String, full name of the congregation, e.g. "Central Park Spanish", "Spanish - Deland")
- congregationNumber (String, congregation number, e.g. "94631" or "118786")
- circuit (String, circuit ID, e.g. "FL-25-A" or "FL-15-B")
- coordinatorFirstName (String, coordinator's first name / Nombre, e.g. "Jaime", "Julio")
- coordinatorLastName (String, coordinator's last name / Apellidos, e.g. "Soto", "Bonilla")
- coordinatorPhone (String, cell phone / Celular, e.g., "321-278-9949")
- coordinatorEmail (String, standard email address / Correo electrónico)
- coordinatorJwpubEmail (String, congregation email / Correo electrónico Cong., e.g., "CONG00194631@jwpub.org")

If any Spanish terms are present in headers, translate or map them properly:
- "Congregacion" -> congregationName
- "Num de Cong" -> congregationNumber
- "Circuito" -> circuit
- "Nombre" -> coordinatorFirstName
- "Apellidos" -> coordinatorLastName
- "Celular" -> coordinatorPhone
- "Correo electrónico" -> coordinatorEmail
- "Correo electrónico Cong." -> coordinatorJwpubEmail

Only output a raw JSON array of objects. Do not wrap the JSON output inside Markdown brackets or add prefix/suffix comments. Use valid double-quoted JSON formats.`;

    const partsArray = [];
    partsArray.push({ text: `Extract all congregation and coordinator rows from this document.` });
    
    let mimeTypeToSend = convFileMime || 'application/octet-stream';
    if (convFile?.name.endsWith('.docx')) mimeTypeToSend = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (convFile?.name.endsWith('.xlsx')) mimeTypeToSend = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (convFile?.name.endsWith('.xls')) mimeTypeToSend = 'application/vnd.ms-excel';
    if (convFile?.name.endsWith('.doc')) mimeTypeToSend = 'application/msword';

    partsArray.push({
      inlineData: {
        mimeType: mimeTypeToSend,
        data: convFileBase64
      }
    });

    const payload = {
      contents: [{
        parts: partsArray
      }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    try {
      setConvParseStep("Uploading document and parsing with Gemini 2.5 Flash...");
      const response = await fetchWithBackoff(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        5,
        1500
      );

      setConvParseStep("Structuring congregations and volunteer coordinator accounts...");
      const data = await response.json();
      const parsedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!parsedText) {
        throw new Error("No parsed structural result received from AI engine.");
      }

      const parsedJSON = JSON.parse(parsedText.trim());
      if (!Array.isArray(parsedJSON)) {
        throw new Error("Parsed response format is not a JSON array of objects.");
      }

      const congregationsList = parsedJSON.map(row => ({
        name: row.congregationName || "Unknown Congregation",
        number: row.congregationNumber || "",
        circuit: row.circuit || "",
        coordinatorName: `${row.coordinatorFirstName || ""} ${row.coordinatorLastName || ""}`.trim() || "Unknown Coordinator",
        coordinatorPhone: row.coordinatorPhone || "",
        coordinatorEmail: row.coordinatorEmail || "",
        coordinatorJwpubEmail: row.coordinatorJwpubEmail || ""
      }));

      const volunteersList: Volunteer[] = parsedJSON.map((row, index) => ({
        id: `imported-coord-${Date.now()}-${index}`,
        name: `${row.coordinatorFirstName || ""} ${row.coordinatorLastName || ""}`.trim() || "Unknown Coordinator",
        dob: "1980-01-01",
        privilege: "Coordinator",
        congregation: row.congregationName || "Unknown Congregation",
        circuit: row.circuit || "",
        lastConventionDate: convDate,
        assignmentHeld: "Coordinator",
        recommendedForCommitteeAssistant: false,
        phone: row.coordinatorPhone || "",
        email: row.coordinatorEmail || "",
        jwpubEmail: row.coordinatorJwpubEmail || "",
        address: "",
        evaluation: {
          grade: null,
          comments: "Parsed automatically from convention import sheet",
          recommendation: null,
          evaluatedAt: null
        }
      }));

      const newId = `conv-${Date.now()}`;
      const newConvention: Convention = {
        id: newId,
        name: `${convPlace} (${convNumber}) - ${convLanguage}`,
        username: `user-${Date.now()}`,
        password: 'password123',
        place: convPlace,
        date: convDate,
        language: convLanguage,
        number: convNumber
      };

      setConventions(prev => [...prev, newConvention]);

      // Merge newly parsed convention coordinators and congregations into the shared master database
      const savedVols = localStorage.getItem('volunteer_db_shared');
      const currentVols = savedVols ? JSON.parse(savedVols) : INITIAL_VOLUNTEERS;
      const savedCongs = localStorage.getItem('congregations_db_shared');
      const currentCongs = savedCongs ? JSON.parse(savedCongs) : [];

      const uniqueNewVols = volunteersList.filter(nv => !currentVols.some((cv: any) => cv.name.toLowerCase() === nv.name.toLowerCase()));
      const mergedVols = [...currentVols, ...uniqueNewVols];

      const uniqueNewCongs = congregationsList.filter(nc => !currentCongs.some((cc: any) => cc.name.toLowerCase() === nc.name.toLowerCase()));
      const mergedCongs = [...currentCongs, ...uniqueNewCongs];

      localStorage.setItem('congregations_db_shared', JSON.stringify(mergedCongs));
      localStorage.setItem('volunteer_db_shared', JSON.stringify(mergedVols));

      setVolunteers(mergedVols);
      setActiveCongregations(mergedCongs);

      // Auto login to this new convention
      setCurrentConvention(newConvention);
      setIsLoggedIn(true);
      localStorage.setItem('current_convention_id', newId);
      sessionStorage.setItem('is_authenticated', 'true');

      // Clear states & Close
      setConvPlace('');
      setConvDate('');
      setConvLanguage('Spanish');
      setConvNumber('');
      setConvFile(null);
      setConvFileBase64('');
      setIsAddConventionOpen(false);

      showToast(`Convention "${newConvention.name}" created with ${congregationsList.length} congregations!`, "success");
    } catch (error: any) {
      console.error(error);
      showToast(`Convention Import Error: ${error.message || "Failed to process document structure."}`, "error");
    } finally {
      setIsConvParsing(false);
      setConvParseStep("");
    }
  };

  // ==========================================
  // AUTHENTICATION LOGIN ROUTER GATE
  // ==========================================
  if (!isLoggedIn || !currentConvention) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="absolute top-6 right-6">
          <button 
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-amber-500 hover:bg-slate-100'}`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="w-full max-w-md p-8">
          {/* Logo Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-500/20 mb-4">
              <Database className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent dark:text-transparent">
              CPT
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Convention Personnel Tool</p>
          </div>

          <div className={`rounded-2xl border p-6 shadow-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
            {/* Tabs */}
            <div className="flex border-b dark:border-slate-800 border-slate-200 mb-6">
              <button 
                onClick={() => setActiveLoginTab('login')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                  activeLoginTab === 'login' 
                  ? 'border-indigo-500 text-indigo-400' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-300'
                }`}
              >
                Log In
              </button>
              <button 
                onClick={() => setActiveLoginTab('create')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                  activeLoginTab === 'create' 
                  ? 'border-indigo-500 text-indigo-400' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-300'
                }`}
              >
                Register Account
              </button>
            </div>

            {/* TAB 1: LOGIN FORM */}
            {activeLoginTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      required
                      value={authForm.username}
                      onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                      placeholder="Admin username"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
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
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                  Authorize CPT Session
                </button>
              </form>
            )}

            {/* TAB 2: CREATE ACCOUNT FORM */}
            {activeLoginTab === 'create' && (
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">Set Admin Username</label>
                  <input 
                    type="text"
                    required
                    value={createAccountForm.username}
                    onChange={(e) => setCreateAccountForm({ ...createAccountForm, username: e.target.value })}
                    placeholder="Choose username"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">Set Admin Password</label>
                  <input 
                    type="password"
                    required
                    value={createAccountForm.password}
                    onChange={(e) => setCreateAccountForm({ ...createAccountForm, password: e.target.value })}
                    placeholder="Password"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">Confirm Admin Password</label>
                  <input 
                    type="password"
                    required
                    value={createAccountForm.confirmPassword}
                    onChange={(e) => setCreateAccountForm({ ...createAccountForm, confirmPassword: e.target.value })}
                    placeholder="Repeat password"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>
        
        {/* System Notification Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
            <div className={`flex items-center gap-2.5 px-4.5 py-3 rounded-xl border shadow-xl ${
              toast.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-xs font-semibold">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // CONVENTION SELECTOR GATE (POST-LOGIN)
  // ==========================================
  if (!currentConvention) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans p-4 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-amber-500 hover:bg-slate-100'}`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button 
            onClick={handleLogout}
            className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-rose-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-rose-600 hover:bg-slate-100'}`}
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full max-w-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-500/20 mb-4">
              <Database className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">Convention Selector</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Select an active convention database or configure a new registry setup.</p>
          </div>

          <div className={`rounded-2xl border p-6 shadow-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Active Convention Sessions</h3>
            
            {conventions.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-xl border-slate-800/80 mb-6 bg-slate-950/20">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400">No conventions registered yet</p>
                <p className="text-xs text-slate-500 mt-1">Please import a congregation roster file below to register your first convention session.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-h-80 overflow-y-auto pr-1">
                {conventions.map(conv => (
                  <div 
                    key={conv.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      theme === 'dark' ? 'bg-slate-950/60 border-slate-850 hover:bg-slate-800/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-indigo-400 truncate">{conv.name}</h4>
                      <div className="text-xxs text-slate-500 mt-1 space-y-0.5">
                        {conv.place && <div>Place: {conv.place}</div>}
                        {conv.date && <div>Date: {conv.date}</div>}
                        {conv.language && <div>Language: {conv.language}</div>}
                        {conv.number && <div>Identifier: {conv.number}</div>}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setCurrentConvention(conv);
                          localStorage.setItem('current_convention_id', conv.id);
                          showToast(`Loaded "${conv.name}" session successfully.`, "success");
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all text-center"
                      >
                        Enter Session
                      </button>
                      <button 
                        onClick={() => {
                          triggerConfirm(
                            "Delete Convention",
                            `Are you sure you want to delete the convention session registry for "${conv.name}"? This does not wipe volunteers, but deletes the convention configuration.`,
                            () => {
                              setConventions(prev => prev.filter(c => c.id !== conv.id));
                              showToast(`Successfully deleted "${conv.name}".`, "success");
                            }
                          );
                        }}
                        className="p-1.5 rounded-lg border border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                        title="Delete Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button 
              onClick={() => setIsAddConventionOpen(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Import & Configure New Convention</span>
            </button>
          </div>
        </div>

        {/* System Notification Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
            <div className={`flex items-center gap-2.5 px-4.5 py-3 rounded-xl border shadow-xl ${
              toast.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-xs font-semibold">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Confirm and Merge Gemini Imports
  const handleConfirmMergeImports = () => {
    if (pendingImports.length === 0) return;
    setVolunteers(prev => [...pendingImports, ...prev]);
    showToast(`Successfully registered ${pendingImports.length} volunteers to the master roster!`, "success");
    setPendingImports([]);
    setImportText('');
    setImportFile(null);
    setImportFileBase64('');
    setIsImportOpen(false);
  };

  const handleRemovePendingImport = (indexToRemove: number) => {
    setPendingImports(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleEditPendingField = (idx: number, field: string, value: any) => {
    setPendingImports(prev => prev.map((item, i) => {
      if (i === idx) {
        if (field.startsWith('evaluation.')) {
          const evalKey = field.split('.')[1];
          return {
            ...item,
            evaluation: {
              ...(item.evaluation || { grade: null, comments: "", recommendation: null, evaluatedAt: null }),
              [evalKey]: value
            }
          };
        }
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
    downloadAnchor.setAttribute("download", `volunteer_db_${currentConvention.id}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Master database backup file downloaded successfully.", "success");
  };

  const importDatabaseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;
    fileReader.readAsText(file, "UTF-8");
    fileReader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const result = event.target?.result;
        if (typeof result === 'string') {
          const parsed = JSON.parse(result);
          if (Array.isArray(parsed)) {
            setVolunteers(parsed);
            showToast(`Master database restored with ${parsed.length} volunteer logs!`, "success");
          } else {
            showToast("Error restoring backup. File schema is invalid.", "error");
          }
        }
      } catch (err) {
        showToast("Corrupt file or invalid JSON backup document.", "error");
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
      () => {
        setVolunteers(prev => prev.filter(v => v.id !== id));
        showToast(`Successfully removed "${name}" from the database.`, "success");
      }
    );
  };

  // ==========================================
  // EVALUATION & PROFILE MODAL SAVE
  // ==========================================
  const handleSaveVolunteer = (formData: any) => {
    if (volunteerModal.type === 'add') {
      const newVol = {
        id: `v-${Date.now()}`,
        name: formData.name,
        dob: formData.dob,
        privilege: formData.privilege,
        congregation: formData.congregation,
        circuit: formData.circuit,
        lastConventionDate: formData.lastConventionDate,
        assignmentHeld: formData.assignmentHeld,
        recommendedForCommitteeAssistant: formData.recommendedForCommitteeAssistant,
        phone: formData.phone,
        email: formData.email,
        jwpubEmail: formData.jwpubEmail,
        address: formData.address,
        evaluation: {
          grade: null,
          comments: "",
          recommendation: null,
          evaluatedAt: null
        }
      };
      setVolunteers(prev => [newVol, ...prev]);
      showToast(`Registered profile for "${formData.name}".`, "success");
    } else if (volunteerModal.type === 'edit') {
      setVolunteers(prev => prev.map(v => {
        if (v.id === volunteerModal.data?.id) {
          return {
            ...v,
            name: formData.name,
            dob: formData.dob,
            privilege: formData.privilege,
            congregation: formData.congregation,
            circuit: formData.circuit,
            lastConventionDate: formData.lastConventionDate,
            assignmentHeld: formData.assignmentHeld,
            recommendedForCommitteeAssistant: formData.recommendedForCommitteeAssistant,
            phone: formData.phone,
            email: formData.email,
            jwpubEmail: formData.jwpubEmail,
            address: formData.address
          };
        }
        return v;
      }));
      showToast(`Updated profile for "${formData.name}".`, "success");
    } else if (volunteerModal.type === 'evaluate') {
      setVolunteers(prev => prev.map(v => {
        if (v.id === volunteerModal.data?.id) {
          return {
            ...v,
            evaluation: {
              grade: formData.grade,
              comments: formData.comments,
              recommendation: formData.recommendation,
              evaluatedAt: new Date().toISOString()
            }
          };
        }
        return v;
      }));
      showToast(`Evaluation completed for "${volunteerModal.data?.name}".`, "success");
    }

    setVolunteerModal({ isOpen: false, type: 'add', data: null });
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* ==========================================
          HEADER / NAVIGATION
          ========================================== */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-500 bg-clip-text text-transparent dark:text-transparent">
                CPT
              </h1>
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1.5">
              <select
                value={currentConvention?.id || ''}
                onChange={(e) => {
                  const selected = conventions.find(c => c.id === e.target.value);
                  if (selected) {
                    setCurrentConvention(selected);
                    localStorage.setItem('current_convention_id', selected.id);
                  }
                }}
                className={`text-xs font-bold py-1 px-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                  theme === 'dark' 
                  ? 'bg-slate-950 border-slate-850 text-slate-300' 
                  : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {conventions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => setIsAddConventionOpen(true)}
                className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 hover:opacity-90 transition-all ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
                title="Import/Add New Convention"
              >
                <Plus className="w-3 h-3 text-indigo-400" />
                <span>Import Conv</span>
              </button>
            </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* PWA Install Trigger */}
            {deferredPrompt && (
              <button 
                onClick={handleInstallApp}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-bold transition-all bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-102 active:scale-98 shrink-0 shadow-lg shadow-indigo-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Connection Badge Indicator / Modal Trigger */}
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
                  <span>Gemini Connected {customApiKey && "(Custom)"}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                  <span>Setup Gemini Key</span>
                </>
              )}
            </button>

            {/* Local backup controls */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={exportDatabase}
                title="Backup Convention Data"
                className={`p-2 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
              >
                <Download className="w-4.5 h-4.5" />
              </button>
              <label 
                title="Restore Convention Backup"
                className={`p-2 rounded-xl border cursor-pointer transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
              >
                <Upload className="w-4.5 h-4.5" />
                <input type="file" accept=".json" onChange={importDatabaseFile} className="hidden" />
              </label>
            </div>

            {/* Dark/Light Toggle */}
            <button 
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-amber-500 hover:bg-slate-200'}`}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Switch Convention Setup */}
            <button 
              onClick={handleSwitchConvention}
              title="Switch Convention Registry"
              className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'}`}
            >
              <Sliders className="w-4.5 h-4.5" />
            </button>

            {/* Logout Gate Switcher */}
            <button 
              onClick={handleLogout}
              title="Log Out Account"
              className={`p-2.5 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-rose-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-rose-600 hover:bg-slate-200'}`}
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
                onClick={() => setVolunteerModal({ isOpen: true, type: 'add', data: null })}
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
                      theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input 
                    type="number" 
                    placeholder="Max"
                    value={filterAgeMax}
                    onChange={(e) => setFilterAgeMax(e.target.value)}
                    className={`w-1/2 text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Date Ranges */}
              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1.5">Last Convention Date</label>
                <div className="space-y-1.5">
                  <input 
                    type="date" 
                    placeholder="From"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className={`w-full text-xs px-3 py-1.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <input 
                    type="date" 
                    placeholder="To"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className={`w-full text-xs px-3 py-1.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Reset Filters */}
                <button 
                  onClick={() => {
                    setFilterCongregation([]);
                    setFilterPrivilege([]);
                    setFilterStatus('all');
                    setFilterAgeMin('');
                    setFilterAgeMax('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setSearchQuery('');
                  }}
                  className="mt-4 text-xs font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Clear Filters
                </button>
              </div>

            </div>
          )}
        </section>

        {/* ==========================================
            VOLUNTEER LIST (GRID & TABLE VIEW)
            ========================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start mb-8">
          {/* Sidebar Panel for Congregations - Desktop Only */}
          {activeCongregations.length > 0 && (
            <div className={`lg:col-span-1 rounded-2xl border p-4 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} hidden lg:block`}>
              <div className="flex items-center justify-between pb-3 border-b dark:border-slate-800 border-slate-200 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Congregations ({activeCongregations.length})</span>
                {selectedCongregation && (
                  <button 
                    onClick={() => setSelectedCongregation(null)}
                    className="text-xxs text-indigo-400 font-bold hover:underline"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {activeCongregations.map(cong => {
                  const isSelected = selectedCongregation === cong.name;
                  return (
                    <button
                      key={cong.name}
                      onClick={() => setSelectedCongregation(isSelected ? null : cong.name)}
                      className={`w-full text-left text-xs p-2.5 rounded-xl transition-all flex flex-col gap-1 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/25' 
                          : (theme === 'dark' ? 'bg-slate-950/40 hover:bg-slate-800/50 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700')
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="truncate flex-1">{cong.name}</span>
                        {cong.circuit && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {cong.circuit}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] opacity-75">
                        <span>{cong.coordinatorName || 'No Coordinator'}</span>
                        {cong.number && <span>#{cong.number}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right Column: Volunteers List and Selected Congregation Metadata Card */}
          <div className={`${activeCongregations.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'} space-y-6`}>
            
            {/* Mobile Congregation Switcher Trigger */}
            {activeCongregations.length > 0 && (
              <div className={`lg:hidden flex items-center justify-between p-4 rounded-2xl border transition-all ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Congregation</span>
                  <span className="text-sm font-semibold text-indigo-400">
                    {selectedCongregation ? selectedCongregation : "All Congregations"}
                  </span>
                </div>
                <button 
                  onClick={() => setIsMobileCongListOpen(true)}
                  className="text-xs font-bold px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-755 text-white transition-all shadow-md"
                >
                  Change Filter
                </button>
              </div>
            )}

            {/* Display Selected Congregation Metadata Details */}
            {selectedCongregation && (() => {
              const congDetail = activeCongregations.find(c => c.name === selectedCongregation);
              if (!congDetail) return null;
              return (
                <div className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between gap-4 animate-fadeIn ${
                  theme === 'dark' ? 'bg-gradient-to-br from-indigo-950/30 to-slate-900 border-indigo-500/30 text-slate-100' : 'bg-gradient-to-br from-indigo-50/50 to-white border-indigo-200 text-slate-900 shadow-sm'
                }`}>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-indigo-400">{congDetail.name}</h3>
                      {congDetail.number && (
                        <span className="font-mono text-xxs font-bold bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-full border border-slate-500/20">
                          ID: #{congDetail.number}
                        </span>
                      )}
                      {congDetail.circuit && (
                        <span className="font-mono text-xxs font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">
                          Circuit: {congDetail.circuit}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 pt-2 border-t border-slate-800/30 text-xs text-slate-400">
                      <div>
                        <strong className="text-slate-300 font-semibold">Coordinator:</strong> {congDetail.coordinatorName}
                      </div>
                      {congDetail.coordinatorPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{congDetail.coordinatorPhone}</span>
                        </div>
                      )}
                      {congDetail.coordinatorEmail && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="truncate max-w-[150px]">{congDetail.coordinatorEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end">
                    <button 
                      onClick={() => setSelectedCongregation(null)}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 flex items-center gap-1 border border-slate-700"
                    >
                      <X className="w-4 h-4" /> Reset Congregation Filter
                    </button>
                  </div>
                </div>
              );
            })()}

            <section className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-xs font-bold tracking-wider uppercase ${theme === 'dark' ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <th className="py-4 px-6">Name / Contacts</th>
                  <th className="py-4 px-4">Age / DOB</th>
                  <th className="py-4 px-4">Privilege</th>
                  <th className="py-4 px-4">Congregation / Address</th>
                  <th className="py-4 px-4">Department / Assignment</th>
                  <th className="py-4 px-4">Committee Assistant</th>
                  <th className="py-4 px-4 text-center">Grade Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredVolunteers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <div className="max-w-md mx-auto flex flex-col items-center">
                        <Database className="w-12 h-12 text-slate-600 mb-4 animate-pulse" />
                        <h3 className="text-lg font-bold text-slate-400">No Volunteer Records</h3>
                        <p className="text-xs text-slate-500 mt-2">No matching volunteers found with the chosen parameters. Refine your filters or create a new entry.</p>
                        <button 
                          onClick={() => setVolunteerModal({ isOpen: true, type: 'add', data: null })}
                          className="mt-5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all"
                        >
                          Add Master Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVolunteers.map(v => {
                    const age = calculateAge(v.dob);
                    const isEvaluated = v.evaluation && v.evaluation.grade !== null;
                    return (
                      <tr 
                        key={v.id} 
                        className={`hover:bg-slate-800/20 group transition-colors duration-150 ${isEvaluated ? '' : 'bg-rose-500/5'}`}
                      >
                        {/* Name & Avatar + Contact Overlay */}
                        <td className="py-4 px-6">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center border-2 shrink-0 mt-1 ${
                              isEvaluated 
                              ? (v.evaluation.grade === 'A' ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400' :
                                 v.evaluation.grade === 'B' ? 'bg-indigo-500/15 border-indigo-500 text-indigo-400' :
                                 v.evaluation.grade === 'C' ? 'bg-amber-500/15 border-amber-500 text-amber-400' :
                                 'bg-rose-500/15 border-rose-500 text-rose-400')
                              : 'bg-slate-700/25 border-slate-500 text-slate-400'
                            }`}>
                              {v.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="space-y-1">
                              <div className="font-semibold text-sm group-hover:text-indigo-400 transition-colors">{v.name}</div>
                              <span className="text-xxs text-slate-500 block">Last worked: {v.lastConventionDate || 'None'}</span>
                              
                              {/* Extended Contact Badges inline */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {v.phone && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700" title={`Phone: ${v.phone}`}>
                                    <Phone className="w-2.5 h-2.5 text-indigo-400" /> {v.phone}
                                  </span>
                                )}
                                {v.email && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700" title={`Email: ${v.email}`}>
                                    <Mail className="w-2.5 h-2.5 text-purple-400" /> {v.email}
                                  </span>
                                )}
                                {v.jwpubEmail && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20" title={`JWPub Email: ${v.jwpubEmail}`}>
                                    <Globe className="w-2.5 h-2.5 text-indigo-400" /> {v.jwpubEmail}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Age & DOB */}
                        <td className="py-4 px-4">
                          <div className="text-sm font-medium">{age} yrs</div>
                          <span className="text-xxs text-slate-500 font-mono">{v.dob}</span>
                        </td>

                        {/* Privilege */}
                        <td className="py-4 px-4 text-sm font-medium">
                          {v.privilege}
                        </td>

                        {/* Congregation & Physical Address */}
                        <td className="py-4 px-4">
                          <div className="text-sm font-medium text-slate-300 dark:text-slate-200 flex items-center gap-1.5">
                            {v.congregation}
                            {v.circuit && (
                              <span className="font-mono text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold border border-indigo-500/25 shrink-0">
                                {v.circuit}
                              </span>
                            )}
                          </div>
                          {v.address ? (
                            <span className="inline-flex items-center gap-1 text-xxs text-slate-500 mt-0.5" title={v.address}>
                              <MapPin className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{v.address}</span>
                            </span>
                          ) : (
                            <span className="text-xxs text-slate-600 italic block">No physical address</span>
                          )}
                        </td>

                        {/* Assignment */}
                        <td className="py-4 px-4 text-sm font-semibold text-indigo-400">
                          {v.assignmentHeld}
                        </td>

                        {/* Committee Assistant Flag */}
                        <td className="py-4 px-4">
                          {v.recommendedForCommitteeAssistant ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <Check className="w-3.5 h-3.5" /> Approved
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 font-medium">—</span>
                          )}
                        </td>

                        {/* Grade Status */}
                        <td className="py-4 px-4 text-center">
                          {isEvaluated ? (
                            <div className="inline-flex flex-col items-center">
                              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                v.evaluation.grade === 'A' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                v.evaluation.grade === 'B' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                                v.evaluation.grade === 'C' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}>
                                Grade {v.evaluation.grade}
                              </span>
                              <span className="text-[10px] text-slate-500 mt-1">
                                {v.evaluation.recommendation}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-rose-400 bg-rose-500/10 px-2.5 py-1 border border-rose-500/25 rounded-xl">
                              Pending Evaluation
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setVolunteerModal({ isOpen: true, type: 'evaluate', data: v })}
                              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all duration-150"
                            >
                              Evaluate
                            </button>
                            <button 
                              onClick={() => setVolunteerModal({ isOpen: true, type: 'edit', data: v })}
                              className={`p-1.5 rounded-lg border ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteVolunteer(v.id, v.name)}
                              className="p-1.5 rounded-lg border border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Grid View */}
          <div className={`block lg:hidden divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredVolunteers.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">No records matched your parameters.</p>
              </div>
            ) : (
              filteredVolunteers.map(v => {
                const age = calculateAge(v.dob);
                const isEvaluated = v.evaluation && v.evaluation.grade !== null;
                return (
                  <div key={v.id} className="p-4 space-y-3.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-base">{v.name}</h4>
                        <span className="text-xs text-slate-400 dark:text-slate-400">{v.congregation}{v.circuit ? ` (${v.circuit})` : ''} — {v.privilege}</span>
                      </div>
                      
                      {isEvaluated ? (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          v.evaluation.grade === 'A' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          v.evaluation.grade === 'B' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                          v.evaluation.grade === 'C' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          Grade {v.evaluation.grade}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-rose-400 bg-rose-500/10 px-2.5 py-1 border border-rose-500/25 rounded-xl">
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Contacts block in Mobile Card */}
                    {(v.phone || v.email || v.jwpubEmail || v.address) && (
                      <div className={`p-2.5 rounded-xl border space-y-1.5 text-xs ${
                        theme === 'dark' ? 'bg-slate-950/20 border-slate-800/50 text-slate-300' : 'bg-slate-100/60 border-slate-200/80 text-slate-650'
                      }`}>
                        {v.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{v.phone}</span>
                          </div>
                        )}
                        {v.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-purple-400" />
                            <span className="truncate">{v.email}</span>
                          </div>
                        )}
                        {v.jwpubEmail && (
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="truncate">{v.jwpubEmail}</span>
                          </div>
                        )}
                        {v.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 mt-0.5" />
                            <span className="leading-tight">{v.address}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-y-1.5 text-xs dark:text-slate-400 text-slate-500">
                      <div><strong className="dark:text-slate-200 text-slate-700">Age:</strong> {age} yrs ({v.dob})</div>
                      <div><strong className="dark:text-slate-200 text-slate-700">Assignment:</strong> {v.assignmentHeld}</div>
                      <div><strong className="dark:text-slate-200 text-slate-700">Last worked:</strong> {v.lastConventionDate}</div>
                      <div><strong className="dark:text-slate-200 text-slate-700">Committee Rec:</strong> {v.recommendedForCommitteeAssistant ? "Yes" : "No"}</div>
                    </div>

                    {isEvaluated && (
                      <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Recommendation</div>
                        <div className="text-xs font-medium text-indigo-400 mt-0.5">{v.evaluation.recommendation}</div>
                        <div className="text-xs text-slate-450 dark:text-slate-400 mt-1.5 italic">"{v.evaluation.comments}"</div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button 
                        onClick={() => setVolunteerModal({ isOpen: true, type: 'evaluate', data: v })}
                        className="flex-1 text-center text-xs font-semibold py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                      >
                        Evaluate Team Member
                      </button>
                      <button 
                        onClick={() => setVolunteerModal({ isOpen: true, type: 'edit', data: v })}
                        className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteVolunteer(v.id, v.name)}
                        className="p-2.5 rounded-xl border border-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

            </section>
          </div>
        </div>

      </main>

      {/* ==========================================
          VOLUNTEER MANAGEMENT MODAL (ADD / EDIT / EVALUATE)
          ========================================== */}
      {volunteerModal.isOpen && (
        <VolunteerModalWrapper 
          type={volunteerModal.type} 
          data={volunteerModal.data} 
          theme={theme}
          onClose={() => setVolunteerModal({ isOpen: false, type: 'add', data: null })}
          onSave={handleSaveVolunteer}
        />
      )}

      {/* Mobile Congregations Drawer */}
      {isMobileCongListOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end lg:hidden animate-fadeIn">
          <div className={`w-full max-w-xs h-full flex flex-col p-5 overflow-y-auto ${theme === 'dark' ? 'bg-slate-900 text-slate-100 border-l border-slate-800' : 'bg-white text-slate-900 border-l border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 dark:border-slate-800 border-slate-200">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Congregations ({activeCongregations.length})</span>
              </div>
              <button 
                onClick={() => setIsMobileCongListOpen(false)}
                className={`p-1.5 rounded-lg border ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            {selectedCongregation && (
              <button 
                onClick={() => {
                  setSelectedCongregation(null);
                  setIsMobileCongListOpen(false);
                }}
                className="w-full text-center text-xs font-bold py-2.5 mb-4 rounded-xl border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 transition-all"
              >
                Clear Filter
              </button>
            )}

            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {activeCongregations.map(cong => {
                const isSelected = selectedCongregation === cong.name;
                return (
                  <button
                    key={cong.name}
                    onClick={() => {
                      setSelectedCongregation(isSelected ? null : cong.name);
                      setIsMobileCongListOpen(false);
                    }}
                    className={`w-full text-left text-xs p-3.5 rounded-xl transition-all flex flex-col gap-1.5 border ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/25' 
                        : (theme === 'dark' ? 'bg-slate-950/40 border-slate-850 hover:bg-slate-800/50 text-slate-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700')
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="truncate flex-1 font-semibold">{cong.name}</span>
                      {cong.circuit && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {cong.circuit}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] opacity-75">
                      <span>{cong.coordinatorName || 'No Coordinator'}</span>
                      {cong.number && <span>#{cong.number}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          AI INTELLIGENT IMPORT PORTAL (DRAWER)
          ========================================== */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className={`w-full max-w-4xl h-full flex flex-col p-6 sm:p-8 overflow-y-auto ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
            
            <div className="flex items-center justify-between border-b pb-4 mb-6 dark:border-slate-800 border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-r from-indigo-500 to-violet-500 p-2 rounded-xl text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Multimodal Intelligent Importer</h2>
                  <p className="text-xs text-slate-400">Powered by Gemini 2.5 OCR & Parsing Pipelines</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsImportOpen(false);
                  setPendingImports([]);
                  setImportText('');
                  setImportFile(null);
                  setImportFileBase64('');
                }}
                className={`p-2 rounded-xl border ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Instruction Panel */}
            <div className={`p-4 rounded-xl text-xs mb-6 ${theme === 'dark' ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
              <h4 className="font-bold text-slate-400 mb-1">Upload Options & File Support:</h4>
              <p className="text-slate-500 leading-relaxed mb-2">
                You can now parse roster lists, reports, or data files in multiple ways:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-500 font-medium">
                <li><strong>Microsoft Word documents:</strong> Supports `.doc` and `.docx` binary files! Drag & drop or attach directly.</li>
                <li><strong>Images & PDFs:</strong> Drag and drop pictures of schedules, tables, physical documents, or PDF reports. Gemini reads them dynamically using advanced vision OCR.</li>
                <li><strong>Spreadsheets:</strong> Support for `.xls` and `.xlsx` data formats.</li>
                <li><strong>Plain Text & CSVs:</strong> Load plain text, schedules, or comma-separated tables instantly.</li>
              </ul>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="mb-6">
              <span className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-2">Upload Files, Images, or Word Documents</span>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  importFile 
                  ? 'border-indigo-500 bg-indigo-500/5' 
                  : 'border-slate-700 hover:border-indigo-500 bg-slate-950/30 hover:bg-indigo-500/5'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*,application/pdf,text/plain,text/csv,.xls,.xlsx,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden" 
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <FileUp className="w-6 h-6" />
                  </div>
                  {importFile ? (
                    <div>
                      <p className="text-sm font-semibold text-indigo-400">{importFile.name}</p>
                      <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB — Click to change file</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Drag & Drop or Click to Upload</p>
                      <p className="text-xs text-slate-500">Supports PDF, Word Documents (DOCX/DOC), JPG, PNG, CSV, Excel (XLSX)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Raw Fallback Text Area */}
            <div className="space-y-3.5 mb-6">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold tracking-wider uppercase text-slate-400">Or Paste Roster / Raw Content Text</label>
                {importFile && (
                  <button 
                    onClick={() => {
                      setImportFile(null);
                      setImportFileBase64('');
                      setImportText('');
                    }}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Clear Loaded File
                  </button>
                )}
              </div>
              <textarea 
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Alternative: Paste raw, unstructured email, WhatsApp rosters or CSV data blocks here...
Example:
Brother Jonathan Mercer, Elder at Oakwood Pines, 407-555-0143, email: j.mercer@gmail.com, work address: 1428 Whispering Pines. Attendants dept."
                className={`w-full p-4 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                }`}
              ></textarea>
            </div>

            {/* Process Parser Trigger */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-4 border-b dark:border-slate-800 pb-6 mb-6">
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleParseWithGemini}
                  disabled={isParsing}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold transition-all disabled:opacity-50 shadow-md"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Parsing Pipeline...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4.5 h-4.5" />
                      Start AI Parse
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Active Parsing State Overlay */}
            {isParsing && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">{parseStep}</p>
                  <p className="text-xs text-slate-500 mt-1">Please keep this tab open while our engine processes your file</p>
                </div>
              </div>
            )}

            {/* Pending Imports Review Step */}
            {!isParsing && pendingImports.length > 0 && (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-indigo-400">Stage 2: Review and Resolve Pending Imports</h3>
                    <p className="text-xs text-slate-400">Review the extracted metadata including parsed phone, emails, and physical addresses.</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-500/15 text-indigo-400 rounded-lg">
                    {pendingImports.length} pending
                  </span>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 flex-1">
                  {pendingImports.map((item, idx) => (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-start md:items-center ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Left: Fields mapping editable form (Enhanced fields) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 w-full">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</label>
                          <input 
                            type="text" 
                            value={item.name}
                            onChange={(e) => handleEditPendingField(idx, 'name', e.target.value)}
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</label>
                          <input 
                            type="text" 
                            value={item.phone}
                            onChange={(e) => handleEditPendingField(idx, 'phone', e.target.value)}
                            placeholder="Phone number"
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Personal Email</label>
                          <input 
                            type="email" 
                            value={item.email}
                            onChange={(e) => handleEditPendingField(idx, 'email', e.target.value)}
                            placeholder="Email"
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">JWPub Email</label>
                          <input 
                            type="text" 
                            value={item.jwpubEmail}
                            onChange={(e) => handleEditPendingField(idx, 'jwpubEmail', e.target.value)}
                            placeholder="name@jwpub.org"
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Physical Address</label>
                          <input 
                            type="text" 
                            value={item.address}
                            onChange={(e) => handleEditPendingField(idx, 'address', e.target.value)}
                            placeholder="Full physical address"
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date of Birth</label>
                          <input 
                            type="date" 
                            value={item.dob}
                            onChange={(e) => handleEditPendingField(idx, 'dob', e.target.value)}
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Privilege</label>
                          <select 
                            value={item.privilege}
                            onChange={(e) => handleEditPendingField(idx, 'privilege', e.target.value)}
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          >
                            <option value="Elder">Elder</option>
                            <option value="Ministerial Servant">Ministerial Servant</option>
                            <option value="Pioneer">Pioneer</option>
                            <option value="Publisher">Publisher</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Congregation</label>
                          <input 
                            type="text" 
                            value={item.congregation}
                            onChange={(e) => handleEditPendingField(idx, 'congregation', e.target.value)}
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Circuit</label>
                          <input 
                            type="text" 
                            value={item.circuit}
                            onChange={(e) => handleEditPendingField(idx, 'circuit', e.target.value)}
                            placeholder="FL-**-** or **-**"
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Last Worked Date</label>
                          <input 
                            type="date" 
                            value={item.lastConventionDate}
                            onChange={(e) => handleEditPendingField(idx, 'lastConventionDate', e.target.value)}
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assignment</label>
                          <input 
                            type="text" 
                            value={item.assignmentHeld}
                            onChange={(e) => handleEditPendingField(idx, 'assignmentHeld', e.target.value)}
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Eval Grade</label>
                          <select 
                            value={item.evaluation?.grade || ''}
                            onChange={(e) => handleEditPendingField(idx, 'evaluation.grade', e.target.value || null)}
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          >
                            <option value="">Unrated</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Evaluation Comments</label>
                          <input 
                            type="text" 
                            value={item.evaluation?.comments || ''}
                            onChange={(e) => handleEditPendingField(idx, 'evaluation.comments', e.target.value)}
                            placeholder="Comments or Comentarios"
                            className={`w-full text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                          />
                        </div>
                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={item.recommendedForCommitteeAssistant}
                              onChange={(e) => handleEditPendingField(idx, 'recommendedForCommitteeAssistant', e.target.checked)}
                              className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-700 rounded"
                            />
                            <span className="text-xs font-semibold text-slate-400">Rec. Committee</span>
                          </label>
                        </div>
                      </div>

                      {/* Right: Remove action */}
                      <button 
                        onClick={() => handleRemovePendingImport(idx)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 self-stretch flex items-center justify-center shrink-0 transition-all"
                        title="Discard from Queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Confirm Final import trigger */}
                <div className="pt-4 border-t dark:border-slate-800 flex justify-end gap-3 shrink-0">
                  <button 
                    onClick={() => {
                      setPendingImports([]);
                      setImportFile(null);
                      setImportFileBase64('');
                    }}
                    className="text-xs font-bold text-rose-400 hover:bg-rose-500/10 px-4 py-2.5 rounded-xl"
                  >
                    Discard All Queue
                  </button>
                  <button 
                    onClick={handleConfirmMergeImports}
                    className="flex items-center gap-2 text-xs font-bold px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Check className="w-4.5 h-4.5" />
                    Commit Import to Database
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==========================================
          FALLBACK GEMINI API CONFIGURE KEY MODAL
          ========================================== */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-lg rounded-2xl border p-6 flex flex-col max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center pb-4 border-b dark:border-slate-800 border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">System Settings & Data Control</h3>
              </div>
              <button 
                onClick={() => setIsApiKeyModalOpen(false)}
                className={`p-1.5 rounded-lg border ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Custom API key configure */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Section 1: Gemini API Key Setup</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If the default platform authorization is missing or unauthorized, you can paste your personal Gemini Developer Key below.
              </p>
              <input 
                type="password" 
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                }`}
              />
              {customApiKey && (
                <button 
                  onClick={() => {
                    setCustomApiKey('');
                    showToast("Reverted to automatic system key.", "info");
                  }}
                  className="text-xxs text-rose-400 hover:underline block pt-1"
                >
                  Clear Custom Key & use System Key
                </button>
              )}
            </div>

            <hr className="dark:border-slate-800 border-slate-200 mb-6" />

            {/* Master Data Delete operations */}
            <div className="space-y-4 mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">Section 2: Danger Zone & Data Cleanses</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Permanently purge records, configurations, or wipe entire workspaces from your browser state.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleClearVolunteers}
                  className="px-4 py-3 rounded-xl border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold text-center transition-all"
                >
                  Wipe Volunteers Database
                </button>

                <button
                  type="button"
                  onClick={handleClearCongregations}
                  className="px-4 py-3 rounded-xl border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold text-center transition-all"
                >
                  Wipe Congregations list
                </button>

                {currentConvention && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentConvention}
                    className="px-4 py-3 rounded-xl border border-rose-500/20 text-rose-450 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold text-center transition-all"
                  >
                    Delete Current Convention
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleWipeAllData}
                  className="px-4 py-3 rounded-xl border border-red-650/35 text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-center transition-all"
                >
                  Factory Reset (Wipe Everything)
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t dark:border-slate-800 border-slate-200 shrink-0">
              <button 
                onClick={() => setIsApiKeyModalOpen(false)}
                className="text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-755 text-slate-300"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsApiKeyModalOpen(false);
                  showToast("Configuration profiles updated.", "success");
                }}
                className="text-xs font-bold px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          ADD/IMPORT CONVENTION MODAL
          ========================================== */}
      {isAddConventionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-lg rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center pb-4 border-b dark:border-slate-800 border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Import & Add Convention</h3>
              </div>
              <button 
                onClick={() => setIsAddConventionOpen(false)}
                className={`p-1.5 rounded-lg border ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Upload a congregation roster/coordinator list. Gemini will parse all congregations, circuit codes, and coordinator details to construct the convention database.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Place / Location</label>
                <input 
                  type="text" 
                  value={convPlace}
                  onChange={(e) => setConvPlace(e.target.value)}
                  placeholder="e.g. Orlando, FL"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Convention Date</label>
                <input 
                  type="date" 
                  value={convDate}
                  onChange={(e) => setConvDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Language</label>
                <select
                  value={convLanguage}
                  onChange={(e) => setConvLanguage(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                >
                  <option value="Spanish">Spanish</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Convention Identifier / Number</label>
                <input 
                  type="text" 
                  value={convNumber}
                  onChange={(e) => setConvNumber(e.target.value)}
                  placeholder="e.g. CO-01 or Region 5"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Upload congregations & Coordinators list</label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleConvFileChange}
                  disabled={isConvParsing}
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
                  className="hidden"
                  id="conv-file-upload-input"
                />
                <label
                  htmlFor="conv-file-upload-input"
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-800/10 ${
                    isConvParsing 
                      ? 'border-indigo-500 bg-indigo-500/5 opacity-70 pointer-events-none' 
                      : 'border-slate-700 hover:border-indigo-500'
                  }`}
                >
                  {isConvParsing ? (
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                      <span className="text-xs font-semibold text-indigo-400 font-mono text-center">
                        {convParseStep}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <div className="bg-indigo-500/10 p-3 rounded-full text-indigo-400 mb-2">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold">
                        {convFile ? convFile.name : 'Select congregation roster file'}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        Supports PDF, Word (.docx), or Excel (.xlsx, .csv)
                      </span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button 
                onClick={() => setIsAddConventionOpen(false)}
                className="text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750"
              >
                Close
              </button>
              <button 
                onClick={handleParseConventionWithGemini}
                disabled={isConvParsing}
                className="text-xs font-bold px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {isConvParsing ? 'Parsing...' : 'Import & Build Convention'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SYSTEM FEEDBACK TOAST / DIALOGS
          ========================================== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
          <div className={`flex items-center gap-2.5 px-4.5 py-3 rounded-xl border shadow-xl ${
            toast.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-md rounded-2xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className="font-bold text-lg mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-2.5">
              <button 
                onClick={confirmModal.onCancel}
                className="text-xs font-bold px-4.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-755 text-slate-300"
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="text-xs font-bold px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// VOLUNTEER EDIT / EVALUATE FORM WRAPPER MODAL
// ==========================================
interface VolunteerFormData {
  name: string;
  dob: string;
  privilege: string;
  congregation: string;
  circuit: string;
  lastConventionDate: string;
  assignmentHeld: string;
  recommendedForCommitteeAssistant: boolean;
  phone: string;
  email: string;
  jwpubEmail: string;
  address: string;
  grade: string | null;
  comments: string;
  recommendation: string;
}

interface VolunteerModalWrapperProps {
  type: 'add' | 'edit' | 'evaluate';
  data: Volunteer | null;
  theme: string;
  onClose: () => void;
  onSave: (formData: VolunteerFormData) => void;
}

function VolunteerModalWrapper({ type, data, theme, onClose, onSave }: VolunteerModalWrapperProps) {
  const [formData, setFormData] = useState<VolunteerFormData>({
    name: data?.name || '',
    dob: data?.dob || '',
    privilege: data?.privilege || 'Publisher',
    congregation: data?.congregation || '',
    circuit: data?.circuit || '',
    lastConventionDate: data?.lastConventionDate || '',
    assignmentHeld: data?.assignmentHeld || '',
    recommendedForCommitteeAssistant: data?.recommendedForCommitteeAssistant || false,
    phone: data?.phone || '',
    email: data?.email || '',
    jwpubEmail: data?.jwpubEmail || '',
    address: data?.address || '',
    
    // Evaluation parts
    grade: data?.evaluation?.grade || null,
    comments: data?.evaluation?.comments || '',
    recommendation: data?.evaluation?.recommendation || 'Keep in current assignment'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Volunteer's full name is required";
    if (!formData.dob) newErrors.dob = "Date of birth is required";
    if (!formData.congregation.trim()) newErrors.congregation = "Congregation name is required";
    if (!formData.assignmentHeld.trim()) newErrors.assignmentHeld = "Assigned department is required";
    
    if (type === 'evaluate') {
      if (!formData.grade) newErrors.grade = "An evaluation letter grade must be assigned";
      if (!formData.comments.trim()) newErrors.comments = "Detailed feedback or notes are required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <form 
        onSubmit={handleSubmit}
        className={`w-full max-w-2xl rounded-2xl border max-h-[90vh] flex flex-col ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        
        {/* Modal Header */}
        <div className="p-6 border-b dark:border-slate-800 border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-lg">
            {type === 'add' && "Create Master Volunteer Profile"}
            {type === 'edit' && `Edit Profile: ${data?.name}`}
            {type === 'evaluate' && `Performance Evaluation: ${data?.name}`}
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg border ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body Scroll Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* SECTION 1: PROFILE INFORMATION */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Section 1: Profile & Assignments</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                <input 
                  type="text"
                  disabled={type === 'evaluate'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Jonathan Mercer"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
                {errors.name && <p className="text-[10px] text-red-400 font-semibold mt-1">{errors.name}</p>}
              </div>

              {/* DOB Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Date of Birth</label>
                <input 
                  type="date"
                  disabled={type === 'evaluate'}
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
                {errors.dob && <p className="text-[10px] text-red-400 font-semibold mt-1">{errors.dob}</p>}
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Phone Number</label>
                <input 
                  type="text"
                  disabled={type === 'evaluate'}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 407-555-0143"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Personal Email Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Personal Email</label>
                <input 
                  type="email"
                  disabled={type === 'evaluate'}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. j.mercer@gmail.com"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* JWPub Email Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">JWPub Email (@jwpub.org)</label>
                <input 
                  type="text"
                  disabled={type === 'evaluate'}
                  value={formData.jwpubEmail}
                  onChange={(e) => setFormData({ ...formData, jwpubEmail: e.target.value })}
                  placeholder="e.g. jonathan.mercer@jwpub.org"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Privilege Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Privilege Type</label>
                <select 
                  disabled={type === 'evaluate'}
                  value={formData.privilege}
                  onChange={(e) => setFormData({ ...formData, privilege: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <option value="Elder">Elder</option>
                  <option value="Ministerial Servant">Ministerial Servant</option>
                  <option value="Pioneer">Pioneer</option>
                  <option value="Publisher">Publisher</option>
                </select>
              </div>

              {/* Congregation Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Congregation</label>
                <input 
                  type="text"
                  disabled={type === 'evaluate'}
                  value={formData.congregation}
                  onChange={(e) => setFormData({ ...formData, congregation: e.target.value })}
                  placeholder="Oakwood Pines"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
                {errors.congregation && <p className="text-[10px] text-red-400 font-semibold mt-1">{errors.congregation}</p>}
              </div>

              {/* Circuit Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Circuit</label>
                <input 
                  type="text"
                  disabled={type === 'evaluate'}
                  value={formData.circuit}
                  onChange={(e) => setFormData({ ...formData, circuit: e.target.value })}
                  placeholder="e.g. FL-10-A or 12-B"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Assignment Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Department / Assignment</label>
                <input 
                  type="text"
                  disabled={type === 'evaluate'}
                  value={formData.assignmentHeld}
                  placeholder="e.g. Attendants, Cleaning, Food Service"
                  onChange={(e) => setFormData({ ...formData, assignmentHeld: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
                {errors.assignmentHeld && <p className="text-[10px] text-red-400 font-semibold mt-1">{errors.assignmentHeld}</p>}
              </div>

              {/* Last Worked Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Last Worked Convention Date</label>
                <input 
                  type="date"
                  disabled={type === 'evaluate'}
                  value={formData.lastConventionDate}
                  onChange={(e) => setFormData({ ...formData, lastConventionDate: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Address Field */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Physical Address</label>
                <input 
                  type="text"
                  disabled={type === 'evaluate'}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 1428 Whispering Pines Dr, Orlando, FL 32801"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
            </div>

            {/* Committee Assistant Switch */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  disabled={type === 'evaluate'}
                  checked={formData.recommendedForCommitteeAssistant}
                  onChange={(e) => setFormData({ ...formData, recommendedForCommitteeAssistant: e.target.checked })}
                  className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-800 rounded transition-all"
                />
                <div>
                  <span className="text-sm font-bold block">Recommended for Committee Assistant?</span>
                  <span className="text-[11px] text-slate-400">Toggle if this volunteer has stellar leadership qualities appropriate for committee helpers.</span>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION 2: EVALUATION AND GRADING CARDS */}
          {type === 'evaluate' && (
            <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-5 animate-slideUp`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-pink-500">Section 2: Convention Evaluation Results</h4>
              
              {/* Large Grade selection buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Performance Letter Grade</label>
                <div className="grid grid-cols-4 gap-3">
                  {['A', 'B', 'C', 'D'].map(gradeOpt => {
                    const isActive = formData.grade === gradeOpt;
                    return (
                      <button
                        key={gradeOpt}
                        type="button"
                        onClick={() => setFormData({ ...formData, grade: gradeOpt })}
                        className={`py-4 rounded-xl border font-bold text-lg flex flex-col items-center justify-center transition-all ${
                          isActive 
                          ? (gradeOpt === 'A' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10 scale-105' :
                             gradeOpt === 'B' ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10 scale-105' :
                             gradeOpt === 'C' ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10 scale-105' :
                             'bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10 scale-105')
                          : (theme === 'dark' ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100')
                        }`}
                      >
                        <span className="text-2xl">{gradeOpt}</span>
                        <span className="text-[10px] font-semibold mt-1">
                          {gradeOpt === 'A' && "Exemplary"}
                          {gradeOpt === 'B' && "Proficient"}
                          {gradeOpt === 'C' && "Developing"}
                          {gradeOpt === 'D' && "Needs Assist"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.grade && <p className="text-[10px] text-red-400 font-semibold mt-1">{errors.grade}</p>}
              </div>

              {/* Recommendation dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Final Recommendation status</label>
                <select 
                  value={formData.recommendation || 'Keep in current assignment'}
                  onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <option value="Recommend for advancement">Recommend for advancement / Promotion</option>
                  <option value="Keep in current assignment">Maintain Current assignment</option>
                  <option value="Do not recommend">Do not recommend for Department</option>
                </select>
              </div>

              {/* Comment text area */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Evaluation & Feedback Comments</label>
                <textarea 
                  rows={4}
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="Document concrete observations: punctuality, dynamic teamwork, demeanor with convention guests, or area improvements..."
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200'
                  }`}
                ></textarea>
                {errors.comments && <p className="text-[10px] text-red-400 font-semibold mt-1">{errors.comments}</p>}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-6 border-t dark:border-slate-800 border-slate-200 flex justify-end gap-2.5">
          <button 
            type="button"
            onClick={onClose}
            className="text-xs font-bold px-4.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="text-xs font-bold px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
          >
            Save Record Changes
          </button>
        </div>

      </form>
    </div>
  );
}