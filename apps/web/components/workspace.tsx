"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Archive, CircleUserRound, FolderKanban, Layers3, LogOut, Plus, RotateCcw, Trash2 } from "lucide-react";
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

function ProjectGallery({ projects, open, create }: { projects: Project[]; open: (project: Project) => void; create: () => void }) {
  return <div className="p-6 md:p-8"><header className="mb-7 flex items-center justify-between gap-4"><h1 className="text-2xl font-semibold tracking-tight">Projects</h1><Button onClick={create}><Plus size={15} />New project</Button></header>{projects.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center"><FolderKanban size={30} className="mb-4 text-primary" /><h2 className="text-lg font-semibold">No projects yet</h2><p className="mt-1 text-sm text-muted-foreground">Create a project to start organizing your work.</p></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <button key={project.id} onClick={() => open(project)} className="min-h-36 rounded-lg border border-border bg-[#161b22] p-5 text-left transition-colors hover:border-[#484f58] hover:bg-accent"><h2 className="text-base font-semibold">{project.name}</h2>{project.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{project.tags.map((tag) => <span key={tag} className="rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">{tag}</span>)}</div>}</button>)}</div>}</div>;
}

export function Workspace({ email }: { email: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"board" | "projects" | "archived">("board");
  const [accountOpen, setAccountOpen] = useState(false);
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
    } catch (error) {
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
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-4 border-b border-border bg-[#161b22] px-5"><div className="flex items-center gap-2.5 text-base font-semibold tracking-tight"><Layers3 size={22} className="text-primary" />DevBoard</div><nav className="flex items-center gap-1"><button onClick={() => { setWorkspaceView("projects"); void load(); }} className={`rounded-md px-3 py-2 text-sm font-medium ${workspaceView === "projects" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><FolderKanban size={16} className="mr-2 inline" />Projects</button><button onClick={() => { setWorkspaceView("archived"); void loadArchived(); }} className={`rounded-md px-3 py-2 text-sm font-medium ${workspaceView === "archived" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Archive size={16} className="mr-2 inline" />Archive</button></nav><div className="relative ml-auto"><Tooltip label="Account"><Button variant="ghost" size="icon" aria-label="Account" onClick={() => setAccountOpen((open) => !open)}><CircleUserRound size={20} /></Button></Tooltip><AnimatePresence>{accountOpen && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} className="absolute right-0 top-11 z-30 w-56 rounded-lg border border-border bg-[#161b22] p-2 shadow-xl"><p className="truncate px-2 py-2 text-xs text-muted-foreground">{email}</p><Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { try { const { error } = await getSupabase().auth.signOut(); if (error) throw error; } catch (error) { setError(error instanceof Error ? error.message : "Unable to log out."); } }}><LogOut size={15} />Log out</Button></motion.div>}</AnimatePresence></div></header>
        {error && <div role="alert" className="m-6 flex items-center gap-4 rounded-lg border border-rose-900 bg-rose-950/20 p-4 text-rose-200">{error}<Button variant="outline" onClick={() => void load()}>Retry</Button></div>}
        {loading ? <SectionLoader icon={FolderKanban} label="Loading projects..." className="min-h-0 flex-1" /> : workspaceView === "projects" ? <motion.div key="projects" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}><ProjectGallery projects={projects} open={(selected) => { setActive(selected.id); setWorkspaceView("board"); }} create={() => setCreating(true)} /></motion.div> : workspaceView === "archived" ? <motion.div key="archive" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="p-6 md:p-8"><h1 className="mb-7 text-2xl font-semibold tracking-tight">Archived projects</h1>{archiveLoading ? <SectionLoader icon={Archive} label="Loading archived projects..." className="min-h-[calc(100dvh-14rem)]" /> : archivedProjects.length === 0 ? <div className="flex min-h-[calc(100dvh-14rem)] items-center justify-center text-sm text-muted-foreground">No archived projects.</div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{archivedProjects.map((item) => <div key={item.id} className="rounded-lg border border-border bg-[#161b22] p-5"><h2 className="text-base font-semibold">{item.name}</h2><div className="mt-5 flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Restore ${item.name}`} onClick={() => void restore(item)}><RotateCcw size={15} /></Button><Button variant="ghost" size="icon" className="text-rose-300" aria-label={`Delete ${item.name}`} onClick={() => setArchivedToDelete(item)}><Trash2 size={15} /></Button></div></div>)}</div>}</motion.div> : <motion.div key="board" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>{project ? <ProjectView key={project.id} project={project} update={(updated) => setProjects((previous) => previous.map((project) => project.id === updated.id ? updated : project))} refresh={async () => { await Promise.all([load(), loadArchived()]); }} /> : <div className="flex min-h-[65vh] flex-col items-center justify-center p-8 text-center"><FolderKanban size={32} className="mb-5 text-primary" /><h1 className="text-xl font-semibold">Make room for your next idea</h1><p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">Create a project, add a few tasks, and take it one step at a time.</p><Button onClick={() => setCreating(true)}><Plus size={15} />Create your first project</Button></div>}</motion.div>}
      </main>
      {creating && <ProjectEditor close={() => setCreating(false)} save={async (data) => { const created = await api<Project>("/projects", json("POST", data)); setProjects((previous) => [...previous, created]); setActive(created.id); }} />}
      <ConfirmDialog open={Boolean(archivedToDelete)} onOpenChange={(open) => !open && setArchivedToDelete(null)} title="Delete project?" description={`This will permanently delete "${archivedToDelete?.name ?? "this project"}" and all of its tasks.`} confirmLabel="Delete project" onConfirm={async () => { if (archivedToDelete) await deleteArchivedProject(archivedToDelete); }} />
    </div>
  );
}
