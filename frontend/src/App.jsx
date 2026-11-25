import React, { useEffect, useState } from 'react';
import {
  Routes, Route, Navigate, NavLink, useNavigate
} from 'react-router-dom';
import {
  School, LayoutDashboard, Users, BookOpen, GraduationCap, DoorOpen,
  CalendarDays, Wallet, ClipboardList, MessageCircle, LogOut, Menu, X,
  Plus, Trash2, RefreshCw
} from 'lucide-react';
import api from './api';

const menu = [
  ['Dashboard', '/', LayoutDashboard],
  ['Élèves', '/students', Users],
  ['Classes', '/classes', School],
  ['Matières', '/subjects', BookOpen],
  ['Enseignants', '/teachers', GraduationCap],
  ['Salles', '/rooms', DoorOpen],
  ['Emploi du temps', '/timetable', CalendarDays],
  ['Notes', '/grades', ClipboardList],
  ['Paiements', '/payments', Wallet],
  ['Devoirs', '/homework', BookOpen],
  ['Messagerie', '/messages', MessageCircle]
];

function Login({ onLogin, onRegister }) {
  const [email, setEmail] = useState('admin@ecole.tn');
  const [password, setPassword] = useState('Ecole123!');
  const [err, setErr] = useState('');

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="brand-icon"><School size={30} /></div>
        <h3>École Primaire</h3>
        <p className="text-muted">Espace de gestion scolaire</p>

        <form onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          try {
            const r = await api.post('/auth/login', { email, password });
            localStorage.setItem('token', r.data.token);
            onLogin(r.data.user);
          } catch {
            setErr('Identifiants incorrects ou serveur non démarré');
          }
        }}>
          <label className="form-label">Adresse e-mail</label>
          <input
            required
            className="form-control mb-3"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <label className="form-label">Mot de passe</label>
          <input
            required
            className="form-control mb-3"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {err && <div className="alert alert-danger py-2">{err}</div>}

          <button className="btn btn-primary w-100" type="submit">
            Se connecter
          </button>
        </form>

        <button
          type="button"
          className="btn btn-outline-primary w-100 mt-3"
          onClick={onRegister}
        >
          Créer une école
        </button>

        <small className="d-block mt-3 text-muted">
          Démo : admin@ecole.tn / Ecole123!
        </small>
      </div>
    </div>
  );
}

function RegisterSchool({ onBack }) {
  const [form, setForm] = useState({
    school_name: '',
    address: '',
    school_email: '',
    phone: '',
    admin_name: '',