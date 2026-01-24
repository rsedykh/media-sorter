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
- Undo tracks last action via `lastAction` object

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
| `↑` | Like (works on any status) |
| `↓` | Dislike (works on any status) |
| `'` | Super like (works on any status) |
| `U` | Undo |
| `N` | Toggle auto-scroll |
| `M` | Toggle sound |
| `,` | Toggle 0.5x speed |
| `.` | Toggle 2x speed |
| `/` | Toggle pause |
| `A` | Toggle Unsorted filter |
| `S` | Toggle Liked filter |
| `D` | Toggle Disliked filter |
| `F` | Toggle Super filter |
| `1-9` | Move liked video to subfolder liked/1-9/ |
| `0` | Move liked video back to liked/ |

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
