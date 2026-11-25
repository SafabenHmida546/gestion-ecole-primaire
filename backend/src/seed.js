
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

dotenv.config();

const run = async () => {
  try {
    const hash = await bcrypt.hash('Ecole123!', 10);

    const users = [
      ['Administrateur', 'admin@ecole.tn', 'admin'],
      ['Mme Ben Ali', 'enseignant@ecole.tn', 'teacher'],
      ['Parent Demo', 'parent@ecole.tn', 'parent'],
      ['Comptable', 'comptable@ecole.tn', 'accountant'],
      ['Eleve Demo', 'eleve@ecole.tn', 'student']
    ];

    for (const [name, email, role] of users) {
      await pool.query(
        `INSERT INTO users(name, email, password_hash, role)
         VALUES($1, $2, $3, $4)
         ON CONFLICT(email)
         DO UPDATE SET password_hash = EXCLUDED.password_hash,
                       active = true`,
        [name, email, hash, role]
      );
    }

    const teacher = (await pool.query(
      "SELECT id FROM users WHERE email = 'enseignant@ecole.tn'"
    )).rows[0].id;

    const parent = (await pool.query(
      "SELECT id FROM users WHERE email = 'parent@ecole.tn'"
    )).rows[0].id;

    await pool.query(
      `INSERT INTO classes(level, section, capacity, school_year, teacher_id)
       SELECT '3eme annee', 'A', 30, '2026-2027', $1
       WHERE NOT EXISTS (
         SELECT 1 FROM classes WHERE level = '3eme annee' AND section = 'A'
       )`,
      [teacher]
    );

    const cl = (await pool.query(
      "SELECT id FROM classes WHERE level = '3eme annee' AND section = 'A' LIMIT 1"
    )).rows[0].id;

    await pool.query(
      `INSERT INTO subjects(name, coefficient, level, school_year)
       SELECT 'Mathematiques', 2, '3eme annee', '2026-2027'
       WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Mathematiques')`
    );

    await pool.query(
      `INSERT INTO subjects(name, coefficient, level, school_year)
       SELECT 'Francais', 2, '3eme annee', '2026-2027'
       WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Francais')`
    );

    await pool.query(
      `INSERT INTO rooms(name, capacity, available, school_year)
       SELECT 'Salle 1', 30, true, '2026-2027'
       WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'Salle 1')`
    );

    await pool.query(
      `INSERT INTO students(first_name, last_name, birth_date, gender, parent_id, class_id, entry_year)
       SELECT 'Yasmine', 'Demo', '2017-04-12', 'Fille', $1, $2, '2024-2025'
       WHERE NOT EXISTS (
         SELECT 1 FROM students WHERE first_name = 'Yasmine' AND last_name = 'Demo'
       )`,
      [parent, cl]
    );

    await pool.query(
      `INSERT INTO homework(title, description, subject_id, class_id, due_date, school_year)
       SELECT 'Exercices de calcul', 'Faire les exercices 1 a 5.',
       (SELECT id FROM subjects WHERE name = 'Mathematiques' LIMIT 1),
       $1, CURRENT_DATE + 3, '2026-2027'
       WHERE NOT EXISTS (
         SELECT 1 FROM homework WHERE title = 'Exercices de calcul'
       )`,
      [cl]
    );

    console.log('Donnees de demonstration creees.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
