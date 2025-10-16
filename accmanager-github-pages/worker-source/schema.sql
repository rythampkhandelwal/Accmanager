/*
  AccManager D1 Database Schema - v1.0
  This schema defines the complete structure for all application data.
  It is designed with Zero-Trust principles, ensuring sensitive data is stored in an encrypted format.
*/

-- ================================================================================================
-- Part 1: Application Configuration & State
-- This table stores global, instance-wide settings for the application itself.
-- ================================================================================================
CREATE TABLE IF NOT EXISTS _config (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
-- The 'admin_initialized' flag is the critical atomic lock that ensures the one-time admin setup process is secure and can never be re-run.
INSERT OR IGNORE INTO _config (key, value) VALUES ('admin_initialized', 'false');

-- ================================================================================================
-- Part 2: Identity, Roles, and Authentication
-- This section defines the tables responsible for managing user identities and their authentication state.
-- ================================================================================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, /* Stores the complete salted Argon2id hash of the user's master password. NEVER plaintext. */
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')), /* Database-level constraint to ensure role integrity. */
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- The 'admins' table explicitly flags a user as an administrator.
-- This provides a clear, indexable separation of concerns and a single source of truth for admin status.
CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE /* If a user account is deleted, their admin status is automatically revoked. */
);

-- The 'sessions' table maps secure tokens to users, enabling persistent, stateful authentication.
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE /* Deleting a user instantly invalidates all their active sessions. */
);

-- The 'password_reset_tokens' table stores password reset tokens for admin-initiated resets.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ================================================================================================
-- Part 3: User Data Vaults
-- These tables store user-provided data. Every column containing potentially sensitive information is encrypted.
-- The naming convention '_encrypted' makes the security posture of the schema immediately obvious.
-- ================================================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name_encrypted TEXT NOT NULL,
  email_encrypted TEXT NOT NULL,
  issuer_encrypted TEXT,
  password_encrypted TEXT NOT NULL,
  dob_encrypted TEXT,
  two_fa_secret_encrypted TEXT,
  date_modified DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS secrets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  secret_name_encrypted TEXT NOT NULL,
  description_encrypted TEXT,
  account_linked_encrypted TEXT,
  value_encrypted TEXT NOT NULL,
  date_modified DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
