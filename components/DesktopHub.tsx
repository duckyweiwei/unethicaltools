"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONVERTERS } from "@/lib/converters";
import { FORMATS, type RemuxLikelihood } from "@/lib/formats";

/**
 * Desktop landing screen. Same job as the website's ConverterHub, but
 * stripped of SEO copy and marketing chrome — just a 7-card grid where
 * each card navigates to /<slug>, which DesktopShell renders as a
 * DesktopConverter screen.
 */
export function DesktopHub() {
  const router = useRouter();

  // Pre-warm every converter route as soon as the hub mounts. In Next.js dev
  // mode, routes compile lazily on first request — so the first click on a
  // card was waiting 1–3 s for /<slug> to compile, which felt like the click
  // wasn't registering. Forcing prefetch here makes the dev server compile
  // them in the background while the user is looking at the grid.
  useEffect(() => {
    for (const c of CONVERTERS) router.prefetch(`/${c.slug}`);
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/icon.png"
            alt=""
            aria-hidden
            className="h-6 w-6"
          />
          <span className="text-sm font-medium tracking-tight">
            unethicaletools
          </span>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-text-dim)]">
          Native · No size limit
        </span>
      </header>

      <section className="flex-1 px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Choose a converter
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Native ffmpeg. Runs locally. No upload, no size limit.
            </p>
          </div>

          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CONVERTERS.map((c) => {
              const f = FORMATS[c.input];
              const tone = toneFor(f.remuxLikelihood);
              return (
                <li key={c.slug}>
                  <Link
                    href={`/${c.slug}`}
                    prefetch
                    className="group block rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4 transition-colors hover:border-[var(--color-border-strong)] hover:bg-white/[0.04] active:bg-[var(--color-accent)]/15 active:border-[var(--color-accent)]/40 active:scale-[0.985]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium tracking-tight text-[var(--color-text)]">
                        {f.displayName}{" "}
                        <span className="text-[var(--color-text-dim)]">→</span>{" "}
                        MP4
                      </span>
                    </div>
                    <span
                      className={`mt-1 inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${tone.cls}`}
                    >
                      {tone.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}

function toneFor(rl: RemuxLikelihood) {
  if (rl === "high")
    return {
      label: "Instant remux",
      cls: "text-emerald-300/90 border-emerald-400/25",
    };
  if (rl === "medium")
    return {
      label: "Mixed",
      cls: "text-cyan-300/90 border-cyan-400/25",
    };
  return {
    label: "Re-encodes",
    cls: "text-amber-300/90 border-amber-400/25",
  };
}
