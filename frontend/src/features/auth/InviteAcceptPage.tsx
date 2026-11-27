import React, { useEffect, useState } from 'react';
import { authApi } from '../../lib/api/auth';
import { InvitationVerifyResponse } from '../../types';
import { ArrowRight, Lock, AlertCircle, Sparkles } from 'lucide-react';

interface InviteAcceptPageProps {
  token: string;
  onNavigate: (path: string) => void;
}

export const InviteAcceptPage: React.FC<InviteAcceptPageProps> = ({ token, onNavigate }) => {
  const [invite, setInvite] = useState<InvitationVerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token');
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const data = await authApi.verifyInvitation(token);
        setInvite(data);
      } catch (err: any) {
        setError(err?.message || 'Invalid or expired invitation link');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

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

    setSubmitting(true);
    try {
      const res = await authApi.acceptInvitation(token, password);
      sessionStorage.setItem('nexora_token', res.access_token);
      onNavigate(res.user?.role === 'reviewer' ? '/marketing' : '/content-studio');
    } catch (err: any) {
      setError(err?.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#256D58] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#66716B]">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased selection:bg-[#256D58] selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#256D58] to-[#34D399] text-white shadow-md shadow-[#256D58]/25">
            <Sparkles className="h-5 w-5 fill-current" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#171B1A]">
            Join your team on Nexora.AI
          </h2>
          {invite && (
            <p className="text-xs sm:text-sm text-[#66716B]">
              You have been invited to join <span className="font-semibold text-[#171B1A]">{invite.company_name || 'the team'}</span> as a{' '}
              <span className="capitalize font-semibold text-[#256D58]">
                {invite.role === 'user' ? 'Content Creator' : invite.role}
              </span>
            </p>
          )}
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAEAE6] shadow-sm">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {invite ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Invited Email
                </label>
                <input
                  type="text"
                  disabled
                  value={invite.email}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#8E9793]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B1A] mb-1.5">
                  Set Your Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E9793] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
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
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAEAE6] bg-[#FAFAF8] text-[#171B1A] placeholder:text-[#8E9793] focus:outline-none focus:border-[#256D58] focus:bg-white focus:ring-2 focus:ring-[#256D58]/15 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#256D58] hover:bg-[#1E5846] text-white text-sm font-semibold shadow-md shadow-[#256D58]/20 transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Activating account...</span>
                  </>
                ) : (
                  <>
                    <span>Accept & Join Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm text-[#66716B]">
                This invitation link is invalid, already claimed, or expired.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#256D58] text-white text-xs font-semibold"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;
