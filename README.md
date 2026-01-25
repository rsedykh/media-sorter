# Media Sorter

A lightweight web app to sort videos and images into categorized folders using keyboard controls.

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

1. Click "Choose Folder" or drag & drop a folder containing videos or images
2. The app creates `liked/`, `disliked/`, and `super/` subfolders automatically
3. Use keyboard controls to sort media files
4. Click the folder name to change folders

**Supported formats:**
- Videos: `.mp4`, `.webm`, `.mov`, `.m4v`
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

## Workflow

Got a folder full of unsorted videos and images? Here's the idea:

1. **Quick triage** — Flip through your media and sort into three piles: liked, disliked, and super (for the best stuff)
2. **Refine later** — Use numbered subfolders (1-9) to break down each category however you need
3. **No lock-in** — Everything stays in plain folders. Move them around, back up, or use other tools anytime

Works great as a simple media browser too — just skip the sorting and flip through your files.

## Features

- Supports both videos and images in one workflow
- Videos autoplay and loop
- Images display for 6 seconds in auto-scroll (3s at 2x, 12s at 0.5x)
- Filter by category (unsorted/liked/disliked/super)
- Sub-sort liked and super media into numbered subfolders (1-9)
- Visual feedback when sorting (♥ like, ✗ dislike, ★ super)
- Auto-advances to next unsorted item after sorting
- Counter showing current position
- 2x speed mode on by default
- 0.5x speed mode for slow viewing
- Auto-scroll mode for hands-free viewing
- Like/dislike/super work on media of any status
- Undo restores media to previous state
- Screenshot current frame to video's folder
- 3x3 grid view for browsing multiple media files at once

## Development

This project uses Claude Code for AI-assisted development. See `CLAUDE.md` for AI context and `HANDOFF.md` for detailed implementation state.
