import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Sliders,
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

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, selectedRole);
      onNavigate('/onboarding');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
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
          Create your account
        </h1>
        <p className="mt-1.5 text-center text-sm text-[#737373]">
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('/login')}
            className="font-medium text-[#252525] underline hover:text-black transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-[#E7E5E4] rounded-2xl sm:px-10 space-y-5">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Role Selection Field */}
            <div>
              <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                Register Account As *
              </label>
              <div className="space-y-2">
                {/* 1. Admin */}
                <div
                  onClick={() => setSelectedRole('admin')}
                  className={`card-motion p-3.5 rounded-xl border cursor-pointer flex items-start justify-between gap-3 ${
                    selectedRole === 'admin'
                      ? 'border-[#252525] bg-[#F0EFED] shadow-xs'
                      : 'border-[#E7E5E4] bg-white hover:bg-[#FAFAF9]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#252525]">Admin</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FAFAF9] text-[#252525] border border-[#E7E5E4]">
                        Company Owner
                      </span>
                    </div>
                    <p className="text-[11px] text-[#737373] leading-snug">
                      Manages company settings, triggers web crawling, oversees team, and has final content approval.
                    </p>
                  </div>
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedRole === 'admin'
                          ? 'border-[#252525] bg-[#252525] text-white'
                          : 'border-[#E7E5E4] bg-white'
                      }`}
                    >
                      {selectedRole === 'admin' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>

                {/* 2. Reviewer */}
                <div
                  onClick={() => setSelectedRole('reviewer')}
                  className={`card-motion p-3.5 rounded-xl border cursor-pointer flex items-start justify-between gap-3 ${
                    selectedRole === 'reviewer'
                      ? 'border-[#252525] bg-[#F0EFED] shadow-xs'
                      : 'border-[#E7E5E4] bg-white hover:bg-[#FAFAF9]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#252525]">Reviewer</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FAFAF9] text-[#252525] border border-[#E7E5E4]">
                        Governance
                      </span>
                    </div>
                    <p className="text-[11px] text-[#737373] leading-snug">
                      Inspects and approves generated articles, posts, images, and videos; rejects with mandatory audit reasons.
                    </p>
                  </div>
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedRole === 'reviewer'
                          ? 'border-[#252525] bg-[#252525] text-white'
                          : 'border-[#E7E5E4] bg-white'
                      }`}
                    >
                      {selectedRole === 'reviewer' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>

                {/* 3. User (Content Creator) */}
                <div
                  onClick={() => setSelectedRole('user')}
                  className={`card-motion p-3.5 rounded-xl border cursor-pointer flex items-start justify-between gap-3 ${
                    selectedRole === 'user'
                      ? 'border-[#252525] bg-[#F0EFED] shadow-xs'
                      : 'border-[#E7E5E4] bg-white hover:bg-[#FAFAF9]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#252525]">User</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FAFAF9] text-[#252525] border border-[#E7E5E4]">
                        Content Creator
                      </span>
                    </div>
                    <p className="text-[11px] text-[#737373] leading-snug">
                      Generates grounded AI marketing content in Content Studio and submits drafts to the review queue.
                    </p>
                  </div>
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedRole === 'user'
                          ? 'border-[#252525] bg-[#252525] text-white'
                          : 'border-[#E7E5E4] bg-white'
                      }`}
                    >
                      {selectedRole === 'user' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Field */}
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

            {/* Password Field */}
            <div>
              <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                Password (min 8 chars)
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

            {/* Confirm Password Field */}
            <div>
              <label className="block text-[13px] font-medium text-[#252525] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#E7E5E4] bg-white text-[#252525] placeholder:text-[#737373]/60 focus:outline-none focus:border-[#252525] transition-colors"
                />
              </div>
            </div>

            {/* Information Callout */}
            <div className="p-3.5 bg-[#FAFAF9] rounded-xl border border-[#E7E5E4] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#252525] shrink-0 mt-0.5" />
              <p className="text-xs text-[#737373] leading-relaxed">
                After registration, you will onboard your company website to build your grounded AI knowledge base with PostgreSQL pgvector.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-motion w-full mt-3 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#252525] text-white text-xs font-semibold hover:bg-[#383838] transition-all disabled:opacity-50 shadow-xs hover:shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Get Started</span>
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
