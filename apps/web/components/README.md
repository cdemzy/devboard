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
    editors.tsx
  ui/
hooks/
  use-projects.ts
```

`SidebarPanel` composes desktop navigation and the mobile drawer with a fragment so the DOM layout remains unchanged. Desktop collapse and drag feedback stay inside `DesktopSidebar`; mobile list drag feedback stays inside `MobileProjectDrawer`. Mobile project handles remain visible on the left; dragging keeps the source at its measured origin, shows a floating row, and reserves a full-height insertion gap that advances when the leading card edge touches a neighboring row. `useMobileSidebar` manages drawer gestures, animation, and scroll locking; the shell shares its controls with `ProjectPanel` because the main content moves when the drawer opens.

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
| [sidebar-panel/project-navigation.tsx](sidebar-panel/project-navigation.tsx) | `sidebar-panel-drawer-project-link`, `sidebar-panel-icon`, `sidebar-panel-project-drag-handle`, `sidebar-panel-project-drag-preview`, `sidebar-panel-project-drag-source`, `sidebar-panel-project-drop-preview`, `sidebar-panel-project-drop-trace`, `sidebar-panel-project-select-button`, `sidebar-panel-project-sortable-link`, `sidebar-panel-sidebar-project-link` |
| [project-panel/project-panel.tsx](project-panel/project-panel.tsx) | `project-panel`, `project-panel-board`, `project-panel-brand`, `project-panel-empty-projects`, `project-panel-error`, `project-panel-error-retry`, `project-panel-load-error`, `project-panel-load-error-code`, `project-panel-mobile-bar`, `project-panel-mobile-header`, `project-panel-mobile-project-menu`, `project-panel-mobile-scrim` |
| [project-panel/archived-projects-panel.tsx](project-panel/archived-projects-panel.tsx) | `project-panel-archive-delete`, `project-panel-archive-panel`, `project-panel-archive-project`, `project-panel-archive-restore`, `project-panel-archive-skeleton` |

The account-creation heading uses `auth-title` in [auth-screen.tsx](auth-screen.tsx). Initial project loading uses the existing `app-loading` class in [page.tsx](../app/page.tsx). Brand selectors in [globals.css](../app/globals.css) use `sidebar-panel-brand` and `project-panel-brand`.
