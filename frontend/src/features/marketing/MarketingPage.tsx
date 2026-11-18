import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  FileText,
  Megaphone,
  Plus,
  Send,
} from "lucide-react";
import { createContent, getContent, roleCanReview, roleCanWrite, transitionContent } from "../../services/api";
import type { MarketingContent, Platform, UserRole } from "../../types/api";
import { EmptyState, ErrorNotice, LoadingState, SuccessNotice } from "../../components/Feedback";
import PageHeading from "../../components/PageHeading";

type Props = { companyId: string; role: UserRole };

export default function MarketingPage({ companyId, role }: Props) {
  const [items, setItems] = useState<MarketingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("social post");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getContent(companyId);
      setItems(response.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load content.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await createContent(companyId, {
        content_title: title.trim(),
        content_type: contentType.trim(),
        platform_target: platform,
        content_text: body.trim(),
        ...(topic.trim() && { topic: topic.trim() }),
        ...(tone.trim() && { tone: tone.trim() }),
      });
      setTitle("");
      setTopic("");
      setTone("");
      setBody("");
      setSuccess("Manual draft saved.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save this draft.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(contentId: string, action: "submit" | "approve" | "reject") {
    setActionError(null);
    setSuccess(null);
    try {
      await transitionContent(contentId, action);
      const result =
        action === "submit"
          ? "submitted for review"
          : action === "approve"
            ? "approved"
            : "rejected";
      setSuccess(`Content ${result}.`);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not update the content status.");
    }
  }

  const visibleItems = filter === "all" ? items : items.filter((item) => item.approval_status === filter);

  return (
    <div className="page feature-workspace">
      <PageHeading
        description="Create manual content drafts and move them through the available review workflow."
        eyebrow="CONTENT WORKFLOW"
        title="Marketing studio"
      />
      {actionError && <ErrorNotice message={actionError} />}
      {success && <SuccessNotice message={success} />}

      <div className="content-grid">
        <section className="panel content-library">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR CONTENT</span>
              <h2>Drafts & review</h2>
            </div>
            <label className="compact-filter">
              <span className="visually-hidden">Filter content by status</span>
              <select onChange={(event) => setFilter(event.target.value)} value={filter}>
                <option value="all">All content</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
          {error && <ErrorNotice message={error} onRetry={() => void load()} />}
          {loading ? (
            <LoadingState label="Loading marketing content" />
          ) : visibleItems.length === 0 ? (
            <EmptyState title={items.length ? "No content matches this filter" : "Your content library is empty"}>
              Create a manual draft to start using the content review workflow.
            </EmptyState>
          ) : (
            <div className="content-cards">
              {visibleItems.map((item) => (
                <article className="content-card" key={item.content_id}>
                  <div className="content-card__top">
                    <span className="record-icon record-icon--blue">
                      <FileText aria-hidden="true" size={17} />
                    </span>
                    <span className={`status-pill status-pill--${item.approval_status}`}>{item.approval_status === "pending" ? "pending review" : item.approval_status}</span>
                  </div>
                  <h3>{item.content_title}</h3>
                  <p className="content-card__excerpt">{item.content_text}</p>
                  <div className="record-meta">
                    <span>{item.platform_target}</span>
                    <span>{item.content_type}</span>
                    <span>{item.generation_type === "manual" ? "Manual draft" : "AI generated"}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  {item.topic && <div className="content-topic">Topic · {item.topic}</div>}
                  <div className="content-card__actions">
                    {item.approval_status === "draft" && roleCanWrite(role) && (
                      <button className="button button--small button--secondary" onClick={() => void handleTransition(item.content_id, "submit")} type="button">
                        <Send aria-hidden="true" size={14} /> Submit for review
                      </button>
                    )}
                    {item.approval_status === "pending" && roleCanReview(role) && (
                      <>
                        <button className="button button--small button--secondary" onClick={() => void handleTransition(item.content_id, "reject")} type="button">Reject</button>
                        <button className="button button--small button--primary" onClick={() => void handleTransition(item.content_id, "approve")} type="button">
                          Approve <ArrowUpRight aria-hidden="true" size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MANUAL WORKFLOW</span>
              <h2>New content draft</h2>
            </div>
            <span className="panel-heading__icon"><Megaphone aria-hidden="true" size={17} /></span>
          </div>
          {roleCanWrite(role) ? (
            <form className="form-stack" onSubmit={(event) => void handleCreate(event)}>
              <label className="field">
                <span>Title <i aria-hidden="true">*</i></span>
                <input maxLength={255} onChange={(event) => setTitle(event.target.value)} placeholder="A clear working title" required value={title} />
              </label>
              <div className="form-row">
                <label className="field">
                  <span>Platform <i aria-hidden="true">*</i></span>
                  <select onChange={(event) => setPlatform(event.target.value as Platform)} value={platform}>
                    <option value="linkedin">LinkedIn</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </label>
                <label className="field">
                  <span>Content type <i aria-hidden="true">*</i></span>
                  <input maxLength={50} onChange={(event) => setContentType(event.target.value)} required value={contentType} />
                </label>
              </div>
              <label className="field">
                <span>Topic</span>
                <input maxLength={255} onChange={(event) => setTopic(event.target.value)} placeholder="What is this about?" value={topic} />
              </label>
              <label className="field">
                <span>Tone</span>
                <input maxLength={50} onChange={(event) => setTone(event.target.value)} placeholder="e.g. informative" value={tone} />
              </label>
              <label className="field">
                <span>Content <i aria-hidden="true">*</i></span>
                <textarea onChange={(event) => setBody(event.target.value)} placeholder="Write the content for your draft…" required rows={7} value={body} />
              </label>
              {actionError && <ErrorNotice message={actionError} />}
              <button className="button button--primary button--wide" disabled={saving} type="submit">
                {saving ? "Saving draft…" : "Save manual draft"} <Plus aria-hidden="true" size={16} />
              </button>
              <p className="form-footnote">This saves text you provide. AI generation, scheduling, and publishing are not connected.</p>
            </form>
          ) : (
            <EmptyState title="Review-only access">
              Your reviewer role can approve or reject submitted content.
            </EmptyState>
          )}
        </aside>
      </div>
    </div>
  );
}
