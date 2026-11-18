import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Save, UserRound } from "lucide-react";
import { getCompany, updateCompany } from "../../services/api";
import type { Company, User, UserRole } from "../../types/api";
import { ErrorNotice, LoadingState, SuccessNotice } from "../../components/Feedback";
import PageHeading from "../../components/PageHeading";

export default function SettingsPage({ user, role }: { user: User; role: UserRole }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [headquarters, setHeadquarters] = useState("");

  const load = useCallback(async () => {
    if (!user.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getCompany(user.company_id);
      setCompany(result);
      setCompanyName(result.company_name);
      setWebsite(result.website_url ?? "");
      setIndustry(result.industry ?? "");
      setHeadquarters(result.headquarters ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load company profile.");
    } finally {
      setLoading(false);
    }
  }, [user.company_id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user.company_id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updateCompany(user.company_id, {
        company_name: companyName.trim(),
        website_url: website.trim() || null,
        industry: industry.trim() || null,
        headquarters: headquarters.trim() || null,
      });
      setCompany(result);
      setSuccess("Company profile updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update company profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page feature-workspace">
      <PageHeading
        description="Review your account and company profile."
        eyebrow="PREFERENCES"
        title="Settings"
      />
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}
      {success && <SuccessNotice message={success} />}
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">SIGNED-IN ACCOUNT</span><h2>Profile</h2></div>
            <span className="panel-heading__icon"><UserRound aria-hidden="true" size={17} /></span>
          </div>
          <div className="profile-summary">
            <span className="profile-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
            <div><strong>{user.email}</strong><span>Company role · {user.role}</span></div>
          </div>
          <p className="form-footnote">Account and role changes are managed through the backend user-management API.</p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">COMPANY PROFILE</span><h2>Workspace details</h2></div>
            <span className="panel-heading__icon"><Building2 aria-hidden="true" size={17} /></span>
          </div>
          {loading ? <LoadingState label="Loading company profile" /> : (
            <form className="form-stack" onSubmit={(event) => void handleSubmit(event)}>
              <label className="field"><span>Company name <i aria-hidden="true">*</i></span><input disabled={role !== "admin"} maxLength={200} onChange={(event) => setCompanyName(event.target.value)} required value={companyName} /></label>
              <label className="field"><span>Website</span><input disabled={role !== "admin"} onChange={(event) => setWebsite(event.target.value)} type="url" value={website} /></label>
              <div className="form-row">
                <label className="field"><span>Industry</span><input disabled={role !== "admin"} maxLength={150} onChange={(event) => setIndustry(event.target.value)} value={industry} /></label>
                <label className="field"><span>Headquarters</span><input disabled={role !== "admin"} maxLength={200} onChange={(event) => setHeadquarters(event.target.value)} value={headquarters} /></label>
              </div>
              {role === "admin" ? (
                <>
                  {error && <ErrorNotice message={error} />}
                  <button className="button button--primary" disabled={saving || !company} type="submit">{saving ? "Saving…" : "Save company details"} <Save aria-hidden="true" size={15} /></button>
                </>
              ) : (
                <p className="form-footnote">Only an administrator can edit company details.</p>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
