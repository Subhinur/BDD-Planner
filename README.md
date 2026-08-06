# Desktop Task Planner

Single-user local task planner scoped for one person on one machine.

## Stack

- Next.js App Router
- TypeScript
- React
- Electron desktop shell
- Electron Builder for downloadable app packaging
- Browser localStorage for task data and preferences
- Plain CSS

## Features

- Kanban board: draft, in progress, review, done
- Dynamic date selector generated from task due dates
- Date-grouped task cards inside each kanban column
- Full-board empty state when the selected date has no tasks
- Compact cards with horizontal board scrolling and vertical column scrolling
- Dynamic board density when selected task lists get large
- Toggleable details panel so the kanban can expand when needed
- Drag cards between columns
- Tick task cards as finished without dragging
- Create, edit, and delete tasks
- Customizable task tags in the add/edit modal
- Filters for all, active, done, and overdue tasks
- Light/dark mode toggle with persisted preference
- Text size slider with persisted preference
- Local summary, today's plan, and task stats

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Run the app locally:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Desktop App

Build and open the app as a desktop window:

```powershell
npm run desktop
```

Create downloadable Windows app builds:

```powershell
npm run dist:win
```

The packaged files are written to:

```text
release
```

The Windows build creates an installer and a portable executable. Share the installer or portable `.exe` from `release` as the downloadable app.

## Build Commands

```powershell
npm run build
```

Creates a static web export in:

```text
out
```

```powershell
npm run dist
```

Creates desktop app packages for the current platform using Electron Builder.

## Local Data

Tasks and UI preferences are stored on the user's machine using `localStorage`. In the desktop app, this data belongs to the installed app profile on that computer.

Task storage key:

```text
desktopPlanner.tasks
```

Preference storage keys:

```text
desktopPlanner.customTags
desktopPlanner.hiddenTags
desktopPlanner.theme
desktopPlanner.fontSize
desktopPlanner.detailsPanel
```

There is no login, team workspace, role model, backend API, database, Redis, WebSockets, real-time sync, Docker service, or server-side persistence in this scope.

## Runtime Shape

```text
Electron desktop window
  -> static Next.js export
  -> React client component
  -> localStorage on this machine
```

The app seeds a few starter tasks the first time it runs. After that, task changes are saved locally whenever tasks are created, edited, moved, completed, deleted, or cleared.
