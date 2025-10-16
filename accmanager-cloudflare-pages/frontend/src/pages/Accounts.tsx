import { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Search, Eye, EyeOff, Copy, Edit, Trash2, Check, Loader2, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { encryptObject, decryptObject } from '../lib/crypto';
import { useAuthStore, useVaultStore } from '../store';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TOTPDisplay from '../components/TOTPDisplay';
import UnlockVaultModal from '../components/UnlockVaultModal';

interface EncryptedAccount {
  id: number;
  user_id: number;
  name_encrypted: string;
  email_encrypted: string;
  issuer_encrypted: string | null;
  password_encrypted: string;
  dob_encrypted: string | null;
  two_fa_secret_encrypted: string | null;
  date_modified: string;
}

interface AccountRow {
  id: number;
  name: string;
  email: string;
  issuer: string;
  password: string;
  dob: string;
  two_fa_secret: string;
  date_modified: string;
}

interface AccountFormData {
  name: string;
  email: string;
  issuer: string;
  password: string;
  dob: string;
  two_fa_secret: string;
}

export default function Accounts() {
  const { user } = useAuthStore();
  const { masterKey, setMasterKey, setUserSalt, isUnlocked, clearMasterKey } = useVaultStore();

  const [encryptedAccounts, setEncryptedAccounts] = useState<EncryptedAccount[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'date'>('name');
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [showPasswordFor, setShowPasswordFor] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<AccountFormData>();

  const fetchAccounts = useCallback(async () => {
    if (!user) {
      setEncryptedAccounts([]);
      setAccounts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.getAccounts();
      setEncryptedAccounts(response.accounts as EncryptedAccount[]);
    } catch (fetchError) {
      console.error('Failed to fetch accounts', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setUserSalt(user.id.toString());
      fetchAccounts();
    } else {
      setUserSalt(null);
      clearMasterKey();
      setEncryptedAccounts([]);
      setAccounts([]);
    }
  }, [user, fetchAccounts, setUserSalt, clearMasterKey]);

  useEffect(() => {
    const decryptAccounts = async () => {
      if (!masterKey) {
        setAccounts([]);
        return;
      }

      try {
        const decryptedRows: AccountRow[] = [];

        for (const account of encryptedAccounts) {
          const decrypted = await decryptObject(
            account as unknown as Record<string, string | null | number>,
            masterKey
          );

          decryptedRows.push({
            id: account.id,
            name: String(decrypted.name ?? ''),
            email: String(decrypted.email ?? ''),
            issuer: String(decrypted.issuer ?? ''),
            password: String(decrypted.password ?? ''),
            dob: String(decrypted.dob ?? ''),
            two_fa_secret: String(decrypted.two_fa_secret ?? ''),
            date_modified: String(decrypted.date_modified ?? account.date_modified),
          });
        }

        setAccounts(decryptedRows);
      } catch (decryptError) {
        console.error('Failed to decrypt accounts', decryptError);
        setError('Unable to decrypt accounts. Please unlock your vault again.');
        setAccounts([]);
      }
    };

    if (encryptedAccounts.length > 0) {
      decryptAccounts();
    } else {
      setAccounts([]);
    }
  }, [encryptedAccounts, masterKey]);

  const ensureUnlocked = () => {
    if (!masterKey) {
      setUnlockModalOpen(true);
      return false;
    }
    return true;
  };

  const onSubmit = async (data: AccountFormData) => {
    if (!ensureUnlocked() || !masterKey) return;

    try {
      const encryptedPayload = await encryptObject(
        {
          name: data.name,
          email: data.email,
          issuer: data.issuer,
          password: data.password,
          dob: data.dob,
          two_fa_secret: data.two_fa_secret,
        },
        masterKey
      );

      if (editingAccount) {
        await api.updateAccount(editingAccount.id, encryptedPayload);
      } else {
        await api.createAccount(encryptedPayload);
      }

      setShowModal(false);
      setEditingAccount(null);
      reset();
      await fetchAccounts();
    } catch (saveError) {
      console.error('Failed to save account', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save account');
    }
  };

  const handleEdit = (account: AccountRow) => {
    if (!ensureUnlocked()) return;

    setEditingAccount(account);
    setValue('name', account.name);
    setValue('email', account.email);
    setValue('issuer', account.issuer);
    setValue('password', account.password);
    setValue('dob', account.dob);
    setValue('two_fa_secret', account.two_fa_secret);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteAccount(id);
      await fetchAccounts();
      setDeleteConfirm(null);
    } catch (deleteError) {
      console.error('Failed to delete account', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete account');
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (copyError) {
      console.error('Failed to copy value', copyError);
    }
  };

  const filteredAndSortedAccounts = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    const filtered = normalizedQuery.length
      ? accounts.filter((account: AccountRow) =>
          [account.name, account.email, account.issuer]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedQuery))
        )
      : accounts;

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'email') return a.email.localeCompare(b.email);
      return new Date(b.date_modified).getTime() - new Date(a.date_modified).getTime();
    });

    return sorted;
  }, [accounts, searchTerm, sortBy]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Accounts</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          {!isUnlocked && (
            <button
              onClick={() => setUnlockModalOpen(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm md:text-base rounded-md transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Unlock Vault</span>
              <span className="sm:hidden">Unlock</span>
            </button>
          )}
          <button
            onClick={() => {
              if (!ensureUnlocked()) return;
              setEditingAccount(null);
              reset();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 text-sm md:text-base rounded-md transition-colors"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">Add Entry</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
            className="w-full pl-9 md:pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm md:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setSortBy(event.target.value as 'name' | 'email' | 'date')
          }
          className="px-3 md:px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Sort by Name</option>
          <option value="email">Sort by Email</option>
          <option value="date">Sort by Date</option>
        </select>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center text-gray-400">
          {isUnlocked ? 'No accounts stored yet. Click “Add Entry” to create one.' : 'Unlock your vault to view your accounts.'}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-750">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Password</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Issuer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">2FA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredAndSortedAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{account.name || 'Encrypted'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300">{account.email || 'Encrypted'}</span>
                        {account.email && (
                          <button
                            onClick={() => handleCopy(account.email, `email-${account.id}`)}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                            title="Copy email"
                          >
                            {copiedField === `email-${account.id}` ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-mono text-sm">{account.password || 'Encrypted'}</span>
                        {account.password && (
                          <button
                            onClick={() => handleCopy(account.password, `password-${account.id}`)}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                            title="Copy password"
                          >
                            {copiedField === `password-${account.id}` ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{account.issuer || '-'}</td>
                    <td className="px-6 py-4">
                      {account.two_fa_secret ? (
                        <TOTPDisplay secret={account.two_fa_secret} />
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(account)}
                          className="text-gray-400 hover:text-white transition-colors p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(account.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {filteredAndSortedAccounts.map((account) => (
              <div key={account.id} className="card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                  <h3 className="text-lg font-semibold text-white">{account.name || 'Encrypted'}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(account)}
                      className="text-gray-400 hover:text-white transition-colors p-2"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(account.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-2"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Email</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-300 text-sm break-all flex-1">{account.email || 'Encrypted'}</span>
                      {account.email && (
                        <button
                          onClick={() => handleCopy(account.email, `email-${account.id}`)}
                          className="text-gray-400 hover:text-white transition-colors p-2 flex-shrink-0 bg-gray-700 rounded"
                          title="Copy email"
                        >
                          {copiedField === `email-${account.id}` ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Password</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-300 font-mono text-sm break-all flex-1">{account.password || 'Encrypted'}</span>
                      {account.password && (
                        <button
                          onClick={() => handleCopy(account.password, `password-${account.id}`)}
                          className="text-gray-400 hover:text-white transition-colors p-2 flex-shrink-0 bg-gray-700 rounded"
                          title="Copy password"
                        >
                          {copiedField === `password-${account.id}` ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {account.issuer && (
                    <div>
                      <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Issuer</label>
                      <div className="text-gray-300 text-sm mt-1">{account.issuer}</div>
                    </div>
                  )}

                  {account.two_fa_secret && (
                    <div>
                      <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">2FA Code</label>
                      <div className="mt-1">
                        <TOTPDisplay secret={account.two_fa_secret} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingAccount(null);
          reset();
        }}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
              <input
                {...register('name', { required: true })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Account name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
              <input
                {...register('email', { required: true })}
                type="email"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="[email protected]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Issuer</label>
            <input
              {...register('issuer')}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Service provider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password *</label>
            <div className="relative">
              <input
                {...register('password', { required: true })}
                type={showPasswordFor === -1 ? 'text' : 'password'}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPasswordFor(showPasswordFor === -1 ? null : -1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPasswordFor === -1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
              <input
                {...register('dob')}
                type="date"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">2FA Secret</label>
              <input
                {...register('two_fa_secret')}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="JBSWY3DPEHPK3PXP"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingAccount(null);
                reset();
              }}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              {editingAccount ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <UnlockVaultModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        userSalt={user ? user.id.toString() : 'salt'}
        onUnlock={async (key) => {
          setMasterKey(key);
          await fetchAccounts();
        }}
      />

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Account"
        message="Are you sure you want to delete this account? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
