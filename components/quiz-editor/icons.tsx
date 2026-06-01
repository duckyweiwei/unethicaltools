/* Minimal inline icon set (no icon dependency). All inherit `currentColor`. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const ChevronLeft = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const ChevronDown = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const Plus = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Sparkles = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5L10 3z" />
    <path d="M17.5 13l.8 2.2L20.5 16l-2.2.8L17.5 19l-.8-2.2L14.5 16l2.2-.8L17.5 13z" />
  </svg>
);

export const Cloud = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.98A6 6 0 0 0 6.34 9.5 4 4 0 0 0 7 17.45" />
  </svg>
);

export const Play = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M7 5l11 7-11 7V5z" fill="currentColor" stroke="none" />
  </svg>
);

export const Settings = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const Dots = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const Trash = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const Grip = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const ImageIcon = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="M21 16l-5-5L5 20" />
  </svg>
);

export const VideoIcon = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3" />
  </svg>
);

export const MicIcon = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const Check = (p: P) => (
  <svg {...base} width="14" height="14" strokeWidth={2.4} {...p}>
    <path d="M5 12l5 5 9-10" />
  </svg>
);

export const Clock = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const Grid = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const Pencil = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

// Fill-in-the-blank: an underline split by a gap with a cursor — "____ | ____".
export const Blank = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M3 17h6M15 17h6" />
    <path d="M12 6v7" />
  </svg>
);

export const Alert = (p: P) => (
  <svg {...base} width="14" height="14" {...p}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);

export const Folder = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h3.2a2 2 0 0 1 1.4.6L11 7h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

// A filled, macOS-style folder: a lighter back panel + tab behind a solid front
// pocket (two-tone via opacity on a single `currentColor`, which we tint blue).
// Used for the Finder-like folder tiles in the library.
export const FolderSolid = (p: P) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" {...p}>
    <path
      d="M2 7a2 2 0 0 1 2-2h4.17a2 2 0 0 1 1.41.59L11 7h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z"
      opacity="0.4"
    />
    <path d="M2 10h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8z" />
  </svg>
);

export const Upload = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const ChevronRight = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const Close = (p: P) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Shuffle = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </svg>
);

// Two opposed vertical arrows — "reorder / swap" the answer choices.
export const SwapVertical = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M7 4v16" />
    <path d="M3 8l4-4 4 4" />
    <path d="M17 20V4" />
    <path d="M13 16l4 4 4-4" />
  </svg>
);

export const Restart = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M2 4v6h6" />
    <path d="M3.5 15a9 9 0 1 0 2.1-9.4L2 10" />
  </svg>
);

// Printer — the study guide's "Print / Save as PDF" action.
export const Printer = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="13" width="12" height="8" rx="1" />
  </svg>
);

// Concentric target — "focus areas" / where to aim.
export const Target = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

// Stacked cards/sheets — the flashcards study mode.
export const Layers = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

// Three bars on a baseline — the progress/stats surface.
export const BarChart = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M3 21h18" />
    <path d="M7 21v-6M12 21V8M17 21v-10" strokeWidth={2.4} />
  </svg>
);

// Five-point star for ratings. Fills with currentColor so a parent can color it
// (amber for earned stars, neutral-200 for the empty remainder of a row).
export const Star = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path
      d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L12 3.5z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

export const Hash = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16" />
  </svg>
);

export const Search = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

// Speaker with sound waves — the "sound on" state of the player's mute toggle.
export const Volume = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M4 9v6h3l5 4V5L7 9H4z" />
    <path d="M16 8.5a4 4 0 0 1 0 7" />
    <path d="M18.5 6a7 7 0 0 1 0 12" />
  </svg>
);

// Speaker with an X — the "muted" state.
export const VolumeOff = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M4 9v6h3l5 4V5L7 9H4z" />
    <path d="M16 9l5 6M21 9l-5 6" />
  </svg>
);

// Share: three connected nodes — the universal "share / send a link" glyph.
export const Share = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

// Link / chain — used when the action specifically copies a URL.
export const LinkIcon = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 5" />
    <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19" />
  </svg>
);
