import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Globe,
  RefreshCw,
} from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters long');
    if (password !== confirmPassword) return setError('Passwords do not match');
    setLoading(true);
    try {
      await register(email.trim(), password.trim(), selectedRole);
      onNavigate('/onboarding');
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
        setError(msg || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const roles: { value: UserRole; title: string; description: string }[] = [
    { value: 'admin', title: 'Admin', description: 'Manage workspace & approvals' },
    { value: 'reviewer', title: 'Reviewer', description: 'Inspect & sign off content' },
    { value: 'user', title: 'Creator', description: 'Create studio campaigns' },
  ];

  const inputClass =
    'w-full py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all';

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171B1A] lg:grid lg:grid-cols-[1.1fr_1fr] font-sans antialiased selection:bg-[#256D58] selection:text-white">
      {/* Main Registration Form */}
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
              Get Started
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171B1A]">
              Create your account
            </h1>
            <p className="text-xs sm:text-sm text-[#66716B]">
              Configure your autonomous marketing workspace in minutes.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAEAE6] shadow-sm space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Account Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setSelectedRole(role.value)}
                      className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                        selectedRole === role.value
                          ? 'border-[#256D58] bg-[#256D58]/10 text-[#171B1A] shadow-xs'
                          : 'border-[#EAEAE6] bg-[#FAFAF8] hover:border-[#256D58]/40 text-[#66716B]'
                      }`}
                    >
                      <span className="block text-xs font-bold">{role.title}</span>
                      <span className="mt-0.5 hidden text-[10px] leading-3 text-[#8E9793] sm:block">
                        {role.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className={`${inputClass} pl-10 pr-3.5`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`${inputClass} pl-10 pr-3.5`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className={`${inputClass} pl-10 pr-3.5`}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] text-xs text-[#66716B]">
                <ShieldCheck className="w-4 h-4 text-[#256D58] shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  Your corporate knowledge and drafts remain private and isolated to your company.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-sm font-semibold shadow-md shadow-[#256D58]/20 transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-[#66716B]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="font-semibold text-[#256D58] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Brand Hero Sidebar (Desktop) */}
      <aside className="relative hidden lg:flex lg:flex-col lg:justify-between bg-[#0E1513] text-[#FAFAF8] p-12 overflow-hidden border-l border-white/10">
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] bg-[#256D58]/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex justify-end">
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
            <span>Enterprise Marketing Autopilot</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            Built for marketing teams demanding precision.
          </h2>

          <p className="text-sm text-[#8E9793] leading-relaxed">
            Eliminate repetitive drafting and maintain a strong social presence across LinkedIn and Instagram without hallucinated facts.
          </p>

          <div className="pt-4 grid grid-cols-2 gap-3 border-t border-white/10">
            <div className="p-3.5 rounded-xl bg-[#14211C] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E9793]">Verification</div>
              <div className="text-sm font-bold text-[#34D399] mt-0.5">Deterministic Fit</div>
              <p className="text-[11px] text-[#8E9793] mt-1">Zero unapproved publishing</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#14211C] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E9793]">Channels</div>
              <div className="text-sm font-bold text-white mt-0.5">LinkedIn + Instagram</div>
              <p className="text-[11px] text-[#8E9793] mt-1">Native API dispatches</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-[#8E9793]">
          © {new Date().getFullYear()} DataFactZ Inc. All rights reserved.
        </div>
      </aside>
    </div>
  );
};

export default RegisterPage;
