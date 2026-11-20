import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
  X,
  ShieldCheck,
  Check,
  Lock,
  Building2,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, role, companyName, logout, switchRole } = useAuth();

  if (!isOpen) return null;

  const currentRole: UserRole = role || 'admin';

  const roleDetails: Record<
    UserRole,
    {
      title: string;
      label: string;
      badgeClass: string;
      permissions: { name: string; allowed: boolean; note: string }[];
    }
  > = {
    admin: {
      title: 'Administrator',
      label: 'Admin',
      badgeClass: 'bg-[#252525] text-white border-[#252525]',
      permissions: [
        { name: 'Website Crawling & Vector Ingestion', allowed: true, note: 'Full crawl & re-index authority' },
        { name: 'Editorial Review Queue Sign-Off', allowed: true, note: 'Approve or reject any content draft' },
        { name: 'Content Studio Asset Generation', allowed: true, note: 'Generate posts, banners, and video reels' },
        { name: 'Inbound Lead Qualification & Scoring', allowed: true, note: 'Full lead evaluation & sales scoring' },
        { name: 'Company Settings & Team Management', allowed: true, note: 'Full administrative control' },
      ],
    },
    reviewer: {
      title: 'Editorial Reviewer',
      label: 'Reviewer',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      permissions: [
        { name: 'Editorial Review Queue Sign-Off', allowed: true, note: 'Approve, reject, or request revisions' },
        { name: 'Full-Tab Draft Inspection', allowed: true, note: 'Read full copy, banners, and citations' },
        { name: 'Inbound Lead Qualification & Scoring', allowed: true, note: 'View lead scores & sales suggestions' },
        { name: 'Content Studio Asset Generation', allowed: false, note: 'Read-only in Content Studio' },
        { name: 'Website Crawling & Vector Ingestion', allowed: false, note: 'Admin only' },
      ],
    },
    user: {
      title: 'Content Creator',
      label: 'Creator (User)',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      permissions: [
        { name: 'Content Studio Asset Generation', allowed: true, note: 'Generate posts, banners, and video reels' },
        { name: 'Submit Drafts to Review Queue', allowed: true, note: 'Submit drafts for approval' },
        { name: 'Inbound Lead Qualification & Scoring', allowed: true, note: 'View lead scores & sales suggestions' },
        { name: 'Editorial Review Queue Sign-Off', allowed: false, note: 'Requires Admin or Reviewer role' },
        { name: 'Website Crawling & Vector Ingestion', allowed: false, note: 'Admin only' },
      ],
    },
  };

  const activeRoleData = roleDetails[currentRole];

  const handleRoleSelect = (newRole: UserRole) => {
    switchRole(newRole);
  };

  const getUserInitials = (email?: string) => {
    if (!email) return 'DF';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252525]/30 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl border border-[#E7E5E4] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 pb-4 border-b border-[#E7E5E4] flex items-center justify-between gap-4 bg-[#FAFAF9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#252525] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs">
              {getUserInitials(user?.email)}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#252525]">
                  {user?.email || 'admin@datafactz.ai'}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${activeRoleData.badgeClass}`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{activeRoleData.label}</span>
                </span>
              </div>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Nexora.AI Workspace Account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737373] hover:text-[#252525] hover:bg-[#E7E5E4] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Body: 1. Role, 2. Registered Company, 3. What Access */}
        <div className="p-5 space-y-4">
          {/* 1. ROLE SELECTION */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-[#252525] uppercase tracking-wider">
              Profile Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'reviewer', 'user'] as UserRole[]).map((r) => {
                const isSelected = currentRole === r;
                const info = roleDetails[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleSelect(r)}
                    className={`btn-motion py-2 px-3 rounded-xl border text-center cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#252525] text-white border-[#252525] shadow-xs'
                        : 'bg-[#FAFAF9] text-[#252525] border-[#E7E5E4] hover:bg-white hover:border-[#D6D3D1]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs font-semibold">{info.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. REGISTERED COMPANY */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-[#E7E5E4] flex items-center justify-center text-[#252525] shrink-0 shadow-2xs">
                <Building2 className="w-4 h-4 text-[#252525]" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#737373] block">
                  Registered Company
                </span>
                <span className="text-sm font-semibold text-[#252525] block">
                  {companyName || 'DataFactZ'}
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white text-emerald-800 border border-emerald-200 shrink-0">
              Active Organization
            </span>
          </div>

          {/* 3. WHAT ACCESS FOR THIS ROLE */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-[#252525] uppercase tracking-wider">
              Access & Permissions for {activeRoleData.label}
            </label>

            <div className="border border-[#E7E5E4] rounded-xl overflow-hidden divide-y divide-[#E7E5E4]">
              {activeRoleData.permissions.map((perm, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 px-3 flex items-center justify-between text-xs ${
                    perm.allowed ? 'bg-white' : 'bg-[#FAFAF9] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {perm.allowed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                    )}
                    <span
                      className={`text-xs ${
                        perm.allowed ? 'font-medium text-[#252525]' : 'text-[#737373] line-through'
                      }`}
                    >
                      {perm.name}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-[#737373]">
                    {perm.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#E7E5E4] bg-[#FAFAF9] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={logout}
            className="btn-motion inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-motion px-5 py-2 text-xs font-semibold text-white bg-[#252525] hover:bg-[#383838] rounded-xl shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
