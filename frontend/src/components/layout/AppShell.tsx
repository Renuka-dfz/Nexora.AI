import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  Sparkles,
  PenTool,
  LogOut,
  Building2,
  Menu,
  X,
  ShieldCheck,
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
  const { user, role, companyName, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const userInitials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'DF';

  // Exactly 5 navigation items as specified in the Scope
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
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7fbfd,#fff)] text-[#252525] flex flex-col font-sans antialiased">
      {/* =========================================================================
          TOP HEADER: 56px height, Pure white surface (#FFFFFF) with thin border (#E7E5E4)
          Soft Graphite Palette: #252525 text, #737373 secondary
          ========================================================================= */}
      <header className="h-14 bg-white/95 text-[#252525] px-6 flex items-center justify-between sticky top-0 z-40 border-b border-[#dfeaf2] backdrop-blur">
        {/* Left: Brand Wordmark + Organization Context */}
        <div className="flex items-center gap-5">
          <div
            onClick={() => handleNavClick('/overview')}
            className="btn-motion flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex h-7 w-7 -rotate-6 items-center justify-center rounded-[8px] bg-[#087fd7] text-white shadow-[0_5px_14px_rgba(22,136,210,.18)]">
              <Sparkles className="h-3.5 w-3.5" fill="currentColor" />
            </div>
            <span className="font-semibold text-[16px] tracking-tight text-[#252525]">
              Nexora.AI
            </span>
          </div>

          <div className="h-4 w-px bg-[#E7E5E4] hidden sm:block" />

          {/* Current Company Context Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAFAF9] border border-[#E7E5E4] text-[13px] text-[#252525]">
            <Building2 className="w-3.5 h-3.5 text-[#737373] shrink-0" />
            <span className="font-medium text-[#252525] max-w-[160px] sm:max-w-[220px] truncate">
              {companyName || 'Active Workspace'}
            </span>
          </div>
        </div>

        {/* Right: User Profile, Role Badge, Sign Out, Mobile Trigger */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => setProfileModalOpen(true)}
            className="hidden md:flex items-center gap-2.5 cursor-pointer p-1.5 px-2.5 rounded-xl hover:bg-[#F5F5F4] border border-transparent hover:border-[#E7E5E4] transition-all group"
            title="Click to view User Profile, Role & Permissions"
          >
            <div className="w-8 h-8 rounded-lg bg-[#252525] text-white flex items-center justify-center font-bold text-xs shadow-2xs group-hover:bg-[#383838]">
              {userInitials}
            </div>
            <div className="text-left">
              <p className="text-[13px] font-semibold text-[#252525] leading-tight group-hover:text-black">
                {user?.email || 'user@nexora.ai'}
              </p>
              <p className="text-[11px] text-[#737373] leading-tight mt-0.5 flex items-center gap-1.5">
                <span className="font-medium text-[#252525]">{getRoleLabel()}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F0EFED] text-[#737373] border border-[#E7E5E4]">
                  Profile
                </span>
              </p>
            </div>
          </div>

          <span
            onClick={() => setProfileModalOpen(true)}
            className="md:hidden text-[12px] font-medium px-2 py-0.5 rounded bg-[#F0EFED] text-[#252525] border border-[#E7E5E4] cursor-pointer"
          >
            {getRoleLabel()}
          </span>

          <div className="h-4 w-px bg-[#E7E5E4] hidden md:block" />

          {/* Sign Out Button: 36px height, subtle hover lift, spring press */}
          <button
            onClick={logout}
            title="Sign out of Nexora.AI"
            className="btn-motion inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium text-[#737373] hover:text-[#252525] hover:bg-[#F5F5F4] border border-transparent hover:border-[#E7E5E4]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-[#737373] hover:text-[#252525] hover:bg-[#F5F5F4] md:hidden transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* =========================================================================
          APPLICATION BODY: Light neutral sidebar (#FAFAF9) + Main workspace (#FAFAF9)
          ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Desktop Sidebar: 240px wide, 40px item height, 4px vertical gaps */}
        <aside className="hidden md:flex md:w-60 flex-col bg-[#f7fbfd] border-r border-[#dfeaf2] shrink-0 min-h-[calc(100vh-3.5rem)]">
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="px-3 pt-1 pb-2">
                <span className="text-[12px] font-medium text-[#737373]">
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
                      className={`btn-motion w-full h-10 flex items-center gap-3 px-3.5 rounded-lg text-left text-[13px] relative cursor-pointer group transition-colors ${
                        isActive
                          ? 'bg-[#e9f5fc] text-[#1688d2] font-semibold'
                          : 'bg-transparent text-[#737373] hover:text-[#252525] hover:bg-[#F5F5F4] font-normal'
                      }`}
                    >
                      {/* Active vertical pill indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4.5 bg-[#1688d2] rounded-r animate-in fade-in duration-200" />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-[#252525]' : 'text-[#737373] group-hover:text-[#252525]'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Bottom: Interactive User, Role & Tenant Profile Card */}
            <div className="pt-4 border-t border-[#E7E5E4]">
              <div
                onClick={() => setProfileModalOpen(true)}
                className="btn-motion p-3.5 rounded-xl bg-white border border-[#E7E5E4] hover:border-[#252525]/40 hover:bg-[#FAFAF9] space-y-2.5 cursor-pointer shadow-2xs group transition-all"
                title="Click to view User Profile, Role Permissions & Tenant Isolation"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#252525]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Tenant Isolated</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAFAF9] text-[#737373] border border-[#E7E5E4] group-hover:bg-white">
                    pgvector
                  </span>
                </div>

                <div className="flex items-center gap-2.5 pt-0.5">
                  <div className="w-8 h-8 rounded-lg bg-[#252525] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#252525] truncate leading-tight group-hover:text-black">
                      {user?.email || 'admin@datafactz.ai'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#737373] mt-0.5">
                      <span className="capitalize font-medium text-[#252525]">
                        {getRoleLabel()}
                      </span>
                      <span className="text-[10px] text-[#737373] group-hover:text-[#252525] font-medium">
                        Profile &rarr;
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#E7E5E4]/60 flex items-center justify-between text-[10px] font-mono text-[#737373]">
                  <span className="truncate max-w-[120px]">{companyName || 'DataFactZ'}</span>
                  <span className="text-emerald-700 font-semibold">Active</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer (Tablet / Mobile) */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-[#252525]/20 backdrop-blur-xs flex animate-in fade-in duration-200">
            <div className="w-68 bg-[#FAFAF9] border-r border-[#E7E5E4] p-5 flex flex-col justify-between shadow-xl animate-in slide-in-from-left duration-200">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4] mb-3">
                  <span className="text-[12px] font-medium text-[#252525]">
                    Navigation
                  </span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded-md text-[#737373] hover:text-[#252525] btn-motion"
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
                        className={`w-full h-10 flex items-center gap-3 px-3.5 rounded-lg text-left text-[13px] transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#F0EFED] text-[#252525] font-medium'
                            : 'text-[#737373] hover:text-[#252525] hover:bg-[#F5F5F4]'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 transition-colors ${
                            isActive ? 'text-[#252525]' : 'text-[#737373]'
                          }`}
                        />
                        <span>{item.name}</span>
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
                className="pt-3 border-t border-[#E7E5E4] text-[12px] text-[#737373] cursor-pointer hover:bg-[#F0EFED] p-2 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#252525] truncate">{user?.email}</p>
                  <span className="text-[10px] text-[#252525] font-medium">&rarr;</span>
                </div>
                <p className="text-[11px] mt-0.5 text-[#737373]">{getRoleLabel()} • View Profile</p>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Workspace Canvas: 32px desktop padding, max-w-[1040px] aligned grid */}
        <main className="flex-1 bg-[linear-gradient(135deg,#f7fbfd,#fff)] overflow-y-auto">
          <div key={activePath} className="page-transition max-w-[1040px] mx-auto p-6 sm:p-8">
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
