import { Context } from 'hono';
import { z } from 'zod';
import { AppBindings, Secret } from '../types';
const encryptedField = z.string().min(1).max(8192);
const nullableEncryptedField = z.string().min(1).max(8192).nullable().optional();

const createSecretSchema = z.object({
  secret_name_encrypted: encryptedField,
  description_encrypted: nullableEncryptedField,
  account_linked_encrypted: nullableEncryptedField,
  value_encrypted: encryptedField
});

const updateSecretSchema = createSecretSchema.partial();

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
 * GET /api/v1/secrets
 * Returns all secrets for the authenticated user (encrypted)
 */
export async function getSecrets(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const secrets = await c.env.DB.prepare(
      'SELECT id, secret_name_encrypted, description_encrypted, account_linked_encrypted, value_encrypted, date_modified FROM secrets WHERE user_id = ? ORDER BY date_modified DESC'
    ).bind(userId).all<Secret>();

    return c.json({ secrets: secrets.results ?? [] });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to fetch secrets' }, 500);
  }
}

/**
 * GET /api/v1/secrets/:id
 * Returns a specific secret with decrypted data
 */
export async function getSecret(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const secretId = c.req.param('id');

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const secret = await c.env.DB.prepare(
      'SELECT * FROM secrets WHERE id = ? AND user_id = ?'
    ).bind(secretId, userId).first<Secret>();

    if (!secret) {
      return c.json({ error: 'Secret not found' }, 404);
    }

    return c.json({ secret });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to fetch secret' }, 500);
  }
}

/**
 * POST /api/v1/secrets
 * Creates a new secret entry
 */
export async function createSecret(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const payload = createSecretSchema.parse(body);

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO secrets (user_id, secret_name_encrypted, description_encrypted, account_linked_encrypted, value_encrypted, date_modified) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING id'
    ).bind(
      userId,
      payload.secret_name_encrypted,
      normalizeEncrypted(payload.description_encrypted),
      normalizeEncrypted(payload.account_linked_encrypted),
      payload.value_encrypted
    ).first<{ id: number }>();

    return c.json({ success: true, id: result?.id ?? null });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to create secret' }, 500);
  }
}

/**
 * PUT /api/v1/secrets/:id
 * Updates an existing secret
 */
export async function updateSecret(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const secretId = c.req.param('id');
    const body = await c.req.json();
    const payload = updateSecretSchema.parse(body);

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const existingSecret = await c.env.DB.prepare(
      'SELECT id FROM secrets WHERE id = ? AND user_id = ?'
    ).bind(secretId, userId).first();

    if (!existingSecret) {
      return c.json({ error: 'Secret not found' }, 404);
    }

    if (Object.keys(payload).length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }

    const updates: string[] = [];
  const values: Array<string | null | number> = [];

    if (payload.secret_name_encrypted !== undefined) {
      updates.push('secret_name_encrypted = ?');
  values.push(payload.secret_name_encrypted);
    }
    if (payload.description_encrypted !== undefined) {
      updates.push('description_encrypted = ?');
      values.push(normalizeEncrypted(payload.description_encrypted));
    }
    if (payload.account_linked_encrypted !== undefined) {
      updates.push('account_linked_encrypted = ?');
      values.push(normalizeEncrypted(payload.account_linked_encrypted));
    }
    if (payload.value_encrypted !== undefined) {
      updates.push('value_encrypted = ?');
  values.push(payload.value_encrypted);
    }

    updates.push('date_modified = CURRENT_TIMESTAMP');
    values.push(secretId, userId);

    await c.env.DB.prepare(
      `UPDATE secrets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();

    return c.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const details = (error as z.ZodError).errors;
      return c.json({ error: 'Validation failed', details }, 400);
    }
    return c.json({ error: 'Failed to update secret' }, 500);
  }
}

/**
 * DELETE /api/v1/secrets/:id
 * Deletes a secret
 */
export async function deleteSecret(c: Context<AppBindings>) {
  try {
    const userId = c.get('userId');
    const secretId = c.req.param('id');

    if (typeof userId !== 'number') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await c.env.DB.prepare(
      'DELETE FROM secrets WHERE id = ? AND user_id = ?'
    ).bind(secretId, userId).run();

    return c.json({ success: true });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to delete secret' }, 500);
  }
}
