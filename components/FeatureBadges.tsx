const items = [
  { label: "No Upload", icon: NoUploadIcon },
  { label: "Private Processing", icon: ShieldIcon },
  { label: "Fast Conversion", icon: BoltIcon },
  { label: "No Sign Up", icon: KeyOffIcon },
];

export function FeatureBadges() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl">
      {items.map(({ label, icon: Icon }) => (
        <li
          key={label}
          className="flex items-center gap-2 rounded-full glass px-3.5 py-2 text-sm text-[var(--color-text)]"
        >
          <Icon />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

function NoUploadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-violet-300"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <line x1="3" y1="3" x2="21" y2="21" />
      <path d="M7 10l5-5 5 5" />
      <line x1="12" y1="5" x2="12" y2="15" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-cyan-300"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-300"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function KeyOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-300"
    >
      <path d="M14 9a4 4 0 1 0-4 4" />
      <path d="M14 9l7 7" />
      <path d="M17 12l3 3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}
