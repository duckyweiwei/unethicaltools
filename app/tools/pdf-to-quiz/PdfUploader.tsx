"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quiz, Question } from "@/lib/domain/types";
import { newImageId } from "@/lib/domain/ids";
import {
  type AnswerKeyEntry,
  type DocSet,
  type MarkSchemeEntry,
  mergeQuizzes,
  mergeQuizSets,
} from "@/lib/importers/merge";
import { putImage, writeTray, type TrayImage } from "@/lib/storage/image-store";
// Client-side renderer for labeled-diagram MCQs. Safe to import statically: it
// only pulls pdf.js in behind a dynamic import (own chunk), never at module load.
import { rasterizeDiagramRequests } from "@/lib/importers/pdf/client-raster";
// Type-only: the runtime modules pull in unpdf/node:zlib and must never reach
// the client bundle. `import type` is erased at compile time, so this is safe.
import type { ExtractedImage } from "@/lib/importers/pdf/images";
import type { DiagramRequest } from "@/lib/importers/pdf/attach";
import { Alert, Check, Cloud, Close } from "@/components/quiz-editor/icons";

// Each file is uploaded and parsed in its OWN request, so this cap is about
// keeping the staging UI manageable, not any request-size limit. Set high enough
// to stage several subjects' papers + mark schemes together (they're grouped per
// subject at merge time — see createQuiz), e.g. ~10 paper+scheme pairs.
const MAX_FILES = 20;
const MAX_MB = 4;
const MAX_BYTES = MAX_MB * 1024 * 1024;

// Cap how many auto-extracted figures we carry into the review tray across the
// whole staged set — bounds the IndexedDB writes and keeps the tray scannable.
const MAX_TRAY_IMAGES = 24;

// The status icon already spins immediately, so we hold the per-file progress
// bar back until a parse has run long enough to be worth showing. Quick parses
// finish before this and never flash a bar; slower ones reveal live progress.
const BAR_DELAY_MS = 1200;

const STAGE_UPLOAD = "Uploading…";
const STAGE_READ = "Reading & finding questions…";

type DocType = "questions" | "answerKey" | "markScheme";

const TYPE_LABEL: Record<DocType, string> = {
  questions: "Questions",
  answerKey: "Answer key",
  markScheme: "Mark scheme",
};

interface StagedDoc {
  uid: string;
  /** The original upload, kept so diagram regions can be rasterized client-side
   *  at create time (the server can't see the vector figures they reference). */
  file: File;
  fileName: string;
  sizeLabel: string;
  status: "parsing" | "ready" | "error";
  progress: number;
  stage: string;
  /** Gates the progress bar: true only after BAR_DELAY_MS of parsing. */
  showBar: boolean;
  /** Effective classification (user can flip when a doc looks like more than one). */
  type: DocType | null;
  hasQuestions: boolean;
  hasKey: boolean;
  /** A mark-scheme candidate: numbered answer rows and not itself a question paper. */
  hasMarkScheme: boolean;
  quiz: Quiz | null;
  answerKey: AnswerKeyEntry[];
  markScheme: MarkSchemeEntry[];
  /** Figures the server pulled from this PDF, offered later in the review tray. */
  images: ExtractedImage[];
  /** Regions the CLIENT must render (vector diagram MCQs the server can't raster). */
  diagramRequests: DiagramRequest[];
  questionCount: number;
  keyCount: number;
  markSchemeCount: number;
  pages: number;
  error: string | null;
}

interface ParseResponse {
  quiz?: Quiz;
  answerKey?: AnswerKeyEntry[];
  markScheme?: MarkSchemeEntry[];
  pages?: number;
  images?: ExtractedImage[];
  diagramRequests?: DiagramRequest[];
  error?: string;
}

const newUid = () => Math.random().toString(36).slice(2, 9);
const plural = (n: number) => (n === 1 ? "" : "s");

function mbLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 0.1 ? "<0.1" : mb.toFixed(1);
}

/** Normalize a filename to a "set" key so a paper and its answer doc group
 *  together: drop the extension, a trailing " (n)" dedupe suffix, and a trailing
 *  role word (mark scheme / answers / key / solutions). So "Bio_TZ1_HL.pdf" and
 *  "Bio_TZ1_HL_markscheme.pdf" both reduce to "bio_tz1_hl". Used only when 2+
 *  question papers are staged, to match each paper to its OWN key/scheme. */
function stemKey(fileName: string): string {
  let s = fileName.replace(/\.pdf$/i, "");
  s = s.replace(/\s*\(\d+\)\s*$/g, ""); // " (1)" dedupe suffix
  s = s.replace(
    /[_\s-]*(?:mark\s*scheme|markscheme|ms|answer\s*key|answers?|key|solutions?|soln)\s*$/i,
    "",
  );
  s = s.replace(/\s*\(\d+\)\s*$/g, ""); // a suffix that preceded the role word
  return s.trim().replace(/[_\s-]+$/, "").toLowerCase();
}

/**
 * The classifications a parsed doc could plausibly be, so the row only offers a
 * toggle when there's a real choice (otherwise a static pill). A question paper
 * is never offered as a mark scheme — its numbered lines are questions, not
 * answers — but a numbered-answer doc can be either an answer key or a scheme.
 */
function candidatesFor(d: StagedDoc): DocType[] {
  const c: DocType[] = [];
  if (d.hasQuestions) c.push("questions");
  if (d.hasKey) c.push("answerKey");
  if (d.hasMarkScheme) c.push("markScheme");
  return c.length ? c : [d.type ?? "answerKey"];
}

/**
 * Stage several PDFs (question papers and/or standalone answer keys), parse each
 * on add, then build ONE quiz on demand. Nothing navigates until the user hits
 * "Create quiz" — so a question PDF that imported with no answers can be paired
 * with a separate answer-key PDF before review.
 */
export function PdfUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<StagedDoc[]>([]);
  const tricklesRef = useRef<Map<string, number>>(new Map());
  const barTimersRef = useRef<Map<string, number>>(new Map());

  const [docs, setDocs] = useState<StagedDoc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  // Clear any running trickles on unmount.
  useEffect(
    () => () => {
      tricklesRef.current.forEach((id) => clearInterval(id));
      tricklesRef.current.clear();
      barTimersRef.current.forEach((id) => clearTimeout(id));
      barTimersRef.current.clear();
    },
    [],
  );

  const patch = (uid: string, partial: Partial<StagedDoc>) =>
    setDocs((ds) => ds.map((d) => (d.uid === uid ? { ...d, ...partial } : d)));

  function stopTrickle(uid: string) {
    const id = tricklesRef.current.get(uid);
    if (id != null) {
      clearInterval(id);
      tricklesRef.current.delete(uid);
    }
  }

  function clearBarTimer(uid: string) {
    const id = barTimersRef.current.get(uid);
    if (id != null) {
      clearTimeout(id);
      barTimersRef.current.delete(uid);
    }
  }

  // Server extract+parse is opaque, so once bytes land we ease this doc's bar
  // toward 95% (the response snaps it to 100) instead of freezing at 40.
  function startTrickle(uid: string) {
    stopTrickle(uid);
    const id = window.setInterval(() => {
      setDocs((ds) =>
        ds.map((d) =>
          d.uid === uid && d.status === "parsing"
            ? { ...d, progress: d.progress < 95 ? d.progress + Math.max(0.4, (95 - d.progress) * 0.05) : d.progress }
            : d,
        ),
      );
    }, 200);
    tricklesRef.current.set(uid, id);
  }

  function makeDoc(file: File, status: StagedDoc["status"], error: string | null, uid = newUid()): StagedDoc {
    return {
      uid,
      file,
      fileName: file.name,
      sizeLabel: mbLabel(file.size),
      status,
      progress: status === "parsing" ? 6 : 0,
      stage: STAGE_UPLOAD,
      showBar: false,
      type: null,
      hasQuestions: false,
      hasKey: false,
      hasMarkScheme: false,
      quiz: null,
      answerKey: [],
      markScheme: [],
      images: [],
      diagramRequests: [],
      questionCount: 0,
      keyCount: 0,
      markSchemeCount: 0,
      pages: 0,
      error,
    };
  }

  function uploadDoc(uid: string, file: File) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/parse-pdf");
    xhr.responseType = "json";
    let handedOff = false;

    // Reveal the progress bar only if this parse outlives BAR_DELAY_MS.
    const barTimer = window.setTimeout(() => {
      barTimersRef.current.delete(uid);
      setDocs((ds) =>
        ds.map((d) => (d.uid === uid && d.status === "parsing" ? { ...d, showBar: true } : d)),
      );
    }, BAR_DELAY_MS);
    barTimersRef.current.set(uid, barTimer);

    // Real upload bytes drive the first 40%.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) patch(uid, { progress: Math.min(40, Math.round((e.loaded / e.total) * 40)) });
    };
    xhr.upload.onload = () => {
      if (handedOff) return;
      handedOff = true;
      setDocs((ds) =>
        ds.map((d) => (d.uid === uid ? { ...d, progress: Math.max(d.progress, 40), stage: STAGE_READ } : d)),
      );
      startTrickle(uid);
    };
    xhr.onload = () => {
      stopTrickle(uid);
      clearBarTimer(uid);
      const ok = xhr.status >= 200 && xhr.status < 300;
      const json = (xhr.response ?? {}) as ParseResponse;
      if (!ok || !json.quiz) {
        patch(uid, { status: "error", error: json.error ?? "Could not parse this PDF.", progress: 0 });
        return;
      }
      const questionCount = json.quiz.questions.length;
      const keyCount = json.answerKey?.length ?? 0;
      const markSchemeCount = json.markScheme?.length ?? 0;
      // A mark scheme is a numbered-answer doc that ISN'T a question paper — its
      // numbered lines are answers, not questions. Auto-pick: questions first,
      // then a clean letter key (conservative), then a scheme. The user can flip.
      const hasQuestions = questionCount >= 1;
      const hasKey = keyCount >= 1;
      const hasMarkScheme = markSchemeCount >= 1 && !hasQuestions;
      patch(uid, {
        status: "ready",
        progress: 100,
        stage: "",
        type: hasQuestions ? "questions" : hasKey ? "answerKey" : hasMarkScheme ? "markScheme" : "answerKey",
        hasQuestions,
        hasKey,
        hasMarkScheme,
        quiz: json.quiz,
        answerKey: json.answerKey ?? [],
        markScheme: json.markScheme ?? [],
        images: json.images ?? [],
        diagramRequests: json.diagramRequests ?? [],
        questionCount,
        keyCount,
        markSchemeCount,
        pages: json.pages ?? 0,
      });
    };
    xhr.onerror = () => {
      stopTrickle(uid);
      clearBarTimer(uid);
      patch(uid, { status: "error", error: "Network error — check your connection and try again.", progress: 0 });
    };

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setGlobalError(null);

    const existing = new Set(docsRef.current.map((d) => d.fileName));
    let slots = MAX_FILES - docsRef.current.length;
    const additions: StagedDoc[] = [];
    const toUpload: Array<{ uid: string; file: File }> = [];
    const problems: string[] = [];

    for (const file of Array.from(fileList)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        problems.push(`${file.name}: not a PDF`);
        continue;
      }
      if (existing.has(file.name)) {
        problems.push(`${file.name}: already added`);
        continue;
      }
      existing.add(file.name);
      if (file.size > MAX_BYTES) {
        additions.push(makeDoc(file, "error", `Too large (${mbLabel(file.size)} MB) — keep each file under ${MAX_MB} MB.`));
        continue;
      }
      if (slots <= 0) {
        problems.push(`${file.name}: over the ${MAX_FILES}-file limit`);
        continue;
      }
      slots -= 1;
      const uid = newUid();
      additions.push(makeDoc(file, "parsing", null, uid));
      toUpload.push({ uid, file });
    }

    if (additions.length) setDocs((prev) => [...prev, ...additions]);
    if (problems.length) setGlobalError(problems.join(" · "));
    toUpload.forEach((u) => uploadDoc(u.uid, u.file));
  }

  function removeDoc(uid: string) {
    stopTrickle(uid);
    clearBarTimer(uid);
    setDocs((ds) => ds.filter((d) => d.uid !== uid));
  }

  function setType(uid: string, type: DocType) {
    patch(uid, { type });
  }

  // Land the figures the server pulled from the question PDFs. Each figure now
  // carries `attachToIds` — the questions it belongs to, decided deterministically
  // server-side from captions + stem references + position. Those get auto-attached
  // straight onto the merged quiz; anything we couldn't place confidently falls
  // back to the manual review tray. Bytes go to IndexedDB under fresh ids; the
  // quiz/tray hold only references. Best-effort and bounded: a storage failure or
  // an absurd image count must never block quiz creation, so each write is caught.
  async function stashFigures(merged: Quiz, ready: StagedDoc[]) {
    const trayRefs: TrayImage[] = [];
    let trayCount = 0;

    for (const d of ready) {
      if (d.type !== "questions" || !d.quiz) continue;

      // The merge preserves each doc's question order and stamps
      // sourceLabel === fileName, so zip this doc's ORIGINAL questions to their
      // merged counterparts by index. Original ids are index-based and collide
      // across docs ("q_001" in every file), so resolve them per-doc, never globally.
      const mergedSlice = merged.questions.filter((q) => q.sourceLabel === d.fileName);
      const byOriginalId = new Map<string, Question>();
      d.quiz.questions.forEach((q, k) => {
        if (mergedSlice[k]) byOriginalId.set(q.id, mergedSlice[k]);
      });

      for (const im of d.images) {
        if (im.attachToIds.length) {
          // Auto-attach. Give every target question its OWN copy of the bytes so
          // removing the image from one question can't strip it from the others.
          for (const targetId of im.attachToIds) {
            const mq = byOriginalId.get(targetId);
            if (!mq) continue;
            const id = newImageId();
            try {
              await putImage(id, im.dataUrl);
              mq.image = { id, alt: "", width: im.width, height: im.height };
            } catch {
              // IndexedDB unavailable / quota — skip this attach, keep the rest.
            }
          }
        } else if (trayCount < MAX_TRAY_IMAGES) {
          // Couldn't place it confidently — offer it in the manual review tray.
          const id = newImageId();
          try {
            await putImage(id, im.dataUrl);
            trayRefs.push({ id, page: im.page, sourceLabel: d.fileName, width: im.width, height: im.height });
            trayCount += 1;
          } catch {
            // IndexedDB unavailable / quota — skip this figure, keep the rest.
          }
        }
      }

      // Diagram MCQs: render the regions the server flagged from THIS doc's PDF
      // bytes (vector figures the raster pass can't see), then attach each crop
      // to its question and clear the needsDiagram hint. Best-effort — any
      // failure just leaves needsDiagram set for a manual attach in the editor.
      if (d.diagramRequests.length) {
        try {
          const bytes = new Uint8Array(await d.file.arrayBuffer());
          const rasters = await rasterizeDiagramRequests(bytes, d.diagramRequests);
          for (const [originalId, raster] of rasters) {
            const mq = byOriginalId.get(originalId);
            if (!mq) continue;
            const id = newImageId();
            try {
              await putImage(id, raster.dataUrl);
              mq.image = { id, alt: "Diagram", width: raster.width, height: raster.height };
              mq.needsDiagram = false;
            } catch {
              // IndexedDB unavailable / quota — keep needsDiagram for a manual attach.
            }
          }
        } catch {
          // Couldn't read or render this PDF — leave its diagram questions hinted.
        }
      }
    }

    writeTray(merged.id, trayRefs); // empty refs clears any stale tray from a prior import
  }

  async function createQuiz() {
    if (creating) return;
    const ready = docsRef.current.filter((d) => d.status === "ready");
    const paperDocs = ready.filter((d) => d.type === "questions" && d.quiz);
    if (!paperDocs.length) {
      setGlobalError("Add at least one PDF that contains questions.");
      return;
    }
    const keyDocs = ready.filter((d) => d.type === "answerKey");
    const schemeDocs = ready.filter((d) => d.type === "markScheme");

    let merged: Quiz;
    if (paperDocs.length === 1) {
      // One paper: every uploaded key/scheme must belong to it (there's no other
      // paper to mis-fill), so pool them all — robust to any answer-key filename.
      merged = mergeQuizzes({
        questionDocs: paperDocs.map((d) => ({ fileName: d.fileName, quiz: d.quiz as Quiz })),
        answerKeys: keyDocs.flatMap((d) => d.answerKey),
        markScheme: schemeDocs.flatMap((d) => d.markScheme),
      });
    } else {
      // Several papers: bundle each with ONLY its own key/scheme (matched by
      // filename stem) so one subject's answers never fill another's questions.
      // Answers are matched by question number, which collides across papers, so
      // pooling everything would assign whichever doc was staged last — wrong.
      const sets = new Map<string, DocSet>();
      const order: string[] = [];
      const setFor = (k: string): DocSet => {
        let s = sets.get(k);
        if (!s) {
          s = { questionDocs: [], answerKeys: [], markScheme: [] };
          sets.set(k, s);
          order.push(k);
        }
        return s;
      };
      for (const d of paperDocs) {
        setFor(stemKey(d.fileName)).questionDocs.push({ fileName: d.fileName, quiz: d.quiz as Quiz });
      }
      const unmatched: string[] = [];
      for (const d of keyDocs) {
        const s = sets.get(stemKey(d.fileName));
        if (s) s.answerKeys.push(...d.answerKey);
        else unmatched.push(d.fileName);
      }
      for (const d of schemeDocs) {
        const s = sets.get(stemKey(d.fileName));
        if (s) s.markScheme.push(...d.markScheme);
        else unmatched.push(d.fileName);
      }
      merged = mergeQuizSets(order.map((k) => sets.get(k) as DocSet));
      if (unmatched.length) {
        // Couldn't tie these to a specific paper by filename. Leaving their answers
        // unfilled (answerable later via the editor) is safer than guessing them
        // onto the wrong subject. Non-blocking — the quiz still creates.
        console.warn(
          `Bulk import: ${order.length} paper sets matched; could not match these answer files to a paper by name (left unfilled): ${unmatched.join(", ")}`,
        );
      }
    }

    setCreating(true);
    // Attach figures FIRST — stashFigures mutates merged.questions[].image by
    // reference, so the snapshot we persist below already carries the auto-attached
    // images (and leaves a tray manifest for anything unplaced).
    await stashFigures(merged, ready);
    sessionStorage.setItem("pdfquiz:current", JSON.stringify(merged));
    // Let the button state paint before routing away.
    window.setTimeout(() => router.push("/tools/pdf-to-quiz/review"), 150);
  }

  const anyParsing = docs.some((d) => d.status === "parsing");
  const questionDocsReady = docs.filter((d) => d.status === "ready" && d.type === "questions");
  const keyDocsReady = docs.filter((d) => d.status === "ready" && d.type === "answerKey");
  const schemeDocsReady = docs.filter((d) => d.status === "ready" && d.type === "markScheme");
  const totalQuestions = questionDocsReady.reduce((n, d) => n + d.questionCount, 0);
  const canCreate = questionDocsReady.length > 0 && !anyParsing && !creating;

  const summary = anyParsing
    ? "Parsing…"
    : questionDocsReady.length === 0
      ? "Add a PDF with questions to continue."
      : `${questionDocsReady.length} PDF${plural(questionDocsReady.length)} · ${totalQuestions} question${plural(
          totalQuestions,
        )}${keyDocsReady.length ? ` · ${keyDocsReady.length} answer key${plural(keyDocsReady.length)}` : ""}${
          schemeDocsReady.length ? ` · ${schemeDocsReady.length} mark scheme${plural(schemeDocsReady.length)}` : ""
        }`;

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone — compact once files are staged. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Add a PDF"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition",
          docs.length ? "px-6 py-6" : "px-6 py-14",
          dragOver
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50",
        ].join(" ")}
      >
        {docs.length ? (
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-600">
            <Cloud className="h-4 w-4" />
            Add another PDF
          </span>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-500">
              <Cloud className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium text-neutral-700">
              Drag PDFs here, or <span className="underline">browse</span>
            </span>
            <span className="text-xs text-neutral-400">
              Questions, plus an answer key or mark scheme · up to {MAX_FILES} files, ~{MAX_MB} MB &amp; 50 pages each
            </span>
          </>
        )}
      </div>

      {/* Staged documents. */}
      {docs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li
              key={d.uid}
              className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3"
            >
              <span
                className={[
                  "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  d.status === "error" ? "bg-rose-50 text-rose-500" : "bg-neutral-100 text-neutral-600",
                ].join(" ")}
              >
                {d.status === "parsing" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-700" />
                ) : d.status === "error" ? (
                  <Alert className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4 text-neutral-700" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-neutral-800">{d.fileName}</span>
                  <button
                    type="button"
                    onClick={() => removeDoc(d.uid)}
                    aria-label={`Remove ${d.fileName}`}
                    className="shrink-0 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <Close className="h-4 w-4" />
                  </button>
                </div>

                {d.status === "parsing" && d.showBar && (
                  <>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full bg-neutral-900 transition-[width] duration-300 ease-out"
                        style={{ width: `${d.progress}%` }}
                      />
                    </div>
                    <span className="mt-1.5 block text-xs text-neutral-400">{d.stage}</span>
                  </>
                )}

                {d.status === "error" && <span className="mt-1 block text-xs text-rose-600">{d.error}</span>}

                {d.status === "ready" && (() => {
                  const cands = candidatesFor(d);
                  const activeType = d.type ?? cands[0];
                  return (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
                      {cands.length > 1 ? (
                        <span className="inline-flex overflow-hidden rounded-md border border-neutral-200">
                          {cands.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setType(d.uid, t)}
                              className={
                                activeType === t
                                  ? "bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white"
                                  : "bg-white px-2 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-50"
                              }
                            >
                              {TYPE_LABEL[t]}
                            </button>
                          ))}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                          {TYPE_LABEL[activeType]}
                        </span>
                      )}
                      <span>
                        {activeType === "questions"
                          ? `${d.questionCount} question${plural(d.questionCount)}`
                          : activeType === "markScheme"
                            ? `${d.markSchemeCount} answer${plural(d.markSchemeCount)}`
                            : `${d.keyCount} answer${plural(d.keyCount)}`}
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {d.pages} pg · {d.sizeLabel} MB
                      </span>
                    </div>
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create-quiz action. */}
      {docs.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-neutral-400">{summary}</span>
          <button
            type="button"
            onClick={createQuiz}
            disabled={!canCreate}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Opening…" : "Create quiz"}
          </button>
        </div>
      )}

      {globalError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{globalError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
