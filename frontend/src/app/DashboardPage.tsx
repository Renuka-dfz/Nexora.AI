import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  Cable,
  ChartNoAxesCombined,
  CircleHelp,
  Megaphone,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getCompany, getContent, getKnowledge, getLeads } from "../services/api";
import type { Company } from "../types/api";
import { ErrorNotice, LoadingState } from "../components/Feedback";

const areas = [
  {
    title: "Company Knowledge",
    description: "Organize company sources and review knowledge records.",
    path: "/company-knowledge",
    icon: BookOpenText,
    tone: "violet",
  },
  {
    title: "Marketing Studio",
    description: "Create drafts and move content through review.",
    path: "/marketing",
    icon: Megaphone,
    tone: "blue",
  },
  {
    title: "Lead Management",
    description: "Keep track of leads and qualification records.",
    path: "/leads",
    icon: UsersRound,
    tone: "amber",
  },
  {
    title: "Integrations",
    description: "Review social account records saved for the company.",
    path: "/integrations",
    icon: Cable,
    tone: "green",
  },
];

export default function DashboardPage({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [counts, setCounts] = useState<{ knowledge: number; content: number; leads: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCounts(null);
    try {
      const [companyResult, knowledge, content, leads] = await Promise.all([
        getCompany(companyId),
        getKnowledge(companyId),
        getContent(companyId),
        getLeads(companyId),
      ]);
      setCompany(companyResult);
      setCounts({
        knowledge: knowledge.total,
        content: content.total,
        leads: leads.total,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load workspace overview.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page dashboard">
      <section className="welcome-panel">
        <div className="welcome-panel__copy">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{company ? `Welcome to ${company.company_name}.` : "A clearer view of what’s next."}</h1>
          <p>
            {company?.company_overview ||
              "Your company knowledge, marketing content, and leads in one place. Pick up where your team left off."}
          </p>
          {company?.website_url && (
            <a className="welcome-panel__link" href={company.website_url} rel="noreferrer" target="_blank">
              Visit company website <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          )}
        </div>
        <div aria-hidden="true" className="welcome-panel__art">
          <div className="welcome-panel__orb welcome-panel__orb--one" />
          <div className="welcome-panel__orb welcome-panel__orb--two" />
          <div className="welcome-panel__spark">
            <ChartNoAxesCombined size={35} strokeWidth={1.5} />
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-title" className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LIVE FROM YOUR WORKSPACE</span>
            <h2 id="overview-title">Workspace overview</h2>
          </div>
          <div className="section-heading__tools">
            <span className="data-note">
              <CircleHelp aria-hidden="true" size={15} />
              Counts come from company API records
            </span>
            <button aria-label="Refresh workspace overview" className="icon-button" disabled={loading} onClick={() => void load()} type="button">
              <RefreshCw aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        {error && <ErrorNotice message={error} onRetry={() => void load()} />}
        {loading ? (
          <LoadingState label="Loading workspace overview" />
        ) : (
          <div className="overview-grid">
            <OverviewCard icon={<BookOpenText size={18} />} label="Knowledge facts" value={counts?.knowledge} tone="violet" />
            <OverviewCard icon={<Megaphone size={18} />} label="Marketing content" value={counts?.content} tone="blue" />
            <OverviewCard icon={<UsersRound size={18} />} label="Leads" value={counts?.leads} tone="amber" />
          </div>
        )}
      </section>

      <section aria-labelledby="areas-title" className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">YOUR TOOLS</span><h2 id="areas-title">Workspace areas</h2></div>
        </div>
        <div className="areas-grid">
          {areas.map(({ description, icon: Icon, path, title, tone }) => (
            <Link className="area-card" key={path} to={path}>
              <span className={`area-card__icon area-card__icon--${tone}`}><Icon aria-hidden="true" size={19} strokeWidth={1.9} /></span>
              <span className="area-card__content"><strong>{title}</strong><span>{description}</span></span>
              <ArrowUpRight aria-hidden="true" className="area-card__arrow" size={17} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function OverviewCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | undefined;
  tone: string;
}) {
  return (
    <article className="overview-card">
      <div className="overview-card__top">
        <span className={`overview-card__icon overview-card__icon--${tone}`}>{icon}</span>
        <span className="overview-card__label">{label}</span>
      </div>
      <strong className="overview-card__value">{value?.toLocaleString() ?? "—"}</strong>
      <span className="overview-card__hint">{value === 1 ? "record" : "records"} in this company</span>
    </article>
  );
}
