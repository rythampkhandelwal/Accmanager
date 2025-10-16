import { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Search, Eye, EyeOff, Copy, Edit, Trash2, Check, Loader2, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { encryptObject, decryptObject } from '../lib/crypto';
import { useAuthStore, useVaultStore } from '../store';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import UnlockVaultModal from '../components/UnlockVaultModal';

interface EncryptedSecret {
  id: number;
  user_id: number;
  secret_name_encrypted: string;
  description_encrypted: string | null;
  account_linked_encrypted: string | null;
  value_encrypted: string;
  date_modified: string;
}

interface SecretRow {
  id: number;
  secret_name: string;
  description: string;
  account_linked: string;
  value: string;
  date_modified: string;
}

interface SecretFormData {
  secret_name: string;
  description: string;
  account_linked: string;
  value: string;
}

export default function Secrets() {
  const { user } = useAuthStore();
  const { masterKey, isUnlocked, setMasterKey, setUserSalt, clearMasterKey } = useVaultStore();

  const [encryptedSecrets, setEncryptedSecrets] = useState<EncryptedSecret[]>([]);
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [showModal, setShowModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<SecretRow | null>(null);
  const [showValueFor, setShowValueFor] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<SecretFormData>();

  const fetchSecrets = useCallback(async () => {
    if (!user) {
      setEncryptedSecrets([]);
      setSecrets([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.getSecrets();
      setEncryptedSecrets(response.secrets as EncryptedSecret[]);
    } catch (fetchError) {
      console.error('Failed to fetch secrets', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setUserSalt(user.id.toString());
      fetchSecrets();
    } else {
      setUserSalt(null);
      clearMasterKey();
      setEncryptedSecrets([]);
      setSecrets([]);
    }
  }, [user, fetchSecrets, setUserSalt, clearMasterKey]);

  useEffect(() => {
    const decryptSecrets = async () => {
      if (!masterKey) {
        setSecrets([]);
        return;
      }

      try {
        const decryptedRows: SecretRow[] = [];

        for (const secret of encryptedSecrets) {
          const decrypted = await decryptObject(
            secret as unknown as Record<string, string | null | number>,
            masterKey
          );

          decryptedRows.push({
            id: secret.id,
            secret_name: String(decrypted.secret_name ?? ''),
            description: String(decrypted.description ?? ''),
            account_linked: String(decrypted.account_linked ?? ''),
            value: String(decrypted.value ?? ''),
            date_modified: String(decrypted.date_modified ?? secret.date_modified),
          });
        }

        setSecrets(decryptedRows);
      } catch (decryptError) {
        console.error('Failed to decrypt secrets', decryptError);
        setError('Unable to decrypt secrets. Please unlock your vault again.');
        setSecrets([]);
      }
    };

    if (encryptedSecrets.length > 0) {
      decryptSecrets();
    } else {
      setSecrets([]);
    }
  }, [encryptedSecrets, masterKey]);

  const ensureUnlocked = () => {
    if (!masterKey) {
      setUnlockModalOpen(true);
      return false;
    }
    return true;
  };

  const onSubmit = async (data: SecretFormData) => {
    if (!ensureUnlocked() || !masterKey) return;

    try {
      const encryptedPayload = await encryptObject(
        {
          secret_name: data.secret_name,
          description: data.description,
          account_linked: data.account_linked,
          value: data.value,
        },
        masterKey
      );

      if (editingSecret) {
        await api.updateSecret(editingSecret.id, encryptedPayload);
      } else {
        await api.createSecret(encryptedPayload);
      }

      setShowModal(false);
      setEditingSecret(null);
      reset();
      await fetchSecrets();
    } catch (saveError) {
      console.error('Failed to save secret', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save secret');
    }
  };

  const handleEdit = (secret: SecretRow) => {
    if (!ensureUnlocked()) return;

    setEditingSecret(secret);
    setValue('secret_name', secret.secret_name);
    setValue('description', secret.description);
    setValue('account_linked', secret.account_linked);
    setValue('value', secret.value);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteSecret(id);
      await fetchSecrets();
      setDeleteConfirm(null);
    } catch (deleteError) {
      console.error('Failed to delete secret', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete secret');
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

  const filteredAndSortedSecrets = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    const filtered = normalizedQuery.length
      ? secrets.filter((secret) =>
          [secret.secret_name, secret.description, secret.account_linked]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedQuery))
        )
      : secrets;

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.secret_name.localeCompare(b.secret_name);
      return new Date(b.date_modified).getTime() - new Date(a.date_modified).getTime();
    });

    return sorted;
  }, [secrets, searchTerm, sortBy]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Secrets</h1>
        <div className="flex items-center gap-3">
          {!isUnlocked && (
            <button
              onClick={() => setUnlockModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              <Lock className="w-4 h-4" />
              Unlock Vault
            </button>
          )}
          <button
            onClick={() => {
              if (!ensureUnlocked()) return;
              setEditingSecret(null);
              reset();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Secret
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search secrets..."
            value={searchTerm}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setSortBy(event.target.value as 'name' | 'date')
          }
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Sort by Name</option>
          <option value="date">Sort by Date</option>
        </select>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : secrets.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center text-gray-400">
          {isUnlocked ? 'No secrets stored yet. Click “Add Secret” to create one.' : 'Unlock your vault to view your secrets.'}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-750">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Secret Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Account Linked</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredAndSortedSecrets.map((secret) => (
                <tr key={secret.id} className="hover:bg-gray-750 transition-colors">
                  <td className="px-6 py-4 text-white">{secret.secret_name || 'Encrypted'}</td>
                  <td className="px-6 py-4 text-gray-300">{secret.description || '-'}</td>
                  <td className="px-6 py-4 text-gray-300">{secret.account_linked || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowValueFor(showValueFor === secret.id ? null : secret.id)}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        title="View value"
                      >
                        {showValueFor === secret.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {showValueFor === secret.id && secret.value && (
                        <button
                          onClick={() => handleCopy(secret.value, `value-${secret.id}`)}
                          className="text-gray-400 hover:text-white transition-colors p-1"
                          title="Copy value"
                        >
                          {copiedField === `value-${secret.id}` ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(secret)}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(secret.id)}
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
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingSecret(null);
          reset();
        }}
        title={editingSecret ? 'Edit Secret' : 'Add Secret'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Secret Name *</label>
            <input
              {...register('secret_name', { required: true })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="API Key, Token, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What is this secret for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Account Linked</label>
            <input
              {...register('account_linked')}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Related account or service"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Value *</label>
            <div className="relative">
              <textarea
                {...register('value', { required: true })}
                rows={4}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 font-mono text-sm"
                placeholder="Enter secret value..."
              />
              <button
                type="button"
                onClick={() => setShowValueFor(showValueFor === -1 ? null : -1)}
                className="absolute right-3 top-3 text-gray-400 hover:text-white"
              >
                {showValueFor === -1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingSecret(null);
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
              {editingSecret ? 'Update' : 'Create'}
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
          await fetchSecrets();
        }}
      />

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Secret"
        message="Are you sure you want to delete this secret? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

