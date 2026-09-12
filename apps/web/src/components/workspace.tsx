"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  FolderKanban,
  Layers3,
  LogOut,
  Plus,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import { Button } from "./ui/button";
import { ProjectEditor } from "./editors";
import { ProjectView } from "./project-view";
export function Workspace({ email }: { email: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const result = await api<Project[]>(`/projects?archived=${archived}`);
      if (current !== request.current) return;
      setError("");
      setProjects(result);
      setActive((previous) =>
        result.some((p) => p.id === previous)
          ? previous
          : (result[0]?.id ?? null),
      );
    } catch (error) {
      if (current === request.current)
        setError(
          error instanceof Error ? error.message : "Unable to load projects.",
        );
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [archived]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);
  const project = projects.find((p) => p.id === active);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-border bg-[#101114] md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-5 py-6 text-base font-semibold tracking-tight">
          <Layers3 size={22} className="text-primary" />
          DevBoard
          <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[9px] font-normal tracking-wide text-muted-foreground">
            PERSONAL
          </span>
        </div>
        <div className="px-3 pb-4">
          <button
            onClick={() => {
              if (archived) {
                setLoading(true);
                setArchived(false);
              }
            }}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${!archived ? "bg-accent text-foreground" : "text-muted-foreground"}`}
          >
            <FolderKanban size={16} />
            Projects
          </button>
          <button
            onClick={() => {
              if (!archived) {
                setLoading(true);
                setArchived(true);
              }
            }}
            className={`mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${archived ? "bg-accent text-foreground" : "text-muted-foreground"}`}
          >
            <Archive size={16} />
            Archived
          </button>
        </div>
        <div className="flex items-center px-5 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <ChevronDown size={12} className="mr-1" />
          {archived ? "Archived projects" : "Your projects"}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6"
            aria-label="Create project"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} />
          </Button>
        </div>
        <nav
          aria-label="Projects"
          className="max-h-48 space-y-1 overflow-y-auto px-3 pb-4 md:max-h-none md:flex-1"
        >
          {!loading && projects.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No {archived ? "archived " : ""}projects yet.
            </p>
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setActive(project.id)}
              aria-current={active === project.id ? "page" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] ${active === project.id ? "bg-primary/12 text-[#c5bdff]" : "text-muted-foreground hover:bg-accent"}`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-[10px] font-semibold">
                {project.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-border p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#31303e] text-xs">
            {email.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={async () => {
              try {
                const { error } = await getSupabase().auth.signOut();
                if (error) throw error;
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : "Unable to log out.",
                );
              }
            }}
          >
            <LogOut size={15} />
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {error && (
          <div
            role="alert"
            className="m-6 flex items-center gap-4 rounded-lg border border-rose-900 bg-rose-950/20 p-4 text-rose-200"
          >
            {error}
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}
        {loading ? (
          <p role="status" className="p-10 text-muted-foreground">
            Loading projects...
          </p>
        ) : project ? (
          <ProjectView
            key={project.id}
            project={project}
            update={(updated) =>
              setProjects((previous) =>
                previous.map((p) => (p.id === updated.id ? updated : p)),
              )
            }
            refresh={load}
          />
        ) : (
          <div className="flex min-h-[65vh] flex-col items-center justify-center p-8 text-center">
            <FolderKanban size={32} className="mb-5 text-primary" />
            <h1 className="text-xl font-semibold">
              {archived ? "Nothing archived" : "Make room for your next idea"}
            </h1>
            <p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">
              {archived
                ? "Archived projects will appear here when you need them again."
                : "Create a project, add a few tasks, and take it one step at a time."}
            </p>
            {!archived && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={15} />
                Create your first project
              </Button>
            )}
          </div>
        )}
      </main>
      {creating && (
        <ProjectEditor
          close={() => setCreating(false)}
          save={async (data) => {
            const created = await api<Project>("/projects", json("POST", data));
            setArchived(false);
            setProjects((previous) =>
              archived ? [created] : [...previous, created],
            );
            setActive(created.id);
          }}
        />
      )}
    </div>
  );
}
