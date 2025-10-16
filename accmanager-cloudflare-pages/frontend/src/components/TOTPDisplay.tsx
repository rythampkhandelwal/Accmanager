import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { TOTP } from 'otpauth';

interface TOTPDisplayProps {
  secret: string;
}

export default function TOTPDisplay({ secret }: TOTPDisplayProps) {
  const [code, setCode] = useState<string>('------');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!secret || secret.length === 0) {
      setCode('------');
      return;
    }

    try {
      const totp = new TOTP({
        issuer: 'AccManager',
        label: 'Account',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      });

      const updateCode = () => {
        const now = Date.now();
        const period = 30000; // 30 seconds in milliseconds
        const remaining = Math.ceil((period - (now % period)) / 1000);
        setTimeLeft(remaining);
        setCode(totp.generate());
      };

      updateCode();
      const interval = setInterval(updateCode, 1000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('TOTP generation error:', error);
      setCode('ERROR');
    }
  }, [secret]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const progress = (timeLeft / 30) * 100;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="relative flex-shrink-0">
        <div className="text-base sm:text-lg font-mono font-bold text-blue-400">
          {code.slice(0, 3)} {code.slice(3, 6)}
        </div>
        <div className="w-full h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 linear ${
              timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors flex-shrink-0"
        title="Copy 2FA code"
      >
        {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
      </button>
      <span className="text-xs text-gray-500 flex-shrink-0">{timeLeft}s</span>
    </div>
  );
}
