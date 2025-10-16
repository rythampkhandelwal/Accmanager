/**
 * Type definitions for the Cloudflare Worker environment
 */

export interface Env {
  DB: D1Database;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  APP_BASE_URL?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface Session {
  token: string;
  user_id: number;
  expires_at: string;
}

export interface Account {
  id: number;
  user_id: number;
  name_encrypted: string;
  email_encrypted: string;
  issuer_encrypted: string | null;
  password_encrypted: string;
  dob_encrypted: string | null;
  two_fa_secret_encrypted: string | null;
  date_modified: string;
}

export interface Secret {
  id: number;
  user_id: number;
  secret_name_encrypted: string;
  description_encrypted: string | null;
  account_linked_encrypted: string | null;
  value_encrypted: string;
  date_modified: string;
}

export interface PasswordResetToken {
  token_hash: string;
  user_id: number;
  expires_at: string;
  used: number;
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    userId: number;
    username: string;
    email: string;
    role: 'user' | 'admin';
  };
};
