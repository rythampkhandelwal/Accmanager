import { Context } from 'hono';
import { AppBindings, Session } from './types';

/**
 * Authentication middleware
 * Verifies the session token and attaches user info to context
 */
export async function isAuthenticated(c: Context<AppBindings>, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Query database for session
    const session = await c.env.DB.prepare(
      'SELECT s.token, s.user_id, s.expires_at, u.username, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
    ).bind(token).first<Session & { username: string; email: string; role: string }>();

    if (!session) {
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    // Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      // Delete expired session
      await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      return c.json({ error: 'Session expired' }, 401);
    }

    // Attach user info to context
  c.set('userId', session.user_id);
  c.set('username', session.username);
  c.set('email', session.email);
  c.set('role', session.role as 'user' | 'admin');

    await next();
  } catch (error) {
    console.error('Authentication error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

/**
 * Admin authorization middleware
 * Must be used after isAuthenticated
 */
export async function isAdmin(c: Context<AppBindings>, next: () => Promise<void>) {
  const role = c.get('role');

  if (role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  await next();
}

/**
 * CORS middleware for cross-origin requests
 */
export function corsMiddleware(c: Context<AppBindings>, next: () => Promise<void>) {
  return next().then(() => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Max-Age', '86400');
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export function handleOptions(c: Context<AppBindings>) {
  return c.newResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
