"use client";

/**
 * Kick off a Stripe Checkout from the browser: POST the chosen plan + the
 * signed-in account id to our server, which creates the hosted session and hands
 * back a URL we redirect to. Card details are entered on Stripe's page, never ours.
 *
 * `accountId` is what ties the eventual payment back to this user — the webhook
 * reads it to grant Pro. Without it a purchase can't be attributed, so the
 * upgrade UI signs the user in first.
 */
export type Plan = "monthly" | "yearly";

export interface StartCheckoutOptions {
  accountId?: string;
  email?: string;
  plan?: Plan;
}

export async function startCheckout(opts: StartCheckoutOptions): Promise<void> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    let message = "Couldn’t start checkout. Please try again.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body — keep the default message */
    }
    throw new Error(message);
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Checkout didn’t return a URL.");
  window.location.href = data.url;
}
