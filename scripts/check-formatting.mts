// Proof/guard for the parser's text-formatting helpers: glued-word repair
// ("isfalse" -> "is false") and enumerated-statement splitting (i./ii./iii.
// onto their own lines). Run alongside parse-sample.mts.
//   npx tsx scripts/check-formatting.mts
import { repairGluedWords, splitEnumeratedStem } from "../lib/importers/pdf/parser/patterns";

let failures = 0;
function eq(name: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`   got : ${JSON.stringify(got)}`);
    console.log(`   want: ${JSON.stringify(want)}`);
  }
}

// --- repairGluedWords: the user's example ---
eq(
  "glue: isfalse",
  repairGluedWords("If Q = 2L + 4K, which of the following isfalse?"),
  "If Q = 2L + 4K, which of the following is false?",
);
eq("glue: aretrue", repairGluedWords("Both statements aretrue."), "Both statements are true.");
eq("glue: doesnot", repairGluedWords("It doesnot hold."), "It does not hold.");
eq("glue: thefollowing", repairGluedWords("Which of thefollowing applies?"), "Which of the following applies?");
eq("glue: noneof", repairGluedWords("noneof these"), "none of these");

// --- repairGluedWords: safety (must NOT change) ---
eq("safe: already spaced", repairGluedWords("which of the following is false?"), "which of the following is false?");
eq("safe: cannot", repairGluedWords("The firm cannot produce."), "The firm cannot produce.");
eq("safe: another/other", repairGluedWords("another option, the other one"), "another option, the other one");
eq("safe: ofthen-word", repairGluedWords("isotope and theory"), "isotope and theory");

// --- splitEnumeratedStem: the user's example ---
const econ =
  "In spending all his or her income, the consumer chooses the market basket that maximizes his or her utility. Which of the following statements will be correct? i. The marginal utility is the same for each commodity. ii. The marginal utility per dollar spent is the same for each commodity. iii. The marginal utility of each commodity is proportional to its price.";
eq(
  "split: i/ii/iii",
  splitEnumeratedStem(econ),
  [
    "In spending all his or her income, the consumer chooses the market basket that maximizes his or her utility. Which of the following statements will be correct?",
    "i. The marginal utility is the same for each commodity.",
    "ii. The marginal utility per dollar spent is the same for each commodity.",
    "iii. The marginal utility of each commodity is proportional to its price.",
  ].join("\n"),
);

// --- splitEnumeratedStem: safety (must NOT split) ---
eq("safe: single i.", splitEnumeratedStem("Solve for x. i. is irrelevant here"), "Solve for x. i. is irrelevant here");
eq("safe: no markers", splitEnumeratedStem("Plain question with no enumeration?"), "Plain question with no enumeration?");

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
