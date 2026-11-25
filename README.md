# Gestion d'école primaire — MVP

Application mono-école construite avec React + Bootstrap, Node.js/Express et PostgreSQL.

## Prérequis
- Node.js 20+
- PostgreSQL 14+
- Visual Studio Code

## 1. Créer la base PostgreSQL
Dans pgAdmin, crée une base nommée `gestion_ecole`.
Puis copie le contenu de `backend/schema.sql` dans l'outil Query Tool et exécute-le.

## 2. Configurer le backend
Dans un terminal VS Code :
```bash
cd backend
copy .env.example .env
npm install
```
Ouvre `backend/.env` et adapte `DATABASE_URL` à ton installation PostgreSQL.
Exemple :
`postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/gestion_ecole`

Créer les données de démonstration :
```bash
npm run seed
npm run dev
```
API : http://localhost:5000

Comptes de démonstration (mot de passe : `Ecole123!`) :
- admin@ecole.tn (administrateur)
- enseignant@ecole.tn (enseignant)
- parent@ecole.tn (parent)
- comptable@ecole.tn (comptable)
- eleve@ecole.tn (élève)

## 3. Lancer le frontend
Ouvre un deuxième terminal :
```bash
cd frontend
npm install
npm run dev
```
Ouvre l'adresse affichée, généralement http://localhost:5173

## Modules inclus dans ce MVP
- Connexion JWT et rôles (administrateur, enseignant, parent, élève, comptable)
- Tableau de bord
- CRUD élèves, classes, matières, enseignants, salles, devoirs, paiements
- Notes et calcul de moyenne pondérée
- Emploi du temps avec vérification des conflits de salle/enseignant
- Messagerie interne simple
- Historique scolaire par année scolaire dans les tables métier principales

## Important
C'est une base de projet pédagogique fonctionnelle, pas encore un déploiement de production.
Avant une utilisation réelle avec des données d'enfants : renforcer les contrôles d'accès par enfant/classe,
ajouter stockage sécurisé des fichiers, sauvegardes automatiques, journal d'audit complet, consentement parental,
HTTPS, notifications e-mail/push et tests de sécurité. Les mots de passe de démonstration doivent être changés.
