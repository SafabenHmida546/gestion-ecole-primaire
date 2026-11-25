import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { auth, allow } from './auth.js';
dotenv.config();
const app=express();
app.use(cors()); app.use(express.json());

app.get('/api/health',(req,res)=>res.json({status:'ok',app:'Gestion école primaire'}));

app.post('/api/schools/register',async(req,res)=>{
 const client=await pool.connect();

 try{
  const {
   school_name,
   address,
   school_email,
   phone,
   admin_name,
   admin_email,
   password
  }=req.body;

  if(!school_name || !admin_name || !admin_email || !password){
   return res.status(400).json({
    message:'Veuillez remplir les champs obligatoires'
   });
  }

  if(password.length<8){
   return res.status(400).json({
    message:'Le mot de passe doit contenir au moins 8 caractères'
   });
  }

  const email=admin_email.trim().toLowerCase();

  const existing=await pool.query(
   'SELECT id FROM users WHERE email=$1',
   [email]
  );

  if(existing.rowCount){
   return res.status(409).json({
    message:'Cet e-mail est déjà utilisé'
   });
  }

  const passwordHash=await bcrypt.hash(password,12);

  await client.query('BEGIN');

  const school=await client.query(`
   INSERT INTO schools(name,address,email,phone)
   VALUES($1,$2,$3,$4)
   RETURNING id,name
  `,[
   school_name.trim(),
   address || null,
   school_email || null,
   phone || null
  ]);

  const schoolId=school.rows[0].id;

  const admin=await client.query(`
   INSERT INTO users(name,email,password_hash,role,school_id)
   VALUES($1,$2,$3,'admin',$4)
   RETURNING id,name,email,role,school_id
  `,[
   admin_name.trim(),
   email,
   passwordHash,
   schoolId
  ]);

  await client.query('COMMIT');

  res.status(201).json({
   message:'École créée avec succès',
   school:school.rows[0],
   admin:admin.rows[0]
  });

 }catch(e){
  await client.query('ROLLBACK');

  if(e.code==='23505'){
   return res.status(409).json({
    message:'Cet e-mail existe déjà'
   });
  }

  console.error(e);
  res.status(500).json({
   message:'Erreur lors de la création de l’école'
  });

 }finally{
  client.release();
 }
});
app.post('/api/auth/login',async(req,res)=>{
 try{
  const {email,password}=req.body;
const q=await pool.query(
 `SELECT u.id,u.name,u.email,u.password_hash,u.role,u.school_id
 FROM users u
 JOIN schools s ON s.id=u.school_id
 WHERE u.email=$1
 AND u.active=true
 AND s.active=true`
 [email]
);
  if(!q.rows[0] || !(await bcrypt.compare(password,q.rows[0].password_hash))) return res.status(401).json({message:'E-mail ou mot de passe incorrect'});
  const u=q.rows[0];

const token=jwt.sign({
 id:u.id,
 name:u.name,
 email:u.email,
 role:u.role,
 school_id:u.school_id
},process.env.JWT_SECRET,{expiresIn:'8h'});

res.json({
 token,
 user:{
  id:u.id,
  name:u.name,
  email:u.email,
  role:u.role,
  school_id:u.school_id
 }
});
 }catch(e){res.status(500).json({message:'Erreur serveur'});}
});
app.get('/api/auth/me',auth,(req,res)=>res.json(req.user));


app.get('/api/dashboard',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const schoolId=req.user.school_id;

  const [students,classes,teachers,payments,homework]=await Promise.all([
   pool.query(
    'SELECT COUNT(*)::int n FROM students WHERE school_id=$1',
    [schoolId]
   ),
   pool.query(
    'SELECT COUNT(*)::int n FROM classes WHERE school_id=$1',
    [schoolId]
   ),
   pool.query(
    "SELECT COUNT(*)::int n FROM users WHERE role='teacher' AND school_id=$1",
    [schoolId]
   ),
   pool.query(
    'SELECT COALESCE(SUM(amount),0)::numeric total FROM payments WHERE school_id=$1',
    [schoolId]
   ),
   pool.query(
    'SELECT COUNT(*)::int n FROM homework WHERE school_id=$1',
    [schoolId]
   )
  ]);

  res.json({
   students:students.rows[0].n,
   classes:classes.rows[0].n,
   teachers:teachers.rows[0].n,
   payments:Number(payments.rows[0].total),
   homework:homework.rows[0].n
  });

 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});


// Table/column allow-list: values are parameterized; identifiers never come from the client.

const entities={
 students:{table:'students',roles:['admin','accountant'],fields:['first_name','last_name','birth_date','gender','address','parent_id','class_id','entry_year','medical_notes']},
 classes:{table:'classes',roles:['admin'],fields:['level','section','capacity','school_year','teacher_id']},
 subjects:{table:'subjects',roles:['admin'],fields:['name','coefficient','level','school_year']},
 rooms:{table:'rooms',roles:['admin'],fields:['name','capacity','available','school_year']},
 homework:{table:'homework',roles:['admin','teacher'],fields:['title','description','subject_id','class_id','due_date','correction','school_year']},
 payments:{table:'payments',roles:['admin','accountant'],fields:['student_id','amount','payment_date','method','description','school_year']}
};

for(const [key,cfg] of Object.entries(entities)){

 app.get(`/api/${key}`,auth,async(req,res)=>{
  try{
   if(!req.user.school_id)
    return res.status(403).json({message:'École non définie'});

   const q=await pool.query(
    `SELECT * FROM ${cfg.table} WHERE school_id=$1 ORDER BY id DESC`,
    [req.user.school_id]
   );

   res.json(q.rows);
  }catch(e){
   res.status(500).json({message:e.message});
  }
 });

 app.post(`/api/${key}`,auth,allow(...cfg.roles),async(req,res)=>{
  try{
   if(!req.user.school_id)
    return res.status(403).json({message:'École non définie'});

   const fields=cfg.fields.filter(f=>req.body[f]!==undefined);

   if(!fields.length)
    return res.status(400).json({message:'Aucune donnée fournie'});

   const vals=fields.map(f=>req.body[f]);
   const cols=[...fields,'school_id'].join(',');
   const marks=[...fields.map((_,i)=>`$${i+1}`),`$${fields.length+1}`].join(',');

   const q=await pool.query(
    `INSERT INTO ${cfg.table} (${cols}) VALUES (${marks}) RETURNING *`,
    [...vals,req.user.school_id]
   );

   await pool.query(
    `INSERT INTO audit_logs(user_id,school_id,entity,entity_id,action,new_values)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [req.user.id,req.user.school_id,key,q.rows[0].id,'CREATE',q.rows[0]]
   );

   res.status(201).json(q.rows[0]);
  }catch(e){
   res.status(400).json({message:e.message});
  }
 });

 app.put(`/api/${key}/:id`,auth,allow(...cfg.roles),async(req,res)=>{
  try{
   if(!req.user.school_id)
    return res.status(403).json({message:'École non définie'});

   const fields=cfg.fields.filter(f=>req.body[f]!==undefined);

   if(!fields.length)
    return res.status(400).json({message:'Aucune donnée fournie'});

   const old=await pool.query(
    `SELECT * FROM ${cfg.table} WHERE id=$1 AND school_id=$2`,
    [req.params.id,req.user.school_id]
   );

   if(!old.rows[0])
    return res.status(404).json({message:'Introuvable'});

   const vals=fields.map(f=>req.body[f]);
   const sets=fields.map((f,i)=>`${f}=$${i+1}`).join(',');

   const q=await pool.query(
    `UPDATE ${cfg.table} SET ${sets}
     WHERE id=$${fields.length+1} AND school_id=$${fields.length+2}
     RETURNING *`,
    [...vals,req.params.id,req.user.school_id]
   );

   await pool.query(
    `INSERT INTO audit_logs(user_id,school_id,entity,entity_id,action,old_values,new_values)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [req.user.id,req.user.school_id,key,req.params.id,'UPDATE',old.rows[0],q.rows[0]]
   );

   res.json(q.rows[0]);
  }catch(e){
   res.status(400).json({message:e.message});
  }
 });

 app.delete(`/api/${key}/:id`,auth,allow(...cfg.roles),async(req,res)=>{
  try{
   if(!req.user.school_id)
    return res.status(403).json({message:'École non définie'});

   const q=await pool.query(
    `DELETE FROM ${cfg.table}
     WHERE id=$1 AND school_id=$2 RETURNING *`,
    [req.params.id,req.user.school_id]
   );

   if(!q.rows[0])
    return res.status(404).json({message:'Introuvable'});

   await pool.query(
    `INSERT INTO audit_logs(user_id,school_id,entity,entity_id,action,old_values)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [req.user.id,req.user.school_id,key,req.params.id,'DELETE',q.rows[0]]
   );

   res.json({message:'Élément supprimé'});
  }catch(e){
   res.status(409).json({
    message:'Suppression impossible : cet élément est peut-être utilisé ailleurs.'
   });
  }
 });

}



app.get('/api/teachers',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const q=await pool.query(
   "SELECT id,name,email,role FROM users WHERE role='teacher' AND school_id=$1 ORDER BY name",
   [req.user.school_id]
  );

  res.json(q.rows);
 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});

app.get('/api/parents',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const q=await pool.query(
   "SELECT id,name,email FROM users WHERE role='parent' AND school_id=$1 ORDER BY name",
   [req.user.school_id]
  );

  res.json(q.rows);
 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});


app.get('/api/grades',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const q=await pool.query(`
   SELECT g.*,
    s.first_name||' '||s.last_name student_name,
    su.name subject_name
   FROM grades g
   JOIN students s ON s.id=g.student_id
   JOIN subjects su ON su.id=g.subject_id
   WHERE g.school_id=$1
     AND s.school_id=$1
     AND su.school_id=$1
   ORDER BY g.id DESC
  `,[req.user.school_id]);

  res.json(q.rows);
 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});

app.post('/api/grades',auth,allow('admin','teacher'),async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const {
   student_id,subject_id,assessment,score,
   assessment_date,school_year
  }=req.body;

  const valid=await pool.query(`
   SELECT
    EXISTS(SELECT 1 FROM students WHERE id=$1 AND school_id=$3) AS student_ok,
    EXISTS(SELECT 1 FROM subjects WHERE id=$2 AND school_id=$3) AS subject_ok
  `,[student_id,subject_id,req.user.school_id]);

  if(!valid.rows[0].student_ok || !valid.rows[0].subject_ok)
   return res.status(400).json({message:'Élève ou matière invalide pour cette école'});

  const q=await pool.query(`
   INSERT INTO grades(
    student_id,subject_id,assessment,score,
    assessment_date,school_year,school_id
   )
   VALUES($1,$2,$3,$4,$5,$6,$7)
   RETURNING *
  `,[
   student_id,subject_id,assessment,score,
   assessment_date||new Date(),
   school_year||'2026-2027',
   req.user.school_id
  ]);

  res.status(201).json(q.rows[0]);
 }catch(e){
  res.status(400).json({message:e.message});
 }
});


app.get('/api/averages/:studentId',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const q=await pool.query(`
   SELECT
    su.name subject,
    ROUND(AVG(g.score),2) average,
    su.coefficient
   FROM grades g
   JOIN subjects su ON su.id=g.subject_id
   JOIN students s ON s.id=g.student_id
   WHERE g.student_id=$1
     AND g.school_id=$2
     AND s.school_id=$2
     AND su.school_id=$2
   GROUP BY su.id,su.name,su.coefficient
  `,[req.params.studentId,req.user.school_id]);

  const total=q.rows.reduce(
   (a,r)=>a+Number(r.average)*Number(r.coefficient),0
  );

  const coeff=q.rows.reduce(
   (a,r)=>a+Number(r.coefficient),0
  );

  res.json({
   subjects:q.rows,
   general_average:coeff
    ? Number((total/coeff).toFixed(2))
    : null
  });

 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});


app.get('/api/timetable',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const q=await pool.query(`
   SELECT
    t.*,
    c.level||' '||c.section class_name,
    u.name teacher_name,
    s.name subject_name,
    r.name room_name
   FROM timetable t
   LEFT JOIN classes c ON c.id=t.class_id AND c.school_id=t.school_id
   LEFT JOIN users u ON u.id=t.teacher_id AND u.school_id=t.school_id
   LEFT JOIN subjects s ON s.id=t.subject_id AND s.school_id=t.school_id
   LEFT JOIN rooms r ON r.id=t.room_id AND r.school_id=t.school_id
   WHERE t.school_id=$1
   ORDER BY t.weekday,t.start_time
  `,[req.user.school_id]);

  res.json(q.rows);
 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});

app.post('/api/timetable',auth,allow('admin'),async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const {
   class_id,teacher_id,subject_id,room_id,
   weekday,start_time,end_time,school_year
  }=req.body;

  if(!class_id || !teacher_id || !subject_id || !room_id ||
     !weekday || !start_time || !end_time)
   return res.status(400).json({message:'Tous les champs sont obligatoires'});

  if(end_time<=start_time)
   return res.status(400).json({message:'L’heure de fin doit être après l’heure de début'});

  const valid=await pool.query(`
   SELECT
    EXISTS(SELECT 1 FROM classes WHERE id=$1 AND school_id=$5) AS class_ok,
    EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='teacher' AND school_id=$5) AS teacher_ok,
    EXISTS(SELECT 1 FROM subjects WHERE id=$3 AND school_id=$5) AS subject_ok,
    EXISTS(SELECT 1 FROM rooms WHERE id=$4 AND school_id=$5) AS room_ok
  `,[class_id,teacher_id,subject_id,room_id,req.user.school_id]);

  const v=valid.rows[0];

  if(!v.class_ok || !v.teacher_ok || !v.subject_ok || !v.room_ok)
   return res.status(400).json({message:'Données invalides pour cette école'});

  const conflict=await pool.query(`
   SELECT id FROM timetable
   WHERE school_id=$1
    AND weekday=$2
    AND start_time<$4
    AND end_time>$3
    AND (teacher_id=$5 OR room_id=$6)
  `,[req.user.school_id,weekday,start_time,end_time,teacher_id,room_id]);

  if(conflict.rowCount)
   return res.status(409).json({
    message:'Conflit : enseignant ou salle déjà occupé(e) sur ce créneau'
   });

  const q=await pool.query(`
   INSERT INTO timetable(
    class_id,teacher_id,subject_id,room_id,
    weekday,start_time,end_time,school_year,school_id
   )
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
   RETURNING *
  `,[
   class_id,teacher_id,subject_id,room_id,
   weekday,start_time,end_time,
   school_year||'2026-2027',
   req.user.school_id
  ]);

  res.status(201).json(q.rows[0]);
 }catch(e){
  res.status(400).json({message:e.message});
 }
});


app.get('/api/messages',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const q=await pool.query(`
   SELECT
    m.*,
    a.name sender_name,
    b.name recipient_name
   FROM messages m
   JOIN users a ON a.id=m.sender_id AND a.school_id=m.school_id
   JOIN users b ON b.id=m.recipient_id AND b.school_id=m.school_id
   WHERE m.school_id=$1
    AND (m.sender_id=$2 OR m.recipient_id=$2)
   ORDER BY m.sent_at DESC
  `,[req.user.school_id,req.user.id]);

  res.json(q.rows);
 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});

app.post('/api/messages',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const {recipient_id,subject,body}=req.body;

  if(!recipient_id || !subject || !body)
   return res.status(400).json({message:'Tous les champs sont obligatoires'});

  const recipient=await pool.query(
   'SELECT id FROM users WHERE id=$1 AND school_id=$2 AND active=true',
   [recipient_id,req.user.school_id]
  );

  if(!recipient.rowCount)
   return res.status(400).json({message:'Destinataire invalide pour cette école'});

  const q=await pool.query(`
   INSERT INTO messages(sender_id,recipient_id,subject,body,school_id)
   VALUES($1,$2,$3,$4,$5)
   RETURNING *
  `,[req.user.id,recipient_id,subject,body,req.user.school_id]);

  res.status(201).json(q.rows[0]);
 }catch(e){
  res.status(400).json({message:e.message});
 }
});

app.patch('/api/messages/:id/read',auth,async(req,res)=>{
 try{
  if(!req.user.school_id)
   return res.status(403).json({message:'École non définie'});

  const q=await pool.query(`
   UPDATE messages
   SET is_read=true
   WHERE id=$1
    AND recipient_id=$2
    AND school_id=$3
   RETURNING id
  `,[req.params.id,req.user.id,req.user.school_id]);

  if(!q.rowCount)
   return res.status(404).json({message:'Message introuvable'});

  res.json({message:'Message lu'});
 }catch(e){
  res.status(500).json({message:'Erreur serveur'});
 }
});

const port=process.env.PORT||5000;
app.listen(port,()=>console.log(`API démarrée sur http://localhost:${port}`));
