import { useState, useEffect, ChangeEvent } from 'react';
import { Users, Download, Upload, Mail, Key, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { api, ApiUser } from '../lib/api';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

interface ExportPayload {
  exported_at: string;
  users: ApiUser[];
  accounts: Array<Record<string, unknown>>;
  secrets: Array<Record<string, unknown>>;
  admins: Array<Record<string, unknown>>;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'export' | 'delete' | null>(null);
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { users: userList } = await api.getAllUsers();
      setUsers(userList);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceReset = async () => {
    if (!selectedUser || !newPassword) {
      alert('Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    try {
      await api.forceResetPassword(selectedUser.id, newPassword);
      alert(`Password reset successful for ${selectedUser.username}`);
      setShowResetModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      alert(`Failed to reset password: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await api.deleteUser(userToDelete.id);
      alert(`User ${userToDelete.username} deleted successfully`);
      setConfirmAction(null);
      setUserToDelete(null);
      await fetchUsers();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      alert(`Failed to delete user: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSendResetLink = async (user: ApiUser) => {
    try {
      await api.sendResetLink(user.id);
      alert(`Password reset link sent to ${user.email}`);
    } catch (error) {
      console.error('Failed to send reset link:', error);
      alert('Failed to send reset link');
    }
  };

  const handleExportData = async () => {
    try {
      const data = (await api.exportData()) as ExportPayload;
      const payload = JSON.stringify(data, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accmanager-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setConfirmAction(null);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data');
    }
  };

  const handleImportData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const data = JSON.parse(text);
      await api.importData(data);
      alert('Data imported successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Failed to import data:', error);
      alert('Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfirmAction('export')}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <label className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md transition-colors cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            {importing ? 'Importing...' : 'Import Data'}
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>
      </div>

      <div className="bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-yellow-500 font-semibold mb-1">Zero-Trust Security Notice</h3>
          <p className="text-yellow-200 text-sm">
            Administrators cannot view user passwords or encrypted data. This is by design to ensure maximum security.
            Use "Force Reset" to set a new password or "Send Reset Link" to email a secure reset token to the user.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-750">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-750 transition-colors">
                  <td className="px-6 py-4 text-white font-mono text-sm">{user.id}</td>
                  <td className="px-6 py-4 text-white">{user.username}</td>
                  <td className="px-6 py-4 text-gray-300">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-900 text-purple-200'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowResetModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded transition-colors"
                        title="Force reset password"
                      >
                        <Key className="w-3.5 h-3.5" />
                        Force Reset
                      </button>
                      <button
                        onClick={() => handleSendResetLink(user)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        title="Send password reset link"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Send Link
                      </button>
                      <button
                        onClick={() => {
                          setUserToDelete(user);
                          setConfirmAction('delete');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                        title="Delete user account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setSelectedUser(null);
          setNewPassword('');
        }}
        title="Force Password Reset"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-orange-900 bg-opacity-20 border border-orange-600 rounded-lg p-3">
            <p className="text-orange-200 text-sm">
              You are about to set a new password for <strong>{selectedUser?.username}</strong>.
              The user will be able to login with this new password immediately.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new password"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setShowResetModal(false);
                setSelectedUser(null);
                setNewPassword('');
              }}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleForceReset}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
            >
              Reset Password
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmAction === 'export'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleExportData}
        title="Export All Data"
        message="Are you sure you want to export all data as JSON? This includes all users, accounts, and secrets (encrypted)."
        confirmText="Export"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmAction === 'delete'}
        onClose={() => {
          setConfirmAction(null);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        title="Delete User Account"
        message={`Are you sure you want to delete user "${userToDelete?.username}"? This will permanently delete all their accounts, secrets, and sessions. This action cannot be undone.`}
        confirmText="Delete User"
        variant="danger"
      />
    </div>
  );
}

