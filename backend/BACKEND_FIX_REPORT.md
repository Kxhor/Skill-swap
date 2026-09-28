# Skill Swap â€” Comprehensive Backend Fix & Architecture Audit Report

This report summarizes all backend security hardening, moderation enforcement, test coverage expansion, schema migration inspection, and concurrency architecture adjustments across Phases 1 through 5.

---

## 1. Summary of Changes Across Phases 1â€“4

### Phase 1: Guardrails, Rate Limiting & Information Leak Prevention
- **Socket Rate-Limiting & Message Size Validation (`backend/app/socket_events.py`)**:
  - Implemented an in-memory rolling-window rate limiter tracking message timestamps per `user_id` within a 60-second window (`_MESSAGE_MAX_PER_WINDOW = 30`). Messages exceeding this threshold emit an error event: `"You're sending messages too fast. Please slow down."`.
  - Replaced silent text truncation with an explicit rejection emitting an error event when message length exceeds 2000 characters: `"Message too long (max 2000 characters)"`, aligning socket behavior with the REST API.
- **AI Matching Exception Leak Fix (`backend/app/utils/gemini_match.py`)**:
  - Replaced internal exception string formatting (`f"AI matching error: {str(e)}"`) with server-side stderr logging (`print(..., file=sys.stderr)`).
  - Callers now receive a safe, generic fallback: `(50, "AI matching is temporarily unavailable")`.
- **Blueprint-Wide Admin Guard (`backend/app/routes/users.py`)**:
  - Added `@users_bp.before_request` hook returning `403` to any authenticated Admin session attempting to reach user endpoints (`"Admin accounts cannot access user endpoints"`).
  - Confirmed intentional behavioral side effect: Logged-in admins receive 403 on `/api/users/stats/community` (admins have access to `/api/admin/stats`), while anonymous callers and standard users access it normally.
  - Removed redundant manual `_reject_admin()` calls from individual user routes.
- **CSRF Token Hardening (`backend/app/routes/auth.py`)**:
  - Verified no frontend code reads `document.cookie` for `"csrf_token"` (the frontend stores the token in memory from the JSON response).
  - Changed `httponly=False` to `httponly=True` on the CSRF cookie set by `get_csrf_token()`.

---

### Phase 2: Skill.status Moderation Enforcement

- **Swap Creation Gating (`backend/app/routes/swaps.py`)**:
  - Updated `create_swap()` to require `Skill.status == "approved"` for both `offered_skill` and `wanted_skill`.
  - Returns `422` with existing error shapes (`"Invalid offered skill"` or `"Invalid wanted skill"`) if unapproved.
- **Public Profile & User Listing Filtering (`backend/app/routes/users.py`)**:
  - `list_users()`: Filtered `Skill.status == "approved"` for offered/wanted skills and skill search subqueries.
  - `get_user(user_id)`: Public profile only returns approved skills for public display.
  - `profile()` (`GET /api/users/profile`): Intentionally left unfiltered so owners can view and manage their own pending/rejected skills on "My Skills".
  - `add_skill()`: Left unchanged; new skills continue to default to `"pending"`.
- **Moderation Option Chosen & Rationale**:
  - *Chosen Option*: Filter public display and swap creation, while preserving full visibility on the owner's private profile (`/api/users/profile`).
  - *Why*: This satisfies strict platform quality control without breaking the frontend React contract in `MySkills.tsx` (which expects to display pending status badges to the skill owner).

---

### Phase 3: Comprehensive Admin Test Suite (`backend/tests/test_admin.py`)

- Created `backend/tests/test_admin.py` covering all 13 endpoints in `backend/app/routes/admin.py`:
  1. `TestAdminStats`: Stats keys, counts verification against fixtures.
  2. `TestAdminUsers`: Pagination, search, status filter (`active`/`banned`/`all`), ban/unban, 409 conflict checks, 404 missing user checks.
  3. `TestAdminSkills`: Pagination, search, status filter, approve/reject, 409 double-approve/reject, 404 checks.
  4. `TestAdminSwaps`: Pagination, status filter, deletion, 404 checks.
  5. `TestAdminFeedback`: Feedback listing with sender resolution, deletion, 404 checks.
  6. `TestAdminAnnouncements`: 422 validation, 200 broadcast creation.
  7. `TestAdminActivity`: Activity feed payload shape and descending chronological order.
  8. `TestAdminIsolationBoundary`: Verified 403 on all 13 admin endpoints for non-admin users, and confirmed admin sessions receive 403 on `GET /api/users` while regular users receive 200.

---

### Phase 4: Schema Migration Inspection & Boot-Time Hardening

- **Migration Generation & Inspection**:
  - Ran `flask db migrate -m "sync schema with current models"`.
  - Result: Alembic reported `INFO [alembic.env] No changes in schema detected.` â€” the live database schema (all 13 tables, including historical `users` columns from `upgrade_db.py`) is in 100% parity with SQLAlchemy models.
  - In accordance with safety rules, `flask db upgrade` was **not** run.
- **Boot-Time Guard (`backend/app/__init__.py`)**:
  - Guarded `db.create_all()` with `if os.environ.get("FLASK_ENV") != "production":`.
  - Added documentation clarifying that production schema changes must proceed through Alembic migrations exclusively.
- **Historical Notice Header (`backend/upgrade_db.py`)**:
  - Added header comment marking `upgrade_db.py` as a one-time historical script superseded by Alembic migrations.

---

## 2. In-Depth Investigations: Phases 5.1 & 5.2

### 2.1 Gemini Model & SDK Version Compatibility (`google-generativeai==0.5.4` vs `gemini-2.0-flash`)

- **Findings**:
  1. **Release Timeline Discrepancy**:
     - `google-generativeai==0.5.4` pinned in `backend/requirements.txt` was released on **May 16, 2024**.
     - `gemini-2.0-flash` was announced in December 2024 and launched generally on **February 5, 2025** (9 months after SDK 0.5.4).
  2. **Model Lifecycle Status**:
     - According to official Google Gemini API documentation, the `gemini-2.0-flash` preview series reached its shutdown/retirement date on **June 1, 2026** and is no longer available on Google's API endpoints.
  3. **Runtime Impact**:
     - In `backend/app/utils/gemini_match.py`, `_call_gemini` attempts to instantiate `genai.GenerativeModel("gemini-2.0-flash")`.
     - While the SDK does not perform client-side model string validation, calling Google's live Generative Language API endpoint with retired model `gemini-2.0-flash` returns an HTTP 404/400 (model retired/not found).
     - Because Phase 1 wrapped this call in safe exception handling, every real invocation currently fails silently server-side (logged to `sys.stderr`) and returns the generic fallback: `(50, "AI matching is temporarily unavailable")`.
- **Proposed Minimal Fixes**:
  - *Option A (Minimal In-Place Fix)*: Update the model string in `backend/app/utils/gemini_match.py` to an active model (e.g., `gemini-2.5-flash` or `gemini-1.5-flash`), and bump `backend/requirements.txt` to `google-generativeai>=0.8.3`.
  - *Option B (Recommended Long-Term)*: Migrate to the new official unified Google GenAI SDK (`google-genai>=1.0.0`) using `genai.Client()` with `gemini-2.5-flash` or `gemini-2.5-flash-lite`.

---

### 2.2 Socket.IO Async Mode vs. Gevent Gunicorn Worker

- **Findings**:
  1. **Production Worker Configuration**:
     - `render.yaml` starts Gunicorn with:
       ```bash
       gunicorn wsgi:app -w 1 -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker --bind 0.0.0.0:$PORT --timeout 120
       ```
  2. **Previous Conflict in `backend/app/__init__.py`**:
     - `backend/app/__init__.py` previously hardcoded `async_mode="threading"`.
     - Flask-SocketIO documentation states that when running under `geventwebsocket.gunicorn.workers.GeventWebSocketWorker`, Flask-SocketIO must operate in `gevent` async mode to properly hook into `environ['wsgi.websocket']`.
     - Locking `async_mode="threading"` under a gevent worker causes WebSocket handshakes to fail or fall back to long-polling, and can cause event-loop deadlocks between greenlets and OS threads.
  3. **Implemented Fix**:
     - Updated `backend/app/__init__.py` to dynamically select `async_mode="gevent"` in production when `gevent` is available, while defaulting to `"threading"` in non-production environments:
       ```python
       socketio_async_mode = "threading"
       if os.environ.get("FLASK_ENV") == "production":
           try:
               import gevent  # noqa: F401
               socketio_async_mode = "gevent"
           except ImportError:
               socketio_async_mode = "threading"

       socketio.init_app(
           app,
           cors_allowed_origins=allowed_origins,
           async_mode=socketio_async_mode,
           logger=False,
           engineio_logger=False,
       )
       ```
  4. **Verification**:
     - **Unit & Integration Tests**: All 28 tests in `backend/tests/test_socket.py` pass 100%.
     - **Local Development**: Tested `python run.py` directly; server cleanly booted on port 5005 and responded `200 OK` (`{"db": "connected", "status": "ok"}`).
  5. **Important Transport Caveat**:
     - *Note*: Flask-SocketIO's test client (`test_client`) simulates message passing in-memory and does not fully exercise real browser-to-server WebSocket handshake headers or TCP socket upgrades. While code compatibility and test passes are confirmed, real-world WebSocket verification should be performed on a live staging/production instance with browser clients.

---

## 3. Test Suite Progression & Verification

| Milestone | Passing Tests | Failed Tests | Delta / Highlights |
|---|---|---|---|
| **Baseline (Initial State)** | **101** | 0 | Starting point prior to fixes |
| **Pass 1 (Security & Guards)** | **107** | 0 | +6 tests (socket limits, CSRF, admin user guard, Gemini error leak) |
| **Pass 2 (Skill Status Gating)** | **110** | 0 | +3 tests (swap creation checks, public profile filtering) |
| **Pass 3 (Admin Route Coverage)** | **137** | 0 | +27 tests (full coverage across all admin routes in `test_admin.py`) |
| **Pass 4 (Schema & Boot Guard)** | **137** | 0 | Verified SQLite test isolation unaffected by `FLASK_ENV` check |
| **Pass 5 (Socket.IO Async Mode Fix)** | **137** | 0 | 100% pass across full suite (137 tests in 74s) |

---

## 4. Open Items Requiring Human Decision

### 1. Pre-existing Pending Skills Data Migration (Phase 2)
- **Question**: When `Skill.status` enforcement was activated, existing skills defaulting to `pending` in the database are now blocked from swap requests and hidden from public profiles until approved.
- **Decision Needed**:
  - *Option A (Bulk Auto-Approve)*: Execute a one-time database migration script:
    ```sql
    UPDATE skills SET status = 'approved' WHERE status = 'pending';
    ```
    This ensures pre-existing users' skills are immediately active.
  - *Option B (Manual Admin Moderation)*: Keep skills pending and have platform administrators manually review and approve them via the Admin Dashboard (`/admin`).

### 2. Production Alembic Migration Stamping (Phase 4)
- **Question**: Alembic confirms that the live database schema already has all tables and columns, with zero schema drift.
- **Decision Needed**:
  - To align Alembic revision tracking in production without running any DDL statements, run:
    ```bash
    flask db stamp head
    ```
  - This marks the production database as up-to-date with Alembic's latest migration revision, preparing it cleanly for future automated migrations.
## [Pass 9] â¬   Swap Lifecycle Race Conditions Prevention (TOCTOU)

**Date**: 2026-09-27  

**Scope**: Backend Swap Routes (`backend/app/routes/swaps.py`)  

**Status**: Completed & Verified (100% Pass)



### 1. Objectives & Implementation Summary



#### 1.1 Atomic Conditional Updates for Swap Mutations

- **File**: `backend/app/routes/swaps.py`

- **Issue**:

  - The functions `accept_swap`, `reject_swap`, `cancel_swap`, `complete_swap`, and `confirm_session` all read the current status of a `SwapRequest` or `ScheduledSession`, checked it in Python with a plain `if` statement, and then mutated and committed.

  - Due to the cooperative scheduling of the single gevent worker (`render.yaml` `-w 1`), near-simultaneous requests could interleave, leading to Time-of-Check to Time-of-Use (TOCTOU) race conditions. For example, a double-click on "Accept" could pass the status check twice before committing, resulting in duplicate system messages and socket events.

- **Changes**:

  - Converted the mutation logic in all five functions to use an atomic conditional `UPDATE` via SQLAlchemy's `db.session.execute()` and `.where()`.

  - The previous read-then-write logic was replaced with updates that verify the required prior status atomically at the database level:

    ```python

    result = db.session.execute(

        db.update(SwapRequest)

        .where(SwapRequest.id == swap_id, SwapRequest.status == "pending")

        .values(status="accepted")

    )

    if result.rowcount == 0:

        return jsonify({"error": "This swap request has already been processed"}), 409

    

    db.session.commit()

    swap = SwapRequest.query.get(swap_id)  # re-fetch

    ```

  - For `confirm_session`, the `WHERE` clause folded both `status == "proposed"` and `proposer_id != current_user.id` into the atomic check to ensure complete thread-safety. If `rowcount == 0`, a secondary read is performed to correctly determine and return the same specific 422 error strings ("You cannot confirm your own proposal" vs "Session is already confirmed").



### 2. Test Suite & Verification Results



- **Test Count Before Pass 9**: 142 passed.

- **Test Count After Pass 9**: 142 passed (100% pass rate).

- **Modified Pre-existing Tests**: None.

- **Full Pytest Suite**: 142 passed, 0 failed across entire backend test suite in 72s.

- **Verification**: The API error shapes and HTTP status codes (`409`, `422`, `404`, `403`) are precisely preserved, ensuring 100% backwards compatibility for frontend consumers.


