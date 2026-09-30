// Hide browser compatibility note in Electron
if (navigator.userAgent.includes('Electron')) {
  document.getElementById('browser-note')?.remove();
}

// Constants
const FEEDBACK_DURATION_MS = 300;
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const IMAGE_BASE_DURATION = 6000; // 6 seconds for images in auto-scroll at 1x
const MAX_SUBFOLDERS = 9;
const GRID_SIZE = 9;
const CATEGORIES = ['liked', 'disliked', 'super'];
const STATUSES = ['unsorted', ...CATEGORIES];

// Feedback symbols for all types
const FEEDBACK_SYMBOLS = {
  liked: '♥',
  disliked: '✗',
  super: '★',
  unsorted: '⟲',
  screenshot: '📷'
};

const MEDIA_TYPE_LABELS = { all: 'All', video: 'Videos', image: 'Images' };
const NEXT_MEDIA_TYPE = { all: 'video', video: 'image', image: 'all' };

// Returns 'video', 'image', or null for unsupported files
function getMediaType(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  return null;
}

function isSubfolderName(name) {
  const n = Number(name);
  return String(n) === name && n >= 1 && n <= MAX_SUBFOLDERS;
}

// State
let folderHandles = null; // { unsorted, liked, disliked, super } -> FileSystemDirectoryHandle
let allMedia = [];        // { name, handle, parentHandle, status, subfolder, type }
let filteredMedia = [];
let currentIndex = 0;
let playbackRate = 2;     // 0.5, 1 or 2 (2x on by default)
let autoScrollMode = false;
let lastAction = null;    // { media, status, subfolder, name } - where media was before the last move
let imageAutoScrollTimer = null;
let mediaTypeFilter = 'all'; // 'all', 'video', 'image'
let singleBlobUrl = null;
let singleRenderId = 0;   // Bumped on every render so stale async loads are discarded
const movingMedia = new Set(); // Media with a file move in progress
const feedbackTimers = new WeakMap();

// Grid mode state
let gridMode = false;
let gridPageIndex = 0;        // Current page (0-based)
let hoveredSlotIndex = null;  // Which slot (0-8) mouse is over
let gridSessionMedia = [];    // Snapshot of filteredMedia for stable grid positions
const gridSortedMedia = new Set(); // Media sorted during this grid session (rendered as black tiles)
let gridMedia = [];           // Media shown in each slot of the current page (null = empty)
let gridBlobUrls = [];        // For cleanup
let gridRenderId = 0;

// DOM elements
const pickerScreen = document.getElementById('picker-screen');
const appScreen = document.getElementById('app-screen');
const pickFolderBtn = document.getElementById('pick-folder');
const dropZone = document.getElementById('drop-zone');
const folderNameEl = document.getElementById('folder-name');
const videoPlayer = document.getElementById('video-player');
const imagePlayer = document.getElementById('image-player');
const counter = document.getElementById('counter');
const status = document.getElementById('status');
const feedback = document.getElementById('feedback');
const noMediaEl = document.getElementById('no-videos');
const filterRadios = Object.fromEntries(STATUSES.map(s => [s, document.getElementById(`filter-${s}`)]));
const shortcutAutoscroll = document.getElementById('shortcut-autoscroll');
const shortcutSound = document.getElementById('shortcut-sound');
const shortcutHalfSpeed = document.getElementById('shortcut-half-speed');
const shortcut2xSpeed = document.getElementById('shortcut-2x-speed');
const shortcutPause = document.getElementById('shortcut-pause');
const shortcutGrid = document.getElementById('shortcut-grid');
const shortcutMediaType = document.getElementById('shortcut-media-type');
const mediaTypeLabel = shortcutMediaType.querySelector('.media-type-label');
const singleView = document.getElementById('single-view');
const gridView = document.getElementById('grid-view');
const gridSlotTemplate = document.getElementById('grid-slot-template');

// Build grid slots from the template and cache their child elements
const gridSlots = Array.from({ length: GRID_SIZE }, (_, index) => {
  const el = gridSlotTemplate.content.firstElementChild.cloneNode(true);
  const slot = {
    el,
    video: el.querySelector('.grid-video'),
    image: el.querySelector('.grid-image'),
    feedback: el.querySelector('.grid-feedback'),
    status: el.querySelector('.grid-status')
  };
  slot.video.muted = true;
  el.addEventListener('mouseenter', () => { hoveredSlotIndex = index; });
  el.addEventListener('mouseleave', () => {
    if (hoveredSlotIndex === index) hoveredSlotIndex = null;
  });
  el.addEventListener('click', () => openFromGrid(index));
  gridView.appendChild(el);
  return slot;
});

// Pick folder via button or by clicking the folder name
async function pickFolder() {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await initializeFolder(handle);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Failed to pick folder:', err);
    }
  }
}

pickFolderBtn.addEventListener('click', pickFolder);
folderNameEl.addEventListener('click', pickFolder);

// Drag and drop handling
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const item = e.dataTransfer.items[0];
  if (item?.kind !== 'file') return;
  try {
    const handle = await item.getAsFileSystemHandle();
    if (handle.kind === 'directory') {
      // Request write permission
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        await initializeFolder(handle);
      }
    }
  } catch (err) {
    console.error('Failed to access dropped folder:', err);
  }
});

// Initialize folder
async function initializeFolder(rootHandle) {
  // Create category folders if they don't exist
  const handles = { unsorted: rootHandle };
  await Promise.all(CATEGORIES.map(async (category) => {
    handles[category] = await rootHandle.getDirectoryHandle(category, { create: true });
  }));

  folderNameEl.textContent = rootHandle.name;

  // Switch to app screen
  pickerScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  const media = await loadMedia(handles);

  // Swap in the new folder only once it's fully scanned
  folderHandles = handles;
  allMedia = media;
  lastAction = null;
  currentIndex = 0;
  gridPageIndex = 0;
  applyFilters();
}

// Collect media in a folder. Category folders also include their numbered subfolders (1-9).
async function scanFolder(dirHandle, statusName, subfolder = null) {
  const found = [];
  const nested = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const type = getMediaType(entry.name);
      if (type) {
        found.push({ name: entry.name, handle: entry, parentHandle: dirHandle, status: statusName, subfolder, type });
      }
    } else if (statusName !== 'unsorted' && subfolder === null && isSubfolderName(entry.name)) {
      nested.push(scanFolder(entry, statusName, Number(entry.name)));
    }
  }
  return found.concat(...(await Promise.all(nested)));
}

// Load media from all folders in parallel, sorted by name
async function loadMedia(handles) {
  const results = await Promise.all(STATUSES.map(s => scanFolder(handles[s], s)));
  return results.flat().sort((a, b) => a.name.localeCompare(b.name));
}

// Rebuild filteredMedia from the current filter settings
function refreshFilteredMedia() {
  const statusFilter = document.querySelector('input[name="filter"]:checked').value;
  filteredMedia = allMedia.filter(m =>
    m.status === statusFilter && (mediaTypeFilter === 'all' || m.type === mediaTypeFilter)
  );
  currentIndex = Math.max(0, Math.min(currentIndex, filteredMedia.length - 1));
}

// Apply filters and redraw (starts a fresh grid session in grid mode)
function applyFilters() {
  refreshFilteredMedia();
  if (gridMode) startGridSession();
  render();
}

function setStatusFilter(statusName) {
  filterRadios[statusName].checked = true;
  applyFilters();
}

// Cycle media type filter: all -> video -> image -> all
function cycleMediaTypeFilter() {
  mediaTypeFilter = NEXT_MEDIA_TYPE[mediaTypeFilter];
  mediaTypeLabel.textContent = MEDIA_TYPE_LABELS[mediaTypeFilter];
  shortcutMediaType.classList.toggle('active', mediaTypeFilter !== 'all');
  applyFilters();
}

// Image timer helpers
function clearImageTimer() {
  if (imageAutoScrollTimer) {
    clearTimeout(imageAutoScrollTimer);
    imageAutoScrollTimer = null;
  }
}

// 6s at 1x, 3s at 2x, 12s at 0.5x
function startImageTimer() {
  clearImageTimer();
  if (autoScrollMode && !gridMode && filteredMedia[currentIndex]?.type === 'image') {
    imageAutoScrollTimer = setTimeout(nextMedia, IMAGE_BASE_DURATION / playbackRate);
  }
}

// Media element helpers. Removing src (instead of setting '') releases the decoder.
function unloadVideo(videoEl) {
  if (!videoEl.hasAttribute('src')) return;
  videoEl.removeAttribute('src');
  videoEl.load();
}

function unloadImage(imageEl) {
  imageEl.removeAttribute('src');
}

function showMedia(videoEl, imageEl, type, url) {
  const isVideo = type === 'video';
  videoEl.style.display = isVideo ? '' : 'none';
  imageEl.style.display = isVideo ? 'none' : '';
  if (isVideo) {
    unloadImage(imageEl);
    videoEl.src = url;
    videoEl.playbackRate = playbackRate;
    videoEl.play().catch(() => {});
  } else {
    unloadVideo(videoEl);
    imageEl.src = url;
  }
}

function unloadSingleView() {
  unloadVideo(videoPlayer);
  unloadImage(imagePlayer);
  if (singleBlobUrl) {
    URL.revokeObjectURL(singleBlobUrl);
    singleBlobUrl = null;
  }
}

function render() {
  return gridMode ? renderGrid() : renderSingle();
}

// Render current media (single view)
async function renderSingle() {
  const renderId = ++singleRenderId;
  clearImageTimer();
  gridView.classList.add('hidden');
  singleView.classList.remove('hidden');

  const media = filteredMedia[currentIndex];
  noMediaEl.classList.toggle('hidden', Boolean(media));

  if (!media) {
    unloadSingleView();
    imagePlayer.style.display = 'none';
    videoPlayer.style.display = '';
    counter.textContent = '0 of 0';
    status.textContent = '';
    status.className = 'status';
    return;
  }

  counter.textContent = `${currentIndex + 1} of ${filteredMedia.length}`;
  status.textContent = media.subfolder ? `${media.status}/${media.subfolder}` : media.status;
  status.className = `status ${media.status}`;

  let file;
  try {
    file = await media.handle.getFile();
  } catch (err) {
    console.error('Failed to load media:', err);
    return;
  }
  // A newer render started while the file was loading
  if (renderId !== singleRenderId) return;

  const url = URL.createObjectURL(file);
  showMedia(videoPlayer, imagePlayer, media.type, url);
  if (singleBlobUrl) URL.revokeObjectURL(singleBlobUrl);
  singleBlobUrl = url;
  startImageTimer();
}

// Flash a feedback symbol on the single view, or on the hovered grid slot
function showFeedback(type) {
  const element = gridMode ? gridSlots[hoveredSlotIndex].feedback : feedback;
  const baseClass = gridMode ? 'grid-feedback feedback' : 'feedback';

  // Subfolder types look like 'liked/3'
  const [statusName, subfolder = ''] = type.split('/');
  element.textContent = FEEDBACK_SYMBOLS[statusName] + subfolder;
  element.className = `${baseClass} ${statusName} show`;

  clearTimeout(feedbackTimers.get(element));
  feedbackTimers.set(element, setTimeout(() => {
    element.className = baseClass;
  }, FEEDBACK_DURATION_MS));
}

// Navigate (single view)
function stepMedia(delta) {
  if (filteredMedia.length === 0) return;
  currentIndex = (currentIndex + delta + filteredMedia.length) % filteredMedia.length;
  renderSingle();
}

function nextMedia() { stepMedia(1); }
function prevMedia() { stepMedia(-1); }

// Pick a name that's free in dirHandle: "clip.mp4" -> "clip (1).mp4", "clip (2).mp4", ...
async function getAvailableName(dirHandle, name) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 0; ; n++) {
    const candidate = n === 0 ? name : `${base} (${n})${ext}`;
    try {
      await dirHandle.getFileHandle(candidate);
    } catch (err) {
      if (err.name === 'NotFoundError') return candidate;
      if (err.name !== 'TypeMismatchError') throw err; // TypeMismatch = a folder has this name
    }
  }
}

// Move media to a status folder (or its numbered subfolder) and update the media object.
// Never overwrites an existing file - a numbered suffix is added instead.
async function moveMediaFile(media, newStatus, newSubfolder, preferredName = media.name) {
  movingMedia.add(media);
  try {
    const statusHandle = folderHandles[newStatus];
    const targetHandle = newSubfolder
      ? await statusHandle.getDirectoryHandle(String(newSubfolder), { create: true })
      : statusHandle;
    const newName = await getAvailableName(targetHandle, preferredName);

    try {
      // Native move is a rename on disk, instant even for large videos (Chromium 111+)
      await media.handle.move(targetHandle, newName);
    } catch {
      // Fallback: copy to destination + delete from source
      const file = await media.handle.getFile();
      const newHandle = await targetHandle.getFileHandle(newName, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(file);
      await writable.close();
      await media.parentHandle.removeEntry(media.name);
    }

    media.handle = await targetHandle.getFileHandle(newName);
    media.parentHandle = targetHandle;
    media.name = newName;
    media.status = newStatus;
    media.subfolder = newSubfolder;
    return true;
  } catch (err) {
    console.error('Failed to move media:', err);
    return false;
  } finally {
    movingMedia.delete(media);
  }
}

// Get the target media for sorting actions (hovered slot in grid, current media in single view)
function getTargetMediaForAction() {
  if (gridMode) {
    return hoveredSlotIndex === null ? null : gridMedia[hoveredSlotIndex] || null;
  }
  return filteredMedia[currentIndex] || null;
}

// Move media to liked/disliked/super/unsorted
async function sortMedia(newStatus) {
  const media = getTargetMediaForAction();
  if (!media || media.status === newStatus || movingMedia.has(media)) return;

  const previous = { status: media.status, subfolder: media.subfolder, name: media.name };
  showFeedback(newStatus);

  if (!(await moveMediaFile(media, newStatus, null))) return;
  lastAction = { media, ...previous };

  if (gridMode) {
    gridSortedMedia.add(media);
    const slotIndex = gridMedia.indexOf(media);
    if (slotIndex !== -1) {
      gridMedia[slotIndex] = null;
      clearGridSlot(gridSlots[slotIndex]);
    }
    refreshFilteredMedia();
    // Auto-advance when every slot on the page has been sorted
    if (gridMedia.every(m => m === null)) changeGridPage(1);
  } else {
    // The sorted media left the current view, so the next one shifted into currentIndex
    const nextIndex = currentIndex;
    refreshFilteredMedia();
    currentIndex = nextIndex < filteredMedia.length ? nextIndex : 0;
    renderSingle();
  }
}

// Move categorized media to a numbered subfolder (1-9) or back to its category folder (0)
async function moveToSubfolder(n) {
  const media = getTargetMediaForAction();
  if (!media || media.status === 'unsorted' || movingMedia.has(media)) return;

  const newSubfolder = n === 0 ? null : n;
  if (media.subfolder === newSubfolder) return;

  const previous = { status: media.status, subfolder: media.subfolder, name: media.name };
  showFeedback(newSubfolder ? `${media.status}/${newSubfolder}` : media.status);

  if (!(await moveMediaFile(media, media.status, newSubfolder))) return;
  lastAction = { media, ...previous };

  if (gridMode) {
    const slotIndex = gridMedia.indexOf(media);
    if (slotIndex !== -1) updateGridBadge(gridSlots[slotIndex], media);
  } else {
    nextMedia();
  }
}

// Undo - restore last moved media to its previous location and navigate to it
async function undoMedia() {
  const action = lastAction;
  if (!action || movingMedia.has(action.media)) return;

  const { media, status: previousStatus, subfolder, name } = action;
  if (!(await moveMediaFile(media, previousStatus, subfolder, name))) return;
  if (lastAction === action) lastAction = null;

  // Switch to the filter for the previous status so we can see the media
  filterRadios[previousStatus].checked = true;
  refreshFilteredMedia();
  const index = filteredMedia.indexOf(media);
  if (index !== -1) currentIndex = index;

  if (gridMode) {
    gridPageIndex = Math.floor(currentIndex / GRID_SIZE);
    startGridSession();
  }
  render();
}

// ========== GRID MODE FUNCTIONS ==========

// Snapshot filteredMedia so grid positions stay stable while sorting
function startGridSession() {
  gridSessionMedia = filteredMedia.slice();
  gridSortedMedia.clear();
  const totalPages = Math.ceil(gridSessionMedia.length / GRID_SIZE);
  gridPageIndex = Math.max(0, Math.min(gridPageIndex, totalPages - 1));
}

// Toggle between single and grid view
function toggleGridMode() {
  gridMode = !gridMode;
  shortcutGrid.classList.toggle('active', gridMode);

  if (gridMode) {
    // Stop single view playback and discard any in-flight single render
    clearImageTimer();
    singleRenderId++;
    unloadSingleView();
    gridPageIndex = Math.floor(currentIndex / GRID_SIZE);
    startGridSession();
    renderGrid();
  } else {
    // Unload grid videos so they don't keep decoding while hidden
    gridRenderId++;
    gridSlots.forEach(clearGridSlot);
    revokeGridBlobUrls();
    gridSessionMedia = [];
    gridSortedMedia.clear();
    gridMedia = [];
    renderSingle();
  }
}

function clearGridSlot(slot) {
  slot.el.classList.add('empty');
  unloadVideo(slot.video);
  slot.video.style.display = 'none';
  unloadImage(slot.image);
  slot.image.style.display = 'none';
  slot.status.textContent = '';
  slot.status.className = 'grid-status';
}

// Status badge is only shown for media with a subfolder assigned
function updateGridBadge(slot, media) {
  if (media.subfolder) {
    slot.status.textContent = `${FEEDBACK_SYMBOLS[media.status]}${media.subfolder}`;
    slot.status.className = `grid-status ${media.status}`;
  } else {
    slot.status.textContent = '';
    slot.status.className = 'grid-status';
  }
}

function revokeGridBlobUrls() {
  for (const url of gridBlobUrls) {
    URL.revokeObjectURL(url);
  }
  gridBlobUrls = [];
}

// Render the current grid page (files load in parallel)
async function renderGrid() {
  const renderId = ++gridRenderId;
  singleView.classList.add('hidden');

  const startIndex = gridPageIndex * GRID_SIZE;
  const pageMedia = gridSessionMedia
    .slice(startIndex, startIndex + GRID_SIZE)
    .map(m => (gridSortedMedia.has(m) ? null : m));
  const files = await Promise.all(pageMedia.map(m => m && m.handle.getFile().catch((err) => {
    console.error('Failed to load media for grid:', err);
    return null;
  })));
  // A newer render started while files were loading
  if (renderId !== gridRenderId) return;

  revokeGridBlobUrls();
  gridMedia = gridSlots.map((slot, i) => {
    if (!files[i]) {
      clearGridSlot(slot);
      return null;
    }
    const media = pageMedia[i];
    const url = URL.createObjectURL(files[i]);
    gridBlobUrls.push(url);
    showMedia(slot.video, slot.image, media.type, url);
    slot.el.classList.remove('empty');
    updateGridBadge(slot, media);
    return media;
  });

  const total = gridSessionMedia.length;
  noMediaEl.classList.toggle('hidden', total > 0);
  gridView.classList.toggle('hidden', total === 0);
  counter.textContent = total > 0
    ? `${startIndex + 1}-${Math.min(startIndex + GRID_SIZE, total)} of ${total}`
    : '0 of 0';
}

// Navigate grid pages
function changeGridPage(delta) {
  const totalPages = Math.ceil(gridSessionMedia.length / GRID_SIZE);
  if (totalPages === 0) return;
  gridPageIndex = (gridPageIndex + delta + totalPages) % totalPages;
  renderGrid();
}

// Click a grid slot to return to single view focused on that media
function openFromGrid(slotIndex) {
  const media = gridMedia[slotIndex];
  if (!media) return;
  const index = filteredMedia.indexOf(media);
  if (index !== -1) currentIndex = index;
  toggleGridMode();
}

// ========== END GRID MODE FUNCTIONS ==========

// Playback controls
function setPlaybackRate(rate) {
  playbackRate = rate;
  shortcut2xSpeed.classList.toggle('active', rate === 2);
  shortcutHalfSpeed.classList.toggle('active', rate === 0.5);
  videoPlayer.playbackRate = rate;
  gridSlots.forEach(slot => { slot.video.playbackRate = rate; });
  startImageTimer();
}

function toggleSound() {
  videoPlayer.muted = !videoPlayer.muted;
  shortcutSound.classList.toggle('active', !videoPlayer.muted);
}

function togglePause() {
  if (gridMode) {
    const videos = gridSlots.map(slot => slot.video).filter(v => v.hasAttribute('src'));
    const anyPlaying = videos.some(v => !v.paused);
    videos.forEach(v => (anyPlaying ? v.pause() : v.play().catch(() => {})));
    shortcutPause.classList.toggle('active', anyPlaying);
  } else if (videoPlayer.paused) {
    videoPlayer.play().catch(() => {});
    shortcutPause.classList.remove('active');
  } else {
    videoPlayer.pause();
    shortcutPause.classList.add('active');
  }
}

function toggleAutoScroll() {
  autoScrollMode = !autoScrollMode;
  shortcutAutoscroll.classList.toggle('active', autoScrollMode);
  videoPlayer.loop = !autoScrollMode;
  startImageTimer();
}

// Take screenshot of current video frame (single view, videos only)
async function takeScreenshot() {
  const media = filteredMedia[currentIndex];
  if (gridMode || media?.type !== 'video') return;

  // Create canvas and draw current frame
  const canvas = document.createElement('canvas');
  canvas.width = videoPlayer.videoWidth;
  canvas.height = videoPlayer.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoPlayer, 0, 0);

  // Convert to blob
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

  // Generate filename: video.mp4 -> video_screenshot.png
  const baseName = media.name.replace(/\.[^.]+$/, '');
  const screenshotName = `${baseName}_screenshot.png`;

  try {
    // Save to same folder as media
    const fileHandle = await media.parentHandle.getFileHandle(screenshotName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    if (!gridMode) showFeedback('screenshot');
  } catch (err) {
    console.error('Failed to save screenshot:', err);
  }
}

// Russian to English key mapping (based on physical key position)
// Allows using shortcuts without switching keyboard layout
// Only Cyrillic characters - ASCII punctuation (. , / ?) works in both layouts
const russianToEnglish = {
  'г': 'u',
  'ь': 'm',
  'т': 'n',
  'ф': 'a',
  'ы': 's',
  'в': 'd',
  'а': 'f',
  'ш': 'i',
  'о': 'j',
  'п': 'g',
  'э': "'",
  'б': ',',
  'ю': '.'
};

// Keyboard controls (keys are lowercased)
const keyActions = {
  arrowright: () => (gridMode ? changeGridPage(1) : nextMedia()),
  arrowleft: () => (gridMode ? changeGridPage(-1) : prevMedia()),
  arrowup: () => sortMedia('liked'),
  arrowdown: () => sortMedia('disliked'),
  "'": () => sortMedia('super'),
  j: () => sortMedia('unsorted'),
  u: undoMedia,
  m: toggleSound,
  '/': togglePause,
  '.': () => setPlaybackRate(playbackRate === 2 ? 1 : 2),
  ',': () => setPlaybackRate(playbackRate === 0.5 ? 1 : 0.5),
  n: toggleAutoScroll,
  a: () => setStatusFilter('unsorted'),
  s: () => setStatusFilter('liked'),
  d: () => setStatusFilter('disliked'),
  f: () => setStatusFilter('super'),
  g: toggleGridMode,
  i: cycleMediaTypeFilter,
  '?': takeScreenshot
};
for (let n = 0; n <= MAX_SUBFOLDERS; n++) {
  keyActions[n] = () => moveToSubfolder(n);
}

document.addEventListener('keydown', (e) => {
  // Ignore if picker screen is visible, and leave browser/OS shortcuts (Cmd+F etc.) alone
  if (!pickerScreen.classList.contains('hidden')) return;
  if (e.metaKey || e.ctrlKey) return;

  const key = e.key.toLowerCase();
  const action = keyActions[russianToEnglish[key] || key];
  if (!action) return;
  e.preventDefault();
  action();
});

// Filter change handlers
Object.values(filterRadios).forEach(radio => radio.addEventListener('change', applyFilters));

// Auto-scroll: advance to next media when current ends
videoPlayer.addEventListener('ended', () => {
  if (autoScrollMode) {
    nextMedia();
  }
});
