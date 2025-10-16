import { Context } from 'hono';
import { z } from 'zod';
import { Account, AppBindings } from '../types';
// Validation schemas for encrypted payloads received from the client.
const encryptedField = z.string().min(1).max(8192);
const nullableEncryptedField = z.string().min(1).max(8192).nullable().optional();

const createAccountSchema = z.object({
  name_encrypted: encryptedField,
  email_encrypted: encryptedField,
  issuer_encrypted: nullableEncryptedField,
  password_encrypted: encryptedField,
  dob_encrypted: nullableEncryptedField,
  two_fa_secret_encrypted: nullableEncryptedField
});

const updateAccountSchema = createAccountSchema.partial();

function normalizeEncrypted(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  return value === '' ? null : value;
}

/**
 * GET /api/v1/accounts
 * Returns all accounts for the authenticated user (encrypted)
 */
export async function getAccounts(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const accounts = await c.env.DB.prepare(
      'SELECT id, name_encrypted, email_encrypted, issuer_encrypted, password_encrypted, dob_encrypted, two_fa_secret_encrypted, date_modified FROM accounts WHERE user_id = ? ORDER BY date_modified DESC'
    ).bind(userId).all<Account>();

    return c.json({ accounts: accounts.results ?? [] });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to fetch accounts' }, 500);
  }
}

/**
 * GET /api/v1/accounts/:id
 * Returns a specific account with decrypted data
 */
export async function getAccount(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const accountId = c.req.param('id');

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const account = await c.env.DB.prepare(
      'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
    ).bind(accountId, userId).first<Account>();

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json({ account });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to fetch account' }, 500);
  }
}

/**
 * POST /api/v1/accounts
 * Creates a new account entry
 */
export async function createAccount(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const payload = createAccountSchema.parse(body);

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO accounts (user_id, name_encrypted, email_encrypted, issuer_encrypted, password_encrypted, dob_encrypted, two_fa_secret_encrypted, date_modified) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING id'
    ).bind(
      userId,
      payload.name_encrypted,
      payload.email_encrypted,
      normalizeEncrypted(payload.issuer_encrypted),
      payload.password_encrypted,
      normalizeEncrypted(payload.dob_encrypted),
      normalizeEncrypted(payload.two_fa_secret_encrypted)
    ).first<{ id: number }>();

    return c.json({ success: true, id: result?.id ?? null });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to create account' }, 500);
  }
}

/**
 * PUT /api/v1/accounts/:id
 * Updates an existing account
 */
export async function updateAccount(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const accountId = c.req.param('id');
    const body = await c.req.json();
    const payload = updateAccountSchema.parse(body);

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
    ).bind(accountId, userId).first();

    if (!existing) {
      return c.json({ error: 'Account not found' }, 404);
    }

    if (Object.keys(payload).length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }

  const updates: string[] = [];
  const values: Array<string | null | number> = [];

    if (payload.name_encrypted !== undefined) {
      updates.push('name_encrypted = ?');
  values.push(payload.name_encrypted);
    }
    if (payload.email_encrypted !== undefined) {
      updates.push('email_encrypted = ?');
  values.push(payload.email_encrypted);
    }
    if (payload.issuer_encrypted !== undefined) {
      updates.push('issuer_encrypted = ?');
      values.push(normalizeEncrypted(payload.issuer_encrypted));
    }
    if (payload.password_encrypted !== undefined) {
      updates.push('password_encrypted = ?');
  values.push(payload.password_encrypted);
    }
    if (payload.dob_encrypted !== undefined) {
      updates.push('dob_encrypted = ?');
  values.push(normalizeEncrypted(payload.dob_encrypted));
    }
    if (payload.two_fa_secret_encrypted !== undefined) {
      updates.push('two_fa_secret_encrypted = ?');
  values.push(normalizeEncrypted(payload.two_fa_secret_encrypted));
    }

    updates.push('date_modified = CURRENT_TIMESTAMP');

    values.push(accountId, userId);

    await c.env.DB.prepare(
      `UPDATE accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();

    return c.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to update account' }, 500);
  }
}

/**
 * DELETE /api/v1/accounts/:id
 * Deletes an account
 */
export async function deleteAccount(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const accountId = c.req.param('id');

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await c.env.DB.prepare(
      'DELETE FROM accounts WHERE id = ? AND user_id = ?'
    ).bind(accountId, userId).run();

    return c.json({ success: true });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to delete account' }, 500);
  }
}

/**
 * GET /api/v1/accounts/search
 * Searches accounts (note: search is limited since data is encrypted)
 */
export async function searchAccounts(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const accounts = await c.env.DB.prepare(
      'SELECT id, name_encrypted, email_encrypted, issuer_encrypted, password_encrypted, dob_encrypted, two_fa_secret_encrypted, date_modified FROM accounts WHERE user_id = ? ORDER BY date_modified DESC'
    ).bind(userId).all<Account>();

    return c.json({ accounts: accounts.results ?? [] });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to search accounts' }, 500);
  }
}
