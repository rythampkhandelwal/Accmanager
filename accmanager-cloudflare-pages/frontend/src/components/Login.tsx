import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, useVaultStore } from '../store';
import { api } from '../lib/api';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const { setUserSalt, clearMasterKey } = useVaultStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.login(formData);
      const normalizedRole = data.user.role === 'admin' ? 'admin' : 'user';

      setAuth(
        {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          role: normalizedRole,
        },
        data.token
      );

      setUserSalt(String(data.user.id));
      clearMasterKey();
      navigate('/accounts');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="card p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          AccManager Login
        </h1>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Username" className="input" value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })} required />
          <input type="password" placeholder="Password" className="input" value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
          <button type="submit" className="btn btn-primary w-full">Login</button>
        </form>
        <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
          Don't have an account? <Link to="/register" className="text-primary-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
