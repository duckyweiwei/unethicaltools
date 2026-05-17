import Link from "next/link";

/**
 * Hub for non-converter tools, sitting above ConverterHub on the homepage.
 * Renamed in spirit from "BleepHub" to "tools hub" — file path kept as
 * BleepHub.tsx so existing imports keep working without a noisy rename.
 *
 * Currently hosts two cards (bleep, transcribe). Designed to keep growing.
 */
interface ToolCard {
  href: string;
  iconWrap: string;
  iconColor: string;
  badge: string;
  badgeClass: string;
  title: string;
  body: string;
  icon: () => React.ReactElement;
}

const TOOLS: ToolCard[] = [
  {
    href: "/bleep",
    iconWrap: "bg-amber-400/10 border border-amber-400/30",
    iconColor: "text-amber-300",
    badge: "Free · No upload",
    badgeClass: "border-emerald-400/25 text-emerald-300/90",
    title: "Auto-bleep video",
    body:
      "Auto-detects profanity using on-device speech-to-text, mutes the offending words, exports a clean MP4 + a timestamped log. No server in the loop — your video never leaves your browser.",
    icon: BleepIcon,
  },
  {
    href: "/transcribe",
    iconWrap: "bg-sky-400/10 border border-sky-400/30",
    iconColor: "text-sky-300",
    badge: "Free · No upload",
    badgeClass: "border-emerald-400/25 text-emerald-300/90",
    title: "Video to text",
    body:
      "Drop a video, get a transcript with word-level timestamps. Download TXT, SRT, VTT, or JSON. Whisper runs entirely in your browser — same on-device promise as the converter.",
    icon: TranscribeIcon,
  },
];

export function BleepHub() {
  return (
    <section
      id="tools"
      className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
          Local audio + video tools
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          More on-device tools
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-[var(--color-text-muted)]">
          Built on the same Whisper + ffmpeg.wasm pipeline as the converter.
          Free. No upload. No quota.
        </p>
      </div>

      <ul className="grid sm:grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="group block h-full rounded-2xl glass p-5 sm:p-6 transition-all hover:border-[var(--color-border-strong)] hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${t.iconWrap} ${t.iconColor}`}
                  >
                    <t.icon />
                  </span>
                  <span className="text-base font-medium tracking-tight text-[var(--color-text)]">
                    {t.title}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${t.badgeClass}`}
                >
                  {t.badge}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {t.body}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
                Try it
                <ArrowIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BleepIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function TranscribeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-hover:translate-x-0.5"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
