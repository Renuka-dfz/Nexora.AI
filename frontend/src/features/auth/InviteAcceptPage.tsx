import React, { useEffect, useState } from 'react';
import { authApi } from '../../lib/api/auth';
import { InvitationVerifyResponse } from '../../types';
import { ArrowRight, Lock, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

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
      onNavigate(res.user?.role === 'reviewer' ? '/app/approvals' : '/app/studio');
    } catch (err: any) {
      setError(err?.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#eef7fd,#fff)] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#256D58] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#66716B]">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#eef7fd,#fff)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 -rotate-6 items-center justify-center rounded-[12px] bg-[#087fd7] text-white shadow-[0_10px_25px_rgba(22,136,210,.20)]">
            <Sparkles className="h-5 w-5" fill="currentColor" />
          </div>
          <span className="text-2xl font-bold text-[#171B1A] tracking-tight">
            Nexora<span className="text-[#256D58]">.AI</span>
          </span>
        </div>

        <h2 className="text-center text-2xl font-bold tracking-tight text-[#171B1A]">
          Join your team on Nexora.AI
        </h2>
        {invite && (
          <p className="mt-2 text-center text-sm text-[#66716B]">
            You have been invited to join <span className="font-semibold text-[#171B1A]">{invite.company_name || 'the team'}</span> as a{' '}
            <span className="capitalize font-semibold text-[#256D58]">
              {invite.role === 'user' ? 'Content Creator' : invite.role}
            </span>
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E5E5E0] sm:rounded-xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {invite ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#171B1A] mb-1.5">
                  Invited Email
                </label>
                <input
                  type="text"
                  disabled
                  value={invite.email}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E5E0] bg-[#F4F4F0] text-[#66716B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#171B1A] mb-1.5">
                  Set Your Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E9793] absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-[#D5D5CF] focus:outline-none focus:ring-2 focus:ring-[#256D58] focus:border-transparent text-[#171B1A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#171B1A] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E9793] absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-[#D5D5CF] focus:outline-none focus:ring-2 focus:ring-[#256D58] focus:border-transparent text-[#171B1A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="lime-button w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full text-[#172300] text-sm font-bold disabled:opacity-50"
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
            <div className="text-center">
              <p className="text-sm text-[#66716B] mb-4">
                This invitation link is invalid, already claimed, or expired.
              </p>
              <button
                onClick={() => onNavigate('/login')}
                className="lime-button inline-flex items-center justify-center px-5 py-3 rounded-full text-[#172300] text-sm font-bold"
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
