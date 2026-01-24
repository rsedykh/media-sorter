# HANDOFF.md

## Current State

The Video Sorter app is fully functional. Users can:
1. Select a folder via button, drag-and-drop, or clicking folder name to change
2. Sort videos into liked/disliked/super folders using keyboard
3. Filter which categories to display (Q/W/E/R keys)
4. Control playback speed (0.5x, 1x, 2x) and sound
5. Use auto-scroll for hands-free viewing
6. Pause/resume video playback

## Keyboard Controls

| Key | Action |
|-----|--------|
| `→` | Next video |
| `←` | Previous video |
| `↑` | Like (move to liked/) - works on any status |
| `↓` | Dislike (move to disliked/) - works on any status |
| `'` | Super like (move to super/) - works on any status |
| `U` | Undo (restore last action and navigate to video) |
| `N` | Toggle auto-scroll (auto-advance when video ends) |
| `M` | Toggle sound on/off |
| `,` | Toggle 0.5x speed |
| `.` | Toggle 2x speed (on by default) |
| `/` | Toggle pause |
| `Q` | Toggle Unsorted filter |
| `W` | Toggle Liked filter |
| `E` | Toggle Disliked filter |
| `R` | Toggle Super filter |

## Code Structure

### app.js Key Variables

```javascript
// State
let quickPreviewMode = true;   // 2x speed on by default
let halfSpeedMode = false;     // 0.5x speed mode
let autoScrollMode = false;    // Auto-advance when video ends
let lastAction = null;         // { video, previousStatus, previousParentHandle } for undo
let rootHandle, likedHandle, dislikedHandle, superHandle;  // Folder handles
let allVideos = [];            // All loaded videos with status
let filteredVideos = [];       // Videos matching current filters
let currentIndex = 0;          // Current video position
```

### Key Functions

- `initializeFolder(handle)` - Sets up folder handles, creates subfolders
- `loadVideos()` - Scans all folders for .mp4 files
- `applyFilters()` - Filters videos based on checkbox state
- `updateDisplay()` - Loads and plays current video
- `moveVideo(video, targetHandle, newStatus)` - Moves file between folders
- `likeVideo()`, `dislikeVideo()`, `superLikeVideo()` - Sort actions (work on any status)
- `undoVideo()` - Restores last moved video to its previous state
- `getHandleForStatus(status)` - Helper to get folder handle from status name

### CSS Classes

- `.status.liked` - Green (#2e7d32)
- `.status.disliked` - Red (#c62828)
- `.status.super` - Yellow (#f9a825)
- `.feedback.liked/disliked/super` - Matching colors for overlay
- `.shortcuts span.active` - Blue (#4a9eff) for active toggles

## Key Behaviors

1. **Like/Dislike/Super** - All work on any video status, not just unsorted
2. **Undo** - Restores video to its *previous* state (not always unsorted), enables filter if needed, navigates to video
3. **Auto-scroll** - Disables loop, advances on video end
4. **Speed modes** - 0.5x and 2x are mutually exclusive
5. **Active indicators** - Toggle options turn blue when active (no "(ON)" text)
6. **Change folder** - Click on folder name in header (underlined)

## UI Layout

- Container max-width: 1280px
- First row of shortcuts (toggles) inline with counter and status
- Second row of shortcuts (actions) below
- Compact spacing between video and controls

## Potential Improvements

1. **Code duplication** - `likeVideo()`, `dislikeVideo()`, `superLikeVideo()` share similar logic

2. **Error handling** - No user-visible errors, only console.error()

3. **Loading states** - No indicator when loading large videos

4. **Persistence** - Filter state and modes don't persist across sessions

5. **Multi-level undo** - Currently only supports single undo

## Testing Checklist

- [ ] Folder picker works (button and drag-drop)
- [ ] Click folder name to change folder
- [ ] Videos load and autoplay at 2x speed
- [ ] All keyboard shortcuts work (including Q/W/E/R filters)
- [ ] Files move to correct folders
- [ ] Like/dislike work on videos of any status
- [ ] Undo restores to previous state (not just unsorted)
- [ ] Filters show/hide correct videos
- [ ] Auto-scroll advances when video ends
- [ ] Pause toggle works
- [ ] 0.5x and 2x speed modes are mutually exclusive
- [ ] Sound toggle works
- [ ] Active toggles highlight in blue

## Dependencies

- express@^4.18.2 (only for static file serving)

No build step required. Run with `node server.js`.
