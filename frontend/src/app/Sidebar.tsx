import { BrainCircuit, ChevronLeft, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navigationItems } from "./navigation";

type SidebarProps = {
  isOpen: boolean;
  onNavigate: () => void;
  companyName: string;
};

export default function Sidebar({ companyName, isOpen, onNavigate }: SidebarProps) {
  return (
    <aside className={`sidebar${isOpen ? " sidebar--open" : ""}`}>
      <div className="sidebar__brand-row">
        <NavLink
          aria-label="Nexora.AI dashboard"
          className="brand"
          onClick={onNavigate}
          to="/"
        >
          <span className="brand__mark">
            <BrainCircuit aria-hidden="true" size={21} strokeWidth={2.2} />
          </span>
          <span className="brand__name">
            Nexora<span>.AI</span>
          </span>
        </NavLink>
        <button
          aria-label="Close navigation"
          className="icon-button sidebar__close"
          onClick={onNavigate}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={19} />
        </button>
      </div>

      <div className="sidebar__section-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="sidebar__nav">
        {navigationItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link--active" : ""}`
            }
            end={path === "/"}
            key={path}
            onClick={onNavigate}
            to={path}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <div className="sidebar__plan-card">
          <span className="sidebar__plan-icon">
            <Sparkles aria-hidden="true" size={16} />
          </span>
          <p>{companyName}</p>
          <span>Company workspace</span>
          <NavLink onClick={onNavigate} to="/settings">View company profile</NavLink>
        </div>
        <div className="sidebar__footer">Nexora.AI · Company workspace</div>
      </div>
    </aside>
  );
}
