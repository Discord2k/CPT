-- =====================================================================
-- DATABASE SCHEMA: Convention Personnel Tool (CPT)
-- Target RDBMS: PostgreSQL (Supabase Compatible)
-- Description: Supports isolated, multi-tenant convention volunteer evaluations.
-- =====================================================================

-- Drop tables if they exist to allow clean rebuilds
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS volunteers CASCADE;
DROP TABLE IF EXISTS conventions CASCADE;

-- 1. CONVENTIONS TABLE
CREATE TABLE conventions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    -- Store hashed passwords (e.g. bcrypt/scrypt) in production, never plain text
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. VOLUNTEERS TABLE
CREATE TABLE volunteers (
    id VARCHAR(50) PRIMARY KEY,
    convention_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    dob DATE NOT NULL,
    privilege VARCHAR(50) NOT NULL CONSTRAINT chk_privilege CHECK (
        privilege IN ('Elder', 'Ministerial Servant', 'Pioneer', 'Publisher')
    ),
    congregation VARCHAR(150) NOT NULL,
    last_convention_date DATE,
    assignment_held VARCHAR(100) NOT NULL,
    recommended_for_committee_assistant BOOLEAN DEFAULT FALSE,
    phone VARCHAR(30),
    email VARCHAR(100),
    jwpub_email VARCHAR(100) UNIQUE, -- Added UNIQUE for Supabase onConflict upsert mapping
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint linking to conventions (ensures multi-tenant integrity)
    CONSTRAINT fk_volunteer_convention 
        FOREIGN KEY (convention_id) 
        REFERENCES conventions(id) 
        ON DELETE CASCADE
);

-- 3. EVALUATIONS TABLE
CREATE TABLE evaluations (
    volunteer_id VARCHAR(50) PRIMARY KEY,
    grade CHAR(1) CONSTRAINT chk_grade CHECK (
        grade IN ('A', 'B', 'C', 'D')
    ),
    comments TEXT NOT NULL,
    recommendation VARCHAR(150) CONSTRAINT chk_recommendation CHECK (
        -- Updated to allow "Needs adjustment / training" matching the frontend options
        recommendation IN (
            'Recommend for advancement', 
            'Keep in current assignment', 
            'Needs adjustment / training', 
            'Do not recommend'
        )
    ),
    evaluated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint linking to volunteers
    CONSTRAINT fk_evaluation_volunteer 
        FOREIGN KEY (volunteer_id) 
        REFERENCES volunteers(id) 
        ON DELETE CASCADE
);

-- =====================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- =====================================================================

-- Quick lookups for convention-specific logins
CREATE INDEX idx_conventions_username ON conventions(username);

-- High-speed filtering by congregation, privilege, and age-calculations
CREATE INDEX idx_volunteers_search_params ON volunteers(convention_id, congregation, privilege);
CREATE INDEX idx_volunteers_dob ON volunteers(dob);

-- Speed up search on assignments and last convention worked
CREATE INDEX idx_volunteers_assignment ON volunteers(assignment_held);
CREATE INDEX idx_volunteers_last_date ON volunteers(last_convention_date);

-- Speed up searching contacts
CREATE INDEX idx_volunteers_phone ON volunteers(phone);
CREATE INDEX idx_volunteers_emails ON volunteers(email, jwpub_email);

-- Fast tracking for approved committee candidates
CREATE INDEX idx_volunteers_committee_rec ON volunteers(recommended_for_committee_assistant) 
    WHERE recommended_for_committee_assistant = TRUE;

-- High-speed tracking of grades
CREATE INDEX idx_evaluations_grade ON evaluations(grade);

-- =====================================================================
-- SEED DATA (Aligns with application seeds)
-- =====================================================================

-- Seed Conventions
INSERT INTO conventions (id, name, username, password_hash) VALUES
('conv-orlando-2026', 'Orlando Regional 2026', 'orlando2026', 'password123'),
('conv-miami-2026', 'Miami Regional 2026', 'miami2026', 'password123');

-- Seed Volunteers for Orlando 2026
INSERT INTO volunteers (id, convention_id, name, dob, privilege, congregation, last_convention_date, assignment_held, recommended_for_committee_assistant, phone, email, jwpub_email, address) VALUES
('v-1', 'conv-orlando-2026', 'Jonathan Mercer', '1985-04-12', 'Elder', 'Oakwood Pines', '2025-08-15', 'Attendants', TRUE, '407-555-0143', 'j.mercer@gmail.com', 'jonathan.mercer@jwpub.org', '1428 Whispering Pines Dr, Orlando, FL 32801'),
('v-2', 'conv-orlando-2026', 'Sarah Jenkins', '1997-11-22', 'Pioneer', 'Valley View', '2025-08-15', 'First Aid', FALSE, '407-555-0189', 'sarah.j.97@yahoo.com', 's.jenkins@jwpub.org', '892 Meadowbrook Ln, Apopka, FL 32703'),
('v-3', 'conv-orlando-2026', 'Marcus Brody', '1990-07-03', 'Ministerial Servant', 'Metro Heights', '2024-06-20', 'Food Service', TRUE, '321-555-0112', 'marcus.brody@outlook.com', 'm.brody@jwpub.org', '405 Urban Plaza, Apt 3B, Orlando, FL 32804');

-- Seed Evaluations for Orlando 2026
INSERT INTO evaluations (volunteer_id, grade, comments, recommendation, evaluated_at) VALUES
('v-1', 'A', 'Outstanding coordination skills during the afternoon rush. Exceptionally reliable and highly recommended for broader committee work.', 'Recommend for advancement', '2025-08-15 17:30:00+00'),
('v-2', 'B', 'Very caring and responsive. Handled incident documentation efficiently, though could use slightly faster triage decisions under pressure.', 'Keep in current assignment', '2025-08-16 11:00:00+00'),
('v-3', 'A', 'Excellent inventory control. Always arrives early and stays late to clean. Very humble and hardworking attitude.', 'Recommend for advancement', '2024-06-20 19:15:00+00');
