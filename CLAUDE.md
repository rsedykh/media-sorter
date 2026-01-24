# CLAUDE.md

## Project Overview

Video Sorter is a web app for sorting MP4 videos into categorized folders (liked, disliked, super) using keyboard shortcuts. It uses the browser's File System Access API for direct folder access.

## Architecture

- **server.js** - Minimal Express server that only serves static files from `public/`
- **public/index.html** - Main UI with folder picker and video player screens
- **public/style.css** - Dark theme styling
- **public/app.js** - All application logic using File System Access API

## Key Technical Details

- No server-side file operations - everything happens in the browser
- Uses `showDirectoryPicker()` for folder selection
- Uses `FileSystemFileHandle` and `FileSystemDirectoryHandle` for file operations
- Videos are loaded as blob URLs via `URL.createObjectURL()`
- Moving files = copy to destination + delete from source (no native move in the API)
- 2x speed mode is on by default (`quickPreviewMode = true`)

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
| `→` | Next video |
| `←` | Previous video |
| `↑` | Like |
| `↓` | Dislike |
| `'` | Super like |
| `U` | Undo |
| `M` | Toggle sound |
| `.` | Toggle 2x speed |
| `/` | Hold for 2x speed |
| `,` | Toggle auto-scroll |

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
