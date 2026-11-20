import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../lib/api/team';
import { TeamMember, UserRole } from '../../types';
import {
  Users,
  UserPlus,
  Shield,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const TeamManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('user');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await teamApi.listMembers();
      setMembers(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await teamApi.updateRole(userId, newRole);
      setMembers(members.map((m) => (m.user_id === userId ? updated : m)));
      setSuccessMsg(`Role updated to ${newRole}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to change role (cannot remove the last active Admin)');
    }
  };

  const handleStatusToggle = async (userId: string, currentActive: boolean) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await teamApi.updateStatus(userId, !currentActive);
      setMembers(members.map((m) => (m.user_id === userId ? updated : m)));
      setSuccessMsg(`Account ${!currentActive ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update user status');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGeneratingInvite(true);
    setGeneratedLink(null);

    try {
      const res = await teamApi.inviteMember(inviteEmail, inviteRole);
      const fullUrl = `${window.location.origin}${res.invite_url}`;
      setGeneratedLink(fullUrl);
      setSuccessMsg(`Single-use invitation generated for ${inviteEmail}`);
      fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Failed to generate invitation');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEAE6]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#171B1A]">Team & Role Management</h1>
          <p className="text-sm text-[#66716B] mt-0.5">
            Invite colleagues, assign Content Creator or Reviewer roles, and maintain governance.
          </p>
        </div>

        <button
          onClick={() => {
            setShowInviteModal(true);
            setGeneratedLink(null);
            setInviteEmail('');
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] transition-all shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> Invite Team Member
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-[#E5E5E0] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#EAEAE6] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#171B1A]">Workspace Members ({members.length})</h2>
          <span className="text-xs text-[#8E9793]">Admin Role Protected (At least 1 active required)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAFAF8] border-b border-[#EAEAE6] text-[#66716B] uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3 px-5">User</th>
                <th className="py-3 px-5">Role</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Joined</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAE6]">
              {members.map((m) => {
                const isSelf = m.user_id === user?.user_id;
                return (
                  <tr key={m.user_id} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#171B1A] flex items-center gap-2">
                        <span>{m.email}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            You
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as UserRole)}
                        className="px-2.5 py-1 text-xs rounded border border-[#D5D5CF] bg-white font-medium text-[#171B1A]"
                      >
                        <option value="admin">Admin</option>
                        <option value="user">Content Creator</option>
                        <option value="reviewer">Reviewer</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-5">
                      {m.is_active ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          Deactivated
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-[#66716B]">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleStatusToggle(m.user_id, m.is_active)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                            m.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5E5E0]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#171B1A]">Invite Team Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#8E9793] hover:text-[#171B1A] text-sm"
              >
                ✕
              </button>
            </div>

            {!generatedLink ? (
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#171B1A] mb-1.5">
                    Colleague's Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@yourcompany.com"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#D5D5CF] focus:outline-none focus:ring-2 focus:ring-[#256D58] text-[#171B1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#171B1A] mb-1.5">
                    Assigned Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#D5D5CF] focus:outline-none focus:ring-2 focus:ring-[#256D58] text-[#171B1A] bg-white"
                  >
                    <option value="user">Content Creator (Generates & Submits Drafts)</option>
                    <option value="reviewer">Reviewer (Audits, Approves, Rejects)</option>
                    <option value="admin">Admin (Full Team & Settings Access)</option>
                  </select>
                </div>

                <div className="p-3 bg-[#FAFAF8] rounded-xl border border-[#EAEAE6] text-xs text-[#66716B]">
                  Generates a single-use, 48-hour secure onboarding link bound to your company.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#66716B] hover:text-[#171B1A]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingInvite}
                    className="px-4 py-2 rounded-lg bg-[#256D58] text-white text-xs font-semibold hover:bg-[#1E5846] transition-colors"
                  >
                    {generatingInvite ? 'Generating...' : 'Create Invite Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  Invitation link created! Share this single-use link with <span className="font-semibold">{inviteEmail}</span>:
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg border border-[#D5D5CF] bg-[#FAFAF8]">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="w-full bg-transparent text-xs text-[#171B1A] font-mono focus:outline-none select-all truncate"
                  />
                  <button
                    onClick={copyInviteLink}
                    className="shrink-0 p-1.5 rounded-md bg-[#256D58] text-white text-xs font-medium hover:bg-[#1E5846]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-full px-4 py-2 rounded-lg bg-[#14211C] text-white text-xs font-semibold hover:bg-black"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
