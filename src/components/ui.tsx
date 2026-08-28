"use client";

import { clsx } from "./clsx";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "success" }) {
  const styles = {
    primary: "bg-fire text-white hover:bg-fire-dark",
    secondary: "bg-white text-navy-800 border border-navy-200 hover:bg-navy-50",
    ghost: "bg-transparent text-navy-700 hover:bg-navy-100",
    danger: "bg-danger text-white hover:bg-red-800",
    success: "bg-current text-white hover:bg-emerald-800",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "current" | "warn" | "danger" | "info" | "fire";
  children: ReactNode;
}) {
  const styles = {
    neutral: "bg-navy-100 text-navy-700",
    current: "bg-current-soft text-current",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-navy-100 text-navy-700",
    fire: "bg-fire-soft text-fire",
  }[tone];
  return <span className={cx("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold", styles)}>{children}</span>;
}

export function assignmentTone(status: string) {
  if (status === "COMPLETE") return "current" as const;
  if (status === "OVERDUE") return "danger" as const;
  if (status === "AWAITING_SIGN_OFF") return "warn" as const;
  if (status === "IN_PROGRESS") return "info" as const;
  return "neutral" as const;
}

export function certTone(health: string) {
  if (health === "current") return "current" as const;
  if (health === "expiring") return "warn" as const;
  if (health === "expired") return "danger" as const;
  return "neutral" as const;
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {kicker ? <div className="kicker mb-1">{kicker}</div> : null}
        <h1 className="display text-3xl font-bold text-navy-900 md:text-4xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-navy-500">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card", className)} {...props} />;
}

export function ProgressBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const color = safe >= 100 ? "bg-current" : safe >= 50 ? "bg-navy-700" : "bg-fire";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-navy-100">
        <div className={cx("h-full rounded-full", color)} style={{ width: `${safe}%` }} />
      </div>
      <span className="text-xs font-semibold text-navy-600">{safe}%</span>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-navy-500">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-navy-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-navy-400">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("input", props.className)} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("select", props.className)} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("textarea", props.className)} {...props} />;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  wide,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-navy-950/50 p-4 md:p-8" onClick={onClose}>
      <div className={cx("card mt-8 w-full p-5", wide ? "max-w-4xl" : "max-w-lg")} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
          <button className="text-navy-400 hover:text-navy-800" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Flash({ message, tone = "info" }: { message: string | null; tone?: "info" | "danger" | "current" }) {
  if (!message) return null;
  const styles = {
    info: "border-navy-200 bg-navy-50 text-navy-800",
    danger: "border-danger/30 bg-danger-soft text-danger",
    current: "border-current/30 bg-current-soft text-current",
  }[tone];
  return <div className={cx("rounded-md border px-3 py-2 text-sm", styles)}>{message}</div>;
}

export function clsxJoin(...args: Array<string | false | null | undefined>) {
  return clsx(...args);
}
