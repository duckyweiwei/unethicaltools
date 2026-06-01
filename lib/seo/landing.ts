/**
 * Data-driven landing-page registry. Each audience (IB, IGCSE, …) and each of
 * its subjects expands into an indexable landing page at a clean top-level slug:
 *
 *   audience hub   →  /igcse-past-paper-quiz
 *   subject page   →  /ib-chemistry
 *
 * Adding an audience or subject HERE is all it takes — the dynamic `[slug]`
 * route, its static params, the metadata, and the sitemap all read from this
 * registry, so the page system extends to any audience without new code or
 * hardcoded routes.
 *
 * Important: we never host or distribute exam papers. Copy throughout speaks of
 * "your own" past papers (the user uploads them), uses "exam-style"/"aligned to"
 * language rather than claiming endorsement, and each page carries a visible
 * not-affiliated disclaimer naming the relevant organisation.
 */

export interface LandingSubject {
  /** URL fragment after the audience prefix, e.g. "biology" → /igcse-biology. */
  slug: string;
  name: string;
  /** One-line description shown in the subject grid. */
  blurb: string;
  /** Optional syllabus/exam code rendered as a small badge, e.g. IGCSE "0610". */
  code?: string;
}

export interface LandingAudience {
  /** Prefix used to build subject slugs, e.g. "igcse" → /igcse-biology. */
  slug: string;
  /** Short brand, e.g. "IGCSE". */
  name: string;
  /** Full brand used in prose, e.g. "Cambridge IGCSE". */
  longName: string;
  /** The body to name in the not-affiliated disclaimer. */
  org: string;
  /** Standalone hub slug, e.g. "igcse-past-paper-quiz". */
  hubSlug: string;
  /** Hero sub-headline for the hub page. */
  tagline: string;
  /**
   * What the visitor uploads, plural and lower-case. Exam boards default to
   * "past papers"; SAT/ACT/AP set "practice tests"/"practice exams" so the copy,
   * SEO titles, and disclaimer read naturally instead of saying "SAT past papers".
   */
  material?: string;
  subjects: LandingSubject[];
}

/** The upload noun for an audience (defaults to "past papers"). */
export function materialOf(a: LandingAudience): string {
  return a.material ?? "past papers";
}

/**
 * SEO/heading noun phrase derived from the material: singularise the last word
 * and title-case it, then append "Quizzes" — "past papers" → "Past Paper
 * Quizzes", "practice tests" → "Practice Test Quizzes".
 */
export function quizPhrase(a: LandingAudience): string {
  const singular = materialOf(a).replace(/s\b/g, "");
  const titled = singular.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${titled} Quizzes`;
}

export type Landing =
  | { kind: "hub"; slug: string; audience: LandingAudience }
  | { kind: "subject"; slug: string; audience: LandingAudience; subject: LandingSubject };

const AUDIENCES: LandingAudience[] = [
  {
    slug: "igcse",
    name: "IGCSE",
    longName: "Cambridge IGCSE",
    org: "Cambridge Assessment International Education",
    hubSlug: "igcse-past-paper-quiz",
    tagline:
      "Upload your own Cambridge IGCSE past papers and revise every multiple-choice question as an interactive, exam-style quiz.",
    subjects: [
      {
        slug: "biology",
        name: "Biology",
        code: "0610",
        blurb: "Paper 1 & 2 multiple choice — cells, organisms, ecology, and human biology.",
      },
      {
        slug: "chemistry",
        name: "Chemistry",
        code: "0620",
        blurb:
          "Paper 1 & 2 multiple choice — atomic structure, bonding, reactions, and the periodic table.",
      },
      {
        slug: "physics",
        name: "Physics",
        code: "0625",
        blurb: "Paper 1 & 2 multiple choice — forces, energy, waves, electricity, and magnetism.",
      },
      {
        slug: "combined-science",
        name: "Combined Science",
        code: "0653",
        blurb: "Multiple-choice questions spanning biology, chemistry, and physics.",
      },
      {
        slug: "co-ordinated-sciences",
        name: "Co-ordinated Sciences",
        code: "0654",
        blurb: "Double-award multiple choice across biology, chemistry, and physics.",
      },
      {
        slug: "economics",
        name: "Economics",
        code: "0455",
        blurb:
          "Paper 1 multiple choice — the basic economic problem, markets, and the wider economy.",
      },
      {
        slug: "accounting",
        name: "Accounting",
        code: "0452",
        blurb:
          "Paper 1 multiple choice — double-entry, control accounts, and financial statements (35 questions).",
      },
    ],
  },
  {
    slug: "ib",
    name: "IB",
    longName: "International Baccalaureate (IB) Diploma",
    org: "the International Baccalaureate Organization",
    hubSlug: "ib-past-paper-quiz",
    tagline:
      "Upload your own IB Diploma Paper 1A papers and drill every multiple-choice question as an interactive, exam-style quiz.",
    subjects: [
      {
        slug: "biology",
        name: "Biology",
        blurb:
          "Paper 1A multiple choice — unity and diversity, form and function, interaction and interdependence.",
      },
      {
        slug: "chemistry",
        name: "Chemistry",
        blurb:
          "Paper 1A multiple choice — atomic models, bonding, energetics, reactivity, and structure.",
      },
      {
        slug: "physics",
        name: "Physics",
        blurb:
          "Paper 1A multiple choice — space, time and motion, fields, the particulate nature of matter, and nuclear physics.",
      },
      {
        slug: "sehs",
        name: "SEHS",
        blurb:
          "Sports, Exercise & Health Science Paper 1A multiple choice — anatomy, energy systems, biomechanics, and skill acquisition.",
      },
      {
        slug: "design-technology",
        name: "Design Technology",
        blurb:
          "Paper 1 multiple choice — design factors, materials, production methods, and innovation.",
      },
    ],
  },
  {
    slug: "sat",
    name: "SAT",
    longName: "SAT",
    org: "the College Board",
    hubSlug: "sat-practice-questions",
    material: "practice tests",
    tagline:
      "Upload your own SAT practice tests and drill every multiple-choice question as an interactive quiz.",
    subjects: [
      {
        slug: "reading-writing",
        name: "Reading & Writing",
        blurb:
          "Digital SAT — craft and structure, information and ideas, expression of ideas, and standard English conventions.",
      },
      {
        slug: "math",
        name: "Math",
        blurb:
          "Digital SAT — algebra, advanced math, problem-solving and data analysis, geometry and trigonometry.",
      },
    ],
  },
  {
    slug: "act",
    name: "ACT",
    longName: "ACT",
    org: "ACT, Inc.",
    hubSlug: "act-practice-questions",
    material: "practice tests",
    tagline:
      "Upload your own ACT practice tests and turn every multiple-choice question into an interactive quiz.",
    subjects: [
      {
        slug: "english",
        name: "English",
        blurb: "Usage, mechanics, and rhetorical skills across five passages — all multiple choice.",
      },
      {
        slug: "math",
        name: "Math",
        blurb:
          "Pre-algebra, elementary and intermediate algebra, geometry, and trigonometry — 60 multiple-choice questions.",
      },
      {
        slug: "reading",
        name: "Reading",
        blurb: "Four passages with multiple-choice comprehension and reasoning questions.",
      },
      {
        slug: "science",
        name: "Science",
        blurb:
          "Data representation, research summaries, and conflicting viewpoints — all multiple choice.",
      },
    ],
  },
  {
    slug: "ap",
    name: "AP",
    longName: "Advanced Placement (AP)",
    org: "the College Board",
    hubSlug: "ap-practice-questions",
    material: "practice exams",
    tagline:
      "Upload your own AP practice exams and turn the Section I multiple-choice questions into an interactive quiz.",
    subjects: [
      {
        slug: "biology",
        name: "Biology",
        blurb:
          "Section I multiple choice — evolution, energetics, genetics, information transfer, and ecology.",
      },
      {
        slug: "chemistry",
        name: "Chemistry",
        blurb:
          "Section I multiple choice — atomic structure, bonding, kinetics, thermodynamics, and equilibrium.",
      },
      {
        slug: "physics",
        name: "Physics",
        blurb:
          "Section I multiple choice — kinematics, forces, energy, momentum, circuits, and waves.",
      },
      {
        slug: "psychology",
        name: "Psychology",
        blurb:
          "Multiple choice — biological bases, sensation, cognition, development, and social psychology.",
      },
      {
        slug: "us-history",
        name: "U.S. History",
        blurb:
          "Section I — stimulus-based multiple-choice questions across nine chronological periods.",
      },
      {
        slug: "statistics",
        name: "Statistics",
        blurb:
          "Section I multiple choice — exploring data, sampling and experimentation, probability, and inference.",
      },
      {
        slug: "environmental-science",
        name: "Environmental Science",
        blurb:
          "Multiple choice — ecosystems, biodiversity, populations, pollution, and sustainability.",
      },
      {
        slug: "human-geography",
        name: "Human Geography",
        blurb:
          "Multiple choice — population, culture, political, agricultural, industrial, and urban geography.",
      },
    ],
  },
];

/** slug → Landing, built once. Holds both hub and subject pages. */
const REGISTRY: Map<string, Landing> = (() => {
  const m = new Map<string, Landing>();
  for (const audience of AUDIENCES) {
    m.set(audience.hubSlug, { kind: "hub", slug: audience.hubSlug, audience });
    for (const subject of audience.subjects) {
      const slug = `${audience.slug}-${subject.slug}`;
      m.set(slug, { kind: "subject", slug, audience, subject });
    }
  }
  return m;
})();

export function getLandingSlugs(): string[] {
  return [...REGISTRY.keys()];
}

/** All audiences, in registry order — used by the homepage subjects/exams grid. */
export function listAudiences(): LandingAudience[] {
  return AUDIENCES;
}

export function getLanding(slug: string): Landing | null {
  return REGISTRY.get(slug) ?? null;
}

/** Visible, page-level disclaimer naming the relevant organisation. */
export function disclaimerFor(audience: LandingAudience): string {
  return `Independent study tool — not affiliated with or endorsed by ${audience.org}. ${audience.longName} ${materialOf(audience)} and answer keys remain the property of their respective owners. Upload only materials you have the right to use.`;
}

/** SEO title + description for a landing page (the layout appends “· unethicaltools”). */
export function landingSeo(landing: Landing): { title: string; description: string } {
  if (landing.kind === "hub") {
    const a = landing.audience;
    return {
      title: `${a.name} ${quizPhrase(a)} — Practice Online`,
      description: `Turn your ${a.longName} ${materialOf(a)} into interactive, exam-style quizzes. Upload a PDF and study the exact questions online — deterministic, free, and no sign-up.`,
    };
  }
  const { audience: a, subject: s } = landing;
  return {
    title: `${a.name} ${s.name} ${quizPhrase(a)}`,
    description: `Revise ${a.longName} ${s.name} from your own ${materialOf(a)}. Upload a PDF and get an interactive quiz of the same questions — exam-style, deterministic, free, no sign-up.`,
  };
}

/** Sibling subject pages for the “more subjects” strip on a subject page. */
export function siblingSubjects(landing: Extract<Landing, { kind: "subject" }>): Landing[] {
  return landing.audience.subjects
    .filter((s) => s.slug !== landing.subject.slug)
    .map((s) => ({
      kind: "subject" as const,
      slug: `${landing.audience.slug}-${s.slug}`,
      audience: landing.audience,
      subject: s,
    }));
}
