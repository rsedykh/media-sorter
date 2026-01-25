# HANDOFF.md

## Current State

The Media Sorter app is fully functional. Users can:
1. Select a folder via button, drag-and-drop, or clicking folder name to change
2. Sort videos and images into liked/disliked/super folders using keyboard
3. Sub-sort liked and super media into numbered subfolders (1-9/) using 1-9 keys
4. Filter which category to display (A/S/D/F keys - single selection)
5. Control playback speed (0.5x, 1x, 2x) and sound
6. Use auto-scroll for hands-free viewing (images display for 6s, affected by speed)
7. Pause/resume video playback
8. Take screenshots of current video frame

**Supported formats:**
- Videos: `.mp4`, `.webm`, `.mov`, `.m4v`
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

## Keyboard Controls

| Key | Action |
|-----|--------|
| `→` | Next media |
| `←` | Previous media |
| `↑` | Like (move to liked/) - works on any status |
| `↓` | Dislike (move to disliked/) - works on any status |
| `'` | Super like (move to super/) - works on any status |
| `J` | Move back to unsorted (root folder) |
| `U` | Undo (restore last action and navigate to media) |
| `N` | Toggle auto-scroll (videos: on end; images: after 6s) |
| `M` | Toggle sound on/off |
| `,` | Toggle 0.5x speed (images: 12s display) |
| `.` | Toggle 2x speed (on by default; images: 3s display) |
| `/` | Toggle pause |
| `A` | Show Unsorted media |
| `S` | Show Liked media |
| `D` | Show Disliked media |
| `F` | Show Super media |
| `1-9` | Move liked/super media to subfolder 1-9/ |
| `0` | Move liked/super media back to parent folder |
| `?` | Screenshot current frame (videos only) |
| `G` | Toggle 3x3 grid view |
| `I` | Cycle media type filter (All → Videos → Images) |

**Russian keyboard support:** Letter shortcuts work with Russian layout (Cyrillic). Punctuation (`. , / ?`) works in both layouts.

## Code Structure

### app.js Key Variables

```javascript
// Constants
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const IMAGE_BASE_DURATION = 6000;  // 6 seconds for images in auto-scroll

// State
let quickPreviewMode = true;   // 2x speed on by default
let halfSpeedMode = false;     // 0.5x speed mode
let autoScrollMode = false;    // Auto-advance when video ends / image timer
let lastAction = null;         // { video, previousStatus, previousParentHandle, previousSubfolder } for undo
let rootHandle, likedHandle, dislikedHandle, superHandle;  // Folder handles
let allVideos = [];            // All loaded media with status, type, likedSubfolder, superSubfolder
let filteredVideos = [];       // Media matching current filter (single selection)
let currentIndex = 0;          // Current media position
let imageAutoScrollTimer = null;  // Timer for image auto-scroll
let mediaTypeFilter = 'all';      // 'all', 'video', 'image'

// Grid mode
let gridMode = false;          // Whether grid view is active
let gridPageIndex = 0;         // Current page in grid (0-based)
let hoveredSlotIndex = null;   // Which slot (0-8) mouse is over
let gridVideos = [];           // Array of media objects for current page
let gridBlobUrls = [];         // For cleanup
```

### Key Functions

- `isVideoFile(filename)`, `isImageFile(filename)`, `isMediaFile(filename)` - File type helpers
- `initializeFolder(handle)` - Sets up folder handles, creates subfolders
- `loadVideos()` - Scans all folders for media files (including liked/1-9 and super/1-9 subfolders)
- `applyFilters()` - Filters media based on selected radio button
- `updateDisplay()` - Loads and plays current video or displays image, handles image timer
- `getImageDuration()` - Returns image display time based on speed mode (3s/6s/12s)
- `updateMediaTypeIndicator()` - Updates the UI indicator for media type filter
- `clearImageTimer()`, `startImageTimer()` - Image auto-scroll timer management
- `moveVideo(video, targetHandle, newStatus)` - Moves file between folders
- `likeVideo()`, `dislikeVideo()`, `superLikeVideo()`, `moveToUnsorted()` - Sort actions
- `moveToLikedSubfolder(n)` - Move liked media to subfolder (1-9) or back to liked/ (0)
- `moveToSuperSubfolder(n)` - Move super media to subfolder (1-9) or back to super/ (0)
- `undoVideo()` - Restores last moved media to its previous state (including subfolder)
- `takeScreenshot()` - Captures current frame and saves as PNG to video's folder
- `toggleGridMode()` - Switches between single and 3x3 grid view
- `updateGridDisplay()` - Loads 9 media items into grid slots
- `nextGridPage()`, `prevGridPage()` - Navigate grid pages
- `getTargetVideoForAction()` - Returns hovered media (grid) or current media (single)
- `showGridFeedback(slotIndex, type)` - Shows feedback overlay on grid slot

### CSS Classes

- `.status.liked` - Green (#2e7d32)
- `.status.disliked` - Red (#c62828)
- `.status.super` - Yellow (#f9a825)
- `.feedback.liked/disliked/super` - Matching colors for overlay
- `.shortcuts span.active` - Blue (#4a9eff) for active toggles

## Key Behaviors

1. **Like/Dislike/Super** - All work on any media status, not just unsorted
2. **Subfolders** - Press 1-9 on liked/super media to move to subfolders, press 0 to move back to parent
3. **Filters** - Radio buttons (single selection), A/S/D/F select filter directly
4. **Undo** - Restores media to its *previous* state (including subfolder), switches filter, navigates to media
5. **Auto-scroll** - Videos: disables loop, advances on end. Images: advance after 6s (3s at 2x, 12s at 0.5x)
6. **Speed modes** - 0.5x and 2x are mutually exclusive; affect both video playback and image timer
7. **Active indicators** - Toggle options turn blue when active (no "(ON)" text)
8. **Change folder** - Click on folder name in header (underlined)
9. **Screenshot** - Press ? to save current frame as {videoname}_screenshot.png (videos only)
10. **Grid view** - Press G to see 9 media at once; hover to select, click to focus; arrows navigate pages
11. **Grid status badges** - Only shown for media with subfolder assignments (not for category alone)
12. **Media types** - Each media object has `type: 'video'` or `type: 'image'` property
13. **Media type filter** - Press I to cycle through All → Videos only → Images only

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
- [ ] Images display correctly
- [ ] All keyboard shortcuts work (including A/S/D/F filters)
- [ ] Files move to correct folders
- [ ] Like/dislike/super/unsorted work on media of any status
- [ ] Liked and super subfolder sorting (1-9, 0) works
- [ ] Undo restores to previous state (including subfolder)
- [ ] Filters show correct media (single selection)
- [ ] Auto-scroll advances when video ends
- [ ] Auto-scroll advances images after 6s
- [ ] Image timer respects 2x speed (3s) and 0.5x speed (12s)
- [ ] Pause toggle works
- [ ] 0.5x and 2x speed modes are mutually exclusive
- [ ] Sound toggle works
- [ ] Active toggles highlight in blue
- [ ] Screenshot saves PNG to video's folder
- [ ] Grid view toggles with G key
- [ ] Grid shows 9 media items (or fewer + black slots)
- [ ] Grid handles mixed videos and images
- [ ] Grid navigation with ←/→ moves by page
- [ ] Hover highlights slot, sorting keys work on hovered media
- [ ] Click media in grid returns to single view on that media
- [ ] Grid counter shows "1-9 of X" format
- [ ] Grid status badges only show for subfolder assignments
- [ ] Media type filter cycles with I key (All → Videos → Images)
- [ ] Media type filter combines with status filter correctly

## Dependencies

- express@^4.18.2 (only for static file serving)

No build step required. Run with `node server.js`.
