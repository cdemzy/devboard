"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ChevronDown, FolderKanban, Layers3, LogOut, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, json } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import { ProjectEditor } from "./editors";
import { ProjectView } from "./project-view";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { SectionLoader } from "./ui/section-loader";
import { Tooltip } from "./ui/tooltip";

export function Workspace({ email }: { email: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [archivesOpen, setArchivesOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archivesLoaded, setArchivesLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archivedToDelete, setArchivedToDelete] = useState<Project | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const result = await api<Project[]>("/projects?archived=false");
      if (current !== request.current) return;
      setError("");
      setProjects(result);
      setActive((previous) => result.some((project) => project.id === previous) ? previous : (result[0]?.id ?? null));
    } catch (error) {
      if (current === request.current) setError(error instanceof Error ? error.message : "Unable to load projects.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);

  const loadArchived = useCallback(async () => {
    setArchiveLoading(true);
    try {
      setArchivedProjects(await api<Project[]>("/projects?archived=true"));
      setArchivesLoaded(true);
    } catch (error) {
      setArchivesLoaded(false);
      setError(error instanceof Error ? error.message : "Unable to load archived projects.");
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load();
        void loadArchived();
      }
    });
    return () => { cancelled = true; };
  }, [load, loadArchived]);
  const project = projects.find((project) => project.id === active);

  async function restore(project: Project) {
    await api(`/projects/${project.id}`, json("PATCH", { archived: false }));
    toast.success("Project restored");
    await Promise.all([load(), loadArchived()]);
    setActive(project.id);
  }

  async function deleteArchivedProject(project: Project) {
    await api(`/projects/${project.id}`, json("DELETE"));
    toast.success("Project deleted");
    await loadArchived();
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-border bg-[#161b22] md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-5 py-6 text-base font-semibold tracking-tight"><Layers3 size={22} className="text-primary" />DevBoard</div>
        <div className="px-3 pb-4">
          <button onClick={() => void load()} className="flex w-full items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-foreground"><FolderKanban size={16} />Projects</button>
          <button
            onClick={() => { const nextOpen = !archivesOpen; setArchivesOpen(nextOpen); if (nextOpen && !archivesLoaded) void loadArchived(); }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            aria-expanded={archivesOpen}
          >
            <Archive size={16} />Archived
            {archivedProjects.length > 0 && <ChevronDown size={15} className={`ml-auto transition-transform ${archivesOpen ? "rotate-180" : ""}`} />}
          </button>
          <AnimatePresence initial={false}>
            {archivesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -6 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
            <div className="mt-1 space-y-1 border-l border-border pl-2">
              {archiveLoading ? <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p> : archivedProjects.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">No archived projects.</p> : archivedProjects.map((project) => (
                <div key={project.id} className="flex items-center gap-1 rounded-md py-1 pl-2 pr-1 text-xs text-muted-foreground hover:bg-accent">
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <Tooltip label="Restore"><Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Restore ${project.name}`} onClick={() => void restore(project)}><RotateCcw size={13} /></Button></Tooltip>
                  <Tooltip label="Delete"><Button variant="ghost" size="icon" className="h-6 w-6 text-rose-300" aria-label={`Delete ${project.name}`} onClick={() => setArchivedToDelete(project)}><Trash2 size={13} /></Button></Tooltip>
                </div>
              ))}
            </div>
            </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center px-5 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><ChevronDown size={12} className="mr-1" />Your projects<Tooltip label="Add"><Button variant="ghost" size="icon" className="ml-auto h-6 w-6" aria-label="Create project" onClick={() => setCreating(true)}><Plus size={14} /></Button></Tooltip></div>
        <nav aria-label="Projects" className="max-h-48 space-y-1 overflow-y-auto px-3 pb-4 md:max-h-none md:flex-1">
          {!loading && projects.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No projects yet.</p>}
          {projects.map((project) => <button key={project.id} onClick={() => setActive(project.id)} aria-current={active === project.id ? "page" : undefined} className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] ${active === project.id ? "bg-primary/15 text-[#58a6ff]" : "text-muted-foreground hover:bg-accent"}`}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-[10px] font-semibold">{project.name.slice(0, 1).toUpperCase()}</span><span className="truncate">{project.name}</span></button>)}
        </nav>
        <div className="flex items-center gap-2 border-t border-border p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#30363d] text-xs">{email.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{email}</span><Tooltip label="Log out"><Button variant="ghost" size="icon" aria-label="Log out" onClick={async () => { try { const { error } = await getSupabase().auth.signOut(); if (error) throw error; } catch (error) { setError(error instanceof Error ? error.message : "Unable to log out."); } }}><LogOut size={15} /></Button></Tooltip></div>
      </aside>
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        {error && <div role="alert" className="m-6 flex items-center gap-4 rounded-lg border border-rose-900 bg-rose-950/20 p-4 text-rose-200">{error}<Button variant="outline" onClick={() => void load()}>Retry</Button></div>}
        {loading ? <SectionLoader icon={FolderKanban} label="Loading projects..." className="min-h-0 flex-1" /> : <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>{project ? <ProjectView key={project.id} project={project} update={(updated) => setProjects((previous) => previous.map((project) => project.id === updated.id ? updated : project))} refresh={async () => { await Promise.all([load(), loadArchived()]); }} /> : <div className="flex min-h-[65vh] flex-col items-center justify-center p-8 text-center"><FolderKanban size={32} className="mb-5 text-primary" /><h1 className="text-xl font-semibold">Make room for your next idea</h1><p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">Create a project, add a few tasks, and take it one step at a time.</p><Button onClick={() => setCreating(true)}><Plus size={15} />Create your first project</Button></div>}</motion.div>}
      </main>
      {creating && <ProjectEditor close={() => setCreating(false)} save={async (data) => { const created = await api<Project>("/projects", json("POST", data)); setProjects((previous) => [...previous, created]); setActive(created.id); }} />}
      <ConfirmDialog open={Boolean(archivedToDelete)} onOpenChange={(open) => !open && setArchivedToDelete(null)} title="Delete project?" description={`This will permanently delete "${archivedToDelete?.name ?? "this project"}" and all of its tasks.`} confirmLabel="Delete project" onConfirm={async () => { if (archivedToDelete) await deleteArchivedProject(archivedToDelete); }} />
    </div>
  );
}
