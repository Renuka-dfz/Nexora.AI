import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cable, Plus, ShieldAlert } from "lucide-react";
import { createSocialAccount, getSocialAccounts } from "../../services/api";
import type { Platform, SocialAccount, UserRole } from "../../types/api";
import { EmptyState, ErrorNotice, LoadingState, SuccessNotice } from "../../components/Feedback";
import PageHeading from "../../components/PageHeading";

export default function IntegrationsPage({
  companyId,
  role,
}: {
  companyId: string;
  role: UserRole;
}) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [externalId, setExternalId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [handle, setHandle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts((await getSocialAccounts(companyId)).items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load account records.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await createSocialAccount(companyId, {
        platform,
        external_account_id: externalId.trim(),
        ...(accountName.trim() && { account_name: accountName.trim() }),
        ...(handle.trim() && { account_handle: handle.trim() }),
      });
      setExternalId("");
      setAccountName("");
      setHandle("");
      setSuccess("Social account record added. No OAuth connection was made.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not add account record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page feature-workspace">
      <PageHeading
        description="View social account records stored for this company."
        eyebrow="CONNECTED CHANNELS"
        title="Integrations"
      />
      <div className="integration-notice">
        <ShieldAlert aria-hidden="true" size={19} />
        <p><strong>Account records are not live integrations.</strong> OAuth, publishing, and metrics synchronization are not implemented. Adding an account below only saves its metadata.</p>
      </div>
      {actionError && <ErrorNotice message={actionError} />}
      {success && <SuccessNotice message={success} />}
      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">SOCIAL ACCOUNT RECORDS</span><h2>Accounts</h2></div>
            <span className="panel-heading__icon"><Cable aria-hidden="true" size={17} /></span>
          </div>
          {error && <ErrorNotice message={error} onRetry={() => void load()} />}
          {loading ? <LoadingState label="Loading account records" /> : accounts.length === 0 ? (
            <EmptyState title="No account records">
              There are no social account records saved for this company.
            </EmptyState>
          ) : (
            <div className="record-list">
              {accounts.map((account) => (
                <article className="integration-record" key={account.social_account_id}>
                  <span className={`platform-mark platform-mark--${account.platform}`}>{account.platform === "linkedin" ? "in" : "ig"}</span>
                  <div className="record-copy">
                    <div className="record-title-line"><h3>{account.account_name || account.platform}</h3><span className={`status-pill status-pill--${account.connection_status}`}>{account.connection_status}</span></div>
                    <p>{account.account_handle || `Account ID · ${account.external_account_id}`}</p>
                    <span className="record-meta">{account.account_type || "Social account record"} · OAuth status is not verified by this API</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">METADATA ONLY</span><h2>Add account record</h2></div>
            <span className="panel-heading__icon"><Plus aria-hidden="true" size={17} /></span>
          </div>
          {role === "admin" ? (
            <form className="form-stack" onSubmit={(event) => void handleSubmit(event)}>
              <label className="field"><span>Platform <i aria-hidden="true">*</i></span><select onChange={(event) => setPlatform(event.target.value as Platform)} value={platform}><option value="linkedin">LinkedIn</option><option value="instagram">Instagram</option></select></label>
              <label className="field"><span>External account ID <i aria-hidden="true">*</i></span><input maxLength={255} onChange={(event) => setExternalId(event.target.value)} required value={externalId} /></label>
              <label className="field"><span>Account name</span><input maxLength={200} onChange={(event) => setAccountName(event.target.value)} value={accountName} /></label>
              <label className="field"><span>Handle</span><input maxLength={200} onChange={(event) => setHandle(event.target.value)} placeholder="@account" value={handle} /></label>
              {actionError && <ErrorNotice message={actionError} />}
              <button className="button button--primary button--wide" disabled={saving} type="submit">{saving ? "Saving…" : "Save account record"} <Plus aria-hidden="true" size={16} /></button>
            </form>
          ) : (
            <EmptyState title="Admin permission required">
              The backend allows administrators to add social account records.
            </EmptyState>
          )}
        </aside>
      </div>
    </div>
  );
}
