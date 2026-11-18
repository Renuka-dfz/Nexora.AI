import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, UserRoundPlus, UsersRound } from "lucide-react";
import { createLead, createQualification, getLeads, roleCanWrite } from "../../services/api";
import type { Lead, UserRole } from "../../types/api";
import { EmptyState, ErrorNotice, LoadingState, SuccessNotice } from "../../components/Feedback";
import PageHeading from "../../components/PageHeading";

type Props = { companyId: string; role: UserRole };

export default function LeadsPage({ companyId, role }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [industry, setIndustry] = useState("");
  const [qualifyingLead, setQualifyingLead] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [intent, setIntent] = useState<"unknown" | "low" | "medium" | "high">("unknown");
  const [qualificationStatus, setQualificationStatus] = useState<"pending" | "qualified" | "nurture" | "unqualified">("pending");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads((await getLeads(companyId)).items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() && !email.trim() && !organization.trim()) {
      setActionError("Add at least a name, email, or organization for this lead.");
      return;
    }
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await createLead(companyId, {
        ...(name.trim() && { full_name: name.trim() }),
        ...(email.trim() && { email: email.trim() }),
        ...(organization.trim() && { organization_name: organization.trim() }),
        ...(industry.trim() && { industry: industry.trim() }),
      });
      setName("");
      setEmail("");
      setOrganization("");
      setIndustry("");
      setSuccess("Lead added to your company.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not create lead.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQualification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!qualifyingLead) return;
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await createQualification(qualifyingLead, {
        ...(score !== "" && { lead_score: Number(score) }),
        intent_level: intent,
        qualification_status: qualificationStatus,
        ...(reason.trim() && { qualification_reason: reason.trim() }),
      });
      setQualifyingLead(null);
      setScore("");
      setIntent("unknown");
      setQualificationStatus("pending");
      setReason("");
      setSuccess("Manual qualification record saved.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save qualification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page feature-workspace">
      <PageHeading
        description="Review company leads and, when appropriate, record qualification results."
        eyebrow="PIPELINE"
        title="Lead management"
      />
      {actionError && <ErrorNotice message={actionError} />}
      {success && <SuccessNotice message={success} />}
      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COMPANY PIPELINE</span>
              <h2>Leads <span className="heading-count">{leads.length}</span></h2>
            </div>
            <span className="panel-heading__icon"><UsersRound aria-hidden="true" size={17} /></span>
          </div>
          {error && <ErrorNotice message={error} onRetry={() => void load()} />}
          {loading ? (
            <LoadingState label="Loading leads" />
          ) : leads.length === 0 ? (
            <EmptyState title="No leads yet">Add a lead to start keeping your pipeline in one place.</EmptyState>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Lead</th><th>Organization</th><th>Status</th><th>Added</th><th><span className="visually-hidden">Actions</span></th></tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.lead_id}>
                      <td>
                        <div className="table-person">
                          <span className="avatar">{(lead.full_name || lead.email || "?").slice(0, 1).toUpperCase()}</span>
                          <span><strong>{lead.full_name || "Unnamed lead"}</strong><small>{lead.email || "No email"}</small></span>
                        </div>
                      </td>
                      <td>{lead.organization_name || "—"}{lead.industry && <small className="table-subtext">{lead.industry}</small>}</td>
                      <td><span className={`status-pill status-pill--${lead.lead_status}`}>{lead.lead_status}</span></td>
                      <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                      <td>
                        {roleCanWrite(role) && (
                          <button
                            aria-label={`Add manual qualification for ${lead.full_name || lead.email || "lead"}`}
                            className="button button--small button--secondary"
                            onClick={() => setQualifyingLead(qualifyingLead === lead.lead_id ? null : lead.lead_id)}
                            type="button"
                          >
                            Qualify
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {qualifyingLead && roleCanWrite(role) && (
            <form className="qualification-form" onSubmit={(event) => void handleQualification(event)}>
              <div className="panel-heading">
                <div><span className="eyebrow">MANUAL ENTRY</span><h2>Record qualification</h2></div>
                <button aria-label="Close qualification form" className="icon-button" onClick={() => setQualifyingLead(null)} type="button">×</button>
              </div>
              <div className="form-row form-row--three">
                <label className="field"><span>Score (0–100)</span><input max="100" min="0" onChange={(event) => setScore(event.target.value)} placeholder="Optional" type="number" value={score} /></label>
                <label className="field"><span>Intent</span><select onChange={(event) => setIntent(event.target.value as typeof intent)} value={intent}><option value="unknown">Unknown</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                <label className="field"><span>Status</span><select onChange={(event) => setQualificationStatus(event.target.value as typeof qualificationStatus)} value={qualificationStatus}><option value="pending">Pending</option><option value="qualified">Qualified</option><option value="nurture">Nurture</option><option value="unqualified">Unqualified</option></select></label>
              </div>
              <label className="field"><span>Reason</span><textarea onChange={(event) => setReason(event.target.value)} placeholder="Optional context for this record" rows={2} value={reason} /></label>
              <button className="button button--primary button--small" disabled={saving} type="submit">{saving ? "Saving…" : "Save qualification"} <Plus aria-hidden="true" size={14} /></button>
              <p className="form-footnote">This records values entered by you. Automated AI scoring is not available in the backend yet.</p>
            </form>
          )}
        </section>

        <aside className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">ADD TO PIPELINE</span><h2>New lead</h2></div>
            <span className="panel-heading__icon"><UserRoundPlus aria-hidden="true" size={17} /></span>
          </div>
          {roleCanWrite(role) ? (
            <form className="form-stack" onSubmit={(event) => void handleCreate(event)}>
              <label className="field"><span>Full name</span><input maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="Name" value={name} /></label>
              <label className="field"><span>Email</span><input onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" type="email" value={email} /></label>
              <label className="field"><span>Organization</span><input maxLength={200} onChange={(event) => setOrganization(event.target.value)} placeholder="Company" value={organization} /></label>
              <label className="field"><span>Industry</span><input maxLength={150} onChange={(event) => setIndustry(event.target.value)} placeholder="Industry" value={industry} /></label>
              {actionError && <ErrorNotice message={actionError} />}
              <button className="button button--primary button--wide" disabled={saving} type="submit">{saving ? "Adding lead…" : "Add lead"} <Plus aria-hidden="true" size={16} /></button>
            </form>
          ) : (
            <EmptyState title="Read-only access">Your reviewer role can view leads but cannot add or qualify them.</EmptyState>
          )}
        </aside>
      </div>
    </div>
  );
}
