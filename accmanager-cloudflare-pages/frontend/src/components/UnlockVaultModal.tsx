import { FormEvent, useState } from 'react';
import { deriveKey } from '../lib/crypto';
import Modal from './Modal';

interface UnlockVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSalt: string;
  onUnlock: (key: CryptoKey) => Promise<void> | void;
}

export default function UnlockVaultModal({ isOpen, onClose, userSalt, onUnlock }: UnlockVaultModalProps) {
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!masterPassword.trim()) {
      setError('Master password is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const key = await deriveKey(masterPassword, userSalt);
      setMasterPassword('');
      await onUnlock(key);
      onClose();
    } catch (unlockError) {
      console.error('Failed to unlock vault', unlockError);
      setError('Unable to unlock vault. Please double-check your master password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unlock Vault" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-gray-300">
          Enter your master password to unlock and decrypt your stored secrets. This password never leaves your browser.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Master Password</label>
          <input
            type="password"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:opacity-60"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
