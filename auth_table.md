| Route Path | Methods | @login_required | Admin Guard | Notes |
|---|---|---|---|---|
| admin.py: /stats | GET | No | Yes (Endpoint @admin_required) |  |
| admin.py: /users | GET | No | Yes (Endpoint @admin_required) |  |
| admin.py: /users/<user_id>/ban | POST | No | Yes (Endpoint @admin_required) |  |
| admin.py: /users/<user_id>/unban | POST | No | Yes (Endpoint @admin_required) |  |
| admin.py: /skills | GET | No | Yes (Endpoint @admin_required) |  |
| admin.py: /skills/<skill_id>/approve | POST | No | Yes (Endpoint @admin_required) |  |
| admin.py: /skills/<skill_id>/reject | POST | No | Yes (Endpoint @admin_required) |  |
| admin.py: /swaps | GET | No | Yes (Endpoint @admin_required) |  |
| admin.py: /feedback | GET | No | Yes (Endpoint @admin_required) |  |
| admin.py: /feedback/<feedback_id> | DELETE | No | Yes (Endpoint @admin_required) |  |
| admin.py: /swaps/<swap_id> | DELETE | No | Yes (Endpoint @admin_required) |  |
| admin.py: /announcements | POST | No | Yes (Endpoint @admin_required) |  |
| admin.py: /activity | GET | No | Yes (Endpoint @admin_required) |  |
| auth.py: /csrf-token | GET | No | No |  |
| auth.py: /register | POST | No | No |  |
| auth.py: /login | POST | No | No |  |
| auth.py: /admin/login | POST | No | No |  |
| auth.py: /logout | POST | Yes | No |  |
| auth.py: /me | GET | Yes | No |  |
| feedback.py: /user/<user_id> | GET | Yes | Yes (Blueprint) |  |
| feedback.py: /swap/<swap_id> | GET | Yes | Yes (Blueprint) |  |
| swaps.py: /unread-count | GET | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/read | POST | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id> | GET | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/accept | POST | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/reject | POST | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/cancel | POST | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/complete | POST | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/messages | GET | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/messages | POST | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/schedule | GET | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/schedule | POST | Yes | Yes (Blueprint) |  |
| swaps.py: /<swap_id>/schedule/confirm | POST | Yes | Yes (Blueprint) |  |
| users.py: /profile | GET, PUT, DELETE | Yes | Yes (Blueprint) |  |
| users.py: /photo | POST, DELETE | Yes | Yes (Blueprint) |  |
| users.py: /skills | GET | Yes | Yes (Blueprint) |  |
| users.py: /skills | POST | Yes | Yes (Blueprint) |  |
| users.py: /skills/<skill_id> | PUT, DELETE | Yes | Yes (Blueprint) |  |
| users.py: /availability | GET, POST | Yes | Yes (Blueprint) |  |
| users.py: /availability/<slot_id> | DELETE | Yes | Yes (Blueprint) |  |
| users.py: /stats/community | GET | No | Yes (Blueprint) |  |
| users.py: /match/<user_id> | GET | Yes | Yes (Blueprint) |  |
| users.py: /<user_id>/follow | POST | Yes | Yes (Blueprint) |  |
| users.py: /<user_id>/follow | DELETE | Yes | Yes (Blueprint) |  |
| users.py: /follow-requests | GET | Yes | Yes (Blueprint) |  |
| users.py: /<user_id>/accept-follow | POST | Yes | Yes (Blueprint) |  |
| users.py: /<user_id>/reject-follow | POST | Yes | Yes (Blueprint) |  |
| users.py: /<user_id> | GET | Yes | Yes (Blueprint) |  |
