import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore, useSystemStore, useVaultStore } from '../store';
import { Moon, Sun, LogOut } from 'lucide-react';
import { api } from '../lib/api';

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const { theme, toggleTheme } = useSystemStore();
  const navigate = useNavigate();
  const { clearMasterKey, setUserSalt } = useVaultStore();

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      clearAuth();
      clearMasterKey();
      setUserSalt(null);
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AccManager</h1>
            <nav className="flex space-x-4">
              <Link to="/accounts" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">Accounts</Link>
              <Link to="/secrets" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">Secrets</Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">Admin</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="btn btn-secondary flex items-center space-x-2">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
