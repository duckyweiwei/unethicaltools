/**
 * Default profanity wordlist for the bleep tool. Curated for the tool's
 * target use case — muting common English swears in podcast/stream
 * republishes — not a comprehensive obscenity dictionary.
 *
 * Inclusions: the f-/s-/b-word families and their conjugations + common
 * compound forms. Explicit conjugations beat regex-stem matching because
 * Whisper occasionally emits weird stems we can't predict (e.g. "fucken").
 *
 * Exclusions:
 *   - Slurs (ethnic, sexual, ableist). Often context-dependent and the
 *     user might not want them auto-flagged. Add via the custom-word
 *     input in the review UI when needed.
 *   - Standalone "ass", "hell", "damn", "crap" — too many false positives
 *     in casual speech.
 *
 * All entries are lowercase and stripped of punctuation. The matcher
 * normalizes Whisper output the same way before comparison.
 */
export const DEFAULT_PROFANITY: readonly string[] = [
  // f-word family
  "fuck", "fucks", "fucked", "fucker", "fuckers", "fucking", "fuckin",
  "fuckup", "fuckups", "fucktard", "fuckwit",
  "motherfucker", "motherfuckers", "motherfucking", "motherfuckin",

  // s-word family
  "shit", "shits", "shitted", "shitting", "shitty", "shithead",
  "shitter", "shitters", "shitshow", "shitstorm", "shitbag",
  "bullshit", "bullshitting", "dipshit", "horseshit",

  // ass-compounds (standalone "ass" excluded — too many false positives)
  "asshole", "assholes", "asshat", "asswipe", "asshats", "asswipes",
  "jackass", "jackasses", "dumbass", "dumbasses", "smartass",

  // b-word family
  "bitch", "bitches", "bitching", "bitched", "bitchy",
  "sonofabitch", "bastard", "bastards",

  // d-/c-/p-word families
  "dick", "dicks", "dickhead", "dickheads", "dickwad",
  "cock", "cocks", "cocksucker", "cocksuckers",
  "prick", "pricks",
  "pussy", "pussies",
  "cunt", "cunts",
  "twat", "twats",
  "wanker", "wankers",

  // slurs/insults at the milder end
  "douche", "douchebag", "douchebags",
  "slut", "sluts", "slutty",
  "whore", "whores",

  // body-function strong (mild forms like "piss" included since they
  // typically warrant a bleep in family-safe edits)
  "piss", "pissed", "pissing", "pisser",
];

export const DEFAULT_PROFANITY_SET: ReadonlySet<string> = new Set(
  DEFAULT_PROFANITY,
);
