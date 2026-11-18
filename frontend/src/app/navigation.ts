import {
  BarChart3,
  BookOpenText,
  Cable,
  ChartNoAxesCombined,
  LayoutDashboard,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Company Knowledge", path: "/company-knowledge", icon: BookOpenText },
  { label: "Marketing Studio", path: "/marketing", icon: Megaphone },
  { label: "Lead Management", path: "/leads", icon: BarChart3 },
  { label: "Analytics", path: "/analytics", icon: ChartNoAxesCombined },
  { label: "Integrations", path: "/integrations", icon: Cable },
  { label: "Settings", path: "/settings", icon: Settings },
];
