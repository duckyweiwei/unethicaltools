"use client";

/**
 * The upgrade screen. It does four things, in order of how the user arrives here:
 *
 *  1. Already Pro      → a calm "you're all set" confirmation.
 *  2. Back from Stripe → ?status=success: poll /api/entitlement until the signed
 *                        webhook flips this account to Pro, then celebrate. (We
 *                        deliberately wait for the webhook — the redirect itself
 *                        is never trusted to grant access.)
 *  3. Cancelled        → ?status=cancelled: a no-charge reassurance, then plans.
 *  4. Default          → choose monthly/yearly (real prices from Stripe) and go.
 *
 * Checkout needs an account to attribute the payment to, so a signed-out visitor
 * is asked to continue with Google first.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useEntitlement } from "@/lib/auth/entitlement-client";
import { startCheckout, type Plan } from "@/lib/billing/checkout";
import { Check } from "@/components/quiz-editor/icons";

/**
 * Master switch for paid subscriptions. Flip to `true` to re-open Pro checkout —
 * the entire monthly/yearly flow below (Stripe session, webhook, entitlement) is
 * intact and verified; this single flag is the ONLY thing gating it. Kept off
 * until the Pro feature set is finished so no one subscribes before it's ready.
 * (Yearly additionally needs a Stripe yearly Price + STRIPE_PRICE_ID_YEARLY env.)
 */
const SUBSCRIPTIONS_ENABLED = false;

interface PlanInfo {
  id: string;
  amount: number | null;
  currency: string;
  interval: string | null;
}
interface PlansResponse {
  configured: boolean;
  monthly?: PlanInfo | null;
  yearly?: PlanInfo | null;
}

function formatCents(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatPrice(p: PlanInfo | null | undefined): string {
  if (!p || p.amount == null) return "";
  return formatCents(p.amount, p.currency);
}

function intervalLabel(p: PlanInfo | null | undefined): string {
  if (!p?.interval) return "";
  return p.interval === "year" ? "/year" : p.interval === "month" ? "/month" : `/${p.interval}`;
}

export function UpgradeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status } = useSession();
  const { pro, refresh } = useEntitlement();

  const statusParam = params.get("status");
  const isSuccess = statusParam === "success";
  const isCancelled = statusParam === "cancelled";

  const [plan, setPlan] = useState<Plan>("monthly");
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollLeft, setPollLeft] = useState(isSuccess ? 8 : 0);

  // Load the real prices once.
  useEffect(() => {
    let active = true;
    fetch("/api/plans", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d: PlansResponse) => {
        if (active) setPlans(d);
      })
      .catch(() => {
        if (active) setPlans({ configured: false });
      });
    return () => {
      active = false;
    };
  }, []);

  // After returning from a successful checkout, poll until the webhook grants Pro.
  useEffect(() => {
    if (!isSuccess || pro || pollLeft <= 0) return;
    const t = setTimeout(() => {
      refresh();
      setPollLeft((n) => n - 1);
    }, 2000);
    return () => clearTimeout(t);
  }, [isSuccess, pro, pollLeft, refresh]);

  const signedIn = status === "authenticated" && Boolean(session?.user);
  const selected = plan === "yearly" ? plans?.yearly : plans?.monthly;
  const hasYearly = Boolean(plans?.yearly);

  // Yearly savings, derived from the real Stripe prices (cents).
  const monthlyAmt = plans?.monthly?.amount ?? null;
  const yearlyAmt = plans?.yearly?.amount ?? null;
  const savingsPct =
    monthlyAmt && yearlyAmt && monthlyAmt > 0
      ? Math.round((1 - yearlyAmt / (monthlyAmt * 12)) * 100)
      : 0;
  const yearlyPerMonth =
    yearlyAmt && plans?.yearly
      ? formatCents(Math.round(yearlyAmt / 12), plans.yearly.currency)
      : "";

  async function onUpgrade() {
    if (!SUBSCRIPTIONS_ENABLED) return; // belt-and-suspenders: CTA is already disabled below
    setError(null);
    if (!signedIn) {
      void signIn("google", { callbackUrl: "/upgrade" });
      return;
    }
    setBusy(true);
    try {
      await startCheckout({
        accountId: session?.user?.id,
        email: session?.user?.email ?? undefined,
        plan,
      });
      // startCheckout redirects on success; if we're still here, it threw.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t start checkout.");
      setBusy(false);
    }
  }

  // ---- 1. Already Pro -------------------------------------------------------
  if (pro) {
    return (
      <Shell>
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <Badge />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">
            You’re on Pro
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
            Thanks for the support — your account has the AI layer unlocked: AI answer-solving for
            keyless papers today, with more AI features on the way. It follows you on any device you
            sign in to with Google.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push("/library")}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Go to my quizzes
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ---- 2. Back from a successful checkout, waiting on the webhook -----------
  if (isSuccess) {
    const stillWaiting = pollLeft > 0;
    return (
      <Shell>
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          {stillWaiting ? (
            <>
              <span className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
                Payment received — activating Pro…
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
                We’re confirming with Stripe. This usually takes a few seconds.
              </p>
            </>
          ) : (
            <>
              <Badge tone="neutral" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
                Almost there
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
                Your payment went through. Pro will switch on as soon as Stripe notifies us — give
                it a moment, then check again.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setPollLeft(8);
                    refresh();
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
                >
                  Check again
                </button>
              </div>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ---- 3 + 4. Plan selection: Free vs Pro, with the yearly discount up front -
  const notConfigured = Boolean(plans && !plans.configured);

  return (
    <WideShell>
      <div className="text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          The converter is free. AI is Pro.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-pretty text-sm leading-relaxed text-neutral-500">
          Every deterministic feature is free forever — unlimited PDFs, multi-paper merge,
          mark-scheme matching, and figures, all on your device. Pro adds the AI layer, starting
          with answer keys for papers that ship without one. Cancel anytime.
        </p>
      </div>

      {isCancelled && (
        <p className="mx-auto mt-5 max-w-md rounded-lg bg-amber-50 px-3 py-2.5 text-center text-[13px] leading-relaxed text-amber-700">
          Checkout cancelled — you haven’t been charged.
        </p>
      )}

      {/* Yearly toggle — sits above both cards so the discount is the first thing you see */}
      {hasYearly && (
        <div className="mt-7 flex flex-col items-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
            <Segment active={plan === "monthly"} onClick={() => setPlan("monthly")}>
              Monthly
            </Segment>
            <Segment active={plan === "yearly"} onClick={() => setPlan("yearly")}>
              Yearly{savingsPct > 0 ? ` · save ${savingsPct}%` : ""}
            </Segment>
          </div>
          {savingsPct > 0 && (
            <p className="text-xs text-neutral-400">
              {plan === "yearly"
                ? `That’s ${yearlyPerMonth}/mo, billed once a year.`
                : `Switch to yearly and save ${savingsPct}%.`}
            </p>
          )}
        </div>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {/* ---- Free tier ---- */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Free</h2>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
              Your plan
            </span>
          </div>
          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl font-semibold tracking-tight text-neutral-900">$0</span>
            <span className="pb-1 text-sm text-neutral-500">/forever</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">No card, no sign-up.</p>

          <ul className="mt-5 space-y-2 text-sm text-neutral-600">
            <Feature>Unlimited quizzes from any PDF</Feature>
            <Feature>Merge multiple papers into one</Feature>
            <Feature>Answer-key &amp; mark-scheme matching</Feature>
            <Feature>Image questions &amp; figures</Feature>
            <Feature>Everything stays on your device</Feature>
          </ul>

          <button
            type="button"
            disabled
            className="mt-6 w-full cursor-default rounded-full border border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-400"
          >
            Current plan
          </button>
        </div>

        {/* ---- Pro tier ---- */}
        <div className="relative flex flex-col rounded-2xl border-2 border-neutral-900 bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Pro</h2>
            {hasYearly && savingsPct > 0 ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Save {savingsPct}% yearly
              </span>
            ) : (
              <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                AI features
              </span>
            )}
          </div>

          {notConfigured ? (
            <p className="mt-5 text-sm leading-relaxed text-neutral-500">
              Upgrades aren’t available just yet. Please check back soon.
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight text-neutral-900">
                  {selected ? formatPrice(selected) : "—"}
                </span>
                <span className="pb-1 text-sm text-neutral-500">{intervalLabel(selected)}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                {plan === "yearly" && hasYearly && yearlyPerMonth
                  ? `${yearlyPerMonth}/mo, billed once a year${savingsPct > 0 ? ` · save ${savingsPct}%` : ""}`
                  : hasYearly && savingsPct > 0
                    ? `Or pay yearly and save ${savingsPct}%.`
                    : "Billed monthly · cancel anytime."}
              </p>

              <ul className="mt-5 space-y-2 text-sm text-neutral-600">
                <Feature>Everything in Free, always</Feature>
                <Feature>AI answer keys for papers with no key</Feature>
                <Feature>Every answer confidence-scored, with reasoning</Feature>
                <Feature soon>AI explanations for any answer</Feature>
                <Feature soon>AI tutor &amp; question generation</Feature>
              </ul>

              {SUBSCRIPTIONS_ENABLED ? (
                <>
                  {error && (
                    <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={onUpgrade}
                    disabled={busy || status === "loading"}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy
                      ? "Starting checkout…"
                      : signedIn
                        ? `Upgrade${selected ? ` — ${formatPrice(selected)}${intervalLabel(selected)}` : ""}`
                        : "Continue with Google to upgrade"}
                  </button>

                  <p className="mt-3 text-center text-[12px] leading-relaxed text-neutral-400">
                    Secure checkout by Stripe. Card details are entered on Stripe’s page — never here.
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-6 flex w-full cursor-default items-center justify-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-400"
                  >
                    Coming soon
                  </button>
                  <p className="mt-3 text-center text-[12px] leading-relaxed text-neutral-400">
                    Pro isn’t open for subscriptions yet — we’re finishing the AI features. The
                    converter and every study tool stay free in the meantime.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </WideShell>
  );
}

// ---- little presentational helpers -----------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16">
      {children}
    </div>
  );
}

// Wider variant for the side-by-side Free/Pro comparison.
function WideShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-16">
      {children}
    </div>
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

function Feature({ children, soon = false }: { children: React.ReactNode; soon?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${soon ? "text-neutral-400" : ""}`}>
      <Check
        className={`mt-0.5 h-4 w-4 shrink-0 ${soon ? "text-neutral-300" : "text-emerald-600"}`}
      />
      <span>
        {children}
        {soon && (
          <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Soon
          </span>
        )}
      </span>
    </li>
  );
}

function Badge({ tone = "emerald" }: { tone?: "emerald" | "neutral" }) {
  return (
    <span
      className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${
        tone === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      <Check className="h-6 w-6" />
    </span>
  );
}
