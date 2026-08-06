# Project Summary

## Current State

The project has been re-scoped from a team, authenticated, database-backed MVP into a single-user local desktop task planner.

Runtime files:

```text
electron/main.cjs
src/app
src/components/DashboardClient.tsx
out
README.md
```

## What Was Changed

- Removed login and logout behavior.
- Removed multi-user accounts, admin/user roles, user management, and task assignment.
- Removed protected route middleware.
- Removed Next.js API routes.
- Removed Prisma, PostgreSQL, seed scripts, migrations, Docker Compose, and environment configuration.
- Removed server-side task fetching and authorization logic.
- Moved task persistence into browser `localStorage`.
- Added an Electron desktop shell.
- Added Electron Builder packaging for downloadable Windows installer and portable executable builds.
- Configured Next.js static export for desktop packaging.
- Kept the kanban board, date selector, task creation, editing, deletion, filtering, completion checkbox, and drag-and-drop status changes.
- Kept local preferences for theme, text size, details panel visibility, and custom tags.

## Architecture

The app is now client-local and packaged for desktop:

```text
Electron desktop window
  -> static Next.js export
  -> React dashboard component
  -> localStorage
```

No backend service is required for task data. The desktop app serves a static Next.js export inside Electron; task state is loaded and saved in local storage on the same machine.

## Runtime Behavior

- Dashboard renders directly at `/` for the desktop app and remains available at `/dashboard`.
- On first browser run, the dashboard creates starter tasks.
- If local task data already exists, it loads from `desktopPlanner.tasks`.
- Creating a task appends it to local state and persists it.
- Editing a task updates local state and persists it.
- Dragging a task between kanban columns updates status and progress locally.
- Ticking a task marks it done or active locally.
- Deleting a task removes it from local storage.
- Filters operate locally across all, active, done, and overdue tasks.
- Date tabs are generated from the due dates of the currently visible tasks.

## Included

- Single-user local task planning
- Local task persistence
- Kanban movement
- Date-based task navigation
- Task CRUD
- Completion checkbox
- Custom tags
- Local filters
- Dense-list scanning support
- Local summary and today's plan
- Theme and text-size preferences
- Downloadable Windows installer and portable executable builds

## Explicitly Out Of Scope

- Login or authentication
- Admin/user roles
- Multi-user task assignment
- Team collaboration
- Concurrent-user conflict handling
- Backend API routes
- Database architecture
- Prisma/PostgreSQL
- Redis
- WebSockets
- Real-time sync
- Server-side infrastructure
