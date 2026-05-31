import type { Quiz } from "./types";

/**
 * Demo fixture for the review/correct screen until live ingestion is wired
 * (upload -> extract -> parse -> review). Shaped exactly like real parser
 * output. Q3 intentionally has no detected answer so the "needs review"
 * affordance is visible; correcting it clears the flag live.
 */
export const sampleQuiz: Quiz = {
  id: "quiz_sample01",
  title: "UI Design Fundamentals & Best Practice",
  source: { type: "pdf", filename: "ui-design-fundamentals.pdf" },
  createdAt: "2026-05-31T00:00:00.000Z",
  questions: [
    {
      id: "q_001",
      number: 1,
      type: "mcq",
      stem: "What does UI stand for?",
      options: [
        { label: "A", text: "User Interaction" },
        { label: "B", text: "User Interface" },
        { label: "C", text: "Universal Input" },
        { label: "D", text: "Unified Integration" },
      ],
      correct: "B",
      explanation: "UI stands for User Interface — the visual layer a person interacts with.",
      confidence: 1,
      flags: [],
    },
    {
      id: "q_002",
      number: 2,
      type: "mcq",
      stem: "Which aspect of UI design is most concerned with guiding the user's eye through a layout?",
      options: [
        { label: "A", text: "Color theory" },
        { label: "B", text: "Visual hierarchy" },
        { label: "C", text: "Microcopy" },
        { label: "D", text: "Version control" },
      ],
      correct: "B",
      explanation: null,
      confidence: 1,
      flags: [],
    },
    {
      id: "q_003",
      number: 3,
      type: "mcq",
      stem: "How should you export an icon asset so it stays crisp across screen densities?",
      options: [
        { label: "A", text: "A single low-resolution PNG" },
        { label: "B", text: "As SVG, or PNG at @1x / @2x / @3x" },
        { label: "C", text: "A screenshot of the canvas" },
        { label: "D", text: "It does not matter" },
      ],
      correct: null,
      explanation: null,
      confidence: 0.6,
      flags: ["No correct answer detected"],
    },
    {
      id: "q_004",
      number: 4,
      type: "mcq",
      stem: "Which term refers to the empty space between design elements?",
      options: [
        { label: "A", text: "Kerning" },
        { label: "B", text: "Whitespace" },
        { label: "C", text: "Bleed" },
        { label: "D", text: "Dithering" },
      ],
      correct: "B",
      explanation: "Whitespace (negative space) is the empty area between elements that gives a layout room to breathe.",
      confidence: 1,
      flags: [],
    },
    {
      id: "q_005",
      number: 5,
      type: "mcq",
      stem: "Why is maintaining consistency important in UI design?",
      options: [
        { label: "A", text: "Consistency enhances creativity" },
        { label: "B", text: "Consistency improves user experience and navigation" },
        { label: "C", text: "Consistency makes the design more complex" },
        { label: "D", text: "Consistency is unnecessary in UI design" },
      ],
      correct: "B",
      explanation: null,
      confidence: 1,
      flags: [],
    },
  ],
};
