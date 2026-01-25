# Video Sorter

A lightweight web app to sort MP4 videos into categorized folders using keyboard controls.

## Requirements

- Node.js
- Chrome, Edge, or Opera (uses File System Access API)

## Installation

```bash
npm install
```

## Usage

```bash
node server.js
```

Open http://localhost:3000 in your browser.

1. Click "Choose Folder" or drag & drop a folder containing MP4 videos
2. The app creates `liked/`, `disliked/`, and `super/` subfolders automatically
3. Use keyboard controls to sort videos
4. Click the folder name to change folders

## Keyboard Controls

### Playback
| Key | Action |
|-----|--------|
| `N` | Toggle auto-scroll (auto-advance when video ends) |
| `M` | Toggle sound on/off |
| `,` | Toggle 0.5x speed |
| `.` | Toggle 2x speed (on by default) |
| `/` | Toggle pause |

### Sorting
| Key | Action |
|-----|--------|
| `↑` | Like (move to liked/) |
| `↓` | Dislike (move to disliked/) |
| `'` | Super like (move to super/) |
| `J` | Move back to unsorted |
| `U` | Undo last action |
| `←` | Previous video |
| `→` | Next video |

### Filters (single selection)
| Key | Action |
|-----|--------|
| `A` | Show Unsorted videos |
| `S` | Show Liked videos |
| `D` | Show Disliked videos |
| `F` | Show Super videos |

### Subfolders (Liked & Super)
| Key | Action |
|-----|--------|
| `1-9` | Move liked/super video to subfolder 1-9/ |
| `0` | Move liked/super video back to parent folder |

### Grid View
| Key | Action |
|-----|--------|
| `G` | Toggle 3x3 grid view |

In grid view:
- ←/→ navigate by page (9 videos)
- Hover over a video and use sorting keys (↑/↓/'/J)
- Click any video to return to single view

### Other
| Key | Action |
|-----|--------|
| `?` | Screenshot current frame |

## Features

- Videos autoplay and loop
- Filter by category (unsorted/liked/disliked/super)
- Sub-sort liked and super videos into numbered subfolders (1-9)
- Visual feedback when sorting (♥ like, ✗ dislike, ★ super)
- Auto-advances to next unsorted video after sorting
- Counter showing current position
- 2x speed mode on by default
- 0.5x speed mode for slow viewing
- Auto-scroll mode for hands-free viewing
- Like/dislike/super work on videos of any status
- Undo restores video to previous state
- Screenshot current frame to video's folder
- 3x3 grid view for browsing multiple videos at once

## Browser Support

Requires browsers with File System Access API support:
- Chrome
- Edge
- Opera

Safari and Firefox are not supported.

## Development

This project uses Claude Code for AI-assisted development. See `CLAUDE.md` for AI context and `HANDOFF.md` for detailed implementation state.
