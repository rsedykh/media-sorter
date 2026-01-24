# HANDOFF.md

## Current State

The Video Sorter app is fully functional. Users can:
1. Select a folder via button or drag-and-drop
2. Sort videos into liked/disliked/super folders using keyboard
3. Filter which categories to display
4. Control playback speed and sound
5. Use auto-scroll for hands-free viewing

## Keyboard Controls

| Key | Action |
|-----|--------|
| `→` | Next video |
| `←` | Previous video |
| `↑` | Like (move to liked/) |
| `↓` | Dislike (move to disliked/) |
| `'` | Super like (move to super/) - works on any status |
| `U` | Undo (move back and switch to that video) |
| `M` | Toggle sound on/off |
| `.` | Toggle permanent 2x speed (on by default) |
| `/` | Hold for 2x speed (4x when 2x mode is on) |
| `,` | Toggle auto-scroll (auto-advance when video ends) |

## Code Structure

### app.js Key Variables

```javascript
// State
let quickPreviewMode = true;   // 2x speed on by default
let autoScrollMode = false;    // Auto-advance when video ends
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
- `likeVideo()`, `dislikeVideo()`, `superLikeVideo()` - Sort actions
- `undoVideo()` - Moves video back to root and switches to it

### CSS Classes

- `.status.liked` - Green (#2e7d32)
- `.status.disliked` - Red (#c62828)
- `.status.super` - Yellow (#f9a825)
- `.feedback.liked/disliked/super` - Matching colors for overlay

## Key Behaviors

1. **Super like** - Works on any video status (unsorted, liked, disliked), not just unsorted
2. **Undo** - Returns video to unsorted AND navigates to it
3. **Auto-scroll** - Disables loop, advances on video end
4. **Hold for 2x** - Relative to current speed (2x or 4x)

## Potential Improvements

1. **Code duplication** - `likeVideo()`, `dislikeVideo()`, `superLikeVideo()` share similar logic

2. **Error handling** - No user-visible errors, only console.error()

3. **Loading states** - No indicator when loading large videos

4. **Persistence** - Filter state and modes don't persist across sessions

5. **Keyboard hint** - Could show current speed multiplier

## Testing Checklist

- [ ] Folder picker works (button and drag-drop)
- [ ] Videos load and autoplay at 2x speed
- [ ] All keyboard shortcuts work
- [ ] Files move to correct folders
- [ ] Super like works on liked/disliked videos
- [ ] Undo moves file back AND switches to it
- [ ] Filters show/hide correct videos
- [ ] Auto-scroll advances when video ends
- [ ] Hold `/` gives speed boost
- [ ] Sound toggle works
- [ ] Status indicators update correctly

## Dependencies

- express@^4.18.2 (only for static file serving)

No build step required. Run with `node server.js`.
