<div align="center">
  <img src="frontend/public/logo.svg" alt="Skill Swap Logo" width="100" />
  <h1>Skill Swap</h1>
  <p>An enterprise-grade peer-to-peer knowledge exchange platform featuring automated AI compatibility scoring and real-time collaboration.</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Flask](https://img.shields.io/badge/Flask-3.1-black.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-010101.svg?logo=socketdotio&logoColor=white)](https://socket.io/)
  [![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Generative%20AI-4285F4.svg?logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
  [![Tests](https://img.shields.io/badge/Tests-142%20Passed-success.svg)](https://github.com/Kxhor/Skill-swap)
</div>

***

## 1. Executive Summary

Skill Swap is a production-grade, decentralized platform designed for skill bartering between peers. Members exchange domain expertise without monetary transactions, offering proficiencies they possess to acquire competencies they want to learn.

The system incorporates artificial intelligence matching via Google Gemini, bi-directional proposal negotiation, low-latency WebSocket messaging, session calendar coordination, and an administrative moderation portal.

***

## 2. System Architecture

Skill Swap implements a decoupled, event-driven architecture designed for high throughput, sub-100ms real-time messaging, and strong transactional integrity.

```text
+-----------------------------------------------------------------+
|                     Client Tier (React SPA)                    |
|  - React 18, Vite, TypeScript, React Router DOM                 |
|  - Data Layer: TanStack Query v5 (Optimistic Updates & Cache)   |
|  - Design System: Tailwind CSS v4, Radix UI Primitives          |
+-------------------------------+---------------------------------+
                                |
               HTTP REST APIs   |   WebSocket Events
               (JSON Payloads)  |   (Socket.IO Protocol)
                                |
+-------------------------------+---------------------------------+
|                     Application API Gateway                     |
|  - Python Flask, Gevent WSGI Server, Flask-SocketIO             |
|  - Rate Limiting: Flask-Limiter (Rolling Windows)               |
|  - Security: Flask-WTF (CSRF Protection), Bleach Sanitizer      |
|  - Identity: Flask-Login, Stateful Sessions, Bcrypt Hashing     |
+-------------------------------+---------------------------------+
                                |
         +----------------------+----------------------+
         |                                             |
+--------+--------+                           +--------+--------+
| Database Tier   |                           | Cloud Services  |
| - PostgreSQL    |                           | - Google Gemini |
| - SQLAlchemy 2  |                           | - Cloudinary    |
| - Alembic       |                           +-----------------+
+-----------------+
```

### Architecture Specifications

| Subsystem | Components | Functional Responsibilities |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 18, TypeScript, Vite | Single-page application rendering, routing, and UI interactions |
| **Data Synchronization** | TanStack React Query (v5) | Query caching, optimistic state updates, and automated invalidation |
| **Interface Styling** | Tailwind CSS v4, Radix UI, Lucide | Design token styling, keyboard navigation, and accessible overlays |
| **API Backend** | Python 3.10+, Flask, SQLAlchemy | Application routing, business workflows, and ORM abstractions |
| **Real-Time Gateway** | Flask-SocketIO, Gevent | Bi-directional chat channels, typing indicators, and presence updates |
| **Security Controls** | Flask-WTF, Flask-Limiter, Bleach | Double-submit CSRF checks, rate limiting, and input sanitization |
| **Persistence Layer** | PostgreSQL, Alembic | Relational data persistence, schema migrations, and relational integrity |
| **AI Integration** | Google Gemini Generative AI | Semantic skill matrix analysis and compatibility percentage scoring |
| **Media Delivery** | Cloudinary CDN | Asset optimization and avatar storage |

***

## 3. Core Capabilities

### AI Compatibility Matching (Google Gemini)
Users' offered and desired skills are evaluated against peer profiles using Google Gemini. The algorithm assesses semantic relevance, skill complementarity, and learning goals to produce quantitative compatibility ratings accompanied by contextual rationale.

### Real-Time Bi-Directional Communication
Persistent Socket.IO connections provide instant peer-to-peer messaging for accepted swap participants. Handlers include live message delivery, presence status (online/offline), typing broadcasts, and real-time unread notification badge updates.

### Atomic Swap Lifecycle State Machine
Swap proposals execute state transitions through atomic database updates with strict validation guards:
* `pending`: Proposal created, awaiting response from recipient.
* `accepted`: Swap terms confirmed; unlocks real-time messaging and scheduling.
* `rejected`: Recipient declined the proposal.
* `cancelled`: Sender rescinded the proposal prior to recipient action.
* `completed`: Both participants confirm session completion; unlocks review submission.

### Dual-Portal Role Isolation
* **User Workspace:** Personal dashboard for monitoring outgoing/incoming proposals, scheduled sessions, profile skill catalogs, and community reputation feedback.
* **Administrative Operations Console (`/admin`):** Segregated control room providing system-wide telemetry, user account state enforcement (active/banned), and skill submission moderation (approval/rejection).

***

## 4. Screenshot Showcase

### Member Profile and Skills Matrix
![Profile](screenshots/profile.jpeg)
*Personal profile view with categorized skills, availability schedules, and reputation metrics.*

### Partner Discovery and AI Compatibility
![Demo User Profile](screenshots/demo_user_profile.jpeg)
*Partner discovery view highlighting AI-driven compatibility scores and skill alignment details.*

### Swap Request Pipeline Management
![Swap Requests](screenshots/swap_requests.jpeg)
*Lifecycle management dashboard organizing incoming, outgoing, and completed skill swaps.*

### Real-Time Chat and Negotiation
![Messages](screenshots/messages.jpeg)
*Real-time Socket.IO chat workspace with live typing indicators and contextual swap metadata.*

### Administrative Control Center
![Admin Dashboard](screenshots/admin_dashboard.jpeg)
*Admin operations console displaying platform telemetry, user moderation, and skill approvals.*

***

## 5. Local Development Setup

Follow these steps to configure and run the project locally.

### Prerequisites
* **Node.js** (v18.0.0 or higher) and npm (v9.0.0 or higher)
* **Python** (v3.10.0 or higher)
* **Git** (v2.30.0 or higher)

### Step 1: Clone Repository

```bash
git clone https://github.com/Kxhor/Skill-swap.git
cd Skill-swap
```

### Step 2: Backend Setup

1. Change directory to `backend/`:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   * **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Create local environment configuration:
   ```bash
   cp .env.example .env
   ```
   *Note: When no external PostgreSQL URL is provided, SQLite is used automatically for local testing.*

5. Apply database schema migrations:
   ```bash
   python -m flask db upgrade
   ```

6. Start backend development server:
   ```bash
   python run.py
   ```
   The backend API will run on `http://127.0.0.1:5005`.

### Step 3: Frontend Setup

1. Open a new terminal window and navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start Vite development server:
   ```bash
   npm run dev
   ```
   The frontend interface will run on `http://localhost:5173`.

***

## 6. Environment Variable Reference

The `backend/.env` file accepts the following parameters:

| Variable | Required | Default / Example Value | Description |
| :--- | :--- | :--- | :--- |
| `FLASK_ENV` | No | `development` | Operational environment mode (`development`, `production`). |
| `SECRET_KEY` | Yes | `generate-a-secure-random-key` | Cryptographic secret for signing session cookies. |
| `DATABASE_URL` | No | `sqlite:///instance/skillswap.db` | PostgreSQL connection URI or SQLite fallback. |
| `CLOUDINARY_CLOUD_NAME` | No | `your-cloud-name` | Cloudinary account identifier for media delivery. |
| `CLOUDINARY_API_KEY` | No | `your-api-key` | Public API credential for Cloudinary. |
| `CLOUDINARY_API_SECRET` | No | `your-api-secret` | Private API credential for Cloudinary. |
| `GEMINI_API_KEY` | No | `your-gemini-api-key` | Google Gemini API key for compatibility calculations. |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-delimited list of permitted CORS origins. |

***

## 7. Pre-Configured Test Accounts

The local development seed provides pre-configured credentials for evaluation:

| Account Role | Email Address | Password | Permissions & Focus Area |
| :--- | :--- | :--- | :--- |
| **Standard User** | `demo@example.com` | `password123` | Outgoing swap proposals and profile customization. |
| **Partner User** | `alice@example.com` | `password123` | Inbound proposal approvals, real-time messaging, and reviews. |
| **Platform Admin** | `admin@example.com` | `adminpassword123` | Access to the `/admin` moderation and telemetry portal. |

***

## 8. Quality Assurance & Testing

The codebase includes an automated regression test suite covering security boundaries, swap lifecycles, and data models.

### Run Backend Tests

```bash
cd backend
pytest
```
*Verification: 142 integration tests validating authentication, permission gates, socket events, and model constraints.*

### Run Frontend Production Build

```bash
cd frontend
npm run build
```
*Verification: Type checks TypeScript definitions and compiles optimized production bundles with zero diagnostics errors.*

***

## 9. Engineering Team

This project was engineered collaboratively by:

* **Kishor G**
* **Hemanth Raj E**

***

## 10. License

This project is open-source software licensed under the MIT License. See the [LICENSE](LICENSE) file for complete details.
