import { useState, type FormEvent } from "react";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, createCompany } from "../services/api";
import { useAuth } from "./AuthContext";

export default function OnboardingPage() {
  const { user, loading, refreshUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [headquarters, setHeadquarters] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="auth-loading">Loading your account…</div>;
  if (!user) return <Navigate replace to="/auth" />;
  if (user.company_id) return <Navigate replace to="/" />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCompany({
        company_name: companyName.trim(),
        ...(website.trim() && { website_url: website.trim() }),
        ...(industry.trim() && { industry: industry.trim() }),
        ...(headquarters.trim() && { headquarters: headquarters.trim() }),
      });
      await refreshUser();
      navigate("/", { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Company setup failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <div className="brand">
          <span className="brand__mark">
            <BrainCircuit aria-hidden="true" size={21} />
          </span>
          <span className="brand__name">
            Nexora<span>.AI</span>
          </span>
        </div>
        <button className="button button--text" onClick={signOut} type="button">
          Sign out
        </button>
      </header>
      <section className="onboarding-card">
        <div className="onboarding-card__step">STEP 1 OF 1 · COMPANY PROFILE</div>
        <span className="eyebrow">WELCOME, {user.email.toUpperCase()}</span>
        <h1>Let’s set up your workspace.</h1>
        <p className="auth-subtitle">
          Add a few company details to create your workspace. You can update
          them later.
        </p>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Company name <i aria-hidden="true">*</i></span>
            <input
              autoComplete="organization"
              maxLength={200}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Your company"
              required
              value={companyName}
            />
          </label>
          <label className="field">
            <span>Website</span>
            <input
              autoComplete="url"
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://example.com"
              type="url"
              value={website}
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Industry</span>
              <input
                maxLength={150}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder="e.g. Technology"
                value={industry}
              />
            </label>
            <label className="field">
              <span>Headquarters</span>
              <input
                maxLength={200}
                onChange={(event) => setHeadquarters(event.target.value)}
                placeholder="City, country"
                value={headquarters}
              />
            </label>
          </div>
          {error && (
            <div aria-live="polite" className="form-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button button--primary"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Creating workspace…" : "Create workspace"}
            {!submitting && <ArrowRight aria-hidden="true" size={17} />}
          </button>
        </form>
      </section>
    </main>
  );
}
