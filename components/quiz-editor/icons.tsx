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

export const Restart = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M2 4v6h6" />
    <path d="M3.5 15a9 9 0 1 0 2.1-9.4L2 10" />
  </svg>
);

export const Hash = (p: P) => (
  <svg {...base} width="16" height="16" {...p}>
    <path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16" />
  </svg>
);
