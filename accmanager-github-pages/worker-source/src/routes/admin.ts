import { Context } from 'hono';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import { z } from 'zod';
import { AppBindings, Env } from '../types';
import { hashPassword, generateToken, hashToken } from '../crypto';
import { sendEmail } from '../utils/email';

const forceResetPasswordSchema = z.object({
  newPassword: z.string().min(12, 'Password must be at least 12 characters long.')
});

const importPayloadSchema = z.object({
  truncate: z.boolean().optional(),
  users: z.array(
    z.object({
      id: z.number(),
      username: z.string(),
      email: z.string().email(),
      password_hash: z.string(),
      role: z.enum(['user', 'admin']),
      created_at: z.string()
    })
  ).default([]),
  accounts: z.array(
    z.object({
      id: z.number(),
      user_id: z.number(),
      name_encrypted: z.string(),
      email_encrypted: z.string(),
      issuer_encrypted: z.string().nullable(),
      password_encrypted: z.string(),
      dob_encrypted: z.string().nullable(),
      two_fa_secret_encrypted: z.string().nullable(),
      date_modified: z.string()
    })
  ).default([]),
  secrets: z.array(
    z.object({
      id: z.number(),
      user_id: z.number(),
      secret_name_encrypted: z.string(),
      description_encrypted: z.string().nullable(),
      account_linked_encrypted: z.string().nullable(),
      value_encrypted: z.string(),
      date_modified: z.string()
    })
  ).default([])
});

const RESET_TOKEN_EXPIRY_MINUTES = 60;

function resolveBaseUrl(env: Env, requestOrigin?: string | null): string | null {
  if (env.APP_BASE_URL && env.APP_BASE_URL.length > 0) {
    return env.APP_BASE_URL.replace(/\/$/, '');
  }

  if (requestOrigin && requestOrigin.length > 0) {
    return requestOrigin.replace(/\/$/, '');
  }

  return null;
}

/**
 * GET /api/v1/admin/users
 * Returns all users (admin only)
 */
export async function getAllUsers(c: Context<AppBindings>) {
  try {
    const users = await c.env.DB.prepare(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    ).all();

    return c.json({ users: users.results || [] });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
}

/**
 * DELETE /api/v1/admin/users/:id
 * Deletes a user account (admin only)
 */
export async function deleteUser(c: Context<AppBindings>) {
  try {
    const userId = c.req.param('id');
    const currentUserId = c.get('userId');

    // Prevent admin from deleting themselves
    if (typeof currentUserId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (parseInt(userId, 10) === currentUserId) {
      return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    await c.env.DB.prepare(
      'DELETE FROM users WHERE id = ?'
    ).bind(userId).run();

    return c.json({ success: true });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to delete user' }, 500);
  }
}

/**
 * POST /api/v1/admin/users/:id/reset-password
 * Forces a password reset for a user (admin only)
 */
export async function forceResetPassword(c: Context<AppBindings>) {
  try {
    const userIdParam = c.req.param('id');
    const userId = Number(userIdParam);

    if (Number.isNaN(userId)) {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    const body = await c.req.json();
    const { newPassword } = forceResetPasswordSchema.parse(body);

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update user's password
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(passwordHash, userId).run();

    // Invalidate all sessions for this user
    await c.env.DB.prepare(
      'DELETE FROM sessions WHERE user_id = ?'
    ).bind(userId).run();

    // Remove any outstanding reset tokens
    await c.env.DB.prepare(
      'DELETE FROM password_reset_tokens WHERE user_id = ?'
    ).bind(userId).run();

    return c.json({ success: true, message: 'Password reset successfully' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to reset password' }, 500);
  }
}

/**
 * POST /api/v1/admin/users/:id/send-reset-link
 * Sends a password reset link to user's email (admin only)
 */
export async function sendResetLink(c: Context<AppBindings>) {
  try {
    const userIdParam = c.req.param('id');
    const userId = Number(userIdParam);

    if (Number.isNaN(userId)) {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    // Get user's email
    const user = await c.env.DB.prepare(
      'SELECT email, username FROM users WHERE id = ?'
    ).bind(userId).first<{ email: string; username: string }>();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const resetToken = generateToken(48);
    const resetTokenHash = await hashToken(resetToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').bind(userId),
      c.env.DB.prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, used) VALUES (?, ?, ?, 0)')
        .bind(resetTokenHash, userId, expiresAt)
    ]);

    const origin = c.req.header('origin') ?? c.req.header('referer') ?? null;
    const baseUrl = resolveBaseUrl(c.env, origin);

    if (!baseUrl) {
      return c.json({ error: 'Unable to resolve application base URL for reset link sending.' }, 500);
    }

    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    const textBody = `Hello ${user.username},

A password reset request was initiated for your AccManager account. If you made this request, follow the secure link below to set a new password:

${resetLink}

This link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes. If you did not request this reset, you can safely ignore this email.

Stay secure,
AccManager`;

    const htmlBody = `
      <p>Hello ${user.username},</p>
      <p>A password reset request was initiated for your AccManager account. If you made this request, click the button below to choose a new password.</p>
      <p><a href="${resetLink}" style="display:inline-block;padding:12px 20px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>This link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.</p>
      <p>If you did not request this reset, you can ignore this email.</p>
      <p>Stay secure,<br/>AccManager</p>
    `;

    await sendEmail(c.env, {
      to: user.email,
      subject: 'AccManager Password Reset',
      text: textBody,
      html: htmlBody
    });

    return c.json({ success: true, message: 'Reset link sent successfully.' });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to send reset link' }, 500);
  }
}

/**
 * GET /api/v1/admin/export
 * Exports all data as JSON (admin only)
 */
export async function exportData(c: Context<AppBindings>) {
  try {
    const users = await c.env.DB.prepare('SELECT * FROM users').all();
    const accounts = await c.env.DB.prepare('SELECT * FROM accounts').all();
    const secrets = await c.env.DB.prepare('SELECT * FROM secrets').all();
    const admins = await c.env.DB.prepare('SELECT * FROM admins').all();

    const exportData = {
      exported_at: new Date().toISOString(),
      users: users.results || [],
      accounts: accounts.results || [],
      secrets: secrets.results || [],
      admins: admins.results || []
    };

    return c.json(exportData);
  } catch (error: unknown) {
    return c.json({ error: 'Failed to export data' }, 500);
  }
}

/**
 * POST /api/v1/admin/import
 * Imports data from JSON (admin only)
 * WARNING: This is a powerful operation - use with caution
 */
export async function importData(c: Context<AppBindings>) {
  try {
    const body = await c.req.json();
    const payload = importPayloadSchema.parse(body);

    const statements = [] as D1PreparedStatement[];

    if (payload.truncate) {
      statements.push(c.env.DB.prepare('DELETE FROM password_reset_tokens'));
      statements.push(c.env.DB.prepare('DELETE FROM sessions'));
      statements.push(c.env.DB.prepare('DELETE FROM accounts'));
      statements.push(c.env.DB.prepare('DELETE FROM secrets'));
      statements.push(c.env.DB.prepare('DELETE FROM admins'));
      statements.push(c.env.DB.prepare('DELETE FROM users'));
    }

    for (const user of payload.users) {
      statements.push(
        c.env.DB.prepare('INSERT OR REPLACE INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(user.id, user.username, user.email, user.password_hash, user.role, user.created_at)
      );

      if (user.role === 'admin') {
        statements.push(
          c.env.DB.prepare('INSERT OR IGNORE INTO admins (user_id) VALUES (?)').bind(user.id)
        );
      }
    }

    for (const account of payload.accounts) {
      statements.push(
        c.env.DB.prepare('INSERT OR REPLACE INTO accounts (id, user_id, name_encrypted, email_encrypted, issuer_encrypted, password_encrypted, dob_encrypted, two_fa_secret_encrypted, date_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(
            account.id,
            account.user_id,
            account.name_encrypted,
            account.email_encrypted,
            account.issuer_encrypted,
            account.password_encrypted,
            account.dob_encrypted,
            account.two_fa_secret_encrypted,
            account.date_modified
          )
      );
    }

    for (const secret of payload.secrets) {
      statements.push(
        c.env.DB.prepare('INSERT OR REPLACE INTO secrets (id, user_id, secret_name_encrypted, description_encrypted, account_linked_encrypted, value_encrypted, date_modified) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(
            secret.id,
            secret.user_id,
            secret.secret_name_encrypted,
            secret.description_encrypted,
            secret.account_linked_encrypted,
            secret.value_encrypted,
            secret.date_modified
          )
      );
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    return c.json({ success: true, message: 'Data imported successfully.' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to import data' }, 500);
  }
}

/**
 * GET /api/v1/admin/stats
 * Returns system statistics (admin only)
 */
export async function getStats(c: Context<AppBindings>) {
  try {
    const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
    const accountCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM accounts').first<{ count: number }>();
    const secretCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM secrets').first<{ count: number }>();

    return c.json({
      users: userCount?.count || 0,
      accounts: accountCount?.count || 0,
      secrets: secretCount?.count || 0
    });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to fetch statistics' }, 500);
  }
}
