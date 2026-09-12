import { test, expect } from "@playwright/test";
import type { Project, Task } from "../src/lib/types";
import { moveTask } from "../src/lib/board";

// Browser integration with simulated service responses; live Supabase remains a separate check.
test("account flow, project and task CRUD, drag persistence, rollback, and logout", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const now = new Date().toISOString();
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "dev@example.com",
    email_confirmed_at: now,
    app_metadata: {},
    user_metadata: {},
    created_at: now,
  };
  const token = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    user,
  };
  let projects: Project[] = [];
  let tasks: Task[] = [];
  let rejectMove = false;
  await page.route(
    "https://devboard-test.supabase.co/auth/v1/**",
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        json: path.endsWith("/logout")
          ? {}
          : path.endsWith("/user")
            ? user
            : token,
      });
    },
  );
  await page.route("http://127.0.0.1:8001/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = request.postDataJSON();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (method === "GET" && path === "/projects") {
      await route.fulfill({
        json: projects.filter(
          (p) => p.archived === (url.searchParams.get("archived") === "true"),
        ),
      });
      return;
    }
    if (method === "POST" && path === "/projects") {
      const project = {
        id: "project-1",
        owner_id: user.id,
        ticket_prefix: "DE",
        ...body,
        archived: false,
        created_at: now,
        updated_at: now,
      };
      projects.push(project);
      await route.fulfill({ status: 201, json: project });
      return;
    }
    if (path === "/projects/project-1" && method === "PATCH") {
      projects[0] = { ...projects[0], ...body };
      await route.fulfill({ json: projects[0] });
      return;
    }
    if (path === "/projects/project-1" && method === "DELETE") {
      projects = [];
      tasks = [];
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/tasks") && method === "GET") {
      await route.fulfill({ json: tasks });
      return;
    }
    if (path.endsWith("/tasks") && method === "POST") {
      const task = {
        ...body,
        id: `task-${tasks.length + 1}`,
        project_id: "project-1",
        position: tasks.filter((t) => t.status === body.status).length,
        ticket_number: tasks.length + 1,
        ticket_id: `DE-${tasks.length + 1}`,
        created_at: now,
        updated_at: now,
      };
      tasks.push(task);
      await route.fulfill({ status: 201, json: task });
      return;
    }
    const id = path.split("/")[2];
    if (path.endsWith("/move")) {
      if (rejectMove) {
        await route.fulfill({
          status: 503,
          json: { detail: "Service temporarily unavailable" },
        });
        return;
      }
      tasks = moveTask(tasks, id, body.status, body.position);
      await route.fulfill({ json: tasks });
      return;
    }
    if (method === "PATCH") {
      tasks = tasks.map((t) => (t.id === id ? { ...t, ...body } : t));
      await route.fulfill({ json: tasks.find((t) => t.id === id) });
      return;
    }
    if (method === "DELETE") {
      tasks = tasks.filter((t) => t.id !== id);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ status: 404, json: { detail: "Not found" } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("strong-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByLabel("Project name").fill("Developer portal");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Developer portal", exact: true }),
  ).toBeVisible();
  for (const title of ["Write API", "Build interface"]) {
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Minimize task", exact: true }).click();
    await expect(
      page.getByRole("button", { name: title, exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: testInfo.outputPath("board-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Minimize task", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("board-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const todo = page.getByRole("region", { name: "Todo", exact: true });
  const progress = page.getByRole("region", {
    name: "In Progress",
    exact: true,
  });
  const done = page.getByRole("region", { name: "Done", exact: true });
  const drag = async (
    title: string,
    target: ReturnType<typeof page.getByRole>,
  ) => {
    const start = await page
      .getByRole("button", { name: `Move ${title}`, exact: true })
      .boundingBox();
    const end = await target.boundingBox();
    if (!start || !end) throw new Error("Drag target is missing");
    await page.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(start.x + 10, start.y + 10);
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
      steps: 15,
    });
    await page.mouse.up();
  };
  await drag(
    "Write API",
    page.getByRole("button", { name: "Build interface", exact: true }),
  );
  await expect(todo.locator("article").first()).toContainText(
    "Build interface",
  );
  await drag("Write API", progress);
  await expect(
    progress.getByRole("button", { name: "Write API", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    progress.getByRole("button", { name: "Write API", exact: true }),
  ).toBeVisible();
  rejectMove = true;
  await drag("Write API", done);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Service temporarily unavailable" }),
  ).toContainText("board has been restored");
  await expect(
    progress.getByRole("button", { name: "Write API", exact: true }),
  ).toBeVisible();
  rejectMove = false;
  const handle = page.getByRole("button", {
    name: "Move Write API",
    exact: true,
  });
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status")).toContainText(
    "over droppable area done",
  );
  await page.keyboard.press("Space");
  await expect(
    done.getByRole("button", { name: "Write API", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Write API", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("API complete");
  await page.getByLabel("Priority").selectOption("high");
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Minimize task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "API complete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "API complete", exact: true }).click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await page.getByRole("button", { name: "Delete task", exact: true }).last().click();
  await expect(
    page.getByRole("button", { name: "API complete", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Project name").fill("Portal MVP");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Portal MVP", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Archive project", exact: true })
    .click();
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Portal MVP", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore project", exact: true })
    .click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Portal MVP", exact: true }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("strong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Portal MVP", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete project", exact: true }).last().click();
  await expect(
    page.getByRole("button", { name: "Create your first project" }),
  ).toBeVisible();
});
