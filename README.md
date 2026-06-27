# Skill Swap

A full-stack web platform where users exchange skills peer-to-peer — no money, just knowledge.

## Tech Stack

**Frontend:** React 18 · Vite 5 · Tailwind CSS · shadcn/ui · TanStack Query · Socket.IO  
**Backend:** Python 3.11 · Flask 2.3 · Flask-SocketIO · SQLAlchemy · Flask-Migrate  
**Database:** PostgreSQL 16 (Neon.tech)  
**Media:** Cloudinary  
**AI:** Google Gemini API (match scoring)  
**Hosting:** Vercel (frontend) + Render (backend)

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # fill in your keys
flask db upgrade
flask create-admin admin@example.com yourpassword
python run.py
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local  # set VITE_API_URL
npm run dev
```

## Live Demo

> Coming after deployment (Session 7)

## Community Stats

> Public page — no login required: `/community`
