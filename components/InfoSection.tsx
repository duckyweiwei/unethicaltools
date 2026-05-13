export function InfoSection() {
  return (
    <section className="relative mx-auto max-w-5xl px-4 sm:px-6 mt-28 sm:mt-36">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-5">
          Why local conversion
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          A different kind of video converter
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-[var(--color-text-muted)]">
          Most online converters upload your video to their servers. This one
          does the work right in your browser using WebAssembly. Different
          architecture, very different privacy story.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <Compare
          title="Cloud upload converters"
          tone="muted"
          points={[
            "Your video is sent to a third-party server",
            "Server-side queue, often slow on free tiers",
            "File size capped by their upload limits",
            "You trust their privacy policy and data retention",
          ]}
          icon={<CloudIcon />}
        />
        <Compare
          title="This app — local conversion"
          tone="accent"
          points={[
            "Your file never leaves your computer",
            "Runs entirely in the browser (ffmpeg.wasm)",
            "Capped only by your device's memory",
            "No account, no analytics on your file",
          ]}
          icon={<MonitorIcon />}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
        <Card
          title="Privacy by architecture"
          body="There is no server doing the conversion. We can't see your file because it's never sent anywhere. This is enforced by where the code runs, not by a policy."
          icon={<LockIcon />}
        />
        <Card
          title="Why remuxing is fast"
          body="Most .ts files already contain H.264 video and AAC audio — the same codecs MP4 uses. We can swap the container in seconds without touching the video stream. Quality stays identical."
          icon={<SwapIcon />}
        />
        <Card
          title="Falls back when needed"
          body="If your file uses codecs MP4 doesn't allow (MPEG-2 video, AC-3 audio), the app automatically re-encodes with H.264 + AAC so you still get a working MP4."
          icon={<ShuffleIcon />}
        />
      </div>
    </section>
  );
}

function Compare({
  title,
  tone,
  points,
  icon,
}: {
  title: string;
  tone: "muted" | "accent";
  points: string[];
  icon: React.ReactNode;
}) {
  const accent = tone === "accent";
  return (
    <div
      className={[
        "rounded-3xl p-6 sm:p-7 glass relative overflow-hidden",
        accent ? "border-[var(--color-border-strong)]" : "",
      ].join(" ")}
    >
      {accent && (
        <div
          aria-hidden
          className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(139,92,246,0.7), transparent 70%)",
          }}
        />
      )}
      <div className="relative flex items-center gap-3 mb-4">
        <div
          className={[
            "h-10 w-10 rounded-xl flex items-center justify-center border",
            accent
              ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-text)]"
              : "bg-white/[0.03] border-[var(--color-border)] text-[var(--color-text-muted)]",
          ].join(" ")}
        >
          {icon}
        </div>
        <h3
          className={[
            "text-lg font-medium tracking-tight",
            accent ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
          ].join(" ")}
        >
          {title}
        </h3>
      </div>
      <ul className="relative space-y-2.5">
        {points.map((p) => (
          <li
            key={p}
            className={[
              "flex items-start gap-2.5 text-sm",
              accent ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
            ].join(" ")}
          >
            <Dot accent={accent} />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl glass p-6">
      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/[0.04] border border-[var(--color-border)] mb-4 text-[var(--color-text)]">
        {icon}
      </div>
      <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function Dot({ accent }: { accent: boolean }) {
  return (
    <span
      className={[
        "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
        accent ? "bg-[var(--color-accent)]" : "bg-white/30",
      ].join(" ")}
    />
  );
}

/* ---------- icons ---------- */
function CloudIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}
function MonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
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
function SwapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function ShuffleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}
