# HANDOFF.md

## Current State

The Video Sorter app is fully functional. Users can:
1. Select a folder via button, drag-and-drop, or clicking folder name to change
2. Sort videos into liked/disliked/super folders using keyboard
3. Sub-sort liked and super videos into numbered subfolders (1-9/) using 1-9 keys
4. Filter which category to display (A/S/D/F keys - single selection)
5. Control playback speed (0.5x, 1x, 2x) and sound
6. Use auto-scroll for hands-free viewing
7. Pause/resume video playback
8. Take screenshots of current video frame

## Keyboard Controls

| Key | Action |
|-----|--------|
| `→` | Next video |
| `←` | Previous video |
| `↑` | Like (move to liked/) - works on any status |
| `↓` | Dislike (move to disliked/) - works on any status |
| `'` | Super like (move to super/) - works on any status |
| `J` | Move back to unsorted (root folder) |
| `U` | Undo (restore last action and navigate to video) |
| `N` | Toggle auto-scroll (auto-advance when video ends) |
| `M` | Toggle sound on/off |
| `,` | Toggle 0.5x speed |
| `.` | Toggle 2x speed (on by default) |
| `/` | Toggle pause |
| `A` | Show Unsorted videos |
| `S` | Show Liked videos |
| `D` | Show Disliked videos |
| `F` | Show Super videos |
| `1-9` | Move liked/super video to subfolder 1-9/ |
| `0` | Move liked/super video back to parent folder |
| `?` | Screenshot current frame (saved to video's folder) |
| `G` | Toggle 3x3 grid view |

## Code Structure

### app.js Key Variables

```javascript
// State
let quickPreviewMode = true;   // 2x speed on by default
let halfSpeedMode = false;     // 0.5x speed mode
let autoScrollMode = false;    // Auto-advance when video ends
let lastAction = null;         // { video, previousStatus, previousParentHandle, previousSubfolder } for undo
let rootHandle, likedHandle, dislikedHandle, superHandle;  // Folder handles
let allVideos = [];            // All loaded videos with status, likedSubfolder, superSubfolder
let filteredVideos = [];       // Videos matching current filter (single selection)
let currentIndex = 0;          // Current video position

// Grid mode
let gridMode = false;          // Whether grid view is active
let gridPageIndex = 0;         // Current page in grid (0-based)
let hoveredSlotIndex = null;   // Which slot (0-8) mouse is over
let gridVideos = [];           // Array of video objects for current page
let gridBlobUrls = [];         // For cleanup
```

### Key Functions

- `initializeFolder(handle)` - Sets up folder handles, creates subfolders
- `loadVideos()` - Scans all folders for .mp4 files (including liked/1-9 and super/1-9 subfolders)
- `applyFilters()` - Filters videos based on selected radio button
- `updateDisplay()` - Loads and plays current video, shows subfolder in status
- `moveVideo(video, targetHandle, newStatus)` - Moves file between folders
- `likeVideo()`, `dislikeVideo()`, `superLikeVideo()`, `moveToUnsorted()` - Sort actions
- `moveToLikedSubfolder(n)` - Move liked video to subfolder (1-9) or back to liked/ (0)
- `moveToSuperSubfolder(n)` - Move super video to subfolder (1-9) or back to super/ (0)
- `undoVideo()` - Restores last moved video to its previous state (including subfolder)
- `takeScreenshot()` - Captures current frame and saves as PNG to video's folder
- `toggleGridMode()` - Switches between single and 3x3 grid view
- `updateGridDisplay()` - Loads 9 videos into grid slots
- `nextGridPage()`, `prevGridPage()` - Navigate grid pages
- `getTargetVideoForAction()` - Returns hovered video (grid) or current video (single)
- `showGridFeedback(slotIndex, type)` - Shows feedback overlay on grid slot

### CSS Classes

- `.status.liked` - Green (#2e7d32)
- `.status.disliked` - Red (#c62828)
- `.status.super` - Yellow (#f9a825)
- `.feedback.liked/disliked/super` - Matching colors for overlay
- `.shortcuts span.active` - Blue (#4a9eff) for active toggles

## Key Behaviors

1. **Like/Dislike/Super** - All work on any video status, not just unsorted
2. **Subfolders** - Press 1-9 on liked/super videos to move to subfolders, press 0 to move back to parent
3. **Filters** - Radio buttons (single selection), A/S/D/F select filter directly
4. **Undo** - Restores video to its *previous* state (including subfolder), switches filter, navigates to video
5. **Auto-scroll** - Disables loop, advances on video end
6. **Speed modes** - 0.5x and 2x are mutually exclusive
7. **Active indicators** - Toggle options turn blue when active (no "(ON)" text)
8. **Change folder** - Click on folder name in header (underlined)
9. **Screenshot** - Press ? to save current frame as {videoname}_screenshot.png
10. **Grid view** - Press G to see 9 videos at once; hover to select, click to focus; arrows navigate pages
11. **Grid status badges** - Only shown for videos with subfolder assignments (not for category alone)

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
- [ ] All keyboard shortcuts work (including A/S/D/F filters)
- [ ] Files move to correct folders
- [ ] Like/dislike/super/unsorted work on videos of any status
- [ ] Liked and super subfolder sorting (1-9, 0) works
- [ ] Undo restores to previous state (including subfolder)
- [ ] Filters show correct videos (single selection)
- [ ] Auto-scroll advances when video ends
- [ ] Pause toggle works
- [ ] 0.5x and 2x speed modes are mutually exclusive
- [ ] Sound toggle works
- [ ] Active toggles highlight in blue
- [ ] Screenshot saves PNG to video's folder
- [ ] Grid view toggles with G key
- [ ] Grid shows 9 videos (or fewer + black slots)
- [ ] Grid navigation with ←/→ moves by page
- [ ] Hover highlights slot, sorting keys work on hovered video
- [ ] Click video in grid returns to single view on that video
- [ ] Grid counter shows "1-9 of X" format
- [ ] Grid status badges only show for subfolder assignments

## Dependencies

- express@^4.18.2 (only for static file serving)

No build step required. Run with `node server.js`.
