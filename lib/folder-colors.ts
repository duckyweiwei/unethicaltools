/**
 * The six folder accent colors. The *key* is what we persist on a folder; the
 * Tailwind class maps live here (as complete, scannable strings) so the library
 * tiles, the create/edit picker, and the sidebar dots all stay in lockstep and
 * Tailwind never tree-shakes a colour we actually use.
 */
export type FolderColor = "sky" | "violet" | "emerald" | "amber" | "rose" | "slate";

/** Picker order. Sky leads because it's the historical (pre-colour) folder tint. */
export const FOLDER_COLORS: FolderColor[] = [
  "sky",
  "violet",
  "emerald",
  "amber",
  "rose",
  "slate",
];

export const DEFAULT_FOLDER_COLOR: FolderColor = "sky";

/** Coerce any stored value to a known colour — folders created before this
 *  feature have no `color`, and we never want an undefined class. */
export function folderColor(c: string | null | undefined): FolderColor {
  return c && (FOLDER_COLORS as string[]).includes(c) ? (c as FolderColor) : DEFAULT_FOLDER_COLOR;
}

// Text tint for the folder glyph (FolderSolid on a tile, Folder in the rail).
const ICON: Record<FolderColor, string> = {
  sky: "text-sky-500",
  violet: "text-violet-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  rose: "text-rose-500",
  slate: "text-slate-500",
};

// Solid fill for a swatch dot (the picker, the sidebar marker).
const SWATCH: Record<FolderColor, string> = {
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

// Soft tinted background + ring for the drop-target / selected affordances.
const SOFT: Record<FolderColor, string> = {
  sky: "bg-sky-50 ring-sky-300",
  violet: "bg-violet-50 ring-violet-300",
  emerald: "bg-emerald-50 ring-emerald-300",
  amber: "bg-amber-50 ring-amber-300",
  rose: "bg-rose-50 ring-rose-300",
  slate: "bg-slate-100 ring-slate-300",
};

export function folderIconClass(c: string | null | undefined): string {
  return ICON[folderColor(c)];
}
export function folderSwatchClass(c: string | null | undefined): string {
  return SWATCH[folderColor(c)];
}
export function folderSoftClass(c: string | null | undefined): string {
  return SOFT[folderColor(c)];
}
