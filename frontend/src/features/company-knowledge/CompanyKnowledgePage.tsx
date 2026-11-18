import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BookOpenText,
  Database,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  createKnowledge,
  createSource,
  getCategories,
  getKnowledge,
  getSources,
  getWebsiteCrawlStatus,
  indexCompanyKnowledge,
  queryCompanyKnowledge,
  roleCanReview,
  roleCanWrite,
  startWebsiteCrawl,
  verifyKnowledge,
} from "../../services/api";
import type {
  Category,
  CompanyKnowledgeContext,
  KnowledgeFact,
  KnowledgeIndexResult,
  KnowledgeMode,
  KnowledgeSource,
  UserRole,
  VerificationStatus,
  WebsiteCrawlJob,
} from "../../types/api";
import { EmptyState, ErrorNotice, LoadingState, SuccessNotice } from "../../components/Feedback";
import PageHeading from "../../components/PageHeading";

type Props = { companyId: string; role: UserRole };

export default function CompanyKnowledgePage({ companyId, role }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [facts, setFacts] = useState<KnowledgeFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<VerificationStatus | "all">("all");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [factTitle, setFactTitle] = useState("");
  const [factDescription, setFactDescription] = useState("");
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlJob, setCrawlJob] = useState<WebsiteCrawlJob | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlSaving, setCrawlSaving] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<KnowledgeMode>("hybrid");
  const [knowledgeResult, setKnowledgeResult] = useState<CompanyKnowledgeContext | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const [indexResult, setIndexResult] = useState<KnowledgeIndexResult | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResult, sourceResult, factResult] = await Promise.all([
        getCategories(companyId),
        getSources(companyId),
        getKnowledge(
          companyId,
          filter === "all" ? {} : { verification_status: filter },
        ),
      ]);
      setCategories(categoryResult.items);
      setSources(sourceResult.items);
      setFacts(factResult.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load knowledge.");
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      const source = await createSource(companyId, {
        source_url: sourceUrl.trim(),
        ...(sourceTitle.trim() && { page_title: sourceTitle.trim() }),
      });
      setSourceId(source.source_id);
      setSourceUrl("");
      setSourceTitle("");
      setSuccess("Source added. You can now attach knowledge facts to it.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not add source.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await createKnowledge(companyId, {
        source_id: sourceId,
        category_id: Number(categoryId),
        title: factTitle.trim(),
        ...(factDescription.trim() && { description: factDescription.trim() }),
      });
      setFactTitle("");
      setFactDescription("");
      setSuccess("Knowledge fact added and marked pending verification.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not add knowledge fact.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerification(
    factId: string,
    status: "verified" | "rejected",
  ) {
    setActionError(null);
    setSuccess(null);
    try {
      await verifyKnowledge(companyId, factId, status);
      setSuccess(`Fact ${status}.`);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not update verification.");
    }
  }

  async function handleStartCrawl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCrawlSaving(true);
    setCrawlError(null);
    setSuccess(null);
    try {
      const job = await startWebsiteCrawl(companyId, crawlUrl.trim());
      setCrawlJob(job);
      setCrawlUrl("");
      setSuccess("Website crawl queued. Progress is available below.");
      await load();
    } catch (caught) {
      setCrawlError(caught instanceof Error ? caught.message : "Could not start website crawl.");
    } finally {
      setCrawlSaving(false);
    }
  }

  async function handleRefreshCrawl() {
    if (!crawlJob) return;
    setCrawlError(null);
    try {
      const job = await getWebsiteCrawlStatus(companyId, crawlJob.job_id);
      setCrawlJob(job);
    } catch (caught) {
      setCrawlError(caught instanceof Error ? caught.message : "Could not refresh crawl status.");
    }
  }

  async function handleKnowledgeQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuerying(true);
    setQueryError(null);
    try {
      const result = await queryCompanyKnowledge(companyId, {
        query: knowledgeQuery.trim(),
        mode: knowledgeMode,
      });
      setKnowledgeResult(result);
    } catch (caught) {
      setQueryError(caught instanceof Error ? caught.message : "Could not search company knowledge.");
    } finally {
      setQuerying(false);
    }
  }

  async function handleIndexKnowledge() {
    setIndexing(true);
    setIndexError(null);
    setIndexResult(null);
    try {
      const result = await indexCompanyKnowledge(companyId);
      setIndexResult(result);
    } catch (caught) {
      setIndexError(caught instanceof Error ? caught.message : "Could not index company knowledge.");
    } finally {
      setIndexing(false);
    }
  }

  return (
    <div className="page feature-workspace">
      <PageHeading
        actions={
          <button className="button button--secondary" onClick={() => void load()} type="button">
            <RefreshCw aria-hidden="true" size={15} /> Refresh
          </button>
        }
        description="Manage company sources and review the knowledge records attached to them."
        eyebrow="COMPANY INTELLIGENCE"
        title="Company knowledge"
      />

      <div className="content-grid">
        <section className="panel knowledge-list-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">KNOWLEDGE BASE</span>
              <h2>Company facts</h2>
            </div>
            <label className="compact-filter">
              <span className="visually-hidden">Filter by verification status</span>
              <select
                onChange={(event) => setFilter(event.target.value as VerificationStatus | "all")}
                value={filter}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="conflicting">Conflicting</option>
              </select>
            </label>
          </div>
          {error && <ErrorNotice message={error} onRetry={() => void load()} />}
          {actionError && <ErrorNotice message={actionError} />}
          {success && <SuccessNotice message={success} />}
          {loading ? (
            <LoadingState label="Loading company knowledge" />
          ) : facts.length === 0 ? (
            <EmptyState title="No facts in this view">
              Add a company source and its first fact, or adjust the status filter.
            </EmptyState>
          ) : (
            <div className="record-list">
              {facts.map((fact) => {
                const source = sources.find((item) => item.source_id === fact.source_id);
                const category = categories.find((item) => item.category_id === fact.category_id);
                return (
                  <article className="knowledge-record" key={fact.fact_id}>
                    <div className="record-main">
                      <span className="record-icon record-icon--violet">
                        <BookOpenText aria-hidden="true" size={17} />
                      </span>
                      <div className="record-copy">
                        <div className="record-title-line">
                          <h3>{fact.title}</h3>
                          <span className={`status-pill status-pill--${fact.verification_status}`}>
                            {fact.verification_status}
                          </span>
                        </div>
                        <p>{fact.description || "No description provided."}</p>
                        <div className="record-meta">
                          <span>{category?.category_name ?? `Category ${fact.category_id}`}</span>
                          {source && <a href={source.source_url} rel="noreferrer" target="_blank">{source.page_title || source.source_url}</a>}
                          <span>{new Date(fact.extracted_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {roleCanReview(role) && fact.verification_status === "pending" && (
                      <div className="record-actions">
                        <button className="button button--small button--secondary" onClick={() => void handleVerification(fact.fact_id, "rejected")} type="button">Reject</button>
                        <button className="button button--small button--primary" onClick={() => void handleVerification(fact.fact_id, "verified")} type="button">
                          <ShieldCheck aria-hidden="true" size={14} /> Verify
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COMPANY SOURCES</span>
              <h2>Add a source</h2>
            </div>
            <span className="panel-heading__icon"><Plus aria-hidden="true" size={17} /></span>
          </div>
          {roleCanWrite(role) ? (
            <>
              <form className="form-stack" onSubmit={(event) => void handleAddSource(event)}>
                <label className="field">
                  <span>Source URL <i aria-hidden="true">*</i></span>
                  <input onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://company.com/about" required type="url" value={sourceUrl} />
                </label>
                <label className="field">
                  <span>Source label</span>
                  <input maxLength={255} onChange={(event) => setSourceTitle(event.target.value)} placeholder="About us" value={sourceTitle} />
                </label>
                <button className="button button--secondary button--wide" disabled={saving} type="submit">
                  {saving ? "Saving source…" : "Add source"} <Plus aria-hidden="true" size={16} />
                </button>
              </form>

              <div className="form-divider knowledge-divider" />
              <div className="panel-heading panel-heading--subsection">
                <div>
                  <span className="eyebrow">KNOWLEDGE RECORD</span>
                  <h2>Add a fact</h2>
                </div>
              </div>
              <form className="form-stack" onSubmit={(event) => void handleAddFact(event)}>
                <label className="field">
                  <span>Source <i aria-hidden="true">*</i></span>
                  <select onChange={(event) => setSourceId(event.target.value)} required value={sourceId}>
                    <option value="">Choose a company source</option>
                    {sources.map((source) => (
                      <option key={source.source_id} value={source.source_id}>
                        {source.page_title || source.source_url}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Fact title <i aria-hidden="true">*</i></span>
                  <input maxLength={255} onChange={(event) => setFactTitle(event.target.value)} placeholder="What should the team know?" required value={factTitle} />
                </label>
                <label className="field">
                  <span>Category <i aria-hidden="true">*</i></span>
                  <select onChange={(event) => setCategoryId(event.target.value)} required value={categoryId}>
                    <option value="">Choose a category</option>
                    {categories.map((category) => <option key={category.category_id} value={category.category_id}>{category.category_name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea onChange={(event) => setFactDescription(event.target.value)} placeholder="Add context for this fact…" rows={3} value={factDescription} />
                </label>
                {actionError && <ErrorNotice message={actionError} />}
                <button className="button button--primary button--wide" disabled={saving || categories.length === 0 || sources.length === 0} type="submit">
                  {saving ? "Saving fact…" : "Add fact"} <Plus aria-hidden="true" size={16} />
                </button>
              </form>
              <p className="form-footnote knowledge-footnote">Source records are stored by the API. Website crawling and automatic extraction are not available.</p>
            </>
          ) : (
            <EmptyState title="Read-only access">
              Your reviewer role can verify facts but cannot add sources or facts.
            </EmptyState>
          )}
        </aside>

        <div className="knowledge-tools">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">WEBSITE INGESTION</span>
                <h2><Globe2 aria-hidden="true" size={17} /> Crawl a website</h2>
              </div>
            </div>
            {role === "admin" ? (
              <>
                <form className="form-stack" onSubmit={(event) => void handleStartCrawl(event)}>
                  <label className="field">
                    <span>Website URL <i aria-hidden="true">*</i></span>
                    <input
                      onChange={(event) => setCrawlUrl(event.target.value)}
                      placeholder="https://company.com"
                      required
                      type="url"
                      value={crawlUrl}
                    />
                  </label>
                  {crawlError && <ErrorNotice message={crawlError} />}
                  <button className="button button--primary" disabled={crawlSaving} type="submit">
                    {crawlSaving ? "Queueing crawl…" : "Start crawl"} <Globe2 aria-hidden="true" size={15} />
                  </button>
                </form>
                {crawlJob && (
                  <div className="crawl-job">
                    <div className="crawl-job__heading">
                      <span className="eyebrow">LATEST JOB</span>
                      <span className={`status-pill status-pill--${crawlJob.status}`}>{crawlJob.status}</span>
                    </div>
                    <a href={crawlJob.website_url} rel="noreferrer" target="_blank">{crawlJob.website_url}</a>
                    <p>
                      {crawlJob.pages_processed} of {crawlJob.pages_discovered} pages processed
                      {" · "}{crawlJob.sections_saved} sections saved
                    </p>
                    {crawlJob.error_message && <ErrorNotice message={crawlJob.error_message} />}
                    <button className="button button--secondary button--small" onClick={() => void handleRefreshCrawl()} type="button">
                      <RefreshCw aria-hidden="true" size={14} /> Refresh status
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="form-footnote">Website crawling is available to company admins.</p>
            )}
            <p className="form-footnote">Crawl jobs require the backend Redis queue and Celery worker to be running.</p>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">KNOWLEDGE RETRIEVAL</span>
                <h2><Search aria-hidden="true" size={17} /> Search company knowledge</h2>
              </div>
            </div>
            <form className="form-stack" onSubmit={(event) => void handleKnowledgeQuery(event)}>
              <label className="field">
                <span>Question or search <i aria-hidden="true">*</i></span>
                <textarea
                  onChange={(event) => setKnowledgeQuery(event.target.value)}
                  placeholder="What products does the company offer?"
                  required
                  rows={3}
                  value={knowledgeQuery}
                />
              </label>
              <label className="field">
                <span>Retrieval mode</span>
                <select onChange={(event) => setKnowledgeMode(event.target.value as KnowledgeMode)} value={knowledgeMode}>
                  <option value="hybrid">Hybrid</option>
                  <option value="structured">Structured facts</option>
                  <option value="semantic">Semantic search</option>
                </select>
              </label>
              {queryError && <ErrorNotice message={queryError} />}
              <button className="button button--primary" disabled={querying} type="submit">
                {querying ? "Searching…" : "Search knowledge"} <Search aria-hidden="true" size={15} />
              </button>
            </form>
            {knowledgeResult && (
              <div className="knowledge-query-results" aria-live="polite">
                <div className="crawl-job__heading">
                  <span className="eyebrow">RESULTS</span>
                  <span className="form-footnote">
                    {knowledgeResult.total_facts} facts · {knowledgeResult.total_chunks} passages · {knowledgeResult.mode}
                  </span>
                </div>
                {knowledgeResult.context_text && <p className="knowledge-context">{knowledgeResult.context_text}</p>}
                {knowledgeResult.structured_facts.map((fact) => (
                  <article className="knowledge-result" key={fact.fact_id}>
                    <strong>{fact.title}</strong>
                    <span>{fact.description || "No description provided."}</span>
                    <div className="record-meta">
                      <span>{fact.category_name}</span>
                      <span>{fact.verification_status}</span>
                      <a href={fact.source_url} rel="noreferrer" target="_blank">View source</a>
                    </div>
                  </article>
                ))}
                {knowledgeResult.semantic_results.map((chunk) => (
                  <article className="knowledge-result" key={chunk.chunk_id}>
                    <strong>{chunk.heading_path || "Semantic passage"}</strong>
                    <span>{chunk.content}</span>
                    <div className="record-meta">
                      {chunk.score !== null && <span>Relevance {chunk.score.toFixed(3)}</span>}
                      <a href={chunk.source_url} rel="noreferrer" target="_blank">View source</a>
                    </div>
                  </article>
                ))}
                {knowledgeResult.total_facts === 0 && knowledgeResult.total_chunks === 0 && (
                  <p className="form-footnote">No matching company knowledge was found.</p>
                )}
              </div>
            )}
          </section>
        </div>

        {role === "admin" && (
          <section className="panel knowledge-index-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SEMANTIC INDEX</span>
                <h2><Database aria-hidden="true" size={17} /> Index verified knowledge</h2>
              </div>
              <button className="button button--secondary" disabled={indexing} onClick={() => void handleIndexKnowledge()} type="button">
                {indexing ? "Indexing…" : "Run indexing"} <Database aria-hidden="true" size={15} />
              </button>
            </div>
            <p className="form-footnote">Only eligible verified facts are indexed. Indexing requires the backend database and embedding configuration.</p>
            {indexError && <ErrorNotice message={indexError} />}
            {indexResult && (
              <SuccessNotice message={`Index ${indexResult.status}: ${indexResult.facts_processed} facts processed, ${indexResult.chunks_created} passages created, ${indexResult.chunks_updated} updated.`} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
