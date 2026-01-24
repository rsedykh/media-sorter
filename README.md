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
| `U` | Undo last action |
| `←` | Previous video |
| `→` | Next video |

### Filters
| Key | Action |
|-----|--------|
| `Q` | Toggle Unsorted filter |
| `W` | Toggle Liked filter |
| `E` | Toggle Disliked filter |
| `R` | Toggle Super filter |

## Features

- Videos autoplay and loop
- Filter checkboxes to show unsorted/liked/disliked/super videos
- Visual feedback when sorting (♥ like, ✗ dislike, ★ super)
- Auto-advances to next unsorted video after sorting
- Counter showing current position
- 2x speed mode on by default
- 0.5x speed mode for slow viewing
- Auto-scroll mode for hands-free viewing
- Like/dislike/super work on videos of any status
- Undo restores video to previous state

## Browser Support

Requires browsers with File System Access API support:
- Chrome
- Edge
- Opera

Safari and Firefox are not supported.
