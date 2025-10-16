import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { AppBindings } from './types';
import { isAuthenticated, isAdmin, handleOptions } from './middleware';

// Import route handlers
import { getStatus, setupAdmin, register, login, logout, getMe, resetPassword } from './routes/auth';
import { 
  getAccounts, 
  getAccount, 
  createAccount, 
  updateAccount, 
  deleteAccount, 
  searchAccounts 
} from './routes/accounts';
import { 
  getSecrets, 
  getSecret, 
  createSecret, 
  updateSecret, 
  deleteSecret 
} from './routes/secrets';
import { 
  getAllUsers, 
  deleteUser, 
  forceResetPassword, 
  sendResetLink, 
  exportData, 
  importData, 
  getStats 
} from './routes/admin';

// Create Hono app
const app = new Hono<AppBindings>();

// Global CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

// Handle OPTIONS requests for CORS preflight
app.options('/*', (c: Context<AppBindings>) => c.newResponse(null, { status: 204 }));

/**
 * ================================================================================================
 * PUBLIC ROUTES - No authentication required
 * ================================================================================================
 */

// System status
app.get('/api/v1/status', getStatus);

// Admin setup (one-time only)
app.post('/api/v1/setup/admin', setupAdmin);

// User registration
app.post('/api/v1/auth/register', register);

// User login
app.post('/api/v1/auth/login', login);

// Password reset
app.post('/api/v1/auth/reset-password', resetPassword);

/**
 * ================================================================================================
 * AUTHENTICATED ROUTES - Requires valid session token
 * ================================================================================================
 */

// Auth endpoints
app.post('/api/v1/auth/logout', isAuthenticated, logout);
app.get('/api/v1/auth/me', isAuthenticated, getMe);

// Account management endpoints
app.get('/api/v1/accounts', isAuthenticated, getAccounts);
app.get('/api/v1/accounts/search', isAuthenticated, searchAccounts);
app.get('/api/v1/accounts/:id', isAuthenticated, getAccount);
app.post('/api/v1/accounts', isAuthenticated, createAccount);
app.put('/api/v1/accounts/:id', isAuthenticated, updateAccount);
app.delete('/api/v1/accounts/:id', isAuthenticated, deleteAccount);

// Secret management endpoints
app.get('/api/v1/secrets', isAuthenticated, getSecrets);
app.get('/api/v1/secrets/:id', isAuthenticated, getSecret);
app.post('/api/v1/secrets', isAuthenticated, createSecret);
app.put('/api/v1/secrets/:id', isAuthenticated, updateSecret);
app.delete('/api/v1/secrets/:id', isAuthenticated, deleteSecret);

/**
 * ================================================================================================
 * ADMIN ROUTES - Requires admin role
 * ================================================================================================
 */

// User management
app.get('/api/v1/admin/users', isAuthenticated, isAdmin, getAllUsers);
app.delete('/api/v1/admin/users/:id', isAuthenticated, isAdmin, deleteUser);
app.post('/api/v1/admin/users/:id/reset-password', isAuthenticated, isAdmin, forceResetPassword);
app.post('/api/v1/admin/users/:id/send-reset-link', isAuthenticated, isAdmin, sendResetLink);

// Data management
app.get('/api/v1/admin/export', isAuthenticated, isAdmin, exportData);
app.post('/api/v1/admin/import', isAuthenticated, isAdmin, importData);
app.get('/api/v1/admin/stats', isAuthenticated, isAdmin, getStats);

/**
 * ================================================================================================
 * ERROR HANDLING
 * ================================================================================================
 */

// 404 handler
app.notFound((c: Context) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Global error handler
app.onError((err: Error, c: Context) => {
  console.error('Global error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

/**
 * ================================================================================================
 * EXPORT
 * ================================================================================================
 */

export default app;
