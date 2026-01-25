# CLAUDE.md

## Project Overview

Media Sorter is a web app for sorting videos and images into categorized folders (liked, disliked, super) using keyboard shortcuts. It uses the browser's File System Access API for direct folder access.

**Supported formats:**
- Videos: `.mp4`, `.webm`, `.mov`, `.m4v`
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

## Architecture

- **server.js** - Minimal Express server that only serves static files from `public/`
- **public/index.html** - Main UI with folder picker and media viewer screens
- **public/style.css** - Dark theme styling
- **public/app.js** - All application logic using File System Access API

## Key Technical Details

- No server-side file operations - everything happens in the browser
- Uses `showDirectoryPicker()` for folder selection
- Uses `FileSystemFileHandle` and `FileSystemDirectoryHandle` for file operations
- Media files are loaded as blob URLs via `URL.createObjectURL()`
- Moving files = copy to destination + delete from source (no native move in the API)
- 2x speed mode is on by default (`quickPreviewMode = true`)
- Undo tracks last action via `lastAction` object
- Images in auto-scroll mode display for 6s (3s at 2x, 12s at 0.5x)
- Each media object has a `type` property: `'video'` or `'image'`

## File Structure

```
/
├── server.js          # Express static file server
├── package.json       # Dependencies (express only)
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
| `1-9` | Move liked/super media to subfolder 1-9/ |
| `0` | Move liked/super media back to parent folder |
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

## Limitations

- Only works in Chromium browsers (Chrome, Edge, Opera)
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
