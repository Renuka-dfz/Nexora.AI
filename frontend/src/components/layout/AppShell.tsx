import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { marketingApi } from '../../lib/api/marketing';
import {
  Compass,
  Sparkles,
  PenTool,
  LogOut,
  Building2,
  Menu,
  X,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Sliders,
} from 'lucide-react';
import { UserProfileModal } from './UserProfileModal';

interface AppShellProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activePath,
  onNavigate,
}) => {
  const { user, role, companyId, companyName, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
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
          .catch(() => {});
      });

    return () => {
      active = false;
    };
  }, [companyId, canReview]);

  const userInitials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'DF';

  const navItems: NavItem[] = [
    {
      name: 'Overview',
      path: '/overview',
      icon: Compass,
    },
    {
      name: 'Marketing Agent',
      path: '/marketing',
      icon: Sparkles,
    },
    {
      name: 'Content Studio',
      path: '/content-studio',
      icon: PenTool,
    },
    {
      name: 'Lead Intelligence',
      path: '/leads',
      icon: TrendingUp,
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: Sliders,
    },
  ];

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  const getRoleLabel = () => {
    if (role === 'admin') return 'Admin';
    if (role === 'reviewer') return 'Reviewer';
    return 'Content Creator';
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171B1A] flex flex-col font-sans antialiased selection:bg-[#256D58] selection:text-white">
      {/* =========================================================================
          TOP HEADER: 56px height, Pure white surface (#FFFFFF) with thin border (#EAEAE6)
          Warm Ivory & Forest Green Palette: #171B1A text, #66716B secondary, #256D58 accent
          ========================================================================= */}
      <header className="h-14 bg-white/95 text-[#171B1A] px-6 flex items-center justify-between sticky top-0 z-40 border-b border-[#EAEAE6] backdrop-blur-sm shadow-2xs">
        {/* Left: Brand Wordmark + Organization Context */}
        <div className="flex items-center gap-5">
          <div
            onClick={() => handleNavClick('/overview')}
            className="btn-motion flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#256D58] text-white shadow-xs">
              <Sparkles className="h-3.5 w-3.5 fill-current" />
            </div>
            <span className="font-bold text-[16px] tracking-tight text-[#171B1A]">
              Nexora<span className="text-[#256D58]">.AI</span>
            </span>
          </div>

          <div className="h-4 w-px bg-[#EAEAE6] hidden sm:block" />

          {/* Current Company Context Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] text-xs text-[#171B1A]">
            <Building2 className="w-3.5 h-3.5 text-[#66716B] shrink-0" />
            <span className="font-semibold text-[#171B1A] max-w-[160px] sm:max-w-[220px] truncate">
              {companyName || 'Active Workspace'}
            </span>
          </div>
        </div>

        {/* Right: User Profile, Role Badge, Sign Out, Mobile Trigger */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => setProfileModalOpen(true)}
            className="hidden md:flex items-center gap-2.5 cursor-pointer p-1.5 px-2.5 rounded-xl hover:bg-[#FAFAF8] border border-transparent hover:border-[#EAEAE6] transition-all group"
            title="Click to view User Profile, Role & Permissions"
          >
            <div className="w-8 h-8 rounded-lg bg-[#171B1A] text-white flex items-center justify-center font-bold text-xs shadow-2xs group-hover:bg-[#256D58] transition-colors">
              {userInitials}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-[#171B1A] leading-tight group-hover:text-[#256D58]">
                {user?.email || 'user@nexora.ai'}
              </p>
              <p className="text-[11px] text-[#66716B] leading-tight mt-0.5 flex items-center gap-1.5">
                <span className="font-medium text-[#171B1A]">{getRoleLabel()}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-[#66716B] border border-[#EAEAE6]">
                  Profile
                </span>
              </p>
            </div>
          </div>

          <span
            onClick={() => setProfileModalOpen(true)}
            className="md:hidden text-xs font-medium px-2 py-0.5 rounded-lg bg-white text-[#171B1A] border border-[#EAEAE6] cursor-pointer"
          >
            {getRoleLabel()}
          </span>

          <div className="h-4 w-px bg-[#EAEAE6] hidden md:block" />

          {/* Sign Out Button */}
          <button
            onClick={logout}
            title="Sign out of Nexora.AI"
            className="btn-motion inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-[#66716B] hover:text-[#171B1A] hover:bg-[#FAFAF8] border border-transparent hover:border-[#EAEAE6]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-[#66716B] hover:text-[#171B1A] hover:bg-[#FAFAF8] md:hidden transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* =========================================================================
          APPLICATION BODY: Clean white sidebar + Warm Ivory main workspace (#FAFAF8)
          ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Desktop Sidebar: 240px wide, 40px item height */}
        <aside className="hidden md:flex md:w-60 flex-col bg-white border-r border-[#EAEAE6] shrink-0 min-h-[calc(100vh-3.5rem)]">
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="px-3 pt-1 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E9793]">
                  Workspaces
                </span>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePath === item.path || (item.path === '/marketing' && activePath === '/crawl');

                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavClick(item.path)}
                      className={`btn-motion w-full h-10 flex items-center gap-3 px-3.5 rounded-xl text-left text-xs relative cursor-pointer group transition-colors ${
                        isActive
                          ? 'bg-[#256D58]/10 text-[#256D58] font-bold'
                          : 'bg-transparent text-[#66716B] hover:text-[#171B1A] hover:bg-[#FAFAF8] font-medium'
                      }`}
                    >
                      {/* Active vertical pill indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#256D58] rounded-r animate-in fade-in duration-200" />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-[#256D58]' : 'text-[#66716B] group-hover:text-[#171B1A]'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                      {item.path === '/marketing' && canReview && pendingCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Bottom: Interactive User, Role & Tenant Profile Card */}
            <div className="pt-4 border-t border-[#EAEAE6]">
              <div
                onClick={() => setProfileModalOpen(true)}
                className="btn-motion p-3 rounded-xl bg-[#FAFAF8] border border-[#EAEAE6] hover:border-[#256D58]/40 hover:bg-white space-y-2 cursor-pointer shadow-2xs group transition-all"
                title="Click to view User Profile, Role Permissions & Tenant Isolation"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#171B1A]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Tenant Isolated</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-[#66716B] border border-[#EAEAE6]">
                    pgvector
                  </span>
                </div>

                <div className="flex items-center gap-2.5 pt-0.5">
                  <div className="w-7 h-7 rounded-lg bg-[#171B1A] text-white flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#256D58] transition-colors">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#171B1A] truncate leading-tight">
                      {user?.email || 'admin@datafactz.ai'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#66716B] mt-0.5">
                      <span className="capitalize font-medium text-[#171B1A]">
                        {getRoleLabel()}
                      </span>
                      <span className="text-[10px] text-[#256D58] font-semibold">
                        Profile &rarr;
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#EAEAE6] flex items-center justify-between text-[10px] font-mono text-[#8E9793]">
                  <span className="truncate max-w-[120px]">{companyName || 'DataFactZ'}</span>
                  <span className="text-[#256D58] font-semibold">Active</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer (Tablet / Mobile) */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex animate-in fade-in duration-200">
            <div className="w-68 bg-white border-r border-[#EAEAE6] p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#EAEAE6] mb-3">
                  <span className="text-xs font-bold text-[#171B1A] uppercase tracking-wider">
                    Navigation
                  </span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded-lg text-[#66716B] hover:text-[#171B1A]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePath === item.path || (item.path === '/marketing' && activePath === '/crawl');

                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavClick(item.path)}
                        className={`w-full h-10 flex items-center gap-3 px-3.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#256D58]/10 text-[#256D58] font-bold'
                            : 'text-[#66716B] hover:text-[#171B1A] hover:bg-[#FAFAF8]'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 transition-colors ${
                            isActive ? 'text-[#256D58]' : 'text-[#66716B]'
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                        {item.path === '/marketing' && canReview && pendingCount > 0 && (
                          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileModalOpen(true);
                }}
                className="pt-3 border-t border-[#EAEAE6] text-xs text-[#66716B] cursor-pointer hover:bg-[#FAFAF8] p-2 rounded-xl transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#171B1A] truncate">{user?.email}</p>
                  <span className="text-[10px] text-[#256D58] font-bold">&rarr;</span>
                </div>
                <p className="text-[11px] mt-0.5 text-[#66716B]">{getRoleLabel()} • View Profile</p>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Workspace Canvas: Clean max-w-6xl aligned grid with generous whitespace */}
        <main className="flex-1 bg-[#FAFAF8] overflow-y-auto">
          <div key={activePath} className="page-transition max-w-6xl mx-auto p-6 sm:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* User, Role & Tenant Profile Governance Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
