import type { ConverterConfig } from "@/lib/converters";
import type { FormatConfig } from "@/lib/formats";

/**
 * Format-specific informational block. Pulls all unique content from the
 * ConverterConfig — no duplicate copy across pages, so each route ranks on
 * its own merits.
 */
export function FormatExplainer({
  config,
  format,
}: {
  config: ConverterConfig;
  format: FormatConfig;
}) {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-20 sm:mt-28">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
          About this conversion
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          What is {format.displayName}, and why convert to MP4?
        </h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <Card title={`${format.displayName} in one paragraph`} body={format.description} />
        <Card title="Where it comes from" body={format.origin} icon={<OriginIcon />} />
      </div>

      <div className="prose-pad mt-6 sm:mt-8 glass rounded-3xl p-6 sm:p-8">
        {config.whyConvertParagraphs.map((p, i) => (
          <p
            key={i}
            className="text-[var(--color-text-muted)] leading-relaxed text-[15px] sm:text-base mb-4 last:mb-0"
          >
            {p}
          </p>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
        <SmallCard
          title="Codecs you'll typically see"
          body={format.typicalCodecs}
          icon={<CodecIcon />}
        />
        <SmallCard
          title={`Remux outlook for ${format.displayName}`}
          body={config.remuxOutlook}
          icon={<SpeedIcon />}
          tone={
            format.remuxLikelihood === "high"
              ? "good"
              : format.remuxLikelihood === "medium"
                ? "mixed"
                : "slow"
          }
        />
        <SmallCard
          title="Privacy by architecture"
          body="The conversion runs in your browser using ffmpeg.wasm. There's no upload endpoint — your file never leaves your device."
          icon={<LockIcon />}
        />
      </div>
    </section>
  );
}

function Card({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl glass p-6 sm:p-7">
      <div className="flex items-center gap-3 mb-3">
        {icon && (
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/[0.03] border border-[var(--color-border)] text-[var(--color-text)]">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{body}</p>
    </div>
  );
}

function SmallCard({
  title,
  body,
  icon,
  tone = "neutral",
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  tone?: "neutral" | "good" | "mixed" | "slow";
}) {
  const accentBorder =
    tone === "good"
      ? "border-emerald-400/30"
      : tone === "mixed"
        ? "border-cyan-400/30"
        : tone === "slow"
          ? "border-amber-400/30"
          : "border-[var(--color-border)]";
  return (
    <div className={`rounded-3xl glass p-6 ${accentBorder}`}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/[0.04] border border-[var(--color-border)] mb-4 text-[var(--color-text)]">
        {icon}
      </div>
      <h3 className="text-base font-medium tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-[var(--color-text-muted)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function OriginIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function CodecIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function SpeedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
