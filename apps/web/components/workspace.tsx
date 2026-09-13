"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Archive, CircleUserRound, FolderKanban, Layers3, LogOut, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, json } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import { ProjectView } from "./project-view";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { SectionLoader } from "./ui/section-loader";
import { Tooltip } from "./ui/tooltip";

function AccountMenu({ email, open, close, reportError, variant = "popover" }: { email: string; open: boolean; close: () => void; reportError: (message: string) => void; variant?: "popover" | "sidebar" }) {
  const isSidebarPanel = variant === "sidebar";
  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0, y: isSidebarPanel ? 6 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: isSidebarPanel ? 6 : -6 }} transition={{ duration: 0.16 }} className={`workspace-account-menu border border-border bg-[#161b22] p-2 ${isSidebarPanel ? "mb-2 w-full rounded-md" : "absolute right-0 top-full z-30 mt-1 w-56 rounded-lg shadow-xl"}`}><p className="workspace-account-email truncate px-2 py-2 text-xs text-muted-foreground">{email}</p><Button variant="ghost" size="sm" className="workspace-logout w-full justify-start" onClick={async () => { try { const { error } = await getSupabase().auth.signOut(); if (error) throw error; close(); } catch (error) { reportError(error instanceof Error ? error.message : "Unable to log out."); } }}><LogOut size={15} />Log out</Button></motion.div>}</AnimatePresence>;
}

export function Workspace({ email }: { email: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
  function selectProject(projectId: string) {
    setActive(projectId);
    setWorkspaceView("board");
  }

  function openArchive() {
    setWorkspaceView("archived");
    void loadArchived();
  }

  async function createEmptyProject() {
    if (isCreatingProject) return;
    setIsCreatingProject(true);
    try {
      const created = await api<Project>("/projects", json("POST", { name: "New Project" }));
      setProjects((previous) => [...previous, created]);
      setActive(created.id);
      setWorkspaceView("board");
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create a new project.");
    } finally {
      setIsCreatingProject(false);
    }
  }

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
    <div className="workspace-shell flex min-h-screen flex-col md:flex-row">
      <aside className={`workspace-sidebar sticky top-0 hidden h-dvh self-start shrink-0 flex-col border-r border-border bg-[#161b22] transition-[width] duration-200 md:flex ${isSidebarCollapsed ? "w-16" : "w-64"}`}>
        <div className={`workspace-sidebar-brand flex h-16 items-center border-b border-border text-base font-semibold tracking-tight ${isSidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-5"}`}><Layers3 size={22} className="shrink-0 text-primary" />{!isSidebarCollapsed && <span>DevBoard</span>}{!isSidebarCollapsed && <Tooltip label="Collapse sidebar" className="ml-auto"><Button className="workspace-sidebar-collapse" variant="ghost" size="icon" aria-label="Collapse sidebar" onClick={() => setIsSidebarCollapsed(true)}><PanelLeftClose size={17} /></Button></Tooltip>}</div>
        <div className={`workspace-sidebar-content flex min-h-0 flex-1 flex-col ${isSidebarCollapsed ? "p-2" : "p-3"}`}>
          {isSidebarCollapsed && <div className="workspace-sidebar-expand-row mb-3 flex justify-center"><Tooltip label="Expand sidebar"><Button className="workspace-sidebar-expand" variant="ghost" size="icon" aria-label="Expand sidebar" onClick={() => setIsSidebarCollapsed(false)}><PanelLeftOpen size={17} /></Button></Tooltip></div>}
          <div className={`workspace-projects-header mb-2 flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between px-2"}`}>
            {!isSidebarCollapsed && <p className="workspace-sidebar-heading text-xs font-medium text-muted-foreground">Projects</p>}
            <Tooltip label="New project"><Button className="workspace-sidebar-create" variant="ghost" size="icon" aria-label="New project" disabled={isCreatingProject} onClick={() => void createEmptyProject()}><Plus size={17} /></Button></Tooltip>
          </div>
          <nav aria-label="Projects" className="workspace-project-list min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {projects.length === 0 ? !isSidebarCollapsed && <p className="workspace-project-list-empty px-2 py-3 text-xs text-muted-foreground">No projects yet</p> : projects.map((item) => <button key={item.id} onClick={() => selectProject(item.id)} aria-label={isSidebarCollapsed ? item.name : undefined} aria-current={workspaceView === "board" && active === item.id ? "page" : undefined} className={`workspace-project-link flex w-full items-center rounded-md py-2 text-left text-sm transition-colors ${isSidebarCollapsed ? "justify-center px-0" : "gap-2 px-2.5"} ${workspaceView === "board" && active === item.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><FolderKanban size={15} className="shrink-0" />{!isSidebarCollapsed && <span className="truncate">{item.name}</span>}</button>)}
          </nav>
          <div className="workspace-sidebar-footer mt-auto border-t border-border pt-3">
            <Tooltip label="Archived projects" className="w-full"><button onClick={openArchive} className={`workspace-archive-link flex w-full items-center rounded-md py-2 text-left text-sm transition-colors ${isSidebarCollapsed ? "justify-center px-0" : "gap-2 px-2.5"} ${workspaceView === "archived" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Archive size={15} />{!isSidebarCollapsed && "Archived projects"}</button></Tooltip>
            <div className="workspace-account mt-2"><AccountMenu email={email} open={accountOpen} close={() => setAccountOpen(false)} reportError={setError} variant="sidebar" /><Tooltip label="Account" className="w-full"><button type="button" className={`workspace-account-trigger flex w-full items-center rounded-md py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${isSidebarCollapsed ? "justify-center px-0" : "gap-2 px-2.5"}`} aria-label="Account" onClick={() => { if (isSidebarCollapsed) setIsSidebarCollapsed(false); setAccountOpen((open) => !open); }}><CircleUserRound size={17} />{!isSidebarCollapsed && <span className="truncate">Account</span>}</button></Tooltip></div>
          </div>
        </div>
      </aside>
      <main className="workspace-main flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="workspace-mobile-header border-b border-border bg-[#161b22] md:hidden"><div className="workspace-mobile-bar flex min-h-16 items-center gap-3 px-4"><div className="workspace-brand flex shrink-0 items-center gap-2.5 text-base font-semibold tracking-tight"><Layers3 size={22} className="text-primary" />DevBoard</div><div className="workspace-account relative ml-auto"><Tooltip label="Account"><Button className="workspace-account-trigger" variant="ghost" size="icon" aria-label="Account" onClick={() => setAccountOpen((open) => !open)}><CircleUserRound size={20} /></Button></Tooltip><AccountMenu email={email} open={accountOpen} close={() => setAccountOpen(false)} reportError={setError} variant="popover" /></div></div><nav aria-label="Projects" className="workspace-mobile-project-list flex gap-1 overflow-x-auto border-t border-border px-3 py-2"><Button className="workspace-mobile-create shrink-0" size="sm" disabled={isCreatingProject} onClick={() => void createEmptyProject()} aria-label="New project"><Plus size={15} /></Button>{projects.map((item) => <button key={item.id} onClick={() => selectProject(item.id)} aria-current={workspaceView === "board" && active === item.id ? "page" : undefined} className={`workspace-mobile-project-link shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${workspaceView === "board" && active === item.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>{item.name}</button>)}<button onClick={openArchive} className={`workspace-mobile-archive-link shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${workspaceView === "archived" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Archive size={15} className="mr-1.5 inline" />Archive</button></nav></header>
        {error && <div role="alert" className="workspace-error m-6 flex items-center gap-4 rounded-lg border border-rose-900 bg-rose-950/20 p-4 text-rose-200">{error}<Button className="workspace-error-retry" variant="outline" onClick={() => void load()}>Retry</Button></div>}
        {loading ? <SectionLoader icon={FolderKanban} label="Loading projects..." className="min-h-0 flex-1" /> : workspaceView === "archived" ? <motion.div key="archive" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="workspace-archive-panel p-6 md:p-8"><h1 className="mb-7 text-2xl font-semibold tracking-tight">Archived projects</h1>{archiveLoading ? <SectionLoader icon={Archive} label="Loading archived projects..." className="min-h-[calc(100dvh-14rem)]" /> : archivedProjects.length === 0 ? <div className="flex min-h-[calc(100dvh-14rem)] items-center justify-center text-sm text-muted-foreground">No archived projects.</div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{archivedProjects.map((item) => <div key={item.id} className="rounded-lg border border-border bg-[#161b22] p-5"><h2 className="text-base font-semibold">{item.name}</h2><div className="mt-5 flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Restore ${item.name}`} onClick={() => void restore(item)}><RotateCcw size={15} /></Button><Button variant="ghost" size="icon" className="text-rose-300" aria-label={`Delete ${item.name}`} onClick={() => setArchivedToDelete(item)}><Trash2 size={15} /></Button></div></div>)}</div>}</motion.div> : <motion.div key="board" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>{project ? <ProjectView key={project.id} project={project} update={(updated) => setProjects((previous) => previous.map((project) => project.id === updated.id ? updated : project))} refresh={async () => { await Promise.all([load(), loadArchived()]); }} /> : <div className="workspace-empty-projects flex min-h-[65vh] flex-col items-center justify-center p-8 text-center"><FolderKanban size={32} className="mb-5 text-primary" /><h1 className="text-xl font-semibold">Make room for your next idea</h1><p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">Create a project, add a few tasks, and take it one step at a time.</p><Button disabled={isCreatingProject} onClick={() => void createEmptyProject()}><Plus size={15} />Create your first project</Button></div>}</motion.div>}
      </main>
      <ConfirmDialog open={Boolean(archivedToDelete)} onOpenChange={(open) => !open && setArchivedToDelete(null)} title="Delete project?" description={`This will permanently delete "${archivedToDelete?.name ?? "this project"}" and all of its tasks.`} confirmLabel="Delete project" onConfirm={async () => { if (archivedToDelete) await deleteArchivedProject(archivedToDelete); }} />
    </div>
  );
}
