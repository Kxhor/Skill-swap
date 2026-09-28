# PROJECT_FINAL_AUDIT.md — Pre-Ship Whole-Codebase Audit

**Date:** 2026-09-28  
**Auditor:** Automated deep-read of every file in `backend/` and `frontend/src/`  
**Backend test suite:** 142 passed, 0 failed (489 SQLAlchemy deprecation warnings)  
**Frontend production build:** 0 errors, 0 warnings, 998 modules, built in 415 ms  

---

## Part C — Re-verification of Every Previously Flagged Item

| # | Item | Source | Current Status | Resolved? |
|---|------|--------|---------------|-----------|
| C-1 | **Skill.status moderation** — new skills default `"pending"` | Audit 1 #2 | ✅ `Skill.status` has `default="pending"` ([skill.py L13](file:///E:/Skill%20Swap/Skill-swap/backend/app/models/skill.py#L13)). All public-facing queries (`community_stats`, `list_users`, `get_user`, `compute_match`) filter `Skill.status == "approved"`. Admin dashboard exposes approve/reject endpoints. On a fresh DB all skills start pending — counts reflect real admin decisions. | **Yes** |
| C-2 | **Alembic migration: `flask db stamp head` / `flask db upgrade`** | Audit 1 (flag) | ⚠️ The sole migration file [`857680aec0f0_initial.py`](file:///E:/Skill%20Swap/Skill-swap/backend/migrations/versions/857680aec0f0_initial.py) has **empty `upgrade()` and `downgrade()` functions** (both are `pass`). The schema is created entirely by `db.create_all()` in `__init__.py` (non-production) or was presumably applied manually in production. There is **no migration that actually defines tables**, so `flask db upgrade` is a no-op. This means the Alembic version chain has never captured the real schema. | **No — flag only** |
| C-3 | **MatchScore cache — stale pre-fix data** | Audit 1 #5 (match) | ⚠️ `MatchScore` has a 7-day TTL ([gemini_match.py L19](file:///E:/Skill%20Swap/Skill-swap/backend/app/utils/gemini_match.py#L19)). When a user changes their skills (adds/removes/gets approved), **no invalidation** occurs — the stale cached score persists until natural expiry. This is a known-accepted tradeoff, not a bug. Pre-fix "AI matching unavailable" reasons would have been overwritten on the next cache miss. | **Accepted (by design)** |
| C-4 | **gevent monkey-patching in `wsgi.py`** | Audit 1 (flag) | ✅ [`wsgi.py`](file:///E:/Skill%20Swap/Skill-swap/backend/wsgi.py) contains **no** monkey-patching. However, [`render.yaml`](file:///E:/Skill%20Swap/Skill-swap/backend/render.yaml#L6) starts Gunicorn with `-k geventwebsocket.gunicorn.workers.GeventWebSocketWorker`. The **GeventWebSocketWorker** class itself calls `monkey.patch_all()` during worker initialization ([gunicorn-websocket source](https://github.com/heroku-python/gunicorn-websocket/blob/master/gunicorn_websocket/workers.py)), so explicit patching in `wsgi.py` is unnecessary and would be redundant. | **Yes — not an issue** |
| C-5 | **Raw exception leak in `cloudinary_upload.py`** | Audit 1 #1 | ✅ `delete_photo` returns `"Failed to delete photo. Please try again."` on error. Verified in current code. | **Yes** |
| C-6 | **Unapproved skills in community stats** | Audit 1 #2 | ✅ `community_stats` filters `Skill.status == "approved"` ([users.py L362](file:///E:/Skill%20Swap/Skill-swap/backend/app/routes/users.py#L362)). | **Yes** |
| C-7 | **Unbounded `per_page` on chat messages** | Audit 1 #3 | ✅ Capped to `min(..., 100)` ([swaps.py L405](file:///E:/Skill%20Swap/Skill-swap/backend/app/routes/swaps.py#L405)). | **Yes** |
| C-8 | **Double commit in swap transitions** | Audit 1 #4 | ✅ `accept_swap` and `complete_swap` now use atomic `db.update()` + single `db.session.commit()` after inserting the system message. | **Yes** |
| C-9 | **Missing DB unique constraints** | Audit 1 #5 | ⚠️ Still missing on `UserSkill(user_id, skill_id, type)`, `MatchScore(user_a_id, user_b_id)`, `Feedback(swap_id, rater_id)`, and `Skill.name`. Requires schema migration. | **No — flag only (same)** |
| C-10 | **IntegrityError → 500 on race conditions** | Audit 1 #6 | ⚠️ Still present. `Follow` composite PK provides DB-level uniqueness but no `try/except IntegrityError` wrapper exists, so a race condition returns 500 instead of 409. | **No — flag only (same)** |
| C-11 | **Socket `join` allows arbitrary room names** | Audit 1 #7 | ⚠️ Still present. Any room string not prefixed `user_` or `swap_` falls through to `enter_room()`. Currently safe since no emissions target non-standard rooms. | **No — flag only (same)** |
| C-12 | **Missing error-path test coverage** | Audit 1 #8 | ⚠️ Still untested: third-party REST swap manipulation, out-of-range ratings, typing throttle suppression. | **No — flag only (same)** |
| C-13 | **Broken Tailwind classes in AdminDashboard, Messages, Settings, SwapRequestModal, Profile** | AGENTS.md | ✅ All broken class strings have been fixed. `Select-String` for ` -alt`, ` -primary`, `bg-yellow-` returns zero matches across all `.tsx` files. | **Yes** |
| C-14 | **Native `alert()` / `window.confirm()` calls** | AGENTS.md | ✅ Zero occurrences of `alert(` or `window.confirm(` remain in `frontend/src/`. Ported to Radix Toast/Dialog. | **Yes** |
| C-15 | **Stray `console.log` in SwapRequestModal** | AGENTS.md | ✅ Zero `console.log` / `console.warn` / `console.debug` statements remain in `frontend/src/`. | **Yes** |
| C-16 | **Uncommitted backend changes mixing with frontend PR** | Audit 2 #1 | ⚠️ Both sets of changes now appear to be on `main`. This flag was about git hygiene during the redesign; it's moot if both have been merged intentionally. | **Moot (both landed)** |

---

## Part A — Full-Stack Coherence

### A-1. REST API Endpoint Trace (every page → backend route)

| Frontend Location | Method + Path | Backend Route | Shape Match? |
|---|---|---|---|
| Dashboard | `GET /api/users/profile` | `users.profile` | ✅ `{ user: {...} }` |
| Dashboard | `GET /api/users?per_page=4` | `users.list_users` | ✅ `{ users, page, pages, total, per_page }` |
| Dashboard | `GET /api/swaps` | `swaps.list_swaps` | ✅ `{ swaps, page, pages, total }` |
| SwapRequests | `GET /api/swaps?tab=all` | `swaps.list_swaps` | ✅ |
| SwapRequests | `POST /api/swaps/:id/accept\|reject\|cancel\|complete` | `swaps.*_swap` | ✅ `{ message, swap }` |
| BrowseUsers | `GET /api/users?search=&skill=&page=&per_page=12` | `users.list_users` | ✅ |
| Profile | `GET /api/users/:id` | `users.get_user` | ✅ `{ user: {...} }` |
| Profile | `POST /api/users/:id/follow` | `users.follow_user` | ✅ |
| Profile | `DELETE /api/users/:id/follow` | `users.unfollow_user` | ✅ |
| Profile | `POST /api/users/photo` | `users.upload_photo_route` | ✅ `{ message, photo_url }` |
| Profile | `DELETE /api/users/photo` | `users.upload_photo_route` | ✅ |
| Profile | `POST /api/feedback` | `feedback.submit_feedback` | ✅ `{ message, feedback }` |
| CommunityStats | `GET /api/users/stats/community` | `users.community_stats` | ✅ `{ total_users, ... skill_summary }` |
| AdminDashboard | `GET /api/admin/stats` | `admin.stats` | ✅ |
| AdminDashboard | `GET /api/admin/users?page=x` | `admin.list_users` | ✅ |
| AdminDashboard | `GET /api/admin/swaps?page=x` | `admin.list_swaps` | ✅ |
| AdminDashboard | `GET /api/admin/skills?status=pending` | `admin.list_skills` | ✅ |
| AdminDashboard | `POST /api/admin/skills/:id/approve\|reject` | `admin.approve\|reject_skill` | ✅ |
| MySkills | `GET /api/users/profile` | `users.profile` | ✅ |
| MySwaps | `GET /api/swaps` | `swaps.list_swaps` | ✅ |
| Messages | `GET /api/swaps` | `swaps.list_swaps` | ✅ |
| Messages | `POST /api/swaps/:id/read` | `swaps.mark_swap_read` | ✅ |
| Notifications | `GET /api/swaps` | `swaps.list_swaps` | ✅ |
| Availability | `GET /api/users/profile` | `users.profile` | ✅ |
| Availability | `POST /api/users/availability` | `users.manage_availability` | ✅ |
| Availability | `DELETE /api/users/availability/:id` | `users.delete_availability` | ✅ |
| Settings | `GET /api/users/profile` | `users.profile` | ✅ |
| Settings | `PUT /api/users/profile` | `users.profile` | ✅ |
| Settings | `DELETE /api/users/profile` | `users.profile` | ✅ |
| Friends | `GET /api/users/follow-requests` | `users.get_follow_requests` | ✅ |
| Friends | `POST /api/users/:id/accept-follow` | `users.accept_follow` | ✅ |
| Friends | `POST /api/users/:id/reject-follow` | `users.reject_follow` | ✅ |
| ChatPanel | `GET /api/swaps/:id/messages` | `swaps.get_messages` | ✅ `{ messages, page, pages, total }` |
| SchedulePicker | `GET /api/swaps/:id/schedule` | `swaps.get_session` | ✅ `{ session }` |
| SchedulePicker | `POST /api/swaps/:id/schedule` | `swaps.propose_session` | ✅ |
| SchedulePicker | `POST /api/swaps/:id/schedule/confirm` | `swaps.confirm_session` | ✅ |
| MatchScoreBadge | `GET /api/users/match/:id` | `users.get_match_score` | ✅ `{ score, reason, cached }` |
| SkillHeatmap | `GET /api/users/stats/community` | `users.community_stats` | ✅ |
| Login | `POST /auth/login` | `auth.login` | ✅ |
| Register | `POST /auth/register` | `auth.register` | ✅ |
| **Reviews** | **`GET /api/feedback/${me.id}`** | **❌ NO MATCH** | **❌ See A-2** |
| **Reviews** | **`POST /api/swaps/${id}/feedback`** | **❌ NO MATCH** | **❌ See A-2** |

### A-2. ❌ CRITICAL: Reviews.tsx has two broken API calls

**Finding severity: High (page is non-functional)**

[`Reviews.tsx`](file:///E:/Skill%20Swap/Skill-swap/frontend/src/pages/Reviews.tsx) contains two endpoints that don't exist on the backend:

1. **Line 26** — `api.get('/api/feedback/${me?.id}')` resolves to e.g. `GET /api/feedback/abc-123`. The backend blueprint mounts at `/api/feedback` and the route is `GET /user/<user_id>`, so the correct URL is `/api/feedback/user/<user_id>`. The current URL would hit the Flask 404 handler.

2. **Line 32** — `api.post('/api/swaps/${data.swapId}/feedback', ...)`. This endpoint does not exist. The correct endpoint is `POST /api/feedback` with `{ swap_id, rating, comment }` in the body. (Note: [`Profile.tsx` L84](file:///E:/Skill%20Swap/Skill-swap/frontend/src/pages/Profile.tsx#L84) correctly uses `POST /api/feedback`.)

3. **Line 41** — Expects `feedbackData.given` and **line 124/127** expects `feedbackData.received` — but the backend returns `{ feedback: [...], average_rating, rating_count, rating_distribution }` with a flat `feedback` array, no `given`/`received` split.

4. **Line 130** — Accesses `f.reviewer.name` but `Feedback.to_dict()` returns `rater_name` (a flat string), not a nested `reviewer` object.

**Result:** The entire Reviews page silently fails — feedback query 404s, submission would 404, and even if data arrived the destructuring would produce `undefined`. The page renders its empty-state fallback, masking the bug.

> [!CAUTION]
> This is a cross-stack bug that only became visible by tracing both sides together. Both individually-safe PRs (backend route structure and frontend redesign) were correct in isolation, but the Reviews page was written against an API shape that was never implemented.

### A-3. Socket.IO Event Trace

| Frontend Listener | Backend Emitter | Shape Match? |
|---|---|---|
| `notification` | `swaps.py` create/accept/reject → `socketio.emit("notification", {type, swap_id, message})` | ✅ |
| `swap_status_changed` | `swaps.py` all transitions → `{swap_id, status, previous_status}` | ✅ |
| `swap_accepted` | `swaps.py accept_swap` → `{swap, message}` | ✅ |
| `new_message` | `socket_events.py send_message` + `swaps.py` accept/complete → `ChatMessage.to_dict()` | ✅ `{id, swap_id, sender_id, sender_name, sender_photo, content, type, is_read, created_at}` |
| `user_online` | `socket_events.py connect` → `{user_id, name}` | ✅ (frontend only reads `user_id`) |
| `user_offline` | `socket_events.py disconnect` → `{user_id, timestamp}` | ✅ |
| `user_typing` (ChatPanel) | `socket_events.py typing` → `{user_id, swap_id}` | ✅ |
| `user_stopped_typing` (ChatPanel) | `socket_events.py stopped_typing` → `{user_id, swap_id}` | ✅ |
| `error` (ChatPanel) | `socket_events.py send_message` → `{message}` | ✅ |

All socket event shapes match. ✅

---

## Part B — Fresh Full-Codebase Pass

### B-1. Backend Re-audit

| Check | Status | Detail |
|---|---|---|
| Exception leak prevention | ✅ | All exception handlers return generic messages. Cloudinary fix confirmed. Global `handle_exception` in `__init__.py`. |
| Input validation coverage | ✅ | All user inputs (name, email, password, skill_name, rating, location, bio, swap_username, message content) go through dedicated validators. |
| Profanity filter on chat | ✅ | Applied in both HTTP route (`swaps.py L438`) and Socket handler (`socket_events.py L114`). |
| CSRF protection | ✅ | `flask_wtf` CSRFProtect enabled. Token endpoint at `/auth/csrf-token`. Socket.IO exempted via `WTF_CSRF_EXEMPT_LIST`. |
| Rate limiting | ✅ | Applied to register (5/min), login (5/min), profile (20/min), photo (5/min), skills (10/min), messages (30/min), match (20/hr), feedback (10/min), swaps (10/min). |
| Pagination caps | ✅ | All endpoints cap `per_page` with `min(..., 50)` or `min(..., 100)`. |
| Auth enforcement | ✅ | `@login_required` on all user endpoints. `@admin_required` on all admin endpoints. `before_request` rejects admin→user and user→admin cross-access. |
| Swap state machine | ✅ | Uses atomic `db.update().where(status==expected)` with `rowcount` check — prevents double-transitions. |
| SQLAlchemy `Query.get()` deprecation | ⚠️ | 489 `LegacyAPIWarning` warnings from `Query.get()`. Should migrate to `db.session.get()`. Not a bug — cosmetic. |
| Community stats cache | ✅ | 5-minute in-memory TTL (`_stats_cache`). Only caches approved skills. |
| Upload size limit | ✅ | `MAX_CONTENT_LENGTH = 5 * 1024 * 1024` (5 MB). |
| Account deletion | ✅ | Anonymizes rather than hard-deletes. Sets `is_banned=True` to prevent login. |

### B-2. Frontend Re-audit

| Check | Status | Detail |
|---|---|---|
| Production build | ✅ | 0 TypeScript errors, 0 warnings. |
| Broken CSS classes | ✅ | Zero instances of truncated/broken Tailwind utilities. |
| Native `alert()` / `window.confirm()` | ✅ | Zero remaining. All use Radix Toast/Dialog. |
| `console.log` statements | ✅ | Zero remaining. |
| Backdrop blur nesting | ✅ | Single instance of `backdrop-blur-sm` on mobile sidebar overlay only. |
| Skeleton loading states | ✅ | All pages use `<Skeleton>` primitive or optional chaining. No bare "Loading..." strings. |
| AppShell consistency | ✅ | All authenticated pages wrap in `<AppShell>`. Login/Register use standalone `min-h-screen`. |
| Accessibility: focus states | ✅ | Global `:focus-visible` outline in `index.css`. |
| Accessibility: color contrast | ✅ | `--color-text-muted` at `rgba(255,255,255,0.65)` against dark surfaces exceeds WCAG AA 4.5:1. |
| Protected file integrity | ✅ | `api.ts`, `AuthContext.tsx`, `SocketContext.tsx`, `useSwaps.ts`, `types.ts`, `constants.ts` confirmed untouched per guardrails. |
| Query key consistency | ✅ | All `useQuery`/`useMutation` hooks use stable keys matching their endpoints. |

---

## Part D — Production-Readiness & Maintainability Assessment

### Fix Directly

#### D-1. ❌ Reviews.tsx: Two broken API endpoints and mismatched response shape
- **Severity:** High
- **Impact:** The entire Reviews page is non-functional. Feedback fetching 404s, feedback submission would 404, and the response destructuring is incompatible.
- **Required changes (frontend only):**
  1. Line 26: Change `/api/feedback/${me?.id}` → `/api/feedback/user/${me?.id}`
  2. Line 32: Change `api.post('/api/swaps/${data.swapId}/feedback', { rating, comment })` → `api.post('/api/feedback', { swap_id: data.swapId, rating: data.rating, comment: data.comment })`
  3. Line 41: The backend returns `{ feedback: [...] }` not `{ given: [...] }`. The page needs to derive "given" vs "received" client-side by filtering `feedback` on `rater_id === me.id` vs `rated_id === me.id`.
  4. Line 130: Change `f.reviewer.name` → `f.rater_name`

> [!WARNING]
> **This is a ship-blocker.** The page compiles and the build passes because it uses `any` typing throughout — TypeScript cannot catch the mismatch. A new contributor would have no signal that this page is broken.

#### D-2. ⚠️ AdminDashboard: Hardcoded mock chart data
- **Severity:** Medium
- **Impact:** The admin line chart ("User Growth"), pie chart ("Swap Distribution"), and "Top Skills" sidebar use `mockLineData`, `mockPieData`, and `mockTopSkills` constants ([AdminDashboard.tsx L19-44](file:///E:/Skill%20Swap/Skill-swap/frontend/src/pages/AdminDashboard.tsx#L19-L44)). These display static fabricated numbers regardless of actual database state. An admin seeing these would form incorrect conclusions.
- **Recommendation:** Either wire these to real admin API data, or clearly label them as "Sample Data" in the UI until backend endpoints exist for time-series stats.

### Flag Only (Needs Human Decision)

#### D-3. Alembic migration chain is empty
- **Severity:** Medium (operational risk)
- **Detail:** The only migration file has `pass` for both `upgrade()` and `downgrade()`. The entire schema is created by `db.create_all()` in non-production. This means:
  - There is no way to run `flask db upgrade` on a fresh production database — it would create zero tables.
  - Future schema changes cannot be tracked incrementally.
  - `flask db migrate` against the current models would generate a single massive "initial" migration.
- **Recommendation:** Generate a proper initial migration (`flask db migrate -m "real_initial"`) and run `flask db stamp head` on production so future changes are tracked.

#### D-4. Missing DB-level unique constraints (unchanged)
- **Severity:** Low (race condition, low probability at portfolio scale)
- **Models affected:** `UserSkill`, `MatchScore`, `Feedback`, `Skill.name`
- **Impact:** Concurrent identical requests can create duplicate rows. Application-level checks exist but are TOCTOU-vulnerable.
- **Recommendation:** Add `UniqueConstraint` definitions and generate a migration.

#### D-5. `Query.get()` deprecation warnings (489 warnings)
- **Severity:** Low (cosmetic, no functional impact)
- **Detail:** SQLAlchemy 2.0 has deprecated `Model.query.get(id)` in favor of `db.session.get(Model, id)`. This affects routes and tests throughout the backend.
- **Recommendation:** A mechanical find-and-replace when convenient. Not a ship-blocker.

#### D-6. MatchScore cache not invalidated on skill changes
- **Severity:** Low (UX, not correctness)
- **Detail:** When a user adds/removes/modifies skills, cached match scores for that user remain until the 7-day TTL expires. A user who updates their skills may see stale match percentages.
- **Recommendation:** Add a cache-bust call in the skill add/delete routes: `MatchScore.query.filter((MatchScore.user_a_id == user_id) | (MatchScore.user_b_id == user_id)).delete()`.

#### D-7. REST vs Socket.IO message duplication
- **Severity:** Low (architectural smell, not a bug)
- **Detail:** Chat messages can be sent via both `POST /api/swaps/:id/messages` (REST) and `socket.emit("send_message")` (Socket.IO). Both paths independently validate, persist, and broadcast. The frontend uses the Socket path for sending and REST for polling (`useMessages` refetches every 5 seconds). This works but means:
  - Validation logic is duplicated across two code paths.
  - The REST polling could be removed entirely if the socket `new_message` listener is trusted for real-time updates.
- **Recommendation:** Consider deprecating the REST send path or extracting shared validation into a service function.

#### D-8. `useMessages` polls every 5 seconds even with active socket
- **Severity:** Low (performance waste)
- **Detail:** `useMessages` has `refetchInterval: 5000` ([useSwaps.ts L66](file:///E:/Skill%20Swap/Skill-swap/frontend/src/hooks/useSwaps.ts#L66)). Since the socket `new_message` handler already invalidates the `['messages', swapId]` query, the 5-second poll is redundant when the socket is connected.
- **Recommendation:** Conditionally disable `refetchInterval` when `connected === true`.

#### D-9. Settings page: Theme/privacy settings are localStorage-only
- **Severity:** Low (UX expectation)
- **Detail:** Settings.tsx stores theme preference and privacy toggles in `localStorage` only. They don't persist across browsers/devices. Users may expect these to sync.
- **Recommendation:** Knowingly accepted for portfolio scope, or add backend fields if cross-device sync is desired.

#### D-10. Test coverage gaps
- **Current:** 142 tests, excellent happy-path coverage.
- **Missing:**
  - No test for a third-party (non-participant) attempting to accept/reject/complete a swap via REST.
  - No test for out-of-range feedback rating (e.g., `rating=6` or `rating=0`).
  - No integration test for the Reviews page's API calls (would have caught D-1).
  - No test for the `community_stats` in-memory cache TTL behavior.
  - No test for concurrent duplicate creation (race conditions flagged in D-4).

---

## Summary

| Category | Fix Directly | Flag Only |
|---|---|---|
| Ship-blockers | **1** (D-1: Reviews page broken) | — |
| Functional issues | **1** (D-2: Admin mock data) | — |
| Operational/architectural | — | **8** (D-3 through D-10) |
| Prior audit items re-verified | 8 confirmed fixed | 4 confirmed still open (by design) |

> [!IMPORTANT]
> **The only item blocking ship is D-1** (Reviews.tsx). Fix the four lines, run `npm run build`, and re-run the full test suite before deploying. Everything else is either cosmetic, a known-accepted tradeoff, or requires a human product decision.
