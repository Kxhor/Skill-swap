# Backend Security & Correctness Audit Report

This audit was conducted by comprehensively reading every route, socket handler, model, utility, and test file in the `backend/` directory. The findings are separated into "Fix directly" (unambiguous bugs and leaks, which have been fixed) and "Flag only, do not fix" (schema changes, architectural decisions, and missing test coverages that require feature additions).

## 🟢 Fix Directly (Applied)

### 1. Raw Exception Leak in Cloudinary Delete Utility
- **Severity**: High
- **Confidence**: 100%
- **Location**: `backend/app/utils/cloudinary_upload.py` (`delete_photo`)
- **Issue**: The `delete_photo` utility caught `Exception as e` and returned `str(e)` directly. If this return value were ever passed directly to a client JSON response, it would expose internal Cloudinary API errors, hostnames, or stack traces.
- **Impact**: Information disclosure (stack trace / internal infrastructure leak).
- **Resolution**: Replaced the raw exception string with a generic `"Failed to delete photo. Please try again."` message and logged the actual error internally via `print()`, matching the safe pattern already used in `upload_photo`.

### 2. Unapproved Skills Leaked via Community Stats
- **Severity**: Medium
- **Confidence**: 100%
- **Location**: `backend/app/routes/users.py` (`community_stats`)
- **Issue**: The public `/stats/community` route aggregated top skills but did not filter by `Skill.status == "approved"`.
- **Impact**: A user's pending or rejected skills (which are supposed to be private to them and admins) would be factored into the public community statistics and could have their names leaked on the public dashboard.
- **Resolution**: Added `.filter(Skill.status == "approved")` to the `skills_offered` query to strictly enforce the privacy boundary across all endpoints.

### 3. Unbounded Pagination on Chat Messages Endpoint
- **Severity**: Medium
- **Confidence**: 100%
- **Location**: `backend/app/routes/swaps.py` (`get_messages`)
- **Issue**: The `per_page` query parameter was cast to `int` but not capped, unlike every other paginated endpoint in the system.
- **Impact**: An attacker could pass `?per_page=1000000` and force the server to allocate massive amounts of memory loading the entire message history for a swap in a single query, leading to Denial of Service (OOM) for the worker.
- **Resolution**: Added a `min(..., 100)` cap to the `per_page` argument.

### 4. Double Commit / Partial State Failure in Swap Transitions
- **Severity**: Medium
- **Confidence**: 100%
- **Location**: `backend/app/routes/swaps.py` (`accept_swap`, `complete_swap`)
- **Issue**: After performing an atomic `db.update()` for the swap status, the code called `db.session.commit()`, then instantiated a system `ChatMessage`, and called `db.session.commit()` again.
- **Impact**: If the application crashed or the database dropped connection between the two commits, the swap would be left in an accepted/completed state *without* the requisite system message, violating expected state.
- **Resolution**: Removed the intermediate commit and unnecessary DB refetch (`SwapRequest.query.get()`), combining the status update and message insertion into a single atomic transaction. (Also cleaned up unnecessary DB refetches in `reject_swap` and `cancel_swap`).

## 🟡 Flag Only, Do Not Fix (Business / Architecture Decisions)

### 5. Missing Database-Level Unique Constraints
- **Severity**: Low
- **Confidence**: 100%
- **Location**: `backend/app/models/*.py`
- **Issue**: Several core models lack database-level unique constraints, relying instead on application-level read-then-write checks which are vulnerable to race conditions:
  - `Skill.name` is not unique. Concurrent creations of "Python" can result in duplicate skill records.
  - `UserSkill` lacks a composite unique constraint on `(user_id, skill_id, type)`.
  - `MatchScore` lacks a composite unique constraint on `(user_a_id, user_b_id)`.
  - `Feedback` lacks a composite unique constraint on `(swap_id, rater_id)`.
- **Impact**: Concurrent requests can create duplicate data, fracturing community stats or causing UI/logic bugs. 
- **Recommendation**: Add composite `UniqueConstraint` definitions to the SQLAlchemy models. This was not applied because it requires a schema migration strategy, violating the rule against altering API responses or schema structure without explicit instruction.

### 6. Read-Then-Write Integrity Errors Return 500s
- **Severity**: Low
- **Confidence**: 100%
- **Location**: `backend/app/routes/users.py` (`follow_user`), `backend/app/routes/auth.py` (`register`)
- **Issue**: Endpoints like user registration and follow-request creation check for existence, then insert. Because `User.email` and `Follow` (composite PK) have DB-level uniqueness, a race condition will throw a SQLAlchemy `IntegrityError`.
- **Impact**: Since the application does not explicitly catch `IntegrityError`, a race condition will result in a generic `500 Internal Server Error` instead of a graceful `409 Conflict`.
- **Recommendation**: Wrap inserts in `try/except IntegrityError` and return 409, or use `INSERT ... ON CONFLICT DO NOTHING`.

### 7. Socket `join` Allows Arbitrary Room Names
- **Severity**: Low
- **Confidence**: 100%
- **Location**: `backend/app/socket_events.py` (`handle_join`)
- **Issue**: The handler correctly gates `user_...` and `swap_...` rooms to authorized participants, but falls through to `socketio.server.enter_room(request.sid, room)` for *any* other room string.
- **Impact**: A client can subscribe to arbitrary non-standard rooms. Currently safe because the application only emits to `user_` and `swap_` rooms, but could become a vulnerability if new room patterns are introduced without adding them to the gate.

### 8. Missing Error-Path Test Coverage
- **Severity**: Low
- **Confidence**: 100%
- **Location**: `backend/tests/test_swaps.py`, `backend/tests/test_socket.py`
- **Issue**: The test suite covers happy paths excellently (142 passing tests) but misses some negative REST authorization paths:
  - No test verifying a third-party non-participant is blocked from accepting, rejecting, or completing a swap via REST.
  - No test verifying out-of-range feedback ratings (e.g., `rating=6`) are properly rejected.
  - No test verifying the `_typing_throttle` actually suppresses excess typing events over the socket (only the memory cleanup on disconnect is tested).

---
**Test Execution Results:**
Run of `pytest backend/tests` completed with **142 tests passing** and 0 failures.
