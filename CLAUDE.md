# CLAUDE.md

## Project Overview

Media Sorter is an app for sorting videos and images into categorized folders (liked, disliked, super) using keyboard shortcuts. It uses the browser's File System Access API for direct folder access. Available as a macOS desktop app (Electron) and a web app.

**Supported formats:**
- Videos: `.mp4`, `.webm`, `.mov`, `.m4v`
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

## Architecture

- **electron/main.js** - Electron main process, loads `public/index.html` in a maximized window
- **server.js** - Minimal Express server for web development (serves static files from `public/`)
- **public/index.html** - Main UI with folder picker and media viewer screens
- **public/style.css** - Dark theme styling with height-responsive layout
- **public/app.js** - All application logic using File System Access API

## Key Technical Details

- No server-side file operations - everything happens in the browser
- Uses `showDirectoryPicker()` for folder selection
- Uses `FileSystemFileHandle` and `FileSystemDirectoryHandle` for file operations
- Media files are loaded as blob URLs via `URL.createObjectURL()`
- Moving files uses native `FileSystemFileHandle.move()` (Chromium 111+, instant rename); falls back to copy + delete if unavailable
- Moves never overwrite: on a name clash in the target folder the file becomes `name (1).ext`; undo restores the original name
- 2x speed mode is on by default (`playbackRate = 2`; one of 0.5 / 1 / 2)
- Undo tracks last action via `lastAction` object (`{ media, status, subfolder, name }` = where it was before)
- Images in auto-scroll mode display for 6s (3s at 2x, 12s at 0.5x)
- Each media object: `{ name, handle, parentHandle, status, subfolder, type }` (`subfolder` is 1-9 or null, `type` is `'video'` or `'image'`)
- Media is compared by object identity, never by name (same filename can exist in several folders)
- Sorting goes through generic `sortMedia(newStatus)`; subfolders via unified `moveToSubfolder(n)`
- `render()` dispatches to `renderSingle()` / `renderGrid()`; both discard stale async loads via render IDs
- Grid slots are cloned from `<template id="grid-slot-template">` (count = `GRID_SIZE`)

## File Structure

```
/
├── electron/
│   └── main.js        # Electron main process
├── server.js          # Express static file server (web dev)
├── package.json       # Dependencies + Electron build config
├── README.md          # User documentation
├── CLAUDE.md          # This file - project context for AI
├── HANDOFF.md         # Detailed state for future development
└── public/
    ├── index.html     # Two-screen UI (picker + player)
    ├── style.css      # Dark theme with status colors
    └── app.js         # File System Access API logic
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| `→` | Next media |
| `←` | Previous media |
| `↑` | Like (works on any status) |
| `↓` | Dislike (works on any status) |
| `'` | Super like (works on any status) |
| `J` | Move back to unsorted |
| `U` | Undo |
| `N` | Toggle auto-scroll |
| `M` | Toggle sound |
| `,` | Toggle 0.5x speed |
| `.` | Toggle 2x speed |
| `/` | Toggle pause |
| `A` | Show Unsorted media |
| `S` | Show Liked media |
| `D` | Show Disliked media |
| `F` | Show Super media |
| `1-9` | Move categorized media to subfolder 1-9/ |
| `0` | Move media back to parent category folder |
| `?` | Screenshot current frame (videos only) |
| `G` | Toggle 3x3 grid view |
| `I` | Cycle media type filter (All → Videos → Images) |

**Russian keyboard support:** Letter shortcuts also work with Russian layout (e.g., `Г` for undo, `Ф` for unsorted filter). Punctuation shortcuts (`. , / ?`) work in both layouts.

## Grid View

Press `G` to toggle a 3x3 grid showing 9 media files at once:
- **Navigation**: ←/→ move by page (9 items at a time)
- **Sorting**: Hover over an item and use ↑/↓/'/J to sort it
- **Exit**: Click any item to return to single view focused on that item
- **Counter**: Shows "1-9 of 45" format
- **Status badges**: Only shown for media with subfolder assignments

## Folder Categories

| Folder | Keyboard | Feedback | Color |
|--------|----------|----------|-------|
| liked/ | ↑ | ♥ | Green |
| disliked/ | ↓ | ✗ | Red |
| super/ | ' | ★ | Yellow |

## Electron Desktop App

- Electron wraps the web app with zero changes to `public/` code
- File System Access API works natively in Electron's Chromium renderer
- Build: `npm run dist` produces a `.dmg` in `dist/`
- Dev: `npm run electron` launches the app locally
- Browser compatibility note is auto-hidden in Electron (detects `navigator.userAgent`)
- App is unsigned — users must right-click → Open on first launch

## Limitations

- Web version only works in Chromium browsers (Chrome, Edge, Opera)
- Safari/Firefox don't support File System Access API
- User must grant read/write permission when selecting folder

## Session End Protocol

When the user ends a session (says "session end", "goodbye", etc.), always:

1. Update documentation to reflect any changes made:
   - **HANDOFF.md** - Update current state, key functions, behaviors
   - **CLAUDE.md** - Update if architecture or key details changed
   - **README.md** - Update if user-facing features changed
2. Commit all changes with a descriptive message
3. Push to remote
