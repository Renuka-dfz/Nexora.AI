import { useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import AnalyticsPage from "../features/analytics/AnalyticsPage";
import CompanyKnowledgePage from "../features/company-knowledge/CompanyKnowledgePage";
import IntegrationsPage from "../features/integrations/IntegrationsPage";
import LeadsPage from "../features/lead-management/LeadsPage";
import MarketingPage from "../features/marketing/MarketingPage";
import SettingsPage from "../features/settings/SettingsPage";
import { LoadingState } from "../components/Feedback";
import AuthPage from "./AuthPage";
import { useAuth } from "./AuthContext";
import DashboardPage from "./DashboardPage";
import OnboardingPage from "./OnboardingPage";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState label="Preparing your workspace" />;
  }

  return (
    <Routes>
      <Route element={<AuthPage />} path="/auth" />
      <Route element={<OnboardingPage />} path="/onboarding" />
      <Route element={<WorkspaceGuard />}>
        <Route element={<WorkspaceLayout />}>
          <Route element={<DashboardPage companyId={user?.company_id ?? ""} />} index />
          <Route
            element={<CompanyKnowledgePage companyId={user?.company_id ?? ""} role={user?.role ?? "user"} />}
            path="company-knowledge"
          />
          <Route
            element={<MarketingPage companyId={user?.company_id ?? ""} role={user?.role ?? "user"} />}
            path="marketing"
          />
          <Route
            element={<LeadsPage companyId={user?.company_id ?? ""} role={user?.role ?? "user"} />}
            path="leads"
          />
          <Route element={<AnalyticsPage companyId={user?.company_id ?? ""} />} path="analytics" />
          <Route
            element={<IntegrationsPage companyId={user?.company_id ?? ""} role={user?.role ?? "user"} />}
            path="integrations"
          />
          <Route element={<SettingsPage role={user?.role ?? "user"} user={user!} />} path="settings" />
        </Route>
      </Route>
      <Route element={<Navigate replace to={user ? (user.company_id ? "/" : "/onboarding") : "/auth"} />} path="*" />
    </Routes>
  );
}

function WorkspaceGuard() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Preparing your workspace" />;
  if (!user) return <Navigate replace to="/auth" />;
  if (!user.company_id) return <Navigate replace to="/onboarding" />;
  return <Outlet />;
}

function WorkspaceLayout() {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <Sidebar
        companyName="Company workspace"
        isOpen={sidebarOpen}
        onNavigate={closeSidebar}
      />
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={closeSidebar}
          type="button"
        />
      )}
      <div className="app-shell__main">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          onSignOut={signOut}
          userEmail={user?.email ?? ""}
        />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
