"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------
   Button — filled / tinted / plain, matching the system button hierarchy.
   Every variant clears the 44pt minimum hit target.
   ---------------------------------------------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "filled" | "tinted" | "plain" | "destructive";
  size?: "sm" | "md" | "lg";
  tint?: string;
  block?: boolean;
};

export function Button({
  variant = "tinted",
  size = "md",
  tint = "var(--blue)",
  block,
  className,
  style,
  ...props
}: ButtonProps) {
  const sizes = {
    sm: "min-h-[32px] px-3 text-footnote rounded-[8px]",
    md: "min-h-[44px] px-4 text-callout rounded-control",
    lg: "min-h-[52px] px-6 text-headline rounded-[14px]",
  }[size];

  const accent = variant === "destructive" ? "var(--red)" : tint;
  const variants: Record<string, string> = {
    filled: "text-white font-semibold",
    destructive: "text-white font-semibold",
    tinted: "font-medium",
    plain: "font-medium",
  };

  const bg =
    variant === "filled" || variant === "destructive"
      ? accent
      : variant === "tinted"
        ? `color-mix(in srgb, ${accent} 14%, transparent)`
        : "transparent";

  return (
    <button
      {...props}
      className={cx(
        "press inline-flex items-center justify-center gap-2 transition-[opacity,transform,background-color] duration-150",
        "active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none",
        sizes,
        variants[variant],
        block && "w-full",
        className,
      )}
      style={{
        background: bg,
        color:
          variant === "filled" || variant === "destructive" ? "#fff" : accent,
        ...style,
      }}
    />
  );
}

/* -------------------------------------------------------------------------
   Grouped list — the inset table style, with hairline separators.
   ---------------------------------------------------------------------- */
export function ListGroup({
  header,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {header && (
        <h2 className="px-4 pb-2 text-footnote font-semibold uppercase tracking-[0.06em] text-label-secondary">
          {header}
        </h2>
      )}
      <div
        className="overflow-hidden rounded-card"
        style={{ background: "var(--grouped-secondary)" }}
      >
        {children}
      </div>
      {footer && (
        <p className="px-4 pt-2 text-footnote text-label-secondary">{footer}</p>
      )}
    </section>
  );
}

export function Divider() {
  return (
    <div
      className="ml-4 h-px"
      style={{ background: "var(--separator)" }}
      role="presentation"
    />
  );
}

/* -------------------------------------------------------------------------
   Segmented control
   ---------------------------------------------------------------------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full gap-1 rounded-control p-1"
      style={{ background: "var(--fill-tertiary)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              "min-h-[36px] flex-1 rounded-[7px] px-3 text-subheadline transition-all duration-150",
              active ? "font-semibold" : "font-normal text-label-secondary",
            )}
            style={
              active
                ? {
                    background: "var(--grouped-secondary)",
                    color: "var(--label)",
                    boxShadow: "var(--shadow-sm)",
                  }
                : undefined
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Sheet — a modal presentation. Focus is trapped, Escape dismisses, and the
   scrim is clickable. HIG > Modality: always give people an obvious way out.
   ---------------------------------------------------------------------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = body;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade bg-black/35"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet relative flex max-h-[92vh] w-full flex-col rounded-t-sheet sm:max-w-[520px] sm:rounded-sheet"
        style={{
          background: "var(--grouped-bg)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <header
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--separator)" }}
        >
          <h2 className="text-headline font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] text-label-secondary transition active:scale-95"
            style={{ background: "var(--fill-tertiary)" }}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <footer
            className="safe-bottom border-t p-4"
            style={{ borderColor: "var(--separator)" }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Form field
   ---------------------------------------------------------------------- */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-footnote font-medium text-label-secondary">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-caption text-label-tertiary">
          {hint}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  "w-full min-h-[44px] rounded-control px-3 py-2.5 text-body outline-none " +
  "transition focus:ring-2 focus:ring-[var(--blue)] placeholder:text-label-tertiary";

export const inputStyle: React.CSSProperties = {
  background: "var(--grouped-secondary)",
  color: "var(--label)",
  border: "1px solid var(--separator)",
};

/* -------------------------------------------------------------------------
   Empty state
   ---------------------------------------------------------------------- */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 text-[40px] text-label-tertiary">{icon}</div>
      )}
      <h3 className="text-title3 font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-[36ch] text-subheadline text-label-secondary">
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
