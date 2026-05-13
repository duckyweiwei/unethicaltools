"use client";

import { useMemo, useState } from "react";
import { CONTACT_EMAIL } from "@/lib/site";

type Category = "format" | "speed" | "bug" | "feature" | "other";

const CATEGORIES: Array<{ value: Category; label: string; example: string }> = [
  {
    value: "format",
    label: "New format request",
    example: "e.g. WMV → MP4, VOB → MP4, MP3 → WAV",
  },
  {
    value: "bug",
    label: "Report an issue",
    example: "Bug, crash, broken output, wrong behavior",
  },
  {
    value: "speed",
    label: "Speed or memory issue",
    example: "Conversion stalled, tab crashed, OOM",
  },
  {
    value: "feature",
    label: "Feature idea",
    example: "Batch convert, trim, preview, GIF export",
  },
  { value: "other", label: "Something else", example: "" },
];

/**
 * Categories where the user has likely hit a problem rather than dreamed up
 * an idea — surfacing the optional Context field (browser, OS, file format
 * the issue happened with) helps us reproduce it.
 */
function isIssueCategory(c: Category): boolean {
  return c === "bug" || c === "speed";
}

/**
 * Privacy-first feedback form: composes a `mailto:` link with category +
 * subject + body + optional reply-to encoded, then opens the user's mail
 * client. No data is sent to any server from this page.
 *
 * Falls back to showing the address in plain text so users without a default
 * mail handler (typical on Linux + browser-only setups) can copy/paste it.
 */
export interface SuggestionsFormProps {
  /**
   * Pre-select a category — used by the page-level "Report an issue" CTA
   * to drop the user straight into the right state.
   */
  defaultCategory?: Category;
}

export function SuggestionsForm({
  defaultCategory = "format",
}: SuggestionsFormProps = {}) {
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [context, setContext] = useState("");
  const [opened, setOpened] = useState(false);

  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.value === category)?.label ?? "Feedback",
    [category],
  );

  const mailtoHref = useMemo(() => {
    const subj = `[${categoryLabel}] ${subject || "Suggestion"}`;
    const bodyLines = [
      message || "(type your message here)",
      "",
      context ? `— Context (browser / OS / file format): ${context}` : "",
      email ? `— Reply-to: ${email}` : "",
      "",
      "Sent from the suggestions page · unethical tools",
    ];
    const params = new URLSearchParams({
      subject: subj,
      body: bodyLines.filter(Boolean).join("\n"),
    });
    // URLSearchParams uses + for spaces; mailto: clients accept %20 or +.
    return `mailto:${CONTACT_EMAIL}?${params.toString()}`;
  }, [category, categoryLabel, subject, message, email, context]);

  const canSubmit = subject.trim().length > 2 && message.trim().length > 4;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    window.location.href = mailtoHref;
    setOpened(true);
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-3xl p-6 sm:p-8">
      <fieldset>
        <legend className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-3">
          What's this about?
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <label
                key={c.value}
                className={[
                  "flex flex-col rounded-xl border p-3 cursor-pointer transition-colors",
                  active
                    ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/[0.06]"
                    : "border-[var(--color-border)] bg-white/[0.02] hover:border-[var(--color-border-strong)]",
                ].join(" ")}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    value={c.value}
                    checked={active}
                    onChange={() => setCategory(c.value)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={[
                      "h-3 w-3 rounded-full border transition-colors",
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                        : "border-[var(--color-text-dim)]",
                    ].join(" ")}
                  />
                  <span className="text-sm text-[var(--color-text)]">
                    {c.label}
                  </span>
                </span>
                {c.example && (
                  <span className="mt-1 ml-5 text-[11px] text-[var(--color-text-dim)]">
                    {c.example}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 space-y-4">
        <Field
          id="subject"
          label="Subject"
          placeholder={
            category === "format" ? "Convert WMV to MP4" : "One-line summary"
          }
          value={subject}
          onChange={setSubject}
          maxLength={120}
          required
        />
        <Field
          id="message"
          label="Message"
          placeholder="Details, repro steps, sample file format, anything that helps."
          value={message}
          onChange={setMessage}
          multiline
          rows={5}
          required
        />
        {isIssueCategory(category) && (
          <Field
            id="context"
            label="Context (helps reproduce)"
            hint="Optional — browser, OS, file format / size."
            placeholder="e.g. Chrome 124 on macOS 14 · 1.2 GB TS file from OBS"
            value={context}
            onChange={setContext}
            multiline
            rows={2}
          />
        )}
        <Field
          id="email"
          label="Reply-to email"
          hint="Optional — only needed if you want a response."
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          type="email"
        />
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[11px] text-[var(--color-text-dim)] leading-relaxed">
          Submitting opens your default mail app with everything pre-filled.
          Nothing is sent until you press Send there.
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient-bg shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)] hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.9)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MailIcon />
          <span>Open mail draft</span>
        </button>
      </div>

      {opened && (
        <p className="mt-4 text-xs text-emerald-300/90">
          Mail draft opened in your default mail app.
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
  required,
  multiline,
  rows,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: string;
}) {
  const common =
    "w-full rounded-xl bg-white/[0.03] border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 focus:bg-white/[0.05] transition-colors";
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between mb-1.5"
      >
        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
        {hint && (
          <span className="text-[10px] text-[var(--color-text-dim)]">{hint}</span>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          rows={rows ?? 4}
          className={`${common} resize-y`}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          className={common}
        />
      )}
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
