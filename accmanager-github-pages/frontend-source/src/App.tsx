import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSystemStore, useAuthStore } from './store';
import { api } from './lib/api';

// Components (to be created)
import AdminSetup from './components/AdminSetup';
import Login from './components/Login';
import Register from './components/Register';
import Layout from './components/Layout';
import Accounts from './pages/Accounts';
import Secrets from './pages/Secrets';
import AdminPanel from './pages/AdminPanel';

function App() {
  const { isInitialized, setInitialized, theme } = useSystemStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // Check system initialization status
    const checkStatus = async () => {
      try {
        const { isInitialized: init } = await api.getStatus();
        setInitialized(init);
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    };

    if (isInitialized === null) {
      checkStatus();
    }
  }, [isInitialized, setInitialized]);

  // Show loading while checking initialization
  if (isInitialized === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show admin setup if not initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AdminSetup />
      </div>
    );
  }

  // Main application routes
  return (
    <BrowserRouter>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/accounts" replace />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="secrets" element={<Secrets />} />
            <Route path="admin" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/accounts" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
