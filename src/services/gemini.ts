import { GoogleGenerativeAI } from '@google/generative-ai';
import { HARDCODED_GEMINI_API_KEY } from '../config';

export type ExtractedVolunteer = {
  name: string;
  dob: string;
  age: number;
  privilege: string;
  congregationName: string;
  congregationNumber: string;
  lastConventionDate: string;
  assignmentHeld: string;
  recommendedForCommitteeAssistant: boolean;
  phone: string;
  email: string;
  jwpubEmail: string;
  address: string;
  evaluation: {
    grade: string | null;
    comments: string;
    recommendation: string | null;
    evaluatedAt: string | null;
  };
}

export const extractVolunteersFromDoc = async (
  file: File,
  fileBase64: string, // Needed for PDF upload
  excelText?: string   // If Excel, the converted CSV/text representation
): Promise<ExtractedVolunteer[]> => {
  const geminiKey = HARDCODED_GEMINI_API_KEY || 
                    import.meta.env.VITE_GEMINI_API_KEY || 
                    localStorage.getItem('ATLAS_GEMINI_KEY');

  if (!geminiKey) {
    // Return mock parsed results so the interface is 100% testable
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getMockExtractedData(file.name));
      }, 1500);
    });
  }

  try {
    const ai = new GoogleGenerativeAI(geminiKey);
    // Use gemini-2.5-flash as requested
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = `
      You are an expert parsing assistant. Analyze the provided list, image, spreadsheet, document, or text describing convention volunteers.
      Extract the details into a valid JSON array of objects. Map and find fields strictly matching:
      - name (String)
      - dob (String in YYYY-MM-DD format. If completely unknown, guess an estimated date like "1995-01-01" or calculate from guessed ages)
      - privilege (String, must strictly map to one of: "Elder", "Ministerial Servant", "Pioneer", "Publisher". Map "MS", "Servant" to "Ministerial Servant")
      - congregationName (String, the name of their congregation)
      - congregationNumber (String, the congregation ID/number if specified, otherwise empty string)
      - lastConventionDate (String in YYYY-MM-DD format, fallback to current year or 2025/2026 if unspecified)
      - assignmentHeld (String, e.g. "Attendants", "First Aid", "Food Service", "Cleaning & Maintenance", "Media & Audio Visual")
      - recommendedForCommitteeAssistant (Boolean, look for notes implying recommendation, outstanding attitude, potential, or leadership capability)
      - phone (String, format neatly if found, e.g., "123-456-7890")
      - email (String, standard personal email address if found)
      - jwpubEmail (String, search explicitly for emails ending with "@jwpub.org", otherwise leave blank)
      - address (String, full physical address if found, e.g. street, city, state, zip)
      - evaluation (Object) containing:
        - grade (String, must strictly map to one of: "A", "B", "C", "D". If they have a rating like A+, A-, map to A, etc.)
        - comments (String, description or comments about the volunteer)
        - recommendation (String, e.g., "Recommend for advancement", "Keep in current assignment", "Needs adjustment")
        - evaluatedAt (String in ISO format if dates are specified, otherwise leave null)

      If any Spanish terms are present, translate them to English (e.g. "Acomodador" -> "Attendants", "Anciano" -> "Elder", "Siervo Ministerial" -> "Ministerial Servant", "Precursor" -> "Pioneer", "Publicador" -> "Publisher").
      Only output a raw JSON array of objects. Do not wrap the JSON output inside Markdown brackets or add prefix/suffix comments. Use valid double-quoted JSON formats.
    `;

    let response;

    if (excelText) {
      prompt += `\nHere is the text extracted from the spreadsheet/document:\n${excelText}`;
      response = await model.generateContent([prompt]);
    } else {
      response = await model.generateContent([
        {
          inlineData: {
            data: fileBase64.split(',')[1] || fileBase64,
            mimeType: file.type || 'application/pdf'
          }
        },
        prompt
      ]);
    }

    const responseText = response.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return normalizeExtractedVolunteers(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (error) {
    console.error('Gemini API extraction failed:', error);
    throw new Error('Gemini API extraction failed. Please check your API key or document format.');
  }
};

const normalizeExtractedVolunteers = (rawList: any[]): ExtractedVolunteer[] => {
  return rawList.map(item => {
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        if (item[k] !== undefined && item[k] !== null) return item[k];
      }
      return undefined;
    };

    const name = getVal(['name', 'fullName', 'full_name', 'nombre']) || 'Unknown Volunteer';
    const dob = getVal(['dob', 'dateOfBirth', 'date_of_birth', 'birthDate', 'fecha_nacimiento']) || '1995-01-01';
    
    // Calculate age helper
    const calculateAge = (dobString: string) => {
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
    const age = Number(getVal(['age', 'edad']) || calculateAge(dob));
    
    let privilege = getVal(['privilege', 'role', 'status', 'privilegio']) || 'Publisher';
    if (privilege.toLowerCase().includes('elder') || privilege.toLowerCase().includes('anciano')) privilege = 'Elder';
    else if (privilege.toLowerCase().includes('servant') || privilege.toLowerCase().includes('siervo') || privilege.toLowerCase().includes('ms')) privilege = 'Ministerial Servant';
    else if (privilege.toLowerCase().includes('pioneer') || privilege.toLowerCase().includes('precursor')) privilege = 'Pioneer';
    else privilege = 'Publisher';

    const congregationName = getVal(['congregationName', 'congregation_name', 'congregation', 'congregacion']) || 'Unassigned';
    const congregationNumber = String(getVal(['congregationNumber', 'congregation_number', 'number', 'numero', 'cong_number']) || '');
    const lastConventionDate = getVal(['lastConventionDate', 'last_convention_date', 'lastConvention']) || new Date().toISOString().split('T')[0];
    const assignmentHeld = getVal(['assignmentHeld', 'assignment_held', 'assignment', 'department', 'departamento', 'asignacion']) || 'General Volunteer';
    const recommendedForCommitteeAssistant = !!getVal(['recommendedForCommitteeAssistant', 'recommended_for_committee_assistant', 'committeeAssistant', 'is_committee_assistant']);
    const phone = getVal(['phone', 'phoneNumber', 'phone_number', 'telefono']) || '';
    const email = getVal(['email', 'email_address', 'mail', 'correo']) || '';
    
    // Handle JWPub email fallback/regex
    let jwpubEmail = getVal(['jwpubEmail', 'jwpub_email', 'jwpub']) || '';
    if (!jwpubEmail && email.endsWith('@jwpub.org')) {
      jwpubEmail = email;
    } else if (!jwpubEmail && name) {
      // Create a plausible fallback
      jwpubEmail = `${name.toLowerCase().replace(/\s+/g, '.')}@jwpub.org`;
    }

    const address = getVal(['address', 'physicalAddress', 'direccion']) || '';

    // Normalize nested evaluation
    const rawEval = item.evaluation || {};
    const getEvalVal = (keys: string[]) => {
      for (const k of keys) {
        if (rawEval[k] !== undefined && rawEval[k] !== null) return rawEval[k];
      }
      return undefined;
    };

    let grade = getEvalVal(['grade', 'rating', 'calificacion']) || getVal(['rating', 'grade', 'rating']) || null;
    if (grade) {
      const gStr = String(grade).toUpperCase().trim();
      if (gStr.startsWith('A')) grade = 'A';
      else if (gStr.startsWith('B')) grade = 'B';
      else if (gStr.startsWith('C')) grade = 'C';
      else if (gStr.startsWith('D')) grade = 'D';
      else grade = 'B';
    }

    const comments = getEvalVal(['comments', 'comment', 'notes', 'comentarios']) || getVal(['comments', 'comment']) || '';
    const recommendation = getEvalVal(['recommendation', 'recommend', 'recomendacion']) || getVal(['recommendation']) || null;
    const evaluatedAt = getEvalVal(['evaluatedAt', 'evaluated_at', 'fecha_evaluacion']) || null;

    return {
      name,
      dob,
      age,
      privilege,
      congregationName,
      congregationNumber,
      lastConventionDate,
      assignmentHeld,
      recommendedForCommitteeAssistant,
      phone,
      email,
      jwpubEmail,
      address,
      evaluation: {
        grade,
        comments,
        recommendation,
        evaluatedAt
      }
    };
  });
};

// Realistic mock data matching the new specifications
const getMockExtractedData = (fileName: string): ExtractedVolunteer[] => {
  const lowercaseName = fileName.toLowerCase();
  
  if (lowercaseName.includes('elder') || lowercaseName.includes('letter')) {
    return [
      {
        name: "Caleb Sterling",
        dob: "1997-05-14",
        age: 29,
        privilege: "Pioneer",
        congregationName: "Oak Ridge",
        congregationNumber: "10552",
        lastConventionDate: "2025-08-15",
        assignmentHeld: "Media & Audio Visual",
        recommendedForCommitteeAssistant: true,
        phone: "407-555-0912",
        email: "c.sterling@gmail.com",
        jwpubEmail: "c.sterling@jwpub.org",
        address: "512 Pinecrest Way, Orlando, FL 32801",
        evaluation: {
          grade: "A",
          comments: "Recommended as an assistant. Caleb serves as a regular pioneer and has been an asset in the audio/video department.",
          recommendation: "Recommend for advancement",
          evaluatedAt: "2025-08-15T16:45:00.000Z"
        }
      },
      {
        name: "Benjamin Albright",
        dob: "1981-11-22",
        age: 44,
        privilege: "Ministerial Servant",
        congregationName: "Oak Ridge",
        congregationNumber: "10552",
        lastConventionDate: "2025-08-15",
        assignmentHeld: "Attendants",
        recommendedForCommitteeAssistant: false,
        phone: "321-555-0844",
        email: "b.albright@yahoo.com",
        jwpubEmail: "b.albright@jwpub.org",
        address: "892 Meadowbrook Ln, Apopka, FL 32703",
        evaluation: {
          grade: "B",
          comments: "Capable and willingMS. Experienced in accounts and hall setup.",
          recommendation: "Keep in current assignment",
          evaluatedAt: "2025-08-15T18:00:00.000Z"
        }
      }
    ];
  }

  return [
    {
      name: "Fernando Menendez",
      dob: "1964-03-10",
      age: 62,
      privilege: "Elder",
      congregationName: "Dean Road Spanish",
      congregationNumber: "25000",
      lastConventionDate: "2025-08-15",
      assignmentHeld: "Attendants",
      recommendedForCommitteeAssistant: true,
      phone: "407-555-9988",
      email: "fernando.m@outlook.com",
      jwpubEmail: "fernando.menendez@jwpub.org",
      address: "123 Spanish Moss Ln, Orlando, FL 32825",
      evaluation: {
        grade: "A",
        comments: "Older brother, but in good health. Very hard worker, outstanding coordinator.",
        recommendation: "Recommend for advancement",
        evaluatedAt: "2025-08-15T12:00:00.000Z"
      }
    },
    {
      name: "Elena Rostova",
      dob: "2003-01-30",
      age: 23,
      privilege: "Publisher",
      congregationName: "Oakwood Pines",
      congregationNumber: "12304",
      lastConventionDate: "2025-08-15",
      assignmentHeld: "Cleaning & Maintenance",
      recommendedForCommitteeAssistant: false,
      phone: "407-555-0174",
      email: "elena.rostova@icloud.com",
      jwpubEmail: "elena.rostova@jwpub.org",
      address: "1428 Whispering Pines Dr, Orlando, FL 32801",
      evaluation: {
        grade: null,
        comments: "",
        recommendation: null,
        evaluatedAt: null
      }
    }
  ];
};

export type ExtractedCongregation = {
  name: string;
  number: string;
}

export const extractCongregationsFromDoc = async (
  _file: File,
  fileBase64: string,
  excelText?: string
): Promise<ExtractedCongregation[]> => {
  const geminiKey = HARDCODED_GEMINI_API_KEY || 
                    import.meta.env.VITE_GEMINI_API_KEY || 
                    localStorage.getItem('ATLAS_GEMINI_KEY');

  if (!geminiKey) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getMockCongregations());
      }, 1500);
    });
  }

  try {
    const ai = new GoogleGenerativeAI(geminiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = `
      You are an expert document data extractor. You are parsing a congregation list, registry, or directory for a regional convention.
      Extract all congregations found in this document. Return the result strictly as a valid JSON array of objects. Do not include markdown code block formatting (like \`\`\`json) or extra text. Just output raw JSON.
      Each object in the array must contain the following keys exactly:
      - "name": Full name of the congregation (string, e.g. "Ridgefield Congregation" or "Lake Helen Spanish")
      - "number": 5-digit or standard congregation number (string, e.g., "12304". If not specified or unknown, generate a random 5-digit number)
    `;

    let response;
    if (excelText) {
      prompt += `\nHere is the text extracted from the spreadsheet:\n${excelText}`;
      response = await model.generateContent([prompt]);
    } else {
      response = await model.generateContent([
        {
          inlineData: {
            data: fileBase64.split(',')[1] || fileBase64,
            mimeType: _file.type || 'application/pdf'
          }
        },
        prompt
      ]);
    }

    const responseText = response.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return normalizeExtractedCongregations(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (error) {
    console.error('Gemini API congregation extraction failed:', error);
    throw new Error('Gemini API congregation extraction failed. Please check your API key or document format.');
  }
};

const normalizeExtractedCongregations = (rawList: any[]): ExtractedCongregation[] => {
  return rawList.map(item => {
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        if (item[k] !== undefined && item[k] !== null) return item[k];
      }
      return undefined;
    };

    const name = getVal(['name', 'congregationName', 'congregation_name', 'congregacion']) || '';
    const number = String(getVal(['number', 'congregationNumber', 'congregation_number', 'numero']) || '');

    return { name, number };
  });
};

const getMockCongregations = (): ExtractedCongregation[] => {
  return [
    { name: "Ridgefield Congregation", number: "12304" },
    { name: "Sunset Park Congregation", number: "24890" },
    { name: "Bayview Congregation", number: "31045" },
    { name: "Lake Helen Spanish", number: "15000" },
    { name: "Dean Road Spanish", number: "25000" },
    { name: "Oak Ridge", number: "10552" }
  ];
};
