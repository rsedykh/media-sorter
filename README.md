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

## Keyboard Controls

| Key | Action |
|-----|--------|
| `M` | Toggle sound on/off |
| `,` | Toggle auto-scroll (auto-advance when video ends) |
| `.` | Toggle permanent 2x speed (on by default) |
| `/` | Hold for 2x speed (4x when 2x mode is on) |
| `↑` | Like (move to liked/) |
| `↓` | Dislike (move to disliked/) |
| `'` | Super like (move to super/) |
| `U` | Undo (move back and switch to that video) |
| `→` | Next video |
| `←` | Previous video |


## Features

- Videos autoplay and loop
- Filter checkboxes to show unsorted/liked/disliked/super videos
- Visual feedback when sorting (♥ like, ✗ dislike, ★ super)
- Auto-advances to next unsorted video after sorting
- Counter showing current position
- 2x speed mode on by default
- Auto-scroll mode for hands-free viewing
- Super like works on already liked/disliked videos

## Browser Support

Requires browsers with File System Access API support:
- Chrome
- Edge
- Opera

Safari and Firefox are not supported.
