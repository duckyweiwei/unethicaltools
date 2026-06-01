/**
 * BULK CAPABILITY TEST — runs the REAL extraction + merge engine over a folder of
 * IB papers + mark schemes, exactly as the upload flow would, but bypassing the
 * UI's file-count / size / page caps (sanctioned: we're testing the engine).
 *
 *   npx tsx scripts/bulk-test.mts
 *
 * Reports:
 *   1. Per-file parse: classification (question paper / answer key / mark scheme),
 *      question & option counts, multi-select, diagram questions, header leakage,
 *      low-confidence, parse errors.
 *   2. Mark-scheme coverage per paper.
 *   3. Matching quality with CORRECT per-subject grouping (the right behavior).
 *   4. The bulk-upload reality: pool EVERYTHING into one mergeQuizzes call (what
 *      the app does today) and measure cross-subject answer contamination.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractPdf } from "../lib/importers/pdf/extract";
import { parseExtracted } from "../lib/importers/pdf/parser/index";
import { extractAnswerKeyPairs } from "../lib/importers/pdf/parser/index";
import { parseMarkScheme } from "../lib/importers/pdf/parser/index";
import { computeDiagramRequests } from "../lib/importers/pdf/attach";
import { mergeQuizzes, mergeQuizSets, type DocSet, type AnswerKeyEntry, type MarkSchemeEntry } from "../lib/importers/merge";
import type { Quiz, Question } from "../lib/domain/types";

const DIR = "/Users/weihaofu/Desktop/testingIBpapers";
const MAXPAGES = 60;

type DocType = "questions" | "answerKey" | "markScheme";

interface Parsed {
  file: string;
  group: string; // subject_paper_TZ_level (mark scheme shares its paper's group)
  isScheme: boolean; // filename says "markscheme"
  pages: number;
  quiz: Quiz;
  answerKey: AnswerKeyEntry[];
  markScheme: MarkSchemeEntry[];
  type: DocType; // how the UPLOADER would classify it
  error?: string;
}

/** Group key the way the upload flow can't, but a human would: subject+paper+TZ+level.
 *  Strip " (n)" dedupe suffixes, "_markscheme", and ".pdf". */
function groupKey(file: string): { group: string; isScheme: boolean } {
  let s = file.replace(/\.pdf$/i, "");
  s = s.replace(/\s*\(\d+\)\s*$/, ""); // " (1)", " (3)"
  const isScheme = /_?markscheme/i.test(s);
  s = s.replace(/_?markscheme/i, "");
  s = s.replace(/\s*\(\d+\)\s*$/, "").trim().replace(/_+$/, "");
  return { group: s, isScheme };
}

const PAPER_CODE = /\b\d{4}\s*[–—-]\s*\d{4}\b|(?:^|\s)[–—-]\s*\d{1,3}\s*[–—-](?:\s|$)/;
function leaks(text: string): boolean {
  return PAPER_CODE.test(text);
}

function isCleanLetter(ans: string): boolean {
  return /^\(?[A-D]\)?$/.test(ans.trim());
}

async function parseOne(file: string): Promise<Parsed> {
  const { group, isScheme } = groupKey(file);
  const base: Parsed = {
    file, group, isScheme, pages: 0,
    quiz: { id: "", title: "", source: { type: "pdf" }, questions: [], createdAt: "" },
    answerKey: [], markScheme: [], type: "answerKey",
  };
  try {
    const buf = await readFile(join(DIR, file));
    const data = new Uint8Array(buf);
    const doc = await extractPdf(data, { maxPages: MAXPAGES });
    const quiz = parseExtracted(doc, { type: "pdf", filename: file });
    const answerKey = extractAnswerKeyPairs(doc) as AnswerKeyEntry[];
    const markScheme = parseMarkScheme(doc) as MarkSchemeEntry[];
    // Mirror the app's classification (PdfUploader xhr.onload).
    const hasQuestions = quiz.questions.length >= 1;
    const hasKey = answerKey.length >= 1;
    const hasScheme = markScheme.length >= 1 && !hasQuestions;
    const type: DocType = hasQuestions ? "questions" : hasKey ? "answerKey" : hasScheme ? "markScheme" : "answerKey";
    return { ...base, pages: doc.pages, quiz, answerKey, markScheme, type };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

function mcqStats(qs: Question[]) {
  const mcq = qs.filter((q) => q.type === "mcq");
  const answered = mcq.filter((q) => q.correct != null);
  const byOrigin: Record<string, number> = {};
  for (const q of answered) byOrigin[q.answerOrigin ?? "?"] = (byOrigin[q.answerOrigin ?? "?"] ?? 0) + 1;
  return { mcqTotal: mcq.length, answered: answered.length, byOrigin };
}

async function main() {
  const all = (await readdir(DIR)).filter((f) => f.toLowerCase().endsWith(".pdf"));
  all.sort();
  console.log(`\n================ PARSING ${all.length} FILES ================\n`);

  const parsed: Parsed[] = [];
  for (const f of all) {
    const p = await parseOne(f);
    parsed.push(p);
    if (p.error) {
      console.log(`✗ ${f}\n    ERROR: ${p.error}`);
      continue;
    }
    const qs = p.quiz.questions;
    const ms = mcqStats(qs);
    const multi = qs.filter((q) => Array.isArray(q.correctSet) && q.correctSet.length >= 2).length;
    const diagram = qs.filter((q) => q.needsDiagram).length;
    const withStemImg = qs.filter((q) => q.image).length;
    const withOptImg = qs.filter((q) => q.options.some((o) => o.image)).length;
    const skipped = p.quiz.skipped?.length ?? 0;
    const lowConf = qs.filter((q) => q.confidence < 0.6).length;
    const leak = qs.filter((q) => leaks(q.stem) || q.options.some((o) => leaks(o.text))).length;
    const diagReqs = computeDiagramRequests(p.quiz, { pages: p.pages, lines: [], text: "" } as never);
    console.log(
      `• ${f}\n    [${p.type}] pages=${p.pages} group="${p.group}"${p.isScheme ? " (markscheme file)" : ""}\n` +
      `    questions=${qs.length} mcq=${ms.mcqTotal} multiSelect=${multi} answeredByParser=${ms.answered}\n` +
      `    diagramQ=${diagram} stemImg=${withStemImg} optImg=${withOptImg} skipped=${skipped} lowConf=${lowConf} headerLeak=${leak}\n` +
      `    answerKeyEntries=${p.answerKey.length} markSchemeEntries=${p.markScheme.length} (diagReqs=${Array.isArray(diagReqs) ? diagReqs.length : "?"})`,
    );
  }

  // ---- Group by subject+paper+TZ+level -------------------------------------
  const groups = new Map<string, Parsed[]>();
  for (const p of parsed) {
    if (p.error) continue;
    (groups.get(p.group) ?? groups.set(p.group, []).get(p.group)!).push(p);
  }

  console.log(`\n================ MARK-SCHEME COVERAGE & MATCHING (correct per-subject grouping) ================\n`);
  let totalMcq = 0, totalAnswered = 0, totalTextFlag = 0;
  const groupAnswers = new Map<string, Map<number, string | null>>(); // group -> qNumber -> answer

  for (const [g, members] of [...groups.entries()].sort()) {
    const papers = members.filter((m) => m.type === "questions" && !m.isScheme);
    const schemes = members.filter((m) => m.isScheme || m.type === "answerKey" || m.type === "markScheme");
    if (!papers.length) {
      console.log(`! ${g}: NO question paper parsed (members: ${members.map((m) => m.type).join(",")})`);
      continue;
    }
    const questionDocs = papers.map((p) => ({ fileName: p.file, quiz: p.quiz }));
    const answerKeys = schemes.filter((s) => s.type === "answerKey").flatMap((s) => s.answerKey);
    const markScheme = schemes.filter((s) => s.type === "markScheme").flatMap((s) => s.markScheme);
    const merged = mergeQuizzes({ questionDocs, answerKeys, markScheme });
    const ms = mcqStats(merged.questions);
    const textFlag = merged.questions.filter((q) => q.flags.some((f) => /mark scheme/i.test(f))).length;
    const unanswered = merged.questions.filter((q) => q.type === "mcq" && q.correct == null).map((q) => q.number);
    const schemeEntries = answerKeys.length + markScheme.length;
    const dirtyLetters = [...answerKeys.map((k) => k.label), ...markScheme.map((m) => m.answer)].filter((a) => !isCleanLetter(a)).length;
    totalMcq += ms.mcqTotal; totalAnswered += ms.answered; totalTextFlag += textFlag;

    // record per-number answer for contamination check
    const m = new Map<number, string | null>();
    for (const q of merged.questions) if (q.number != null) m.set(q.number, q.correct);
    groupAnswers.set(g, m);

    console.log(
      `${g}\n` +
      `    schemes: ${schemes.map((s) => `${s.file}[${s.type}:${s.type === "answerKey" ? s.answerKey.length : s.markScheme.length}]`).join(", ") || "NONE"}\n` +
      `    MCQ=${ms.mcqTotal} answered=${ms.answered} (${ms.mcqTotal ? Math.round(100 * ms.answered / ms.mcqTotal) : 0}%) origin=${JSON.stringify(ms.byOrigin)} fuzzyTextMatches=${textFlag} nonLetterSchemeAnswers=${dirtyLetters}\n` +
      (unanswered.length ? `    UNANSWERED MCQ #: ${unanswered.join(", ")}\n` : "") ,
    );
  }
  console.log(`TOTAL (grouped): ${totalAnswered}/${totalMcq} MCQs answered (${Math.round(100 * totalAnswered / totalMcq)}%), ${totalTextFlag} via fuzzy text match.`);

  // ---- Scenario A: pool EVERYTHING into one merge (what the app does today) --
  console.log(`\n================ BULK UPLOAD AS-IS: one mergeQuizzes for ALL files ================\n`);
  const allPapers = parsed.filter((p) => !p.error && p.type === "questions" && !p.isScheme);
  const allKeys = parsed.filter((p) => !p.error && p.type === "answerKey").flatMap((p) => p.answerKey);
  const allSchemes = parsed.filter((p) => !p.error && p.type === "markScheme").flatMap((p) => p.markScheme);
  const big = mergeQuizzes({
    questionDocs: allPapers.map((p) => ({ fileName: p.file, quiz: p.quiz })),
    answerKeys: allKeys, markScheme: allSchemes,
  });
  const bigMs = mcqStats(big.questions);
  console.log(`Pooled: ${allPapers.length} papers, ${allKeys.length} key entries, ${allSchemes.length} scheme entries → ONE quiz of ${big.questions.length} questions.`);
  console.log(`MCQ answered: ${bigMs.answered}/${bigMs.mcqTotal} origin=${JSON.stringify(bigMs.byOrigin)}`);

  // Contamination: did a question get an answer DIFFERENT from its own subject's grouped answer?
  let contaminated = 0, checked = 0;
  const examples: string[] = [];
  for (const q of big.questions) {
    if (q.type !== "mcq" || q.correct == null) continue;
    const g = groupKey(q.sourceLabel ?? "").group;
    const own = groupAnswers.get(g)?.get(q.number ?? -1);
    if (own === undefined) continue;
    checked++;
    if (own !== q.correct) {
      contaminated++;
      if (examples.length < 12) examples.push(`    ${q.sourceLabel} Q${q.number}: bulk="${q.correct}" but own-subject scheme="${own ?? "(none)"}"`);
    }
  }
  console.log(`\n(OLD) one-pool merge CONTAMINATION: ${contaminated}/${checked} sampled answered MCQs got a DIFFERENT (foreign-subject) answer.`);
  if (examples.length) console.log("Examples:\n" + examples.join("\n"));

  // ---- Scenario A-fixed: group by subject set, match within (the #95 fix) ----
  console.log(`\n================ BULK UPLOAD WITH #95 FIX: mergeQuizSets (group by subject) ================\n`);
  const docSets: DocSet[] = [...groups.entries()]
    .map(([, members]) => ({
      questionDocs: members.filter((m) => m.type === "questions" && !m.isScheme).map((p) => ({ fileName: p.file, quiz: p.quiz })),
      answerKeys: members.filter((m) => m.type === "answerKey").flatMap((m) => m.answerKey),
      markScheme: members.filter((m) => m.type === "markScheme").flatMap((m) => m.markScheme),
    }))
    .filter((s) => s.questionDocs.length);
  const fixed = mergeQuizSets(docSets);
  const fm = mcqStats(fixed.questions);
  console.log(`Grouped into ${docSets.length} subject sets → ONE quiz of ${fixed.questions.length} questions.`);
  console.log(`MCQ answered: ${fm.answered}/${fm.mcqTotal} (every answer comes from its OWN subject's scheme — 0 cross-subject contamination by construction).`);
  console.log(`Compare: one-pool merge reported ${bigMs.answered} "answered" but ~${Math.round(100 * contaminated / Math.max(1, checked))}% of the sample was the wrong subject's answer.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
