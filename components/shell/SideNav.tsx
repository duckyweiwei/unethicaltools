"use client";

/**
 * Left navigation rail for the app surfaces. Two parts: a small set of section
 * links (Home / Convert / My quizzes) and a live list of the visitor's own
 * published quizzes pulled from localStorage, each a one-click jump into study.
 * Hidden below `lg` (the top toolbar carries navigation on narrow screens).
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { listQuizzes, listFolders, type StoredQuiz, type Folder as FolderType } from "@/lib/storage/quiz-library";
import { folderIconClass } from "@/lib/folder-colors";
import { BarChart, Folder, Grid, Upload } from "@/components/quiz-editor/icons";

const SECTIONS = [
  { href: "/", label: "Home", Icon: Grid },
  { href: "/tools/pdf-to-quiz", label: "Convert a PDF", Icon: Upload },
  { href: "/library", label: "My quizzes", Icon: Folder },
  { href: "/stats", label: "Progress", Icon: BarChart },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

export function SideNav() {
  const pathname = usePathname() ?? "/";
  // Reactive URL query — `?folder` (library filter) and `?id` (open review)
  // change WITHOUT a path change when navigating via <Link>, so reading them
  // from useSearchParams keeps the rail highlight in sync (a one-shot
  // window.location read on mount would go stale, mirroring the library bug).
  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder");
  const activeReviewId = searchParams.get("id");
  const [quizzes, setQuizzes] = useState<StoredQuiz[] | null>(null);
  const [folders, setFolders] = useState<FolderType[]>([]);

  useEffect(() => {
    setQuizzes(listQuizzes());
    setFolders(listFolders());
  }, []);

  return (
    <aside className="hidden w-44 shrink-0 border-r border-neutral-200 bg-white/40 lg:block">
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col gap-5 overflow-y-auto px-2.5 py-4">
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
          {SECTIONS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                  active
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-neutral-400" />
                {label}
              </Link>
            );
          })}
        </nav>

        {folders.length > 0 && (
          <nav aria-label="Folders" className="flex flex-col">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Folders
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {folders.map((f) => {
                const active = isActive(pathname, "/library") && activeFolder === f.id;
                return (
                  <Link
                    key={f.id}
                    href={`/library?folder=${encodeURIComponent(f.id)}`}
                    title={f.name}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                      active
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    <Folder className={`h-3.5 w-3.5 shrink-0 ${folderIconClass(f.color)}`} />
                    <span className="truncate">{f.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Your quizzes
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {quizzes === null ? (
              <div className="px-3 py-2 text-sm text-neutral-300">Loading&hellip;</div>
            ) : quizzes.length === 0 ? (
              <p className="px-3 py-2 text-sm leading-relaxed text-neutral-400">
                Nothing here yet. Convert a PDF to get started.
              </p>
            ) : (
              quizzes.slice(0, 15).map((q) => {
                const active =
                  isActive(pathname, "/tools/pdf-to-quiz/review") && activeReviewId === q.id;
                return (
                  <Link
                    key={q.id}
                    href={`/tools/pdf-to-quiz/review?id=${encodeURIComponent(q.id)}`}
                    title={q.title}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                      active
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    <Grid className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                    <span className="truncate">{q.title}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
