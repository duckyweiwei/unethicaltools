import Link from "next/link";
import { CONVERTERS } from "@/lib/converters";
import { FORMATS } from "@/lib/formats";

/**
 * Single source of truth for "every tool, one card each, one-line blurb,
 * one link". Used by the homepage and the /tools page so both stay in sync
 * when a tool is added.
 *
 * Layout: 3-column grid on desktop, 2 on tablet, 1 on mobile. The two
 * non-converter tools (bleep, transcribe) appear first because they're the
 * newer, more interesting surfaces; the seven format converters follow in
 * registry order.
 */

interface ToolEntry {
  href: string;
  title: string;
  blurb: string;
  /** Either an SVG node or a short text glyph rendered in the icon square. */
  icon: React.ReactNode;
  /** Tailwind classes for the icon-square wrapper (bg + border + text). */
  iconWrap: string;
  /** Optional small badge in the header row (e.g. remux likelihood). */
  badge?: { label: string; cls: string };
}

const APP_TOOLS: ToolEntry[] = [
  {
    href: "/bleep",
    title: "Profanity Censor Tool",
    blurb:
      "Mute swear words automatically. On-device speech-to-text finds them, you toggle which to keep, ffmpeg mutes the rest.",
    icon: <BleepIcon />,
    iconWrap: "bg-amber-400/10 border border-amber-400/30 text-amber-300",
    badge: { label: "Free", cls: "border-emerald-400/25 text-emerald-300/90" },
  },
  {
    href: "/transcribe",
    title: "Video to text",
    blurb:
      "Drop a video, get a transcript with word-level timestamps. Download TXT, SRT, VTT, or JSON.",
    icon: <TranscribeIcon />,
    iconWrap: "bg-sky-400/10 border border-sky-400/30 text-sky-300",
    badge: { label: "Free", cls: "border-emerald-400/25 text-emerald-300/90" },
  },
];

const CONVERTER_BLURBS: Record<string, string> = {
  "ts-to-mp4":
    "Convert MPEG transport streams (TS / MTS / M2TS) to MP4. Usually an instant remux — no quality loss.",
  "mov-to-mp4":
    "Turn QuickTime / iPhone MOV into universal MP4. Usually a remux when codecs are H.264 or HEVC.",
  "mkv-to-mp4":
    "Convert Matroska MKV to MP4. Lossless remux when the inside codecs are MP4-compatible.",
  "webm-to-mp4":
    "Re-encode VP9 / Opus WebM into H.264 + AAC MP4 for universal playback (iOS, smart TVs, editors).",
  "avi-to-mp4":
    "Modernize old DivX / Xvid AVI archives to MP4 — the output is usually smaller too.",
  "flv-to-mp4":
    "Rescue Flash Video archives. Fast remux for H.264 + AAC FLVs (most post-2008 files).",
  "mpeg-to-mp4":
    "Convert MPEG-1 / MPEG-2 to H.264 MP4. Dramatically smaller output at near-identical quality.",
};

function converterEntries(): ToolEntry[] {
  return CONVERTERS.map((c) => {
    const fmt = FORMATS[c.input];
    const tone =
      fmt.remuxLikelihood === "high"
        ? { label: "Instant remux", cls: "border-emerald-400/25 text-emerald-300/90" }
        : fmt.remuxLikelihood === "medium"
          ? { label: "Mixed", cls: "border-cyan-400/25 text-cyan-300/90" }
          : { label: "Re-encodes", cls: "border-amber-400/25 text-amber-300/90" };

    return {
      href: `/${c.slug}`,
      title: `${fmt.displayName} → MP4`,
      blurb: CONVERTER_BLURBS[c.slug] ?? c.tagline,
      icon: (
        <span className="font-mono text-[10px] leading-none">
          .{fmt.extensions[0]}
        </span>
      ),
      iconWrap:
        "bg-white/[0.04] border border-[var(--color-border)] text-[var(--color-text)]",
      badge: tone,
    };
  });
}

export function AllToolsList({
  showHeading = true,
  only,
}: {
  /** Set false when the parent page renders its own H1 + intro. */
  showHeading?: boolean;
  /**
   * Restrict the rendered list to tools whose href is in this set. When
   * present the layout collapses from a 3-column grid to a single centered
   * card so a one-tool catalog doesn't look like a lonely tile.
   */
  only?: readonly string[];
}) {
  const allTools = [...APP_TOOLS, ...converterEntries()];
  const filterSet = only ? new Set(only) : null;
  const tools = filterSet
    ? allTools.filter((t) => filterSet.has(t.href))
    : allTools;
  const isSingle = tools.length === 1;

  return (
    <section id="tools" className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16">
      {showHeading && (
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
            Every tool on this site
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
            unethical tools
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-[var(--color-text-muted)]">
            All of them run on your device. Free, no upload, no account, no
            quota.
          </p>
        </div>
      )}

      <ul
        className={
          isSingle
            ? "max-w-md mx-auto"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        }
      >
        {tools.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="group block h-full rounded-2xl glass p-5 transition-all hover:border-[var(--color-border-strong)] hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${t.iconWrap}`}
                  >
                    {t.icon}
                  </span>
                  <span className="text-base font-medium tracking-tight text-[var(--color-text)] truncate">
                    {t.title}
                  </span>
                </div>
                {t.badge && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${t.badge.cls}`}
                  >
                    {t.badge.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                {t.blurb}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
                Open
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
