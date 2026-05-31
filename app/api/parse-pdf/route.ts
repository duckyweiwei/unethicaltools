import { NextResponse } from "next/server";
import { parsePdf, PdfTooLargeError } from "@/lib/importers/pdf";

// pdf.js (via unpdf) needs the Node runtime, not edge.
export const runtime = "nodejs";
export const maxDuration = 30;

// Soft page cap: keeps a single file comfortably inside maxDuration. Files are
// added one at a time client-side, so combined uploads never sum past Vercel's
// ~4.5 MB request-body limit.
const MAX_PAGES = 50;

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

  const data = new Uint8Array(await file.arrayBuffer());

  try {
    const { quiz, answerKey, pages } = await parsePdf(
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
    return NextResponse.json({ quiz, answerKey, pages });
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
