import { useState, type FormEvent } from "react";
import { ArrowRight, BrainCircuit, LockKeyhole, Mail } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "./AuthContext";

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [registerMode, setRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="auth-loading">Loading your workspace…</div>;
  }
  if (user) {
    return <Navigate replace to={user.company_id ? "/" : "/onboarding"} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (registerMode) {
        await signUp(email.trim(), password);
        navigate("/onboarding", { replace: true });
      } else {
        await signIn(email.trim(), password);
        navigate("/", { replace: true });
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "We couldn’t complete that request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-panel__top">
          <div className="brand">
            <span className="brand__mark">
              <BrainCircuit aria-hidden="true" size={22} />
            </span>
            <span className="brand__name">
              Nexora<span>.AI</span>
            </span>
          </div>
        </div>
        <div className="auth-brand-panel__message">
          <span className="eyebrow">YOUR BUSINESS, IN FOCUS</span>
          <h1>One workspace for the work that moves you forward.</h1>
          <p>
            Bring your company knowledge, marketing, and leads into one clear
            view.
          </p>
        </div>
        <div className="auth-brand-panel__footer">
          <span className="auth-brand-panel__orbit auth-brand-panel__orbit--one" />
          <span className="auth-brand-panel__orbit auth-brand-panel__orbit--two" />
          <span className="auth-brand-panel__glow" />
          <span>Thoughtful tools for growing teams.</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-panel__content">
          <span className="eyebrow">{registerMode ? "GET STARTED" : "WELCOME BACK"}</span>
          <h2>{registerMode ? "Create your account" : "Sign in to Nexora"}</h2>
          <p className="auth-subtitle">
            {registerMode
              ? "Start by creating your account, then set up your company workspace."
              : "Use your account credentials to continue to your workspace."}
          </p>

          <form className="form-stack auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email address</span>
              <span className="field__input-wrap">
                <Mail aria-hidden="true" size={17} />
                <input
                  autoComplete="email"
                  maxLength={255}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  type="email"
                  value={email}
                />
              </span>
            </label>
            <label className="field">
              <span>Password</span>
              <span className="field__input-wrap">
                <LockKeyhole aria-hidden="true" size={17} />
                <input
                  autoComplete={registerMode ? "new-password" : "current-password"}
                  maxLength={128}
                  minLength={registerMode ? 8 : 1}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={registerMode ? "At least 8 characters" : "Your password"}
                  required
                  type="password"
                  value={password}
                />
              </span>
              {registerMode && (
                <small className="field__hint">
                  Use 8–128 characters for your password.
                </small>
              )}
            </label>
            {error && (
              <div aria-live="polite" className="form-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button button--primary button--wide"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? "Please wait…"
                : registerMode
                  ? "Create account"
                  : "Sign in"}
              {!submitting && <ArrowRight aria-hidden="true" size={17} />}
            </button>
          </form>

          <p className="auth-switch">
            {registerMode ? "Already have an account?" : "New to Nexora.AI?"}{" "}
            <button
              onClick={() => {
                setRegisterMode(!registerMode);
                setError(null);
              }}
              type="button"
            >
              {registerMode ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
        <span className="auth-privacy-note">
          Your workspace is protected by your account credentials.
        </span>
      </section>
    </main>
  );
}
