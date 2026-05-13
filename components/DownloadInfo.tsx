/**
 * Below-the-fold content for /download. Explains the "browser vs app" trade
 * so a user landing here from the 4 GB block can quickly decide.
 */
export function DownloadInfo() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-20 sm:mt-28">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
          Browser or desktop?
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          When you actually need the app
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-[var(--color-text-muted)]">
          Most people never need it — the browser version handles ~95% of
          real-world files. The desktop app exists for the cases where the
          browser physically can&apos;t.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <Compare
          title="Browser (current site)"
          rows={[
            ["Install required", "No"],
            ["File size", "Up to 4 GB"],
            ["Speed", "Slower (WASM)"],
            ["Privacy", "Local · no upload"],
            ["Works offline after first load", "Yes (cached)"],
          ]}
          accent={false}
        />
        <Compare
          title="Desktop app"
          rows={[
            ["Install required", "Yes (~15 MB)"],
            ["File size", "Unlimited"],
            ["Speed", "Native ffmpeg, multi-core"],
            ["Privacy", "Local · no upload"],
            ["Works offline", "Yes (fully)"],
          ]}
          accent
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
        <Card
          title="Same privacy guarantee"
          body="The desktop app shells out to native ffmpeg with your file as a local path argument. No HTTP, no network calls, no analytics on your content."
        />
        <Card
          title="Same conversion engine"
          body="It's the same remux-first / encode-fallback pipeline as the browser version — just running on native ffmpeg instead of ffmpeg.wasm."
        />
        <Card
          title="Same UI, smaller footprint"
          body="Built with Tauri, not Electron. The whole app is ~15 MB instead of ~150 MB and uses your system's WebView."
        />
      </div>
    </section>
  );
}

function Compare({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: Array<[string, string]>;
  accent: boolean;
}) {
  return (
    <div className="rounded-3xl glass p-6 sm:p-7 relative overflow-hidden">
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
      <h3
        className={[
          "relative text-lg font-medium tracking-tight mb-4",
          accent ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
        ].join(" ")}
      >
        {title}
      </h3>
      <dl className="relative divide-y divide-[var(--color-border)]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between py-2.5">
            <dt className="text-xs text-[var(--color-text-muted)]">{k}</dt>
            <dd
              className={[
                "text-sm text-right",
                accent ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
              ].join(" ")}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl glass p-6">
      <h3 className="text-base font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}
