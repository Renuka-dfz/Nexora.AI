import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/api/auth';
import {
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  Globe,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset password mode
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      if (isResetMode) {
        const cleanNew = newPassword.trim();
        if (cleanNew.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        if (cleanNew !== confirmPassword.trim()) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        await authApi.resetPassword(cleanEmail, cleanNew);
        setSuccess('Password updated successfully! Signing you in...');
        await login(cleanEmail, cleanNew);
        onNavigate('/overview');
        return;
      }

      await login(cleanEmail, password.trim());
      onNavigate('/overview');
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('not running')
      ) {
        setError('Cannot connect to backend server at http://localhost:8000. Please ensure the backend is running.');
      } else {
        setError(msg || 'Invalid email or password. Please verify or use Reset Password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171B1A] lg:grid lg:grid-cols-[1fr_1.1fr] font-sans antialiased selection:bg-[#256D58] selection:text-white">
      {/* Brand Hero Sidebar (Desktop) */}
      <aside className="relative hidden lg:flex lg:flex-col lg:justify-between bg-[#0E1513] text-[#FAFAF8] p-12 overflow-hidden border-r border-white/10">
        {/* Ambient Subtle Glow */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[300px] bg-[#256D58]/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#256D58] to-[#34D399] flex items-center justify-center text-white shadow-md shadow-[#256D58]/30 group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              Nexora<span className="text-[#34D399]">.AI</span>
            </span>
          </button>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#34D399]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
            <span>Autonomous Marketing System</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            Turn company knowledge into autonomous growth campaigns.
          </h2>

          <p className="text-sm text-[#8E9793] leading-relaxed">
            Automatically crawl websites, vectorize corporate context with pgvector, generate weekly multi-channel content, and publish with complete human sign-off.
          </p>

          <div className="pt-4 grid grid-cols-3 gap-3 border-t border-white/10">
            <div className="p-3.5 rounded-xl bg-[#14211C] border border-white/10">
              <Globe className="w-4 h-4 text-[#34D399] mb-2" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E9793]">Knowledge</div>
              <div className="text-xs font-bold text-white mt-0.5">pgvector</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#14211C] border border-white/10">
              <RefreshCw className="w-4 h-4 text-[#34D399] mb-2" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E9793]">Cadence</div>
              <div className="text-xs font-bold text-white mt-0.5">5 Posts / Wk</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#14211C] border border-white/10">
              <ShieldCheck className="w-4 h-4 text-[#34D399] mb-2" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E9793]">Safety</div>
              <div className="text-xs font-bold text-white mt-0.5">100% Gated</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-[#8E9793]">
          © {new Date().getFullYear()} DataFactZ Inc. All rights reserved.
        </div>
      </aside>

      {/* Main Authentication Form */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo Header */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex items-center gap-2 text-left group cursor-pointer mb-6"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#256D58] to-[#34D399] flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-4 h-4 fill-current" />
              </div>
              <span className="text-lg font-bold tracking-tight text-[#171B1A]">
                Nexora<span className="text-[#256D58]">.AI</span>
              </span>
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#256D58]">
              {isResetMode ? 'Account Recovery' : 'Welcome Back'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171B1A]">
              {isResetMode ? 'Reset your password' : 'Sign in to your workspace'}
            </h1>
            <p className="text-xs sm:text-sm text-[#66716B]">
              {isResetMode
                ? 'Enter your email address and new password to recover access.'
                : 'Enter your credentials to access your autonomous marketing agent.'}
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAEAE6] shadow-sm space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
                  />
                </div>
              </div>

              {!isResetMode ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#171B1A]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-xs text-[#256D58] hover:underline cursor-pointer font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-[#8E9793] hover:text-[#171B1A] transition-colors p-0.5 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-[#8E9793] hover:text-[#171B1A] transition-colors p-0.5 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-sm font-semibold shadow-md shadow-[#256D58]/20 transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isResetMode ? 'Updating password...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    <span>{isResetMode ? 'Reset & Sign In' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-[#66716B]">
              {isResetMode ? (
                <span>
                  Remembered your password?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="font-semibold text-[#256D58] hover:underline cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </span>
              ) : (
                <span>
                  New to Nexora?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/register')}
                    className="font-semibold text-[#256D58] hover:underline cursor-pointer"
                  >
                    Create an account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
