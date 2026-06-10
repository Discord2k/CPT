export interface Congregation {
  id: string;
  name: string;
  number: string;
  assigned_convention_id: string; // convention session it belongs to for the year
}

export interface Volunteer {
  id: string;
  name: string;
  age: number;
  jwpub_email: string;
  home_congregation_id: string;
  is_committee_assistant: boolean;
  
  // New VolunGrader Fields
  dob?: string;
  privilege?: string;
  last_convention_date?: string;
  assignment_held?: string;
  phone?: string;
  email?: string;
  address?: string;
  recommended_for_committee_assistant?: boolean;
}

export interface Evaluation {
  id: string;
  volunteer_id: string;
  user_id: string; // evaluator's identifier/email
  rating: RatingType;
  year: number;
  convention_identifier: string; // e.g. "CO-01" or "Region 3"
  location: string;
  department: string;
  assignment: string;
  comments: string;

  // New VolunGrader Fields
  grade?: string;
  recommendation?: string;
  evaluated_at?: string;
}

export type RatingType = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-';

export const RATING_SORT_ORDER: Record<RatingType, number> = {
  'A+': 0,
  'A': 1,
  'A-': 2,
  'B+': 3,
  'B': 4,
  'B-': 5,
  'C+': 6,
  'C': 7,
  'C-': 8,
};

export interface ConventionSession {
  year: number;
  identifier: string;
  location: string;
  date: string;
}

export interface SystemUser {
  id: string;
  email: string;
}
