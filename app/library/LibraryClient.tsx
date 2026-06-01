"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAccount } from "@/lib/auth/account";
import { AccountModal } from "@/components/shell/AccountMenu";
import {
  listQuizzes,
  deleteQuiz,
  listFolders,
  createFolder,
  renameFolder,
  setFolderColor,
  deleteFolder,
  setQuizFolder,
  type StoredQuiz,
  type Folder as FolderType,
} from "@/lib/storage/quiz-library";
import {
  FOLDER_COLORS,
  folderColor,
  folderIconClass,
  folderSwatchClass,
  folderSoftClass,
  type FolderColor,
} from "@/lib/folder-colors";
import { buildShareLink } from "@/lib/share/link";
import {
  Check,
  ChevronLeft,
  Close,
  Folder,
  FolderSolid,
  Grid,
  Pencil,
  Play,
  Plus,
  Search,
  Share,
  Trash,
} from "@/components/quiz-editor/icons";

// Drag-over highlight key for the breadcrumb "unfile" drop target (distinct from
// any real folder id, which is prefixed `fld_`).
const UNFILE_DROP = "__unfile__";

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

/** Case-insensitive match of `query` against a quiz's title or any of its
 *  question stems, so you can find a quiz by something you remember being in it,
 *  not just its name. Empty query matches everything. */
function matches(q: StoredQuiz, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (q.title.toLowerCase().includes(needle)) return true;
  return q.questions.some((question) => question.stem.toLowerCase().includes(needle));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * The quiz library — a macOS-Finder-style surface. At the top level you see your
 * folders (open one to file into it) alongside any loose, unfiled quizzes; open a
 * folder to see just its quizzes. Quizzes can be dragged onto a folder to file
 * them (or onto the breadcrumb to unfile). Folders are optional and user-created;
 * publishing a quiz never forces one. Everything is read from localStorage on
 * mount (client-only), so we render a spinner until hydrated.
 */
export function LibraryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Quizzes are private to the signed-in account (local profile or Google). We
  // gate the whole library on having one, and re-read when the identity resolves.
  const account = useAccount();
  const { status: sessionStatus } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const [items, setItems] = useState<StoredQuiz[] | null>(null);
  const [folders, setFolders] = useState<FolderType[]>([]);
  // Multi-select to combine several quizzes into one study/test run.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Two-step deletes: arming a per-tile/card confirmation rather than removing
  // immediately, so nothing vanishes on a stray click.
  const [confirmId, setConfirmId] = useState<string | null>(null); // quiz delete
  const [confirmFolderId, setConfirmFolderId] = useState<string | null>(null); // folder delete
  // Per-card "move to folder" overlay (the click/keyboard path; drag-drop is the
  // pointer path). Mutually exclusive with the delete confirms.
  const [moveId, setMoveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Which folder is open. null = top level (folders + unfiled quizzes).
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  // Folder create/edit popup. null = closed, "new" = create, an existing folder
  // object = edit it (rename + recolor).
  const [folderModal, setFolderModal] = useState<"new" | FolderType | null>(null);
  // Drag state: the quiz being dragged, and the drop target currently hovered
  // (a folder id, or UNFILE_DROP for the breadcrumb).
  const [dragQuizId, setDragQuizId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // Brief "pop" on a folder right after a quiz lands in it (drag or move-to).
  const [justFiled, setJustFiled] = useState<string | null>(null);

  useEffect(() => {
    setItems(listQuizzes());
    setFolders(listFolders());
    // Re-read when the signed-in identity changes: signing in reveals that
    // account's quizzes; signing out clears them.
  }, [account?.id]);

  // Drive the open folder from the URL query so a sidebar link click — which
  // only changes the query string and does NOT remount this already-mounted
  // client component — actually opens the folder. `useSearchParams` is reactive,
  // unlike a one-shot `window.location.search` read on mount.
  useEffect(() => {
    setActiveFolder(searchParams.get("folder"));
  }, [searchParams]);

  const searching = query.trim().length > 0;

  // Quiz counts per folder (plus unfiled / total).
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    let unfiled = 0;
    for (const q of items ?? []) {
      if (q.folderId) map[q.folderId] = (map[q.folderId] ?? 0) + 1;
      else unfiled += 1;
    }
    return { map, unfiled, total: items?.length ?? 0 };
  }, [items]);

  // Search results are flat across every folder (Finder-style global search).
  const searchResults = useMemo(
    () => (items ? items.filter((q) => matches(q, query)) : []),
    [items, query],
  );
  // Top level shows only loose quizzes; filed ones live inside their folder.
  const unfiledQuizzes = useMemo(() => (items ?? []).filter((q) => !q.folderId), [items]);
  const activeFolderObj = activeFolder ? folders.find((f) => f.id === activeFolder) : undefined;
  const folderQuizzes = useMemo(
    () => (activeFolderObj ? (items ?? []).filter((q) => q.folderId === activeFolderObj.id) : []),
    [items, activeFolderObj],
  );

  const folderName = (id: string | null | undefined): string | null =>
    id ? folders.find((f) => f.id === id)?.name ?? null : null;

  function selectFolder(id: string | null) {
    setActiveFolder(id); // immediate; the searchParams effect keeps it in sync
    setConfirmFolderId(null);
    setConfirmId(null);
    setMoveId(null);
    // Route through the router (single source of truth) so this matches the
    // sidebar's `<Link>` path. `replace` keeps folder hops out of history.
    router.replace(id ? `/library?folder=${encodeURIComponent(id)}` : "/library", {
      scroll: false,
    });
  }

  function addFolder(name: string, color: FolderColor) {
    createFolder(name, color);
    setFolders(listFolders());
    setFolderModal(null);
  }

  function saveFolder(id: string, name: string, color: FolderColor) {
    renameFolder(id, name);
    setFolderColor(id, color);
    setFolders(listFolders());
    setFolderModal(null);
  }

  function moveTo(quizId: string, fid: string | null) {
    setQuizFolder(quizId, fid);
    setItems((prev) => (prev ? prev.map((q) => (q.id === quizId ? { ...q, folderId: fid } : q)) : prev));
    setMoveId(null);
    // Pop the destination folder so a drop (or move-to) reads as "landed here".
    if (fid) {
      setJustFiled(fid);
      window.setTimeout(() => setJustFiled((c) => (c === fid ? null : c)), 450);
    }
  }

  function removeFolder(id: string) {
    deleteFolder(id);
    setFolders(listFolders());
    setItems(listQuizzes()); // quizzes were unfiled, not deleted — re-read them
    setConfirmFolderId(null);
    if (activeFolder === id) selectFolder(null);
  }

  function remove(id: string) {
    deleteQuiz(id);
    setItems((prev) => (prev ? prev.filter((q) => q.id !== id) : prev));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setConfirmId(null);
  }

  // ---- multi-select to combine ----
  function startSelect() {
    setSelectMode(true);
    setConfirmId(null);
    setConfirmFolderId(null);
    setMoveId(null);
  }
  function cancelSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function studyTogether() {
    const ids = [...selected];
    if (ids.length < 2) return;
    router.push(`/tools/pdf-to-quiz/play?ids=${ids.map(encodeURIComponent).join(",")}`);
  }

  // ---- drag-and-drop wiring ----
  function onQuizDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragQuizId(id);
  }
  function onQuizDragEnd() {
    setDragQuizId(null);
    setDragOver(null);
  }
  function dropTargetProps(target: string, folderId: string | null) {
    return {
      onDragOver: (e: DragEvent) => {
        if (!dragQuizId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(target);
      },
      onDragLeave: () => setDragOver((cur) => (cur === target ? null : cur)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || dragQuizId;
        if (id) moveTo(id, folderId);
        setDragOver(null);
        setDragQuizId(null);
      },
    };
  }

  const renderQuiz = (q: StoredQuiz, i = 0) => (
    <QuizCard
      key={q.id}
      index={i}
      q={q}
      folderBadge={activeFolder === null && !searching ? null : folderName(q.folderId)}
      folders={folders}
      dragging={dragQuizId === q.id}
      confirming={confirmId === q.id}
      moving={moveId === q.id}
      selectable={selectMode}
      selected={selected.has(q.id)}
      onToggleSelect={() => toggleSelect(q.id)}
      onDragStart={(e) => onQuizDragStart(e, q.id)}
      onDragEnd={onQuizDragEnd}
      onRequestDelete={() => {
        setMoveId(null);
        setConfirmId(q.id);
      }}
      onConfirmDelete={() => remove(q.id)}
      onCancelDelete={() => setConfirmId(null)}
      onOpenMove={() => {
        setConfirmId(null);
        setMoveId(q.id);
      }}
      onCloseMove={() => setMoveId(null)}
      onMoveTo={(fid) => moveTo(q.id, fid)}
    />
  );

  // While the session is still resolving we don't yet know whether there's an
  // account, so show the spinner rather than flashing the signed-out prompt.
  if (!account && sessionStatus === "loading") {
    return (
      <div className="flex justify-center py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  // Signed out → quizzes are private to an account, so there's nothing to show.
  // Prompt to sign in (local profile or Google, via the same modal as the header).
  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">My quizzes</h1>
        <p className="mt-2 text-[15px] text-neutral-500">Your quizzes are private to your account.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
            <Folder className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-neutral-700">Sign in to see your quizzes</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-400">
              The quizzes you make are saved to your account. Sign in to see the ones you&rsquo;ve
              made &mdash; or to start building your library.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSignInOpen(true)}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Sign in
          </button>
        </div>
        {signInOpen && <AccountModal account={null} onClose={() => setSignInOpen(false)} />}
      </div>
    );
  }

  return (
    <div className={cx("mx-auto max-w-6xl px-6 py-12", selectMode && "pb-24")}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">My quizzes</h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          {selectMode
            ? "Pick the quizzes you want to study together, then combine them into one run."
            : "Every quiz you’ve published, organized into optional folders."}
        </p>
      </div>

      {!!items && items.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or question…"
              aria-label="Search your quizzes"
              className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>
          {items.length > 1 && !selectMode && (
            <button
              type="button"
              onClick={startSelect}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <Check className="h-4 w-4" /> Combine quizzes
            </button>
          )}
        </div>
      )}

      <div className="mt-8">
        {items === null ? (
          <div className="flex justify-center py-24">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
              <Folder className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-700">No quizzes yet</p>
              <p className="mt-1 text-sm text-neutral-400">Publish a quiz and it&rsquo;ll show up here.</p>
            </div>
            <a
              href="/tools/pdf-to-quiz"
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Upload a PDF &rarr;
            </a>
          </div>
        ) : searching ? (
          // ---- Flat search results across all folders ----
          searchResults.length === 0 ? (
            <EmptyState icon={<Search className="h-5 w-5" />} title="No matches">
              <p className="mt-1 text-sm text-neutral-400">
                Nothing here matches &ldquo;{query.trim()}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                Clear search
              </button>
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{searchResults.map(renderQuiz)}</div>
          )
        ) : activeFolderObj ? (
          // ---- A single open folder ----
          <>
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 text-sm">
              <button
                type="button"
                onClick={() => selectFolder(null)}
                {...dropTargetProps(UNFILE_DROP, null)}
                title="Back to all quizzes — drop here to unfile"
                className={cx(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium transition",
                  dragOver === UNFILE_DROP
                    ? "scale-105 bg-sky-50 text-sky-700 ring-2 ring-sky-300"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                )}
              >
                <ChevronLeft className="h-4 w-4" /> My quizzes
              </button>
              <span className="text-neutral-300">/</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-900">
                <FolderSolid className={cx("h-4 w-4", folderIconClass(activeFolderObj.color))} />
                {activeFolderObj.name}
              </span>
              <span className="text-xs text-neutral-400">
                · {folderQuizzes.length} {folderQuizzes.length === 1 ? "quiz" : "quizzes"}
              </span>
            </div>
            {folderQuizzes.length === 0 ? (
              <div className="mt-8">
                <EmptyState icon={<Folder className="h-5 w-5" />} title="This folder is empty">
                  <p className="mt-1 text-sm text-neutral-400">
                    Back on the main view, drag a quiz onto this folder to file it here.
                  </p>
                  <button
                    type="button"
                    onClick={() => selectFolder(null)}
                    className="mt-3 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
                  >
                    Back to all quizzes
                  </button>
                </EmptyState>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{folderQuizzes.map(renderQuiz)}</div>
            )}
          </>
        ) : (
          // ---- Top level: folders + loose quizzes ----
          <div className="space-y-10">
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Folders</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {folders.map((f) => (
                  <FolderTile
                    key={f.id}
                    name={f.name}
                    color={f.color}
                    count={counts.map[f.id] ?? 0}
                    dragOver={dragOver === f.id}
                    popping={justFiled === f.id}
                    confirming={confirmFolderId === f.id}
                    onOpen={() => selectFolder(f.id)}
                    onEdit={() => {
                      setConfirmFolderId(null);
                      setFolderModal(f);
                    }}
                    onRequestDelete={() => {
                      setConfirmId(null);
                      setConfirmFolderId(f.id);
                    }}
                    onConfirmDelete={() => removeFolder(f.id)}
                    onCancelDelete={() => setConfirmFolderId(null)}
                    {...dropTargetProps(f.id, f.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setFolderModal("new")}
                  className="flex min-h-[124px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 p-4 text-neutral-400 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-600"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-sm font-medium">New folder</span>
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Quizzes
                {folders.length > 0 && (
                  <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-300">
                    not in a folder
                  </span>
                )}
              </h2>
              {unfiledQuizzes.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400">
                  {folders.length > 0
                    ? "Every quiz is filed in a folder. Open one above to see what's inside."
                    : "Nothing loose here."}
                </p>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {unfiledQuizzes.map(renderQuiz)}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {folderModal && (
        <FolderModal
          folder={folderModal === "new" ? null : folderModal}
          onSubmit={(name, color) =>
            folderModal === "new" ? addFolder(name, color) : saveFolder(folderModal.id, name, color)
          }
          onClose={() => setFolderModal(null)}
        />
      )}

      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <span className="text-sm font-medium text-neutral-600">
              {selected.size === 0
                ? "Select 2 or more quizzes"
                : `${selected.size} selected${selected.size < 2 ? " · pick one more" : ""}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelSelect}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={studyTogether}
                disabled={selected.size < 2}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play /> Study {selected.size >= 2 ? `${selected.size} ` : ""}together
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** One quiz, as a draggable card with delete + move-to-folder overlays. */
function QuizCard({
  index,
  q,
  folders,
  folderBadge,
  dragging,
  confirming,
  moving,
  selectable,
  selected,
  onToggleSelect,
  onDragStart,
  onDragEnd,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onOpenMove,
  onCloseMove,
  onMoveTo,
}: {
  index: number;
  q: StoredQuiz;
  folders: FolderType[];
  folderBadge: string | null;
  dragging: boolean;
  confirming: boolean;
  moving: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onOpenMove: () => void;
  onCloseMove: () => void;
  onMoveTo: (folderId: string | null) => void;
}) {
  // Self-contained share: build a link-only token for this quiz, copy it, and
  // surface the URL (with a manual copy fallback) in an in-card panel.
  const [share, setShare] = useState<{ url: string; copied: boolean } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function doShare() {
    setSharing(true);
    setShareError(null);
    try {
      const url = await buildShareLink(q);
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        /* clipboard blocked — the panel still shows the link to copy by hand */
      }
      setShare({ url, copied });
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Couldn’t build a share link.");
    } finally {
      setSharing(false);
    }
  }

  function closeShare() {
    setShare(null);
    setShareError(null);
  }

  return (
    <div
      draggable={!selectable}
      onDragStart={selectable ? undefined : onDragStart}
      onDragEnd={selectable ? undefined : onDragEnd}
      onClick={selectable ? onToggleSelect : undefined}
      role={selectable ? "button" : undefined}
      aria-pressed={selectable ? selected : undefined}
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      className={cx(
        "card-in group relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition",
        selectable
          ? cx(
              "cursor-pointer select-none",
              selected
                ? "border-neutral-900 ring-2 ring-neutral-900"
                : "border-neutral-200 hover:border-neutral-300 hover:shadow-md",
            )
          : "cursor-grab border-neutral-200 hover:border-neutral-300 hover:shadow-md active:cursor-grabbing",
        dragging && "scale-95 -rotate-2 opacity-50 shadow-lg",
      )}
    >
      {selectable && (
        <div
          className={cx(
            "absolute right-3 top-3 z-10 grid h-5 w-5 place-items-center rounded-md border transition",
            selected
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-300 bg-white text-transparent",
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
      {confirming && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/95 p-5 text-center backdrop-blur-sm">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Delete this quiz?</p>
            <p className="mt-1 text-xs text-neutral-500">This can&rsquo;t be undone.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              <Trash className="h-4 w-4" /> Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {moving && (
        <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-white/97 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Move to folder</p>
            <button
              type="button"
              onClick={onCloseMove}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <Close className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
            <FolderOption label="Unfiled" active={!q.folderId} onClick={() => onMoveTo(null)} />
            {folders.map((f) => (
              <FolderOption
                key={f.id}
                label={f.name}
                active={q.folderId === f.id}
                onClick={() => onMoveTo(f.id)}
              />
            ))}
            {folders.length === 0 && (
              <p className="px-2 py-2 text-xs leading-relaxed text-neutral-400">
                No folders yet. Create one from the main view, then move quizzes into it.
              </p>
            )}
          </div>
        </div>
      )}

      {(share || shareError) && !confirming && !moving && (
        <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-white/97 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">
              {shareError ? "Couldn’t share" : share?.copied ? "Link copied" : "Share link"}
            </p>
            <button
              type="button"
              onClick={closeShare}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <Close className="h-4 w-4" />
            </button>
          </div>
          {shareError ? (
            <p className="mt-2 text-xs leading-relaxed text-rose-600">{shareError}</p>
          ) : (
            share && (
              <div className="mt-1 flex flex-1 flex-col">
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Anyone with this link can add their own copy. The quiz rides inside the link
                  itself — nothing is uploaded to us.
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    readOnly
                    value={share.url}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Share link"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-600 outline-none focus:ring-2 focus:ring-neutral-900/10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(share.url)
                        .then(() => setShare((s) => (s ? { ...s, copied: true } : s)))
                        .catch(() => {})
                    }
                    className="shrink-0 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700"
                  >
                    Copy
                  </button>
                </div>
                {share.copied && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                    <Check className="h-3 w-3" /> Copied to clipboard
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}

      {!selectable && (
        <div className="absolute right-3 top-3 flex items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={doShare}
            disabled={sharing}
            aria-label={`Share ${q.title}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
          >
            <Share className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenMove}
            aria-label={`Move ${q.title} to a folder`}
            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Folder className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete ${q.title}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-300 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      )}

      <span className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-900 text-white">
        <Grid className="h-4 w-4" />
      </span>
      <h3 className="mt-4 line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">{q.title}</h3>
      <div className="mt-1 text-xs text-neutral-400">
        {q.questions.length} {q.questions.length === 1 ? "question" : "questions"} · {formatDate(q.publishedAt)}
      </div>
      {folderBadge && (
        <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
          <Folder className="h-3 w-3" />
          <span className="max-w-[140px] truncate">{folderBadge}</span>
        </div>
      )}

      {!selectable && (
        <div className="mt-auto flex items-center gap-2 pt-4">
          <a
            href={`/tools/pdf-to-quiz/play?id=${encodeURIComponent(q.id)}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            <Play /> Study
          </a>
          <a
            href={`/tools/pdf-to-quiz/review?id=${encodeURIComponent(q.id)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
          >
            <Pencil className="h-4 w-4" /> Edit
          </a>
        </div>
      )}
    </div>
  );
}

/** A macOS-style folder tile: click to open, a drop target for dragged quizzes,
 *  with a hover trash that arms an in-tile delete confirm (matching quiz cards). */
function FolderTile({
  name,
  color,
  count,
  dragOver,
  popping,
  confirming,
  onOpen,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  name: string;
  color?: FolderColor;
  count: number;
  dragOver: boolean;
  popping: boolean;
  confirming: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cx(
        "group relative flex min-h-[124px] flex-col items-center justify-center rounded-2xl border p-4 text-center transition",
        dragOver
          ? cx("ring-2", folderSoftClass(color))
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm",
        dragOver && "scale-[1.04] border-transparent shadow-md",
        popping && "drop-pop",
      )}
    >
      {confirming ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/95 p-3 text-center backdrop-blur-sm">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Delete this folder?</p>
            <p className="mt-1 text-xs text-neutral-500">Quizzes inside stay in your library.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700"
            >
              <Trash className="h-3.5 w-3.5" /> Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute right-2 top-2 flex items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Rename or recolor folder ${name}`}
            className="grid h-7 w-7 place-items-center rounded-lg text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete folder ${name}`}
            className="grid h-7 w-7 place-items-center rounded-lg text-neutral-300 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <button type="button" onClick={onOpen} className="flex w-full flex-col items-center gap-1.5">
        <FolderSolid className={cx("h-12 w-12", folderIconClass(color))} />
        <span className="line-clamp-2 px-1 text-sm font-medium text-neutral-800">{name}</span>
        <span className="text-xs text-neutral-400">
          {count} {count === 1 ? "quiz" : "quizzes"}
        </span>
      </button>
    </div>
  );
}

/** The folder create/edit popup. Owns its own name + colour state; Enter
 *  submits, Escape / backdrop / Cancel close. `folder` null = create a new one;
 *  an existing folder = rename + recolor it. */
function FolderModal({
  folder,
  onSubmit,
  onClose,
}: {
  folder: FolderType | null;
  onSubmit: (name: string, color: FolderColor) => void;
  onClose: () => void;
}) {
  const editing = folder != null;
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState<FolderColor>(folderColor(folder?.color));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (name.trim()) onSubmit(name.trim(), color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit folder" : "New folder"}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {editing ? "Edit folder" : "New folder"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Folder name"
          aria-label="Folder name"
          className="mt-4 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-900/10"
        />

        <span className="mt-4 block text-xs font-medium text-neutral-500">Color</span>
        <div className="mt-2 flex items-center gap-2.5">
          {FOLDER_COLORS.map((c) => {
            const active = color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`${c} folder color`}
                aria-pressed={active}
                className={cx(
                  "grid h-7 w-7 place-items-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
                  folderSwatchClass(c),
                  active
                    ? "ring-2 ring-neutral-900 ring-offset-2"
                    : "ring-1 ring-black/5 hover:scale-110",
                )}
              >
                {active && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A selectable folder row inside a card's "move to folder" overlay. */
function FolderOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
        active ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-50",
      )}
    >
      <Folder className="h-4 w-4 shrink-0 text-neutral-400" />
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className="h-4 w-4 shrink-0 text-neutral-900" />}
    </button>
  );
}

/** Shared centered empty-state card (no-match / empty-folder). */
function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-neutral-100 text-neutral-400">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-neutral-700">{title}</p>
      {children}
    </div>
  );
}
