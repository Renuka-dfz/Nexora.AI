import { useEffect, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getApiHealth } from "../services/api";
import { navigationItems } from "./navigation";

type TopBarProps = {
  onMenuClick: () => void;
  onSignOut: () => void;
  userEmail: string;
};

export default function TopBar({
  onMenuClick,
  onSignOut,
  userEmail,
}: TopBarProps) {
  const { pathname } = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const currentPage =
    navigationItems.find((item) => item.path === pathname)?.label ?? "Workspace";

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        await getApiHealth();
        if (active) {
          setApiOnline(true);
          setApiError(null);
        }
      } catch (error) {
        if (active) {
          setApiOnline(false);
          setApiError(
            error instanceof Error ? error.message : "Backend is unavailable",
          );
        }
      }
    };

    void checkHealth();
    const intervalId = window.setInterval(() => void checkHealth(), 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <header className="topbar">
      <button
        aria-label="Open navigation"
        className="icon-button topbar__menu"
        onClick={onMenuClick}
        type="button"
      >
        <Menu aria-hidden="true" size={20} />
      </button>
      <div className="topbar__context">
        <span className="topbar__eyebrow">NEXORA.AI WORKSPACE</span>
        <span aria-current="page" className="topbar__page">
          {currentPage}
        </span>
      </div>
      <div className="topbar__actions">
        <div
          aria-label={
            apiOnline === null
              ? "Backend health check in progress"
              : apiOnline
                ? "Backend is online"
                : "Backend is offline"
          }
          className={`workspace-badge${
            apiOnline === null
              ? ""
              : apiOnline
                ? " workspace-badge--online"
                : " workspace-badge--offline"
          }`}
          title={apiError ?? "Connected to the Nexora.AI health endpoint"}
        >
          <span aria-hidden="true" className="workspace-badge__dot" />
          <span>
            {apiOnline === null
              ? "Checking API"
              : apiOnline
                ? "API online"
                : "API offline"}
          </span>
        </div>
        <span className="topbar__user" title={userEmail}>
          {userEmail}
        </span>
        <button
          aria-label="Sign out"
          className="icon-button topbar__signout"
          onClick={onSignOut}
          title="Sign out"
          type="button"
        >
          <LogOut aria-hidden="true" size={17} />
        </button>
      </div>
    </header>
  );
}
