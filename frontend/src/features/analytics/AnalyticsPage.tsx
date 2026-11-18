import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, Eye, MousePointer2, RefreshCw } from "lucide-react";
import { getPerformance } from "../../services/api";
import type { PerformanceRecord } from "../../types/api";
import { EmptyState, ErrorNotice, LoadingState } from "../../components/Feedback";
import PageHeading from "../../components/PageHeading";

export default function AnalyticsPage({ companyId }: { companyId: string }) {
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords((await getPerformance(companyId)).items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load performance records.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page feature-workspace">
      <PageHeading
        actions={<button className="button button--secondary" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={15} /> Refresh</button>}
        description="Review metrics recorded for your company’s published marketing content."
        eyebrow="PERFORMANCE"
        title="Analytics"
      />
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}
      {loading ? (
        <LoadingState label="Loading performance data" />
      ) : records.length === 0 ? (
        <section className="panel analytics-empty">
          <EmptyState title="No performance records yet">
            Analytics displays performance records already stored by the backend. Social metrics collection is not connected.
          </EmptyState>
        </section>
      ) : (
        <>
          <div className="metric-grid">
            <MetricCard icon={<Activity size={18} />} label="Performance records loaded" value={records.length} />
            <MetricCard icon={<Eye size={18} />} label="Records with impressions" value={records.filter((item) => item.impressions !== null).length} />
            <MetricCard icon={<MousePointer2 size={18} />} label="Records with clicks" value={records.filter((item) => item.clicks !== null).length} />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">RECORDED DATA</span><h2>Performance records</h2></div>
              <span className="heading-count">{records.length} shown</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Collected</th><th>Period</th><th>Impressions</th><th>Reach</th><th>Likes</th><th>Comments</th><th>Clicks</th><th>Source</th></tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.performance_id}>
                      <td>{new Date(record.collected_at).toLocaleDateString()}</td>
                      <td>{record.metric_period}</td>
                      <td>{formatMetric(record.impressions)}</td>
                      <td>{formatMetric(record.reach)}</td>
                      <td>{formatMetric(record.likes)}</td>
                      <td>{formatMetric(record.comments)}</td>
                      <td>{formatMetric(record.clicks)}</td>
                      <td>{record.metric_source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className="metric-card">
      <span className="metric-card__icon">{icon}</span>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>From API records currently loaded</small>
    </article>
  );
}

function formatMetric(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}
