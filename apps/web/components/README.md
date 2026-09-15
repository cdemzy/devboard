# Frontend panels

`Dashboard` composes `SidebarPanel` and `ProjectPanel` and coordinates selection, view navigation, account visibility, and shared viewport layout. Keep responsibilities specific to a panel inside its folder.

```text
components/
  dashboard.tsx
  sidebar-panel/
    sidebar-panel.tsx
    desktop-sidebar.tsx
    mobile-project-drawer.tsx
    account-menu.tsx
    project-navigation.tsx
    use-mobile-sidebar.ts
  project-panel/
    project-panel.tsx
    project-view.tsx
    archived-projects-panel.tsx
    kanban-board.tsx
    status-section.tsx
    task-card.tsx
    board-status-styles.ts
    editors.tsx
  ui/
hooks/
  use-projects.ts
```

`SidebarPanel` composes desktop navigation and the mobile drawer with a fragment so the DOM layout remains unchanged. The wide desktop layout is set by the existing 1280px CSS breakpoint from the first render. Desktop hover expansion and drag feedback stay inside `DesktopSidebar`; mobile list drag feedback stays inside `MobileProjectDrawer`. Mobile project handles remain visible on the left; dragging keeps the source at its measured origin, shows a floating row, and reserves a full-height insertion gap that advances when the leading card edge touches a neighboring row. `useMobileSidebar` manages drawer gestures, animation, and scroll locking; the shell shares its controls with `ProjectPanel` because the main content moves when the drawer opens.

`ProjectPanel` owns the main content layout, mobile navigation header, loading and error states, and composition of the active project or archive view. `ProjectView` owns project editing and task-view state, and `ArchivedProjectsPanel` owns archive deletion confirmation. `useProjects` owns the project collections, loading, mutations, and serialized optimistic ordering shared by both panels.

Browser specs in `../e2e/` are divided by account, project lifecycle, project navigation, mobile navigation, mobile project sorting, archived projects, and task-board behavior. Their shared simulated service and project fixtures live in `../e2e/helpers/dashboard.ts`.

## Panel UI hooks

Names without `#` are classes. Classes inside the relocated project view, board, editors, and shared UI components retain their existing names.

| Source | Classes and IDs |
| --- | --- |
| [dashboard.tsx](dashboard.tsx) | `dashboard` |
| [sidebar-panel/sidebar-panel.tsx](sidebar-panel/sidebar-panel.tsx) | `sidebar-panel-mobile-drawer-cover` |
| [sidebar-panel/desktop-sidebar.tsx](sidebar-panel/desktop-sidebar.tsx) | `sidebar-panel`, `sidebar-panel-account`, `sidebar-panel-account-trigger`, `sidebar-panel-archive-link`, `sidebar-panel-brand`, `sidebar-panel-content`, `sidebar-panel-create`, `sidebar-panel-create-icon-skeleton`, `sidebar-panel-create-label-skeleton`, `sidebar-panel-footer`, `sidebar-panel-icon`, `sidebar-panel-project-drop-trace`, `sidebar-panel-project-list`, `sidebar-panel-project-sort-list`, `sidebar-panel-projects-header` |
| [sidebar-panel/mobile-project-drawer.tsx](sidebar-panel/mobile-project-drawer.tsx) | `#mobile-project-drawer`, `sidebar-panel-mobile-drawer`, `sidebar-panel-mobile-drawer-account`, `sidebar-panel-mobile-drawer-account-trigger`, `sidebar-panel-mobile-drawer-archive`, `sidebar-panel-mobile-drawer-brand`, `sidebar-panel-mobile-drawer-content`, `sidebar-panel-mobile-drawer-create`, `sidebar-panel-mobile-drawer-footer`, `sidebar-panel-mobile-drawer-header`, `sidebar-panel-mobile-drawer-project-list`, `sidebar-panel-mobile-drawer-project-scroll`, `sidebar-panel-mobile-project-sort-list` |
| [sidebar-panel/account-menu.tsx](sidebar-panel/account-menu.tsx) | `sidebar-panel-account-email`, `sidebar-panel-account-menu`, `sidebar-panel-logout` |
| [sidebar-panel/project-navigation.tsx](sidebar-panel/project-navigation.tsx) | `sidebar-panel-drawer-project-link`, `sidebar-panel-icon`, `sidebar-panel-project-drag-handle`, `sidebar-panel-project-drag-preview`, `sidebar-panel-project-drag-source`, `sidebar-panel-project-label-skeleton`, `sidebar-panel-project-drop-preview`, `sidebar-panel-project-drop-trace`, `sidebar-panel-project-select-button`, `sidebar-panel-project-sortable-link`, `sidebar-panel-sidebar-project-link` |
| [project-panel/project-panel.tsx](project-panel/project-panel.tsx) | `project-panel`, `project-panel-board`, `project-panel-brand`, `project-panel-empty-projects`, `project-panel-error`, `project-panel-error-retry`, `project-panel-load-error`, `project-panel-load-error-code`, `project-panel-mobile-bar`, `project-panel-mobile-header`, `project-panel-mobile-project-menu`, `project-panel-mobile-scrim` |
| [project-panel/archived-projects-panel.tsx](project-panel/archived-projects-panel.tsx) | `project-panel-archive-delete`, `project-panel-archive-panel`, `project-panel-archive-project`, `project-panel-archive-restore`, `project-panel-archive-skeleton` |

The account-creation heading uses `auth-title` in [auth-screen.tsx](auth-screen.tsx). Initial project loading uses the existing `app-loading` class in [page.tsx](../app/page.tsx). Brand selectors in [globals.css](../app/globals.css) use `sidebar-panel-brand` and `project-panel-brand`.

Status sections use `StatusSection` on all screen sizes. In `project-panel/status-section.tsx`, their hooks are `board-status-section`, `board-status-section-header`, `board-status-section-top-add`, `board-status-section-top-add-tooltip`, `board-status-section-expand`, `board-status-section-task-list`, `board-status-section-drop-indicator`, `board-status-section-empty-state`, and `board-status-section-add-task`. Drag selectors use `data-board-status-section` and `data-board-status-section-empty-state`; Tailwind hover styling uses `group/board-status-section`. Loading hooks in `project-panel/project-view.tsx` are `board-status-section-skeleton`, `board-status-section-icon-skeleton`, `board-status-section-title-skeleton`, and `board-status-section-count-skeleton`.

`KanbanBoard` owns drag coordination, insertion feedback, the active drag preview, and which status is creating a task. `StatusSection` owns the status header, task-list composition, loading and empty states, and mobile expansion controls. Its private `NewTaskCard` keeps draft, saving, and error state local. `task-card.tsx` contains `TaskCard` (including local action-menu state) and `TaskDragPreview`; `board-status-styles.ts` shares the existing status colors between cards and sections.

Task hooks retained in `project-panel/task-card.tsx` are `task-card`, `task-card-header`, `task-card-title-link`, `task-card-ticket`, `task-card-title`, `task-card-drag-handle`, `task-card-footer`, `task-card-priority`, `task-card-complexity`, `task-card-actions`, `task-actions-trigger`, `task-actions-menu`, `task-actions-menu-button`, `task-actions-menu-button-danger`, and `task-drag-preview`. Task-creation hooks retained in `project-panel/status-section.tsx` are `kanban-new-task-card`, `kanban-new-task-title`, and `kanban-new-task-error`.
