# Security, Authentication & Authorization Report

This document is strictly dedicated to the security posture of the Skill Swap platform. It outlines exactly how the application identifies users, restricts access to data, and defends against common web vulnerabilities.

---

## 1. Authentication (Proving Who You Are)

Authentication is the process of verifying a user's identity when they log in.

- **Password Hashing:** Passwords are never stored in plain text. The backend uses `bcrypt`, a highly secure cryptographic hashing algorithm, to scramble passwords before saving them. Even if the database were compromised, the passwords cannot be read.
- **Session Management:** The application uses `Flask-Login` for session management. When a user logs in successfully, the server creates a secure session and sends a unique session identifier back to the user's browser.
- **Secure Cookies:** The session identifier is stored in a browser cookie that is strictly protected:
  - **HttpOnly:** The cookie cannot be read by any JavaScript running in the browser. This prevents hackers from stealing the session via malicious scripts.
  - **Secure:** The cookie is only transmitted over encrypted HTTPS connections.
  - **SameSite=None:** Configured safely to allow cross-origin API requests from your frontend domain while maintaining strict verification.

---

## 2. Authorization (Controlling What You Can Do)

Authorization is the process of ensuring a logged-in user only has access to data and actions they are permitted to see.

- **Endpoint Protection:** Almost all backend API endpoints are wrapped with a `@login_required` decorator. If a request arrives without a valid session cookie, the server instantly rejects it with a `401 Unauthorized` error.
- **Role-Based Access Control (RBAC):** The platform distinguishes between standard users and Administrators. Admin endpoints (like viewing total platform statistics or banning users) are protected by a custom `@admin_required` decorator. Standard users attempting to access these routes are blocked with a `403 Forbidden` error.
- **Ownership Verification:** For actions like sending a chat message or editing a profile, the backend explicitly checks if the `current_user.id` matches the owner of the data being modified. A user cannot edit another user's profile or read messages from a chat room they do not belong to.

---

## 3. General Security Defenses

The application is hardened against the most common web vulnerabilities (often referred to as the OWASP Top 10).

- **Cross-Site Scripting (XSS) Prevention:**
  - **The Threat:** A malicious user types JavaScript into their "Bio" or a chat message, hoping it will execute on another user's screen.
  - **The Defense:** The backend uses a library called `bleach` inside the `sanitize_text()` utility. Before saving any user-generated text to the database, it actively strips out all HTML tags and executable scripts. Furthermore, the React frontend automatically escapes text before rendering it, providing a double layer of defense.
- **SQL Injection (SQLi) Prevention:**
  - **The Threat:** A hacker types raw database commands into a search box to trick the server into deleting or exposing data.
  - **The Defense:** The backend uses the SQLAlchemy Object-Relational Mapper (ORM). All database queries are automatically "parameterized," meaning user input is strictly treated as text, not as executable SQL code.
- **Cross-Site Request Forgery (CSRF) Prevention:**
  - **The Threat:** A malicious website tricks a logged-in user's browser into silently submitting a form (like changing an email address) on Skill Swap.
  - **The Defense:** The backend uses `Flask-WTF` to generate a unique, cryptographically secure CSRF token for every session. The frontend must attach this token to the headers of every POST, PUT, and DELETE request. If the token is missing or invalid, the request is blocked.
- **Rate Limiting (Brute Force Protection):**
  - **The Threat:** An attacker uses an automated bot to guess thousands of passwords per second on the login page.
  - **The Defense:** The `Flask-Limiter` library is installed and actively monitors traffic. The `/login` and `/register` endpoints are strictly limited to 5 attempts per minute per IP address. If this limit is exceeded, the attacker is temporarily blocked.
- **Secrets Management:**
  - **The Threat:** Sensitive API keys or database passwords are accidentally uploaded to a public GitHub repository.
  - **The Defense:** All sensitive configurations (Database URLs, Cloudinary Keys, Gemini Keys) are strictly isolated in a `.env` file that is ignored by Git. The production code only references these via environment variables.
