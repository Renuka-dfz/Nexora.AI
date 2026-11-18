import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div aria-live="polite" className="state-panel state-panel--loading">
      <LoaderCircle aria-hidden="true" className="loading-spinner" size={19} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-state__mark">
        <CheckCircle2 size={20} />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div aria-live="polite" className="notice notice--error" role="alert">
      <AlertCircle aria-hidden="true" size={17} />
      <span>{message}</span>
      {onRetry && (
        <button className="button button--text" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </div>
  );
}

export function SuccessNotice({ message }: { message: string }) {
  return (
    <div aria-live="polite" className="notice notice--success" role="status">
      <CheckCircle2 aria-hidden="true" size={17} />
      <span>{message}</span>
    </div>
  );
}
