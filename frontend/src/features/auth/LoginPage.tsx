import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      onNavigate('/overview');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Wordmark */}
        <div
          onClick={() => onNavigate('/login')}
          className="flex items-center justify-center gap-2.5 cursor-pointer mb-6 group"
        >
          <div className="w-8 h-8 rounded bg-[#252525] flex items-center justify-center text-white font-semibold text-xs tracking-wider">
            N
          </div>
          <span className="font-semibold text-xl tracking-tight text-[#252525]">
            Nexora.AI
          </span>
        </div>

        <h1 className="text-center text-[28px] font-semibold tracking-tight text-[#252525] leading-tight">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-center text-sm text-[#737373]">
          Or{' '}
          <button
            onClick={() => onNavigate('/register')}
            className="font-medium text-[#252525] underline hover:text-black transition-colors"
          >
            register a new workspace account
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-[#E7E5E4] rounded-2xl sm:px-10 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-motion w-full mt-3 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] transition-all disabled:opacity-50 shadow-xs hover:shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
