import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { marketingApi } from '../../lib/api/marketing';
import {
  Sparkles,
  CheckCircle2,
  BookOpen,
  Users,
  LogOut,
  Building2,
  TrendingUp,
  Sliders,
  Shield,
  Layers,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  companyName?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activePath,
  onNavigate,
  companyName = 'My Organization',
}) => {
  const { user, role, companyId, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const canReview = role === 'admin' || role === 'reviewer';

  useEffect(() => {
    if (!companyId || !canReview) {
      setPendingCount(0);
      return;
    }
    let active = true;
    marketingApi.getSummary(companyId)
      .then((data) => {
        if (active && data) {
          setPendingCount(data.pending_reviews ?? 0);
        }
      })
      .catch(() => {
        marketingApi.listContent(companyId, { status: 'pending', limit: 1 })
          .then((res) => {
            if (active && res) {
              setPendingCount(res.total ?? res.items.length);
            }
          })
          .catch(() => { });
      });

    return () => {
      active = false;
    };
  }, [companyId, canReview]);

  // Define role-specific navigation menus
  const navItems = React.useMemo(() => {
    if (role === 'admin') {
      return [
        { label: 'Marketing Agent', path: '/marketing', icon: Sparkles },
        { label: 'Content Studio', path: '/content-studio', icon: Sparkles },
        { label: 'Company Knowledge', path: '/app/knowledge', icon: BookOpen },
        { label: 'Team Members', path: '/app/team', icon: Users },
        { label: 'Lead Intelligence', path: '/leads', icon: TrendingUp },
        { label: 'Company Settings', path: '/settings', icon: Sliders },
      ];
    } else if (role === 'reviewer') {
      return [
        { label: 'Marketing Agent', path: '/marketing', icon: Sparkles },
        { label: 'Fact Verification', path: '/app/knowledge', icon: BookOpen },
        { label: 'Audit & History', path: '/app/history', icon: Layers },
      ];
    } else {
      // Creator (user role)
      return [
        { label: 'Marketing Agent', path: '/marketing', icon: Sparkles },
        { label: 'Content Studio', path: '/content-studio', icon: Sparkles },
        { label: 'Company Knowledge', path: '/app/knowledge', icon: BookOpen },
        { label: 'Lead Management', path: '/leads', icon: TrendingUp },
      ];
    }
  }, [role]);

  const roleBadge = () => {
    if (role === 'admin') {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#256D58]/10 text-[#256D58] border border-[#256D58]/20">Admin</span>;
    }
    if (role === 'reviewer') {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Reviewer</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Content Creator</span>;
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171B1A] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-16 bg-white border-b border-[#EAEAE6] px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 cursor-pointer font-bold text-lg text-[#171B1A] tracking-tight hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-[#14211C] flex items-center justify-center text-white font-semibold text-sm">
              N
            </div>
            <span>Nexora<span className="text-[#256D58]">.AI</span></span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#F4F4F0] border border-[#E5E5E0] text-xs text-[#66716B]">
            <Building2 className="w-3.5 h-3.5 text-[#256D58]" />
            <span className="font-medium text-[#171B1A] max-w-[180px] truncate">{companyName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs font-medium text-[#171B1A]">{user?.email}</span>
            <div className="mt-0.5">{roleBadge()}</div>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="p-2 rounded-lg text-[#66716B] hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-[#EAEAE6] p-4 flex flex-col justify-between hidden md:flex">
          <div className="space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-[#8E9793]">
              Workspace
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.path;
              const isReviewItem = item.path === '/app/approvals' && canReview;

              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                    ? 'bg-[#256D58] text-white shadow-sm'
                    : 'text-[#66716B] hover:text-[#171B1A] hover:bg-[#F4F4F0]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#66716B]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.path === '/marketing' && canReview && pendingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-[#FAFAF8] rounded-xl border border-[#EAEAE6]">
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="w-4 h-4 text-[#256D58]" />
              <span className="text-xs font-semibold text-[#171B1A]">Human in the Loop</span>
            </div>
            <p className="text-[11px] text-[#66716B] leading-relaxed">
              Nothing publishes without approval. Factual grounding is strictly verified before creation.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
