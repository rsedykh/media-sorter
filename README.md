# Media Sorter

A lightweight app to sort videos and images into categorized folders using keyboard controls.

[Download for macOS](../../releases/latest)

<img width="1366" height="848" alt="media-sorter" src="https://github.com/user-attachments/assets/f8f5887c-41a6-48af-9e93-bc31bc4b37c8" />

Got a folder full of unsorted videos and images? Here's the idea:

1. **Quick triage** — Flip through your media and sort into three piles: liked, disliked, and super (for the best stuff)
2. **Refine later** — Use numbered subfolders (1-9) to break down each category however you need
3. **No lock-in** — Everything stays in plain folders. Move them around, back up, or use other tools anytime

Works great as a simple media browser too — just skip the sorting and flip through your files.

## Workflow

1. Click "Choose Folder" or drag & drop a folder containing videos or images
2. The app creates `liked/`, `disliked/`, and `super/` subfolders automatically
3. Use keyboard controls to sort media files
4. Click the folder name to change folders

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

## Desktop App (macOS)

Download the latest `.dmg` from [Releases](../../releases), open it, and drag Media Sorter to Applications.

On first launch, right-click → Open to bypass Gatekeeper (the app is unsigned).

## Web Version

Requires Node.js and a Chromium browser (Chrome, Edge, or Opera).

```bash
npm install
node server.js
```

Open http://localhost:3000 in your browser.

**Supported formats:**
- Videos: `.mp4`, `.webm`, `.mov`, `.m4v`
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

## Development

This project uses Claude Code for AI-assisted development. See `CLAUDE.md` for AI context and `HANDOFF.md` for detailed implementation state.
