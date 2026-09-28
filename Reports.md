# Skill Swap â€” Engineering Execution Reports

This file logs all backend updates, bug fixes, security hardening passes, and test suite verification results across tasks.

---

## [Pass 1] â€” Backend Hardening & Guardrails Fixes
**Date**: 2026-09-27  
**Scope**: Backend (`backend/app/`) & Test Suite (`backend/tests/`)  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

#### 1.1 Socket Message Rate Limiting & Payload Character Limit
- **File**: `backend/app/socket_events.py`
- **Issue**:
  - The socket event `send_message` previously accepted messages up to 5,000 characters and silently truncated them via `sanitize_text(content, max_length=5000)`.
  - There was no rate limiting on socket message sending, leaving a gap compared to the REST API's 30-per-minute rate limit on `/api/swaps/<swap_id>/messages`.
- **Changes**:
  - Replaced silent truncation with an explicit rejection emitting an error event when `len(content) > 2000`:
    ```python
    socketio.emit("error", {"message": "Message too long (max 2000 characters)"}, room=f"user_{user_id}")
    ```
  - Added an in-memory rolling-window rate limiter per user (`_message_rate_limit: dict[str, list[float]]`) with a window of 60 seconds (`_MESSAGE_WINDOW_SEC = 60.0`) and limit of 30 messages (`_MESSAGE_MAX_PER_WINDOW = 30`).
  - Prunes timestamps older than 60 seconds on every check; if 30 or more messages have been sent within the window, rejects subsequent emits:
    ```python
    socketio.emit("error", {"message": "You're sending messages too fast. Please slow down."}, room=f"user_{user_id}")
    ```

#### 1.2 Information Leak Prevention in Gemini Skill Matching
- **File**: `backend/app/utils/gemini_match.py`
- **Issue**:
  - `_call_gemini` returned internal raw exception details to the caller via `f"AI matching error: {str(e)}"`.
- **Changes**:
  - Raw exception details are now logged to server-side standard error (`sys.stderr`):
    ```python
    print(f"[gemini_match] AI matching failed: {e}", file=sys.stderr)
    ```
  - Caller receives a non-leaking, generic fallback message:
    ```python
    return 50, "AI matching is temporarily unavailable"
    ```

#### 1.3 Blueprint-Wide Admin Isolation on Users Blueprint
- **File**: `backend/app/routes/users.py`
- **Issue**:
  - Admin accounts were blocked on `routes/swaps.py` and `routes/feedback.py` via blueprint-wide `@before_request` hooks, but `routes/users.py` relied on manual per-route `_reject_admin()` checks, leaving public or newer routes unguarded.
- **Changes**:
  - Added `@users_bp.before_request`:
    ```python
    @users_bp.before_request
    def _reject_admin():
        if hasattr(current_user, "role"):
            return jsonify({"error": "Admin accounts cannot access user endpoints"}), 403
    ```
  - Confirmed intentional behavioral side effect: Logged-in admin sessions will now get 403 on `/api/users/stats/community` (admins already have access to `/api/admin/stats`), while anonymous callers and regular user sessions continue to access it normally.
  - Cleaned up now-redundant manual `_reject_admin()` calls across route functions (`profile`, `upload_photo_route`, `get_my_skills`, `add_skill`, `modify_skill`, `manage_availability`, `delete_availability`).

#### 1.4 CSRF Token Cookie Hardening (`HttpOnly`)
- **File**: `backend/app/routes/auth.py`
- **Audit**:
  - Grepped `frontend/src/` for `document.cookie` (0 occurrences found).
  - Confirmed frontend retrieves the CSRF token from the JSON body in `AuthContext.tsx` (`res.data.csrf_token`) and stores it in memory in `api.ts` to attach via the `X-CSRFToken` request header.
- **Changes**:
  - Updated `httponly=False` to `httponly=True` on `csrf_token` cookie set in `get_csrf_token()`.

---

### 2. Test Suite & Verification Results

- **Environment**: Python 3.14.7, pytest 9.1.1, SQLite in-memory test database.
- **Baseline Run**: 101 tests passed.
- **Post-Fix Run**: 107 tests passed (100% pass rate).
- **New Tests Added**:
  1. `tests/test_socket.py`:
     - `test_message_over_2000_chars_rejected`: Verifies rejection event when message exceeds 2000 chars.
     - `test_message_rate_limiting`: Verifies 30 messages allowed within 60s, and the 31st emits a rate-limit error.
  2. `tests/test_differentiators.py`:
     - `test_gemini_exception_logs_stderr_and_returns_generic_message`: Verifies exception logging to stderr and safe generic return string.
  3. `tests/test_auth.py`:
     - `test_csrf_cookie_is_httponly`: Verifies `HttpOnly` flag on `Set-Cookie` for `csrf_token`.
     - `test_admin_blocked_from_all_users_routes_including_stats`: Verifies admins receive 403 on `/api/users` and `/api/users/stats/community`.
     - `test_anonymous_and_user_can_access_community_stats`: Verifies anonymous callers and standard users can reach `/api/users/stats/community`.
- **Modified Pre-existing Tests**: None. No pre-existing test assertions had to be changed or weakened.

---
## [Pass 2] â€” Skill.status Gating Enforcement
**Date**: 2026-09-27  
**Scope**: Backend (`backend/app/routes/users.py`, `backend/app/routes/swaps.py`) & Test Suite (`backend/tests/`)  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

#### 1.1 Swap Creation Enforcement of Approved Skill Status
- **File**: `backend/app/routes/swaps.py`
- **Changes**:
  - In `create_swap()`, when validating both `offered_skill` and `wanted_skill`, added check requiring that the underlying `Skill.status == "approved"`.
  - Maintained the existing 422 error response contract:
    - If `offered_skill.skill.status != "approved"` -> returns `jsonify({"error": "Invalid offered skill"}), 422`.
    - If `wanted_skill.skill.status != "approved"` -> returns `jsonify({"error": "Invalid wanted skill"}), 422`.

#### 1.2 Public User Listing & Profile Filtering
- **File**: `backend/app/routes/users.py`
- **Changes**:
  - `list_users()`:
    - When querying `all_skills` for the page's users, added `.filter(..., Skill.status == "approved")` so `skills_offered` and `skills_wanted` only contain approved skills.
    - When searching by `skill`, filtered `Skill.status == "approved"` in subquery to ensure unapproved skills cannot match.
  - `get_user(user_id)`:
    - Joined with `Skill` and filtered `Skill.status == "approved"` for both `offered` and `wanted` skills before returning.
  - `profile()` (`GET /api/users/profile`):
    - Left unfiltered so a user's own profile continues to show all their pending, approved, and rejected skills in "My Skills".
  - `add_skill()`:
    - Left unchanged; new skills continue to default to `status="pending"`.

---

### 2. Test Suite Adjustments & Verification

- **Root Cause of Test Failures During Enforcement**:
  - Before this change, `Skill.status` was never validated by `create_swap()` or filtered by `list_users()`/`get_user()`.
  - As a result, test fixtures (`conftest.py`'s `user_skills`, `test_swaps.py`'s `two_users`, `test_differentiators.py`'s `two_users`) generated skills via `Skill(...)` or `POST /api/users/skills` which defaulted to `status="pending"`.
  - Once enforcement was activated, swap creation in those fixtures failed with 422.
- **Fixture Updates**:
  1. `tests/conftest.py`: Explicitly set `status="approved"` on `Skill(name="Python", ...)` and `Skill(name="React", ...)`.
  2. `tests/test_swaps.py`: Added `Skill.query.update({"status": "approved"})` in the `two_users` setup fixture.
  3. `tests/test_differentiators.py`: Added `Skill.query.update({"status": "approved"})` in the `two_users` setup fixture.
- **New Tests Added**:
  1. `tests/test_swaps.py`:
     - `test_create_swap_rejected_when_offered_skill_not_approved`: Verifies 422 rejection when offered skill is pending.
     - `test_create_swap_rejected_when_wanted_skill_not_approved`: Verifies 422 rejection when wanted skill is rejected.
  2. `tests/test_differentiators.py`:
     - `test_public_user_endpoints_filter_unapproved_skills`: Verifies `GET /api/users` and `GET /api/users/<id>` exclude pending and rejected skills, while `GET /api/users/profile` displays all skills to the owner.
- **Final Test Results**: 110 passed, 0 failed (100% pass rate).

---

## [Pass 3] â€” Comprehensive Admin Route Test Suite
**Date**: 2026-09-27  
**Scope**: Backend Tests (`backend/tests/test_admin.py`)  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

- **File Created**: `backend/tests/test_admin.py`
- **Pattern Alignment**:
  - Mirrored existing patterns from `backend/tests/conftest.py` (`admin_client`, `client`, `logged_in_client` fixtures) and `backend/tests/test_auth.py`'s `TestIsolation` class.
  - Did not touch any frontend files, database models, route URLs, or response JSON shapes.

#### 1.1 Test Classes & Coverage Breakdown

1. **`TestAdminStats`**:
   - `test_stats_keys_and_counts`: Verifies `/api/admin/stats` returns all required keys (`total_users`, `active_swaps`, `completed_swaps`, `pending_skills`, `total_skills`, `total_swaps`) with accurate counts matching fixture data.
2. **`TestAdminUsers`**:
   - `test_list_users_pagination_search_filter`: Verifies pagination (`page`, `per_page`), text search (`search`), and status filtering (`active`, `banned`, `all`).
   - `test_ban_and_unban_user_happy_path`: Verifies banning and unbanning a user toggles `is_banned` and returns success.
   - `test_ban_user_double_ban_conflict`: Verifies 409 conflict when attempting to ban an already-banned user.
   - `test_unban_user_not_banned_conflict`: Verifies 409 conflict when attempting to unban an unbanned user.
   - `test_ban_unban_nonexistent_user_404`: Verifies 404 for missing `user_id`.
3. **`TestAdminSkills`**:
   - `test_list_skills_pagination_search_filter`: Verifies pagination, search, and status filtering (`pending`, `approved`, `rejected`).
   - `test_approve_skill_happy_path`: Verifies approving a pending skill transitions status to `approved`.
   - `test_approve_skill_double_approve_conflict`: Verifies 409 conflict when approving an already-approved skill.
   - `test_approve_skill_not_found_404`: Verifies 404 for nonexistent skill ID.
   - `test_reject_skill_happy_path`: Verifies rejecting a skill transitions status to `rejected`.
   - `test_reject_skill_double_reject_conflict`: Verifies 409 conflict when rejecting an already-rejected skill.
   - `test_reject_skill_not_found_404`: Verifies 404 for nonexistent skill ID.
4. **`TestAdminSwaps`**:
   - `test_list_swaps_pagination_and_status_filter`: Verifies pagination and status filtering on swaps.
   - `test_delete_swap_happy_path`: Verifies deleting a swap removes it from the database.
   - `test_delete_swap_not_found_404`: Verifies 404 for missing swap ID.
5. **`TestAdminFeedback`**:
   - `test_list_feedback`: Verifies feedback listing includes sender information.
   - `test_delete_feedback_happy_path`: Verifies deleting feedback removes the record.
   - `test_delete_feedback_not_found_404`: Verifies 404 for missing feedback ID.
6. **`TestAdminAnnouncements`**:
   - `test_send_announcement_validation_422`: Verifies 422 when title or message is missing.
   - `test_send_announcement_success`: Verifies broadcast announcement creation and 200 response.
7. **`TestAdminActivity`**:
   - `test_recent_activity_shape_and_order`: Verifies activity stream contains `type`, `data`, `timestamp` and is sorted in descending chronological order.
8. **`TestAdminIsolationBoundary`**:
   - `test_regular_user_blocked_from_all_admin_routes`: Verifies non-admin authenticated users receive 403 on all 13 admin endpoints.
   - `test_admin_blocked_from_users_bp`: Verifies admin sessions receive 403 on `users_bp` routes (`GET /api/users`).
   - `test_regular_user_allowed_on_users_bp`: Verifies regular users are allowed (200) on `GET /api/users`.

---

### 2. Test Suite & Verification Results

- **Test Count Before Pass 3**: 110 passed.
- **Test Count After Pass 3**: 137 passed (100% pass rate).
- **New Tests Added**: 27 tests in `backend/tests/test_admin.py`.
- **Pre-existing Test Changes**: None (0 modified).

## [Pass 4] â€” Schema Migration Analysis & Production Boot-Time Hardening
**Date**: 2026-09-27  
**Scope**: Schema Management (`backend/app/__init__.py`, `backend/upgrade_db.py`, `backend/migrations/`) & Test Suite Verification  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

#### 1.1 Live Schema Inspection & Migration Generation
- **Command Run**: `flask db migrate -m "sync schema with current models"` (against dev/live database environment).
- **Inspection Finding**:
  - The live database schema already contains all 13 application tables (`users`, `admins`, `skills`, `user_skills`, `swap_requests`, `feedback`, `chat_messages`, `availability`, `match_scores`, `verified_badges`, `scheduled_sessions`, `follows`, and `alembic_version`).
  - The `users` table already contains the historical fields added by `upgrade_db.py` (`linkedin_id`, `github_id`, `instagram_id`, `dob`, `swap_id`, `swap_username`).
  - Live `alembic_version` table is stamped with base revision `857680aec0f0`.
  - Result: Alembic reported `INFO [alembic.env] No changes in schema detected.` â€” the schema is a true no-op (zero drift between live tables and SQLAlchemy models).
  - Consistent with instructions, `flask db upgrade` was **not** run.

#### 1.2 Production Boot-Time Safeguard in `app/__init__.py`
- **File**: `backend/app/__init__.py`
- **Changes**:
  - Replaced unconditional startup `db.create_all()` with:
    ```python
    # â”€â”€ Auto-create tables (non-production only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # Production schema changes must go through `flask db migrate` + `flask db upgrade`
    # exclusively from now on, never through create_all() or an ad hoc script.
    if os.environ.get("FLASK_ENV") != "production":
        with app.app_context():
            import sys as _sys
            try:
                db.create_all()
            except Exception as _e:
                print(f"[startup] db.create_all failed: {_e}", file=_sys.stderr)
    ```
  - Prevents accidental `create_all()` executions in production, ensuring future schema migrations follow controlled Alembic workflows.

#### 1.3 Historical Script Deprecation Notice in `upgrade_db.py`
- **File**: `backend/upgrade_db.py`
- **Changes**:
  - Retained the script for historical reference while adding an explicit top-level header comment:
    ```python
    # =============================================================================
    # HISTORICAL MIGRATION SCRIPT â€” DO NOT RUN
    # =============================================================================
    # This was a one-time historical upgrade script that has already been applied
    # to the live database (adding user social fields, swap_id, and swap_username).
    #
    # Going forward, all schema changes must be managed exclusively through Alembic
    # migrations (`flask db migrate` + `flask db upgrade`). Do not execute this
    # script directly.
    # =============================================================================
    ```

---

### 2. Test Suite & Verification Results

- **Test Suite Impact**: None. Tests execute with `FLASK_ENV=testing` and instantiate an in-memory SQLite database via `create_all()` in `conftest.py`, which is completely unaffected by the `!= "production"` guard.
- **Pytest Output**: 137 passed, 0 failed (100% pass rate).

---

## [Pass 5] â€” Socket.IO Async Mode Harmonization & Gemini Compatibility Audit
**Date**: 2026-09-27  
**Scope**: Server Concurrency Architecture (`backend/app/__init__.py`), Gemini SDK Audit (`backend/app/utils/gemini_match.py`), Test Suite Verification  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

#### 1.1 Gemini Model & SDK Compatibility Investigation
- **Context**: `backend/requirements.txt` pins `google-generativeai==0.5.4` while `backend/app/utils/gemini_match.py` uses model string `"gemini-2.0-flash"`.
- **Findings**:
  - `google-generativeai==0.5.4` was released on May 16, 2024.
  - `gemini-2.0-flash` was launched in Feb 2025 and officially retired on June 1, 2026.
  - While SDK 0.5.4 does not validate model names locally, requests sent to Google's API endpoint fail with 404/400 (model retired).
  - Exception handling in `_call_gemini` catches this error, logs it to `sys.stderr`, and returns fallback `(50, "AI matching is temporarily unavailable")`.
  - Solutions proposed: Update model string to active model (`gemini-2.5-flash` or `gemini-1.5-flash`) or migrate to the official `google-genai` SDK.

#### 1.2 Socket.IO Async Mode Configuration
- **Context**: `render.yaml` runs Gunicorn with `-k geventwebsocket.gunicorn.workers.GeventWebSocketWorker`. However, `backend/app/__init__.py` previously hardcoded `async_mode="threading"`.
- **Changes in `backend/app/__init__.py`**:
  - Dynamically select `"gevent"` async mode when deployed in production and `gevent` is available, while defaulting to `"threading"` in development and test environments:
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
- **Verification**:
  - `tests/test_socket.py` passed 100% (28/28).
  - Local execution via `python run.py` booted cleanly and responded to `/health`.
  - Noted transport caveat: in-memory `test_client` does not fully simulate browser-level WebSocket transport headers; live deployment verification is recommended.

---

### 2. Test Suite & Verification Results

- **Pytest Output**: 137 passed, 0 failed (100% pass rate in 74.5s).
- **Report Created**: `backend/BACKEND_FIX_REPORT.md` generated with full engineering findings.

---

## [Pass 6] â€” Socket.IO Swap Status Verification & Parity Enforcement
**Date**: 2026-09-27  
**Scope**: Backend Socket Events (`backend/app/socket_events.py`) & Socket Test Suite (`backend/tests/test_socket.py`)  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

#### 1.1 Socket.IO Swap Status Enforcement
- **File**: `backend/app/socket_events.py`
- **Issue**:
  - The REST endpoint `POST /api/swaps/<swap_id>/messages` strictly checks `if swap.status != "accepted": return jsonify({"error": "Chat is only available for accepted swaps"}), 400`.
  - The Socket.IO event handlers `handle_send_message`, `handle_typing`, and `handle_stopped_typing` previously only checked that the user was a participant (`swap.sender_id != user_id and swap.receiver_id != user_id`), failing to verify `swap.status == "accepted"`.
  - As a result, users could send messages and typing indicators on swaps that were pending, cancelled, or rejected.
- **Changes**:
  - In `handle_send_message`, added status verification immediately after the participant check:
    ```python
    if swap.status != "accepted":
        socketio.emit("error", {"message": "Chat is only available for accepted swaps"}, room=f"user_{user_id}")
        return
    ```
  - In `handle_typing` and `handle_stopped_typing`, added silent return if `swap.status != "accepted"`:
    ```python
    if swap.status != "accepted":
        return
    ```

#### 1.2 Test Suite Updates & Regression Testing
- **File**: `backend/tests/test_socket.py`
- **Fixture Addition**:
  - Added `accepted_swap` fixture that accepts `alice_bob_swap` via Bob, drains handshake/system events, and restores Alice's session.
- **Pre-existing Test Adjustments (asserting buggy behavior)**:
  - `test_send_message_via_socket`: Updated fixture dependency from `alice_bob_swap` (which was pending) to `accepted_swap` so that chat happy-path is tested on an accepted swap.
  - `test_send_message_persists`: Updated fixture dependency from `alice_bob_swap` to `accepted_swap`.
  - `test_message_rate_limiting`: Updated fixture dependency from `alice_bob_swap` to `accepted_swap`.
  - `test_typing_relayed`: Updated fixture dependency from `alice_bob_swap` to `accepted_swap`.
  - `test_stopped_typing_relayed`: Updated fixture dependency from `alice_bob_swap` to `accepted_swap`.
- **New Regression Tests Added**:
  - `test_send_message_on_pending_swap_rejected`: Verifies emitting `send_message` on a pending swap creates 0 `ChatMessage` records, emits `error` with `"Chat is only available for accepted swaps"`, and partner receives no `new_message`.
  - `test_send_message_on_rejected_swap_rejected`: Verifies emitting `send_message` on a rejected swap creates 0 `ChatMessage` records and emits error.
  - `test_typing_on_pending_swap_ignored`: Verifies typing and stopped_typing events on pending swaps are silently dropped without being relayed.

---

### 2. Test Suite & Verification Results

- **Test Count Before Pass 6**: 137 passed.
- **Test Count After Pass 6**: 140 passed (100% pass rate).
- **Socket Suite Output**: 31 passed, 0 failed in `tests/test_socket.py`.
- **Full Suite Output**: 140 passed, 0 failed across entire backend test suite in 33.7s.

---

## [Pass 7] â€” Gemini AI Matching Skill Moderation Enforcement
**Date**: 2026-09-27  
**Scope**: Backend Gemini Match Utility (`backend/app/utils/gemini_match.py`) & Tests (`backend/tests/test_differentiators.py`)  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

#### 1.1 Skill Moderation Filter in `compute_match`
- **File**: `backend/app/utils/gemini_match.py`
- **Issue**:
  - `compute_match()` queried `UserSkill` directly (`filter_by(user_id=..., type=...)`) without checking `Skill.status == "approved"`.
  - Consequently, unapproved (pending or rejected) skills were sent in the prompt to Gemini, leaking private/unapproved skills and allowing them to factor into the match score and generated explanation text.
- **Changes**:
  - Imported `Skill` from `app.models.skill`.
  - Updated all four queries (`a_offered`, `a_wanted`, `b_offered`, `b_wanted`) to join `Skill` and filter `Skill.status == "approved"`, matching the pattern in `routes/users.py`'s `get_user`:
    ```python
    a_offered = (
        UserSkill.query
        .join(Skill)
        .filter(UserSkill.user_id == user_a_id, UserSkill.type == "offered", Skill.status == "approved")
        .all()
    )
    a_wanted = (
        UserSkill.query
        .join(Skill)
        .filter(UserSkill.user_id == user_a_id, UserSkill.type == "wanted", Skill.status == "approved")
        .all()
    )
    b_offered = (
        UserSkill.query
        .join(Skill)
        .filter(UserSkill.user_id == user_b_id, UserSkill.type == "offered", Skill.status == "approved")
        .all()
    )
    b_wanted = (
        UserSkill.query
        .join(Skill)
        .filter(UserSkill.user_id == user_b_id, UserSkill.type == "wanted", Skill.status == "approved")
        .all()
    )
    ```

#### 1.2 Regression Test Added
- **File**: `backend/tests/test_differentiators.py` (`TestMatchScore`)
- **Test**: `test_pending_skill_excluded_from_match_prompt`
  - Created two users where Alice offers a pending skill (`"SecretHacking"`) and Bob wants `"SecretHacking"`, which would otherwise create a reciprocal match.
  - Mocked the Gemini model API.
  - Inspected `mock_model.generate_content.call_args[0][0]` directly to assert that the prompt string constructed server-side does not contain `"SecretHacking"`, while still including legitimate approved skills (`"Python"`, `"Guitar"`).

---

### 2. Test Suite & Verification Results

- **Test Count Before Pass 7**: 140 passed.
- **Test Count After Pass 7**: 141 passed (100% pass rate).
- **Modified Pre-existing Tests**: None.
- **Full Pytest Suite**: 141 passed in 47.8s.

#### 1.3 Post-Fix Cache Purge (One-Time Operational Step)
- **Target**: `match_scores` table in live Neon PostgreSQL database.
- **Rationale**: Any `MatchScore` records computed prior to the fix had stale, unfiltered reason strings cached with a 7-day TTL. To prevent those records from continuing to be served, the cache was purged.
- **Execution Output**:
  - Rows before purge: 29
  - Rows deleted: 29
  - Rows remaining: 0
- **Outcome**: Future match requests will immediately recompute match scores and explanation texts using the updated query that filters strictly for `Skill.status == "approved"`.

---

## [Pass 8] â€” Socket.IO In-Memory State Cleanup on Disconnect
**Date**: 2026-09-27  
**Scope**: Backend Socket Events (`backend/app/socket_events.py`) & Tests (`backend/tests/test_socket.py`)  
**Status**: Completed & Verified (100% Pass)

### 1. Objectives & Implementation Summary

#### 1.1 Memory Leak Remediation in `handle_disconnect`
- **File**: `backend/app/socket_events.py`
- **Issue**:
  - The module-level dicts `_message_rate_limit` and `_typing_throttle` are keyed by `user_id`.
  - While entries were pruned on incoming message checks, disconnected users were never popped from the dictionaries, causing keys to accumulate monotonically over a worker's lifetime.
- **Changes**:
  - In `handle_disconnect`, popped the disconnecting user's entries from both dictionaries after emitting the `user_offline` event:
    ```python
    @socketio.on("disconnect")
    def handle_disconnect():
        """Notify other users about disconnection."""
        user_id = flask_session.get("socket_user_id")
        if user_id:
            socketio.emit("user_offline", {
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }, include_self=False)
            _message_rate_limit.pop(user_id, None)
            _typing_throttle.pop(user_id, None)
    ```

#### 1.2 Regression Test Added
- **File**: `backend/tests/test_socket.py` (`TestSocketConnection`)
- **Test**: `test_disconnect_cleans_up_rate_limit_and_throttle`
  - Connected Alice, sent a message and typing event (populating both `_message_rate_limit` and `_typing_throttle` with Alice's `user_id`).
  - Disconnected Alice.
  - Asserted that `alice_id not in _message_rate_limit` and `alice_id not in _typing_throttle`.

---

### 2. Test Suite & Verification Results

- **Test Count Before Pass 8**: 141 passed.
- **Test Count After Pass 8**: 142 passed (100% pass rate).
- **Socket Suite Output**: 32 passed, 0 failed in `tests/test_socket.py`.
- **Full Pytest Suite**: 142 passed in 47.8s.


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



---

## [Phase 1 & 2] ?" Frontend SaaS Dashboard Redesign
**Date**: 2026-09-28  
**Scope**: Frontend CSS (index.css), Global Layout (AppShell.tsx), and Pages/Components  
**Status**: Completed & Verified (0 TS Errors, Successful Build)

### 1. Objectives & Implementation Summary

#### 1.1 CSS Token System & Glassmorphism Removal
- **File**: rontend/src/index.css
- **Changes**:
  - Removed heavily nested ackdrop-filter: blur(...) effects from .glass-panel and .glass-card.
  - Implemented a clear 3-tier solid surface hierarchy matching standard SaaS dashboards:
    - --color-bg-app: App background (deepest plane).
    - --color-surface: Distinct solid sidebar/nav surface.
    - --color-surface-alt: Card surface distinct from nav and background.
  - Refactored .btn-purple, .btn-white, and .btn-glass to be clean and solid without internal shadows, ensuring all buttons in the app natively inherit the new aesthetic without modifying their API or props.

#### 1.2 Layout Standardization (AppShell)
- **Files**: rontend/src/components/layout/AppShell.tsx, rontend/src/pages/*.tsx
- **Changes**:
  - Created a single, reusable <AppShell> master layout component.
  - Replaced the repetitive, hand-rolled <div className="flex h-screen..."><Sidebar /><main>...</main></div> markup across all 16 routed pages with <AppShell>.
  - Fixed multiple opportunistic layout bugs in the process (e.g., duplicated paddings like gap-6 p-6 in Profile.tsx, truncated utility classes like -alt in AdminDashboard.tsx and Messages.tsx, and a double-space missing background class in Settings.tsx).

#### 1.3 Loading Skeletons & Radix UI Primitives
- **Files**: rontend/src/components/ui/skeleton.tsx, 	oaster.tsx, dialog.tsx, Various Pages
- **Changes**:
  - **Skeletons**: Replaced layout-shifting raw text returns (if (isLoading) return <p>Loading...</p>) across all core pages (Dashboard, Profile, Settings, etc.) with structurally accurate <Skeleton> placeholder blocks matching the incoming UI shapes.
  - **Toasts**: Set up a Radix-powered <Toaster> at the root of App.tsx and migrated the native lert() success banner in SwapRequestModal.tsx to use the non-blocking useToast hook.
  - **Dialogs**: Replaced the blocking window.confirm() flow for Account Deletion in Settings.tsx with a refined Radix <Dialog> modal.

#### 1.4 Refined Dashboard & Inline Components
- **Files**: Dashboard.tsx, SkillSection.tsx, SchedulePicker.tsx, SkillHeatmap.tsx
- **Changes**:
  - Replaced manually coded dashboard metric cards with the newly abstracted <StatCard> component.
  - Stripped legacy blurry classes (glass-pill, glass-input) from inline components like SkillSection and SchedulePicker, mapping them directly to solid g-surface-alt and g-surface border configurations.
  - Adjusted the heatmap's grid stroke color to a subtler 10% white for dark mode cohesion.
  - Re-themed the warning tokens in SwapRequestModal.tsx for proper dark-theme contrast.

### 2. Verification Results
- Executed 
pm install to finalize Radix dependencies.
- Ran 
px tsc --noEmit and 
pm run build, successfully clearing all intermediary syntax/fragment issues.
- **Result**: Frontend builds flawlessly in ~450ms with **0 TypeScript Errors**, matching all visual requirements while fully preserving functional mutation boundaries.
