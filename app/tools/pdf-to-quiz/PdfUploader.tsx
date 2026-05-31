"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quiz } from "@/lib/domain/types";
import { type AnswerKeyEntry, mergeQuizzes } from "@/lib/importers/merge";
import { Alert, Check, Cloud, Close } from "@/components/quiz-editor/icons";

const MAX_FILES = 8;
const MAX_MB = 4;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const STAGE_UPLOAD = "Uploading…";
const STAGE_READ = "Reading & finding questions…";

type DocType = "questions" | "answerKey";

interface StagedDoc {
  uid: string;
  fileName: string;
  sizeLabel: string;
  status: "parsing" | "ready" | "error";
  progress: number;
  stage: string;
  /** Effective classification (user can flip when a doc has both). */
  type: DocType | null;
  hasQuestions: boolean;
  hasKey: boolean;
  quiz: Quiz | null;
  answerKey: AnswerKeyEntry[];
  questionCount: number;
  keyCount: number;
  pages: number;
  error: string | null;
}

interface ParseResponse {
  quiz?: Quiz;
  answerKey?: AnswerKeyEntry[];
  pages?: number;
  error?: string;
}

const newUid = () => Math.random().toString(36).slice(2, 9);
const plural = (n: number) => (n === 1 ? "" : "s");

function mbLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 0.1 ? "<0.1" : mb.toFixed(1);
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
      fileName: file.name,
      sizeLabel: mbLabel(file.size),
      status,
      progress: status === "parsing" ? 6 : 0,
      stage: STAGE_UPLOAD,
      type: null,
      hasQuestions: false,
      hasKey: false,
      quiz: null,
      answerKey: [],
      questionCount: 0,
      keyCount: 0,
      pages: 0,
      error,
    };
  }

  function uploadDoc(uid: string, file: File) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/parse-pdf");
    xhr.responseType = "json";
    let handedOff = false;

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
      const ok = xhr.status >= 200 && xhr.status < 300;
      const json = (xhr.response ?? {}) as ParseResponse;
      if (!ok || !json.quiz) {
        patch(uid, { status: "error", error: json.error ?? "Could not parse this PDF.", progress: 0 });
        return;
      }
      const questionCount = json.quiz.questions.length;
      const keyCount = json.answerKey?.length ?? 0;
      patch(uid, {
        status: "ready",
        progress: 100,
        stage: "",
        type: questionCount >= 1 ? "questions" : "answerKey",
        hasQuestions: questionCount >= 1,
        hasKey: keyCount >= 1,
        quiz: json.quiz,
        answerKey: json.answerKey ?? [],
        questionCount,
        keyCount,
        pages: json.pages ?? 0,
      });
    };
    xhr.onerror = () => {
      stopTrickle(uid);
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
    setDocs((ds) => ds.filter((d) => d.uid !== uid));
  }

  function setType(uid: string, type: DocType) {
    patch(uid, { type });
  }

  function createQuiz() {
    const ready = docsRef.current.filter((d) => d.status === "ready");
    const questionDocs = ready
      .filter((d) => d.type === "questions" && d.quiz)
      .map((d) => ({ fileName: d.fileName, quiz: d.quiz as Quiz }));
    if (!questionDocs.length) {
      setGlobalError("Add at least one PDF that contains questions.");
      return;
    }
    const answerKeys = ready.filter((d) => d.type === "answerKey").flatMap((d) => d.answerKey);
    const merged = mergeQuizzes({ questionDocs, answerKeys });

    setCreating(true);
    sessionStorage.setItem("pdfquiz:current", JSON.stringify(merged));
    // Let the button state paint before routing away.
    window.setTimeout(() => router.push("/tools/pdf-to-quiz/review"), 150);
  }

  const anyParsing = docs.some((d) => d.status === "parsing");
  const questionDocsReady = docs.filter((d) => d.status === "ready" && d.type === "questions");
  const keyDocsReady = docs.filter((d) => d.status === "ready" && d.type === "answerKey");
  const totalQuestions = questionDocsReady.reduce((n, d) => n + d.questionCount, 0);
  const canCreate = questionDocsReady.length > 0 && !anyParsing && !creating;

  const summary = anyParsing
    ? "Parsing…"
    : questionDocsReady.length === 0
      ? "Add a PDF with questions to continue."
      : `${questionDocsReady.length} PDF${plural(questionDocsReady.length)} · ${totalQuestions} question${plural(
          totalQuestions,
        )}${keyDocsReady.length ? ` · ${keyDocsReady.length} answer key${plural(keyDocsReady.length)}` : ""}`;

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
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white text-center transition",
          docs.length ? "px-6 py-6" : "px-6 py-14",
          dragOver
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50",
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
              Questions and/or a separate answer key · up to {MAX_FILES} files, ~{MAX_MB} MB &amp; 50 pages each
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

                {d.status === "parsing" && (
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

                {d.status === "ready" && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
                    {d.hasQuestions && d.hasKey ? (
                      <span className="inline-flex overflow-hidden rounded-md border border-neutral-200">
                        <button
                          type="button"
                          onClick={() => setType(d.uid, "questions")}
                          className={
                            d.type === "questions"
                              ? "bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white"
                              : "bg-white px-2 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-50"
                          }
                        >
                          Questions
                        </button>
                        <button
                          type="button"
                          onClick={() => setType(d.uid, "answerKey")}
                          className={
                            d.type === "answerKey"
                              ? "bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white"
                              : "bg-white px-2 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-50"
                          }
                        >
                          Answer key
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        {d.type === "questions" ? "Questions" : "Answer key"}
                      </span>
                    )}
                    <span>
                      {d.type === "questions"
                        ? `${d.questionCount} question${plural(d.questionCount)}`
                        : `${d.keyCount} answer${plural(d.keyCount)}`}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {d.pages} pg · {d.sizeLabel} MB
                    </span>
                  </div>
                )}
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
