import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

// Lazy-loaded pages to maintain ultra-fast initial bundle size
const OverviewPage = lazy(() =>
  import('./features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const MarketingWorkspacePage = lazy(() =>
  import('./features/marketing/MarketingWorkspacePage').then((m) => ({
    default: m.MarketingWorkspacePage,
  }))
);
const ContentStudioPage = lazy(() =>
  import('./features/content-studio/ContentStudioPage').then((m) => ({
    default: m.ContentStudioPage,
  }))
);
const LeadsPage = lazy(() =>
  import('./features/lead-management/LeadsPage').then((m) => ({ default: m.LeadsPage }))
);
const CompanySettingsPage = lazy(() =>
  import('./features/settings/CompanySettingsPage').then((m) => ({
    default: m.CompanySettingsPage,
  }))
);
const LoginPage = lazy(() =>
  import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const OnboardingPage = lazy(() =>
  import('./features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage }))
);
const InviteAcceptPage = lazy(() =>
  import('./features/auth/InviteAcceptPage').then((m) => ({ default: m.InviteAcceptPage }))
);

// Layout-stable Soft Graphite skeleton loader (prevents layout shifts during React.lazy loading)
const PageSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Title Bar Skeleton */}
    <div className="pb-5 border-b border-[#E7E5E4] flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md animate-shimmer" />
        <div className="h-4 w-96 rounded animate-shimmer" />
      </div>
      <div className="h-9 w-32 rounded-lg animate-shimmer" />
    </div>

    {/* Content Skeleton Grid: 32px grid gap matching Overview */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="h-[360px] bg-[#FFFFFF] border border-[#E7E5E4] rounded-xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md animate-shimmer" />
          <div className="space-y-1.5 flex-1">
            <div className="h-5 w-40 rounded animate-shimmer" />
            <div className="h-3 w-28 rounded animate-shimmer" />
          </div>
        </div>
        <div className="h-16 rounded animate-shimmer" />
        <div className="space-y-2 pt-2">
          <div className="h-3.5 w-full rounded animate-shimmer" />
          <div className="h-3.5 w-5/6 rounded animate-shimmer" />
          <div className="h-3.5 w-3/4 rounded animate-shimmer" />
        </div>
      </div>
      <div className="h-[360px] bg-[#FFFFFF] border border-[#E7E5E4] rounded-xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md animate-shimmer" />
          <div className="space-y-1.5 flex-1">
            <div className="h-5 w-40 rounded animate-shimmer" />
            <div className="h-3 w-28 rounded animate-shimmer" />
          </div>
        </div>
        <div className="h-16 rounded animate-shimmer" />
        <div className="space-y-2 pt-2">
          <div className="h-3.5 w-full rounded animate-shimmer" />
          <div className="h-3.5 w-5/6 rounded animate-shimmer" />
          <div className="h-3.5 w-3/4 rounded animate-shimmer" />
        </div>
      </div>
    </div>
  </div>
);

const AppRoutes: React.FC = () => {
  const { isAuthenticated, hasCompany, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Legacy route redirections to preferred clean routes
  useEffect(() => {
    if (currentPath === '/app/studio') navigate('/content-studio');
    else if (currentPath === '/app/leads') navigate('/leads');
    else if (currentPath === '/app/settings') navigate('/settings');
    else if (currentPath === '/app/approvals' || currentPath === '/app/knowledge') navigate('/marketing');
    else if (currentPath === '/app/team') navigate('/settings');
  }, [currentPath]);

  // Root redirect per Section 7 (Landing page removed from active routing)
  useEffect(() => {
    if (isLoading) return;
    if (currentPath === '/') {
      if (!isAuthenticated) {
        navigate('/login');
      } else if (!hasCompany) {
        navigate('/onboarding');
      } else {
        navigate('/overview');
      }
    }
  }, [currentPath, isAuthenticated, hasCompany, isLoading]);

  // If user is already authenticated with a company and visits /login or /register, redirect to /overview
  useEffect(() => {
    if (!isLoading && isAuthenticated && hasCompany && (currentPath === '/login' || currentPath === '/register')) {
      navigate('/overview');
    }
  }, [isAuthenticated, hasCompany, currentPath, isLoading]);

  // Handle invitation token route
  if (currentPath.startsWith('/invite/accept') || currentPath.startsWith('/invite')) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
    return (
      <Suspense fallback={<PageSkeleton />}>
        <InviteAcceptPage token={token} onNavigate={navigate} />
      </Suspense>
    );
  }

  // Public / Auth routes
  if (currentPath === '/login') {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <LoginPage onNavigate={navigate} />
      </Suspense>
    );
  }

  if (currentPath === '/register') {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <RegisterPage onNavigate={navigate} />
      </Suspense>
    );
  }

  if (currentPath === '/onboarding') {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <OnboardingPage onNavigate={navigate} />
      </Suspense>
    );
  }

  // Loading state while verifying authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#252525] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#737373] font-medium tracking-wide">Loading Nexora.AI...</p>
        </div>
      </div>
    );
  }

  // Protected application routes inside the unified AppShell
  return (
    <ProtectedRoute onNavigate={navigate}>
      <AppShell activePath={currentPath} onNavigate={navigate}>
        <Suspense fallback={<PageSkeleton />}>
          {currentPath === '/overview' && <OverviewPage onNavigate={navigate} />}
          {currentPath === '/marketing' && <MarketingWorkspacePage onNavigate={navigate} />}
          {currentPath === '/content-studio' && <ContentStudioPage onNavigate={navigate} />}
          {currentPath === '/leads' && <LeadsPage />}
          {currentPath === '/settings' && <CompanySettingsPage />}

          {/* Fallback for undefined sub-paths inside app */}
          {!['/overview', '/marketing', '/content-studio', '/leads', '/settings'].includes(currentPath) && (
            <OverviewPage onNavigate={navigate} />
          )}
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
