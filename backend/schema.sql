CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(160) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL, role VARCHAR(30) NOT NULL CHECK(role IN ('admin','teacher','parent','student','accountant')),
 active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS classes (
 id SERIAL PRIMARY KEY, level VARCHAR(30) NOT NULL, section VARCHAR(20) NOT NULL,
 capacity INTEGER NOT NULL DEFAULT 30, school_year VARCHAR(20) NOT NULL,
 teacher_id INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS students (
 id SERIAL PRIMARY KEY, first_name VARCHAR(80) NOT NULL, last_name VARCHAR(80) NOT NULL,
 birth_date DATE, gender VARCHAR(20), address TEXT, parent_id INTEGER REFERENCES users(id),
 class_id INTEGER REFERENCES classes(id), entry_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
 medical_notes TEXT, created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS subjects (
 id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, coefficient NUMERIC(5,2) NOT NULL DEFAULT 1,
 level VARCHAR(30), school_year VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
 id SERIAL PRIMARY KEY, name VARCHAR(80) NOT NULL, capacity INTEGER NOT NULL DEFAULT 30,
 available BOOLEAN DEFAULT TRUE, school_year VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS teacher_assignments (
 id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES users(id),
 subject_id INTEGER NOT NULL REFERENCES subjects(id), class_id INTEGER NOT NULL REFERENCES classes(id),
 school_year VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS timetable (
 id SERIAL PRIMARY KEY, class_id INTEGER REFERENCES classes(id), teacher_id INTEGER REFERENCES users(id),
 subject_id INTEGER REFERENCES subjects(id), room_id INTEGER REFERENCES rooms(id),
 weekday VARCHAR(15) NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
 school_year VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS grades (
 id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES students(id), subject_id INTEGER REFERENCES subjects(id),
 assessment VARCHAR(120) NOT NULL, score NUMERIC(5,2) NOT NULL CHECK(score BETWEEN 0 AND 20),
 assessment_date DATE DEFAULT CURRENT_DATE, school_year VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
 id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES students(id), amount NUMERIC(10,2) NOT NULL,
 payment_date DATE DEFAULT CURRENT_DATE, method VARCHAR(30) NOT NULL, description TEXT,
 school_year VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS homework (
 id SERIAL PRIMARY KEY, title VARCHAR(160) NOT NULL, description TEXT, subject_id INTEGER REFERENCES subjects(id),
 class_id INTEGER REFERENCES classes(id), due_date DATE NOT NULL, correction TEXT,
 school_year VARCHAR(20) NOT NULL, created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS messages (
 id SERIAL PRIMARY KEY, sender_id INTEGER REFERENCES users(id), recipient_id INTEGER REFERENCES users(id),
 subject VARCHAR(160) NOT NULL, body TEXT NOT NULL, sent_at TIMESTAMP DEFAULT NOW(), is_read BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), entity VARCHAR(60), entity_id INTEGER,
 action VARCHAR(30), old_values JSONB, new_values JSONB, created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
