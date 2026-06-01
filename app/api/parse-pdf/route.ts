import { NextResponse } from "next/server";
import { parsePdf, PdfTooLargeError } from "@/lib/importers/pdf";

// pdf.js (via unpdf) needs the Node runtime, not edge.
export const runtime = "nodejs";
export const maxDuration = 30;

// Soft page cap: keeps a single file comfortably inside maxDuration. Files are
// added one at a time client-side, so combined uploads never sum past Vercel's
// ~4.5 MB request-body limit.
const MAX_PAGES = 50;

// Hard ceiling on upload size. Vercel rejects request bodies past ~4.5 MB at the
// edge before this handler ever runs; this explicit guard is the backstop for
// self-hosting and keeps the expensive parser from touching an absurd input.
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Parse one uploaded PDF, server-side. Returns the parsed quiz, any standalone
 * answer-key pairs, and the page count — enough for the client to tell a
 * questions PDF from an answer-key PDF and to merge several into one quiz.
 * The deterministic engine runs in Node so the browser never bundles pdf.js.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Please upload a PDF file." }, { status: 415 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "This file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "This PDF is too large. Please upload a file under 6 MB." },
      { status: 413 },
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());

  // Magic-byte guard: a real PDF carries "%PDF-" within its first kilobyte (the
  // spec tolerates leading junk before the header). A matching extension or MIME
  // type is trivially spoofed, so confirm the actual bytes before parsing.
  const header = new TextDecoder("latin1").decode(data.subarray(0, 1024));
  if (!header.includes("%PDF-")) {
    return NextResponse.json({ error: "This file isn't a valid PDF." }, { status: 415 });
  }

  try {
    const { quiz, answerKey, markScheme, pages, images, diagramRequests } = await parsePdf(
      { data, filename: file.name },
      { maxPages: MAX_PAGES },
    );
    // A usable PDF yields questions OR an answer key. Neither → not parseable.
    if (!quiz.questions.length && !answerKey.length) {
      return NextResponse.json(
        {
          error:
            "No questions or answer key were found. This tool supports text-based MCQ PDFs (not scanned or image-only files).",
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ quiz, answerKey, markScheme, pages, images, diagramRequests });
  } catch (err) {
    if (err instanceof PdfTooLargeError) {
      return NextResponse.json(
        {
          error: `This PDF has ${err.pages} pages. Please split it — each file can be up to ${err.maxPages} pages.`,
        },
        { status: 413 },
      );
    }
    console.error("parse-pdf failed:", err);
    return NextResponse.json(
      { error: "Could not read this PDF. It may be encrypted, scanned, or corrupted." },
      { status: 500 },
    );
  }
}
