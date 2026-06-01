/**
 * Tiny synthesized audio cues for the quiz player — a bright chime when an
 * answer is right, a soft low buzz when it's wrong, and a short flourish when a
 * test is finished. Everything is generated with the Web Audio API (oscillators
 * + gain envelopes), so there are no audio asset files to ship or load.
 *
 * The AudioContext is created lazily and shared. Browsers start it "suspended"
 * until a user gesture, so every play resumes it first — in practice these cues
 * always fire from a click (Check / self-grade / Submit), which satisfies the
 * gesture requirement. All functions no-op safely during SSR or where Web Audio
 * is unavailable; callers gate on their own mute preference.
 */

type AC = AudioContext;

let ctx: AC | null = null;

function audioContext(): AC | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** One note: an oscillator with a quick attack and exponential decay so it
 *  reads as a soft "pluck" rather than a flat beep. */
function tone(
  ac: AC,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine",
  peak = 0.16,
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Resume the (possibly suspended) context and return its current time, or null
 *  if Web Audio isn't available here. */
function begin(): { ac: AC; t: number } | null {
  const ac = audioContext();
  if (!ac) return null;
  if (ac.state === "suspended") void ac.resume();
  return { ac, t: ac.currentTime };
}

/** Unlock audio ahead of the first cue. Browsers create the context "suspended"
 *  until a user gesture, so calling this from a click (e.g. "Start test")
 *  resumes it early — which matters in all-on-one-page mode, where the only cue
 *  (the finish chime) fires from an effect after Submit rather than directly
 *  from the click, and would otherwise be suppressed. Safe no-op without Web
 *  Audio. */
export function primeAudio(): void {
  begin();
}

/** Right answer: a bright rising fifth (E5 → B5). */
export function playCorrect(): void {
  const b = begin();
  if (!b) return;
  tone(b.ac, 659.25, b.t, 0.14, "sine", 0.16);
  tone(b.ac, 987.77, b.t + 0.09, 0.22, "sine", 0.16);
}

/** Wrong answer: a soft, low descending buzz (A3 → F3) on a triangle so it's a
 *  gentle "nope," never a harsh klaxon. */
export function playWrong(): void {
  const b = begin();
  if (!b) return;
  tone(b.ac, 220.0, b.t, 0.16, "triangle", 0.14);
  tone(b.ac, 174.61, b.t + 0.1, 0.26, "triangle", 0.14);
}

/** Test finished: a short three-note major flourish (C5–E5–G5). Gives page
 *  mode — which grades only at the end — an audible "done" moment. */
export function playDone(): void {
  const b = begin();
  if (!b) return;
  tone(b.ac, 523.25, b.t, 0.13, "sine", 0.15);
  tone(b.ac, 659.25, b.t + 0.1, 0.13, "sine", 0.15);
  tone(b.ac, 783.99, b.t + 0.2, 0.26, "sine", 0.15);
}
