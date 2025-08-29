
-- LGS Tracker – PostgreSQL schema (v0.1.0)
-- Timezone: Europe/Istanbul (store UTC with timestamptz; convert on read)

CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ENUMs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('active', 'disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status') THEN
    CREATE TYPE student_status AS ENUM ('active', 'inactive', 'graduated');
  END IF;
END $$;

-- Tables

CREATE TABLE IF NOT EXISTS teacher (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  status user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_section (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade INT NOT NULL CHECK (grade BETWEEN 5 AND 8),
  label TEXT NOT NULL, -- e.g., "8/A"
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (grade, label)
);

CREATE TABLE IF NOT EXISTS student (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  grade INT NOT NULL CHECK (grade BETWEEN 5 AND 8),
  class_section TEXT NOT NULL, -- redundant for simplicity; also link via class_section table when needed
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  status student_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_grade ON student (grade);
CREATE INDEX IF NOT EXISTS idx_student_class ON student (class_section);
CREATE INDEX IF NOT EXISTS idx_student_name_trgm ON student USING gin (full_name gin_trgm_ops);

-- Teacher scope (least privilege)
CREATE TABLE IF NOT EXISTS teacher_scope (
  teacher_id UUID NOT NULL REFERENCES teacher(id) ON DELETE CASCADE,
  grade INT NOT NULL CHECK (grade BETWEEN 5 AND 8),
  class_section TEXT, -- nullable = all classes in grade
  PRIMARY KEY (teacher_id, grade, class_section)
);

-- System config (KV)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Subjects configuration per grade
CREATE TABLE IF NOT EXISTS subjects_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g., "default-2025"
  description TEXT,
  penalty_factor NUMERIC(6,4) NOT NULL DEFAULT 0.3333,
  per_grade JSONB NOT NULL, -- { "5": { "TR": { "label": "Türkçe", "max": 20 }, ... }, "8": { ... } }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trial exams
CREATE TABLE IF NOT EXISTS trial_exam (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  source TEXT,
  date DATE NOT NULL,
  grade_scope INT[] NOT NULL, -- e.g., {8} or {7,8}
  subjects_config_id UUID NOT NULL REFERENCES subjects_config(id),
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trial results (header)
CREATE TABLE IF NOT EXISTS trial_result (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  trial_exam_id UUID NOT NULL REFERENCES trial_exam(id) ON DELETE CASCADE,
  correct_total INT NOT NULL DEFAULT 0,
  wrong_total INT NOT NULL DEFAULT 0,
  blank_total INT NOT NULL DEFAULT 0,
  net_total NUMERIC(6,3) NOT NULL DEFAULT 0,
  entered_by UUID NOT NULL REFERENCES teacher(id),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, trial_exam_id)
);

-- Trial result per subject (normalized)
CREATE TABLE IF NOT EXISTS trial_result_subject (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trial_result_id UUID NOT NULL REFERENCES trial_result(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL, -- e.g., TR, MAT, FEN, INK, DIN, ING
  correct INT NOT NULL DEFAULT 0,
  wrong INT NOT NULL DEFAULT 0,
  blank INT NOT NULL DEFAULT 0,
  net NUMERIC(6,3) NOT NULL DEFAULT 0,
  UNIQUE (trial_result_id, subject_code)
);

CREATE INDEX IF NOT EXISTS idx_trial_result_student ON trial_result (student_id);
CREATE INDEX IF NOT EXISTS idx_trial_result_exam ON trial_result (trial_exam_id);

-- Workbooks
CREATE TABLE IF NOT EXISTS workbook (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  grade INT NOT NULL CHECK (grade BETWEEN 5 AND 8),
  publisher TEXT,
  total_units INT,
  total_pages INT
);

-- Student workbook assignments
CREATE TABLE IF NOT EXISTS student_workbook (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  workbook_id UUID NOT NULL REFERENCES workbook(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES teacher(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'assigned',
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  progress_breakdown JSONB
);

-- Notes
CREATE TABLE IF NOT EXISTS note (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES teacher(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log (ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);

-- Sessions (server-side)
CREATE TABLE IF NOT EXISTS session (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_user ON session (user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires ON session (expires_at);

-- Seed subjects config
INSERT INTO subjects_config (id, name, description, penalty_factor, per_grade)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default-2025',
  'Default per-grade subject list with max counts and aliases',
  0.3333,
  '{
    "aliases": {
      "TR": {"tr": "Türkçe", "en": "Turkish"},
      "MAT": {"tr": "Matematik", "en": "Mathematics"},
      "FEN": {"tr": "Fen Bilimleri", "en": "Science"},
      "INK": {"tr": "T.C. İnkılap Tarihi ve Atatürkçülük", "en": "Revolution History & Kemalism"},
      "DIN": {"tr": "Din Kültürü ve Ahlak Bilgisi", "en": "Religious Culture & Ethics"},
      "ING": {"tr": "İngilizce", "en": "English"}
    },
    "5": {"TR":{"max":20},"MAT":{"max":20},"FEN":{"max":20},"INK":{"max":10},"DIN":{"max":10},"ING":{"max":10}},
    "6": {"TR":{"max":20},"MAT":{"max":20},"FEN":{"max":20},"INK":{"max":10},"DIN":{"max":10},"ING":{"max":10}},
    "7": {"TR":{"max":20},"MAT":{"max":20},"FEN":{"max":20},"INK":{"max":10},"DIN":{"max":10},"ING":{"max":10}},
    "8": {"TR":{"max":20},"MAT":{"max":20},"FEN":{"max":20},"INK":{"max":10},"DIN":{"max":10},"ING":{"max":10}}
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- Seed teachers
INSERT INTO teacher (id, full_name, email, username, password_hash, must_change_password, status)
VALUES
('11111111-1111-1111-1111-111111111111', 'Rooter Admin', 'rooter@example.edu.tr', 'rooter', '$argon2id$v=19$m=65536,t=3,p=2$YXNkZmFzZGZhc2RmYXNkZg$Dk0Hj0Q7gZf9Vbqz9N8n7kH8lQe3H5uQ8F2oY3lN7nQ', FALSE, 'active'),
('22222222-2222-2222-2222-222222222222', 'Ayşe Öğretmen', 'teacher1@example.edu.tr', 'teacher1', '$argon2id$v=19$m=65536,t=3,p=2$YXNkZmFzZGZhc2RmYXNkZg$Dk0Hj0Q7gZf9Vbqz9N8n7kH8lQe3H5uQ8F2oY3lN7nQ', TRUE, 'active')
ON CONFLICT DO NOTHING;

-- Seed class sections
INSERT INTO class_section (id, grade, label, active) VALUES
('33333333-3333-3333-3333-333333333331', 8, '8/A', TRUE),
('33333333-3333-3333-3333-333333333332', 8, '8/B', TRUE),
('33333333-3333-3333-3333-333333333333', 7, '7/A', TRUE),
('33333333-3333-3333-3333-333333333334', 6, '6/A', TRUE),
('33333333-3333-3333-3333-333333333335', 5, '5/A', TRUE)
ON CONFLICT DO NOTHING;

-- Seed students
INSERT INTO student (id, full_name, grade, class_section, guardian_name, guardian_phone, guardian_email, status)
VALUES
('44444444-4444-4444-4444-444444444441', 'Mehmet Yılmaz', 8, '8/A', 'Ali Yılmaz', '05001234567', 'ali.yilmaz@example.com', 'active'),
('44444444-4444-4444-4444-444444444442', 'Elif Demir', 8, '8/B', 'Ayşe Demir', '05007654321', 'ayse.demir@example.com', 'active'),
('44444444-4444-4444-4444-444444444443', 'Ahmet Kaya', 7, '7/A', 'Fatma Kaya', '05001112233', 'fatma.kaya@example.com', 'active'),
('44444444-4444-4444-4444-444444444444', 'Zeynep Çelik', 6, '6/A', 'Hasan Çelik', '05003334455', 'hasan.celik@example.com', 'active'),
('44444444-4444-4444-4444-444444444445', 'Ayşe Koç', 5, '5/A', 'Emine Koç', '05005556677', 'emine.koc@example.com', 'active')
ON CONFLICT DO NOTHING;

-- Teacher scope
INSERT INTO teacher_scope (teacher_id, grade, class_section) VALUES
('22222222-2222-2222-2222-222222222222', 8, NULL),
('22222222-2222-2222-2222-222222222222', 7, '7/A');

-- Seed workbooks
INSERT INTO workbook (id, title, subject_code, grade, publisher, total_units, total_pages) VALUES
('55555555-5555-5555-5555-555555555551', 'Türkçe Soru Bankası 8', 'TR', 8, 'Yayınevi A', 12, 240),
('55555555-5555-5555-5555-555555555552', 'Matematik Denemeleri 8', 'MAT', 8, 'Yayınevi B', 10, 200),
('55555555-5555-5555-5555-555555555553', 'Fen Bilimleri Etkinlikleri 7', 'FEN', 7, 'Yayınevi C', 8, 160);

-- Seed trial exams
INSERT INTO trial_exam (id, name, source, date, grade_scope, subjects_config_id, is_finalized) VALUES
('66666666-6666-6666-6666-666666666661', 'Okul Deneme - Mart', 'Okul', '2025-03-15', ARRAY[8], '00000000-0000-0000-0000-000000000001', TRUE),
('66666666-6666-6666-6666-666666666662', 'Okul Deneme - Nisan', 'Okul', '2025-04-10', ARRAY[7,8], '00000000-0000-0000-0000-000000000001', FALSE);

-- Seed trial results (for Mehmet Yılmaz, 8/A, Mart exam)
INSERT INTO trial_result (id, student_id, trial_exam_id, correct_total, wrong_total, blank_total, net_total, entered_by, entered_at)
VALUES ('77777777-7777-7777-7777-777777777771', '44444444-4444-4444-4444-444444444441', '66666666-6666-6666-6666-666666666661', 85, 15, 0, 80.000, '22222222-2222-2222-2222-222222222222', now());

INSERT INTO trial_result_subject (trial_result_id, subject_code, correct, wrong, blank, net) VALUES
('77777777-7777-7777-7777-777777777771','TR',18,2,0,17.333),
('77777777-7777-7777-7777-777777777771','MAT',17,3,0,16.000),
('77777777-7777-7777-7777-777777777771','FEN',17,3,0,16.000),
('77777777-7777-7777-7777-777777777771','INK',8,2,0,7.333),
('77777777-7777-7777-7777-777777777771','DIN',12,0,0,12.000),
('77777777-7777-7777-7777-777777777771','ING',13,5,0,11.333);

-- Seed student workbook assignment
INSERT INTO student_workbook (id, student_id, workbook_id, assigned_by, assigned_at, target_date, status, progress_percent, progress_breakdown)
VALUES ('88888888-8888-8888-8888-888888888881', '44444444-4444-4444-4444-444444444441', '55555555-5555-5555-5555-555555555552',
        '22222222-2222-2222-2222-222222222222', now(), '2025-05-15', 'in_progress', 40,
        '{{"unit1": 100, "unit2": 50, "unit3": 0}}');

-- Audit sample
INSERT INTO audit_log (id, actor_id, actor_role, action, entity_type, entity_id, before, after)
VALUES ('99999999-9999-9999-9999-999999999991', '22222222-2222-2222-2222-222222222222', 'teacher', 'create', 'trial_result', '77777777-7777-7777-7777-777777777771', NULL,
        '{{"net_total": 80.0}}');
