import { Context } from 'hono';
import { z } from 'zod';
import { AppBindings } from '../types';
import { hashPassword, verifyPassword, generateToken, hashToken } from '../crypto';

// Validation schemas
const setupAdminSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8)
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string()
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(12, 'Password must be at least 12 characters long.')
});

/**
 * GET /api/v1/status
 * Returns the initialization status of the system
 */
export async function getStatus(c: Context<AppBindings>) {
  try {
    const config = await c.env.DB.prepare(
      "SELECT value FROM _config WHERE key = 'admin_initialized'"
    ).first<{ value: string }>();

    const isInitialized = config?.value === 'true';

    return c.json({ isInitialized });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to check status' }, 500);
  }
}

/**
 * POST /api/v1/setup/admin
 * Creates the initial administrator account (one-time only)
 */
export async function setupAdmin(c: Context<AppBindings>) {
  try {
    const body = await c.req.json();
    const validatedData = setupAdminSchema.parse(body);

    // Check if admin already initialized
    const config = await c.env.DB.prepare(
      "SELECT value FROM _config WHERE key = 'admin_initialized'"
    ).first<{ value: string }>();

    if (config?.value === 'true') {
      return c.json({ error: 'Admin already initialized' }, 409);
    }

    // Hash the password
    const passwordHash = await hashPassword(validatedData.password);

    // Create admin user atomically
    const newUserResult = await c.env.DB.prepare(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin') RETURNING id"
    ).bind(validatedData.username, validatedData.email, passwordHash).first<{ id: number }>();

    if (!newUserResult) {
      return c.json({ error: 'Failed to create admin user' }, 500);
    }

    const userId = newUserResult.id;

    // Batch operation: Mark as initialized and add to admins table
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE _config SET value = 'true' WHERE key = 'admin_initialized'"),
      c.env.DB.prepare("INSERT INTO admins (user_id) VALUES (?)").bind(userId)
    ]);

    return c.json({ success: true, message: 'Admin created successfully' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to setup admin' }, 500);
  }
}

/**
 * POST /api/v1/auth/register
 * Registers a new user account
 */
export async function register(c: Context<AppBindings>) {
  try {
    const body = await c.req.json();
    const validatedData = registerSchema.parse(body);

    // Check if system is initialized
    const config = await c.env.DB.prepare(
      "SELECT value FROM _config WHERE key = 'admin_initialized'"
    ).first<{ value: string }>();

    if (config?.value !== 'true') {
      return c.json({ error: 'System not initialized' }, 400);
    }

    // Hash the password
    const passwordHash = await hashPassword(validatedData.password);

    // Create new user
    await c.env.DB.prepare(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'user')"
    ).bind(validatedData.username, validatedData.email, passwordHash).run();

    return c.json({ success: true, message: 'User registered successfully' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to register user. Username or email may already exist.' }, 409);
  }
}

/**
 * POST /api/v1/auth/login
 * Authenticates a user and creates a session
 */
export async function login(c: Context<AppBindings>) {
  try {
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);

    // Find user by username
    const user = await c.env.DB.prepare(
      "SELECT id, username, email, password_hash, role FROM users WHERE username = ?"
    ).bind(validatedData.username).first<{
      id: number;
      username: string;
      email: string;
      password_hash: string;
      role: string;
    }>();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.password_hash);

    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate session token
    const sessionToken = generateToken(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create session
    await c.env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionToken, user.id, expiresAt.toISOString()).run();

    return c.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Login failed' }, 500);
  }
}

/**
 * POST /api/v1/auth/logout
 * Terminates the current session
 */
export async function logout(c: Context<AppBindings>) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No session to logout' }, 400);
    }

    const token = authHeader.substring(7);

    // Delete session
    await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();

    return c.json({ success: true, message: 'Logged out successfully' });
  } catch (error: unknown) {
    return c.json({ error: 'Logout failed' }, 500);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns current user information (requires authentication)
 */
export async function getMe(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const username = c.get('username');
    const email = c.get('email');
    const role = c.get('role');

    if (typeof userId !== 'number' || !username || !email || !role) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json({
      id: userId,
      username,
      email,
      role
    });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to get user info' }, 500);
  }
}

/**
 * POST /api/v1/auth/reset-password
 * Resets a password using a single-use token
 */
export async function resetPassword(c: Context<AppBindings>) {
  try {
    const body = await c.req.json();
    const { token, newPassword } = resetPasswordSchema.parse(body);

    const tokenHash = await hashToken(token);

    const tokenRecord = await c.env.DB.prepare(
      'SELECT token_hash, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = ?'
    ).bind(tokenHash).first<{ user_id: number; expires_at: string; used: number }>();

    if (!tokenRecord) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    if (tokenRecord.used) {
      return c.json({ error: 'Token already used' }, 400);
    }

    const now = Date.now();
    const expires = new Date(tokenRecord.expires_at).getTime();

    if (Number.isNaN(expires) || expires < now) {
      await c.env.DB.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').bind(tokenHash).run();
      return c.json({ error: 'Token has expired' }, 400);
    }

    const passwordHash = await hashPassword(newPassword);

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, tokenRecord.user_id),
      c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(tokenRecord.user_id),
      c.env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?').bind(tokenHash)
    ]);

    return c.json({ success: true, message: 'Password reset successfully.' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to reset password' }, 500);
  }
}
