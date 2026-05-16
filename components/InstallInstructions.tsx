/**
 * First-launch install guide — shown on /download below the platform cards.
 *
 * Required because we don't pay Apple's $99/yr Developer Program for code
 * signing. Without a signed app, macOS Gatekeeper refuses to open it on
 * regular double-click. The bypass is one right-click → Open, but users
 * who don't know that just see the "can't be opened" dialog and bounce.
 *
 * Reframing in the copy: this is the brand pitch — we're not paying $99/yr
 * for a cert just to look like a tracking-focused company.
 */
export function InstallInstructions() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-20 sm:mt-28">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-[var(--color-text-muted)] mb-4">
          First-time install
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gradient">
          One extra click on first launch
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-[var(--color-text-muted)]">
          The app isn&apos;t code-signed. macOS will refuse a regular
          double-click and ask you to confirm. Here&apos;s how, in 30 seconds.
        </p>
      </div>

      <ol className="space-y-3">
        <Step
          n={1}
          title="Download the .dmg above and open it"
          body="A small Finder window pops up with the app icon and an Applications shortcut."
        />
        <Step
          n={2}
          title="Drag the app icon onto Applications"
          body="Standard Mac install — no installer wizard, just a copy."
        />
        <Step
          n={3}
          title="Open Applications, find Local Video Converter"
          body={
            <>
              <span className="text-[var(--color-text)] font-medium">
                Right-click
              </span>{" "}
              (or Control-click) the app icon, then choose{" "}
              <span className="text-[var(--color-text)] font-medium">
                Open
              </span>
              .{" "}
              <span className="text-[var(--color-text-dim)]">
                Don&apos;t double-click — macOS will refuse and you&apos;ll
                have to come back here.
              </span>
            </>
          }
        />
        <Step
          n={4}
          title="A dialog appears — click Open"
          body={
            <>
              The dialog says{" "}
              <span className="font-mono text-[var(--color-text-muted)]">
                &quot;macOS cannot verify the developer of Local Video
                Converter…&quot;
              </span>{" "}
              — that&apos;s expected. Click{" "}
              <span className="text-[var(--color-text)] font-medium">
                Open
              </span>
              . That&apos;s the one-time bypass.
            </>
          }
        />
        <Step
          n={5}
          title="Done — future launches work normally"
          body="macOS remembers your decision. From now on, just double-click the dock icon like any other app."
          last
        />
      </ol>

      <div className="mt-8 rounded-2xl glass p-5 sm:p-6 text-sm text-[var(--color-text-muted)] leading-relaxed">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-mono mb-2">
          Why this happens
        </div>
        <p>
          Apple charges $99/yr for the Developer Program to bypass Gatekeeper.
          We don&apos;t pay it because we&apos;re not in the &quot;capture
          your data&quot; business — we&apos;d rather ask you to right-click
          once than have a recurring expense baked into the brand.{" "}
          <span className="text-[var(--color-text)]">
            The app is the same code in the GitHub repo
          </span>{" "}
          — you can verify what it does before you trust it.
        </p>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  last,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 rounded-2xl glass p-5">
      <div className="shrink-0">
        <div className="h-8 w-8 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 flex items-center justify-center text-xs font-mono text-[var(--color-text)]">
          {n}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium tracking-tight text-[var(--color-text)] mb-1">
          {title}
        </div>
        <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {body}
        </div>
      </div>
      {!last && (
        <div
          aria-hidden
          className="absolute left-[33px] top-[60px] bottom-[-12px] w-px bg-[var(--color-border)]"
        />
      )}
    </li>
  );
}
