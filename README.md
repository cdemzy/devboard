# DevBoard

## Tech stack

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, dnd-kit, Radix UI
- **API:** Python 3.12+, FastAPI, SQLAlchemy, Pydantic
- **Data and authentication:** Supabase PostgreSQL and Supabase Auth
- **Testing:** Vitest, Playwright, and pytest

## Architecture

```text
Next.js / React -> FastAPI -> Supabase PostgreSQL
       |
       +-----------> Supabase Auth (sign up, sign in, session refresh, logout)
```

The browser sends its Supabase access token to FastAPI. The API verifies that token with
Supabase Auth's user endpoint and checks project ownership on every data operation.
Project and task mutations go exclusively through FastAPI. There is no service key in
the browser. The database enables RLS and revokes direct data privileges from browser
roles; the backend uses a trusted database connection.

Task creation, movement, and deletion lock the owning project row in a transaction.
The backend normalizes zero-based positions in each column. Moves are optimistic in
the UI, with rollback and a reload action after failure. Concurrent moves serialize;
the later move wins. The web client is a client-rendered authenticated workspace:
no private data is rendered into the public HTML shell.

## Prerequisites

- Node.js 22.12+ (Node 24 used during development), npm
- Python 3.12+, [uv](https://docs.astral.sh/uv/getting-started/installation/)
- A Supabase project with email/password Auth and PostgreSQL

## Supabase setup

1. Create a Supabase project.
2. Run the files in `supabase/migrations/` in filename order in its SQL editor.
   They create projects and tasks, UUID primary keys, ownership and project foreign
   keys, indexes, checks, timestamps, API-only table access, and generated ticket IDs.
   Do not use SQLAlchemy `create_all` for a deployed database: it intentionally does
   not manage Supabase's `auth.users` table or install the migration's RLS/grants.
3. Enable the Email provider in Authentication. Configure the minimum password length
   to at least eight characters. The frontend requires eight characters.
4. Set the Auth Site URL to `http://localhost:3000` and allow that URL as a redirect.
   With email confirmation enabled, users must follow the confirmation email before
   logging in. Add the actual frontend origin when deploying.
5. Copy the project URL and **publishable key** (legacy anon key also works) to both
   environment files. Never use a secret/service-role key in a `NEXT_PUBLIC_` variable.
6. Copy the PostgreSQL connection string to the backend environment. Change its scheme
   to `postgresql+psycopg://`, URL-encode special characters in the password, and use
   `?sslmode=require` for hosted Supabase. Use the direct connection or Supabase's
   **session pooler** if your network cannot reach the IPv6 direct database host.
   This MVP expects a trusted server database role (the dashboard connection uses
   `postgres`) with table access that bypasses RLS. Keep that credential server-only.

Useful references: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords),
[database connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Next.js setup](https://nextjs.org/docs/app/getting-started/installation).

## Run locally

From the repository root:

```powershell
npm install
```

Start the backend in one terminal:

```powershell
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal, from the repository root:

```powershell
npm run dev
```

Open http://localhost:3000. API documentation: http://localhost:8000/docs.
`GET /health` is a process liveness check; it does not check the database or Auth.

For a production web build: `npm run build`, then `npm run start -w apps/web`.
Set frontend public environment values **before** building. Serve the API and frontend
over HTTPS in production and restrict `CORS_ORIGINS` to the actual frontend origin.

### Environment variables

| File                | Variable                             | Meaning                                                                  |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| apps/web/.env.local | NEXT_PUBLIC_API_URL                  | FastAPI base URL, default http://localhost:8000                          |
| apps/web/.env.local | NEXT_PUBLIC_SUPABASE_URL             | Supabase project URL                                                     |
| apps/web/.env.local | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Browser-safe publishable or legacy anon key                              |
| apps/api/.env       | DATABASE_URL                         | Server-only SQLAlchemy psycopg PostgreSQL URL                            |
| apps/api/.env       | SUPABASE_URL                         | Same Supabase project URL                                                |
| apps/api/.env       | SUPABASE_PUBLISHABLE_KEY             | Publishable or legacy anon key for token verification                    |
| apps/api/.env       | CORS_ORIGINS                         | JSON list of allowed frontend origins, default ["http://localhost:3000"] |

Backend settings load relative to `apps/api`; run API commands from that directory.
No Supabase secret/service-role key or JWT signing secret is needed.

### Pre-commit hooks

Install the API development tools, then enable the repository hooks once:

```powershell
cd apps/api
uv sync
uv run pre-commit install
```

Before each commit, the hooks run Ruff checks, formatting, and MyPy type checks for
API Python changes, plus ESLint for staged web TypeScript and JavaScript files. Run
every hook manually from the repository root with
`uv run --project apps/api pre-commit run --all-files`.

## API

All endpoints except health require `Authorization: Bearer <Supabase access token>`.

| Method               | Path                    | Behavior                                                       |
| -------------------- | ----------------------- | -------------------------------------------------------------- |
| GET                  | /health                 | Process liveness                                               |
| GET / POST           | /projects               | List active owned projects / create                            |
| GET                  | /projects?archived=true | List archived owned projects                                   |
| GET / PATCH / DELETE | /projects/{id}          | Read / rename, describe, archive, restore / permanently delete |
| GET / POST           | /projects/{id}/tasks    | List ordered tasks / create                                    |
| GET / PATCH / DELETE | /tasks/{id}             | Read / edit / delete                                           |
| POST                 | /tasks/{id}/move        | Atomic movement; returns the resulting board                   |

Move payload: `{"status":"in_progress","position":0}`. Position is the final zero-based
index within the target column, clamped to its length. Changing status through PATCH
appends to that column unless a position is supplied. Archived project tasks are
read-only until restored. A non-owned or missing resource returns 404. Unknown request
fields and null updates are rejected. Deleting a project permanently deletes its tasks.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
cd apps/api
uv run pytest
uv run ruff check app tests
uv run ruff format --check app tests
```

Backend tests use an isolated SQLite database, dependency overrides for user identity,
and mocked Supabase responses in auth-boundary tests. They cover ownership on all
resource routes, validation, task ordering and persistence across requests, and
archive/restore/cascade deletion. These tests do not establish PostgreSQL locking,
RLS, or a real Supabase email flow.

The browser integration test exercises account screens, project/task CRUD, drag
movement, reordering, refresh, rollback, archiving, restoring, and logout/login.
It uses the real Next.js UI with simulated Auth/API responses:

```powershell
npm exec -w apps/web -- playwright install chromium
npm run test:e2e -w apps/web
```

It starts an isolated dev server on port 3001. These are test-only service mocks;
there is no mock-auth mode or demo persistence in the application.

### Live acceptance checklist

After configuring Supabase, use two accounts:

1. Sign up, confirm email, log in, and create a project.
2. Create multiple tasks, reorder Todo, then drag into In Progress and Done.
3. Refresh; confirm saved statuses and positions. Edit and delete tasks.
4. Rename, archive, restore, and delete a disposable project.
5. Log out and back in; confirm remaining data persists.
6. With the second user's access token, request the first user's project/task
   endpoints through the API; each must return 404 and its project list must be empty.
7. Verify direct Supabase REST writes to the core tables are denied.

## License

DevBoard is released under the MIT License. See [LICENSE](LICENSE).
