# HANDOFF.md

## Current State

The Media Sorter app is fully functional. Users can:
1. Select a folder via button, drag-and-drop, or clicking folder name to change
2. Sort videos and images into liked/disliked/super folders using keyboard
3. Sub-sort any categorized media into numbered subfolders (1-9/) using 1-9 keys
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
| `1-9` | Move categorized media to subfolder 1-9/ |
| `0` | Move media back to parent category folder |
| `?` | Screenshot current frame (videos only) |
| `G` | Toggle 3x3 grid view |
| `I` | Cycle media type filter (All → Videos → Images) |

**Russian keyboard support:** Letter shortcuts work with Russian layout (Cyrillic). Punctuation (`. , / ?`) works in both layouts.

## Code Structure

### app.js Key Variables

```javascript
// Constants
const FEEDBACK_DURATION_MS = 300;
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const IMAGE_BASE_DURATION = 6000;  // 6 seconds for images in auto-scroll at 1x
const MAX_SUBFOLDERS = 9;
const GRID_SIZE = 9;
const CATEGORIES = ['liked', 'disliked', 'super'];
const STATUSES = ['unsorted', ...CATEGORIES];
const FEEDBACK_SYMBOLS = { liked: '♥', disliked: '✗', super: '★', unsorted: '⟲', screenshot: '📷' };

// State
let folderHandles = null;      // { unsorted, liked, disliked, super } -> FileSystemDirectoryHandle
let allMedia = [];             // { name, handle, parentHandle, status, subfolder, type }
let filteredMedia = [];        // Media matching current filter (single selection)
let currentIndex = 0;          // Current media position
let playbackRate = 2;          // 0.5, 1 or 2 (2x on by default)
let autoScrollMode = false;    // Auto-advance when video ends / image timer
let lastAction = null;         // { media, status, subfolder, name } - location before the last move
let imageAutoScrollTimer = null;
let mediaTypeFilter = 'all';   // 'all', 'video', 'image'
let singleBlobUrl = null;      // Blob URL shown in single view
let singleRenderId = 0;        // Bumped per render; stale async loads are discarded
const movingMedia = new Set(); // Media with a move in progress (blocks double actions / key repeat)

// Grid mode
let gridMode = false;
let gridPageIndex = 0;         // Current page in grid (0-based)
let hoveredSlotIndex = null;   // Which slot (0-8) mouse is over
let gridSessionMedia = [];     // Snapshot of filteredMedia for stable grid positions
const gridSortedMedia = new Set(); // Media sorted during this grid session (black tiles)
let gridMedia = [];            // Media shown per slot on the current page (null = empty)
let gridBlobUrls = [];         // For cleanup
let gridRenderId = 0;
const gridSlots = [...];       // { el, video, image, feedback, status } built from #grid-slot-template
```

Media objects are compared by identity (`indexOf`, `Set`), never by name.

### Key Functions

**File helpers:**
- `getMediaType(filename)` - Returns `'video'`, `'image'` or `null`
- `isSubfolderName(name)` - True for `"1"`..`"9"`
- `getAvailableName(dirHandle, name)` - Free name in a folder (`clip.mp4` -> `clip (1).mp4` on clash)

**Initialization:**
- `pickFolder()` - Folder picker (button and folder name click)
- `initializeFolder(rootHandle)` - Creates category folders, scans, then swaps in the new folder state (resets undo/index)
- `scanFolder(dirHandle, status, subfolder)` - One pass over a folder; category folders recurse into numbered subfolders
- `loadMedia(handles)` - Scans all folders in parallel, returns media sorted by name

**Filtering:**
- `refreshFilteredMedia()` - Rebuilds filteredMedia and clamps currentIndex (no rendering)
- `applyFilters()` - Refresh + new grid session in grid mode + render
- `setStatusFilter(status)`, `cycleMediaTypeFilter()`

**Display:**
- `render()` - Dispatches to `renderSingle()` or `renderGrid()`
- `renderSingle()` - Loads and plays current media (single view)
- `showMedia(videoEl, imageEl, type, url)` - Shows a blob URL in a video/image pair
- `unloadVideo(el)`, `unloadImage(el)`, `unloadSingleView()` - Remove `src` so decoders are released
- `showFeedback(type)` - Feedback overlay on single view or hovered grid slot (handles `'liked/3'` types)

**Sorting:**
- `sortMedia(newStatus)` - Move to liked/disliked/super/unsorted; single view then shows the next media in the current view
- `moveToSubfolder(n)` - Move categorized media to subfolder 1-9 (0 = back to category folder)
- `moveMediaFile(media, status, subfolder, preferredName)` - Native `move()` with copy+delete fallback, never overwrites
- `undoMedia()` - Moves last media back (original name, subfolder), switches filter and focuses it
- `getTargetMediaForAction()` - Hovered media (grid) or current media (single)

**Navigation:**
- `nextMedia()`, `prevMedia()` (via `stepMedia(delta)`) - Single view
- `changeGridPage(delta)` - Grid pages

**Grid mode:**
- `toggleGridMode()` - Switches views; unloads the hidden view's media
- `startGridSession()` - Snapshots filteredMedia, clears sorted set, clamps page
- `renderGrid()` - Loads the page's files in parallel into slots
- `clearGridSlot(slot)`, `updateGridBadge(slot, media)`, `openFromGrid(slotIndex)`

**Playback / other:**
- `setPlaybackRate(rate)` - Updates single + grid videos, indicators and image timer
- `toggleSound()`, `togglePause()`, `toggleAutoScroll()`
- `startImageTimer()`, `clearImageTimer()` - Image auto-scroll (single view only), duration = 6s / playbackRate
- `takeScreenshot()` - Captures current frame and saves as PNG (single view, videos only)
- `keyActions` - Key -> action map; `russianToEnglish` maps Cyrillic keys; Cmd/Ctrl combos are ignored

### CSS Classes

- `.status.liked` - Green (#2e7d32)
- `.status.disliked` - Red (#c62828)
- `.status.super` - Yellow (#f9a825)
- `.feedback.liked/disliked/super` - Matching colors for overlay
- `.shortcuts span.active` - Blue (#4a9eff) for active toggles

## Key Behaviors

1. **Like/Dislike/Super** - All work on any media status, not just unsorted
2. **Subfolders** - Press 1-9 on any categorized media to move to subfolders, press 0 to move back to parent
3. **Filters** - Radio buttons (single selection), A/S/D/F select filter directly
4. **Undo** - Restores media to its *previous* state (including subfolder), switches filter, navigates to media
5. **Auto-scroll** - Videos: disables loop, advances on end. Images: advance after 6s (3s at 2x, 12s at 0.5x)
6. **Speed modes** - 0.5x and 2x are mutually exclusive; affect video playback, grid videos, and image timer
7. **Active indicators** - Toggle options turn blue when active (no "(ON)" text)
8. **Change folder** - Click on folder name in header (underlined)
9. **Screenshot** - Press ? to save current frame as {medianame}_screenshot.png (videos only)
10. **Grid view** - Press G to see 9 media at once; hover to select, click to focus; arrows navigate pages; videos always muted
11. **Grid status badges** - Only shown for media with subfolder assignments (not for category alone)
12. **Media types** - Each media object has `type: 'video'` or `type: 'image'` property
13. **Media type filter** - Press I to cycle through All → Videos only → Images only
14. **No overwrites** - If the target folder already has a file with the same name, the moved file gets a ` (1)` suffix
15. **After sorting** - Single view shows the next item of the current view (wraps to the first at the end)

## UI Layout

- Container fills full viewport (no max-width cap)
- App screen uses flex column layout: header → video (flex:1) → controls → shortcuts
- Video container fills remaining vertical space (no fixed aspect-ratio)
- First row of shortcuts (toggles) inline with counter and status
- Second row of shortcuts (actions) below, hidden when height < 640px or width < 768px
- Compact spacing between video and controls

## Potential Improvements

1. **Error handling** - No user-visible errors, only console.error()

2. **Loading states** - No indicator when loading large videos

3. **Persistence** - Filter state and modes don't persist across sessions

4. **Multi-level undo** - Currently only supports single undo

## Testing Checklist

- [ ] Folder picker works (button and drag-drop)
- [ ] Click folder name to change folder
- [ ] Videos load and autoplay at 2x speed
- [ ] Images display correctly
- [ ] All keyboard shortcuts work (including A/S/D/F filters)
- [ ] Files move to correct folders
- [ ] Like/dislike/super/unsorted work on media of any status
- [ ] Subfolder sorting (1-9, 0) works for liked, disliked, and super
- [ ] Undo restores to previous state (including subfolder)
- [ ] Filters show correct media (single selection)
- [ ] Auto-scroll advances when video ends
- [ ] Auto-scroll advances images after 6s
- [ ] Image timer respects 2x speed (3s) and 0.5x speed (12s)
- [ ] Pause toggle works
- [ ] 0.5x and 2x speed modes are mutually exclusive
- [ ] Speed mode changes sync to grid videos
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
- [ ] Grid videos are always muted
- [ ] Single view video pauses when entering grid mode
- [ ] Media type filter cycles with I key (All → Videos → Images)
- [ ] Media type filter combines with status filter correctly

## Dependencies

- express@^4.18.2 (only for static file serving in web mode)
- electron@^34.0.0 (devDependency - desktop app shell)
- electron-builder@^25.1.8 (devDependency - builds .dmg)

**Web dev:** `node server.js` → http://localhost:3000
**Electron dev:** `npm run electron`
**Build .dmg:** `npm run dist` → `dist/Media Sorter-*-arm64.dmg`
