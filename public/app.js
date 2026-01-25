// Constants
const FEEDBACK_DURATION_MS = 300;
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const IMAGE_BASE_DURATION = 6000; // 6 seconds for images in auto-scroll
const MAX_SUBFOLDERS = 9;
const GRID_SIZE = 9;

// Feedback symbols for all types
const FEEDBACK_SYMBOLS = {
  liked: '♥',
  disliked: '✗',
  super: '★',
  unsorted: '⟲',
  screenshot: '📷'
};

// File type helpers
function isVideoFile(filename) {
  const lower = filename.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function isImageFile(filename) {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function isMediaFile(filename) {
  return isVideoFile(filename) || isImageFile(filename);
}

// State
let rootHandle = null;
let likedHandle = null;
let dislikedHandle = null;
let superHandle = null;

let allMedia = [];
let filteredMedia = [];
let currentIndex = 0;
let quickPreviewMode = true;
let halfSpeedMode = false;
let autoScrollMode = false;
let lastAction = null; // { media, previousStatus, previousParentHandle, previousSubfolder }
let imageAutoScrollTimer = null;
let mediaTypeFilter = 'all'; // 'all', 'video', 'image'

// Grid mode state
let gridMode = false;
let gridPageIndex = 0;        // Current page (0-based)
let hoveredSlotIndex = null;  // Which slot (0-8) mouse is over
let gridMedia = [];           // Array of media objects for current page (or null for empty/sorted)
let gridBlobUrls = [];        // For cleanup
let gridSessionMedia = [];    // Snapshot of filteredMedia for stable grid positions

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
const filterUnsorted = document.getElementById('filter-unsorted');
const filterLiked = document.getElementById('filter-liked');
const filterDisliked = document.getElementById('filter-disliked');
const filterSuper = document.getElementById('filter-super');
const shortcutAutoscroll = document.getElementById('shortcut-autoscroll');
const shortcutSound = document.getElementById('shortcut-sound');
const shortcutHalfSpeed = document.getElementById('shortcut-half-speed');
const shortcut2xSpeed = document.getElementById('shortcut-2x-speed');
const shortcutPause = document.getElementById('shortcut-pause');
const shortcutGrid = document.getElementById('shortcut-grid');
const shortcutMediaType = document.getElementById('shortcut-media-type');
const singleView = document.getElementById('single-view');
const gridView = document.getElementById('grid-view');
const gridSlots = document.querySelectorAll('.grid-slot');

// Pick folder via button
pickFolderBtn.addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await initializeFolder(handle);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Failed to pick folder:', err);
    }
  }
});

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

  const items = e.dataTransfer.items;
  if (items.length > 0) {
    const item = items[0];
    if (item.kind === 'file') {
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
    }
  }
});

// Initialize folder
async function initializeFolder(handle) {
  rootHandle = handle;

  // Create subfolders if they don't exist
  likedHandle = await rootHandle.getDirectoryHandle('liked', { create: true });
  dislikedHandle = await rootHandle.getDirectoryHandle('disliked', { create: true });
  superHandle = await rootHandle.getDirectoryHandle('super', { create: true });

  folderNameEl.textContent = rootHandle.name;

  // Switch to app screen
  pickerScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  await loadMedia();
}

// Get folder handle for a status
function getHandleForStatus(statusName) {
  const handles = {
    unsorted: rootHandle,
    liked: likedHandle,
    disliked: dislikedHandle,
    super: superHandle
  };
  return handles[statusName] || null;
}

// Get subfolder property name for a status
function getSubfolderProperty(statusName) {
  return `${statusName}Subfolder`;
}

// Load media from all folders
async function loadMedia() {
  allMedia = [];

  // Load unsorted media from root
  for await (const entry of rootHandle.values()) {
    if (entry.kind === 'file' && isMediaFile(entry.name)) {
      allMedia.push({
        name: entry.name,
        handle: entry,
        status: 'unsorted',
        parentHandle: rootHandle,
        type: isVideoFile(entry.name) ? 'video' : 'image'
      });
    }
  }

  // Load media from category folders and their subfolders
  const categoryFolders = [
    { handle: likedHandle, status: 'liked' },
    { handle: dislikedHandle, status: 'disliked' },
    { handle: superHandle, status: 'super' }
  ];

  for (const { handle, status } of categoryFolders) {
    // Load from main folder
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && isMediaFile(entry.name)) {
        const mediaObj = {
          name: entry.name,
          handle: entry,
          status: status,
          parentHandle: handle,
          type: isVideoFile(entry.name) ? 'video' : 'image'
        };
        mediaObj[getSubfolderProperty(status)] = null;
        allMedia.push(mediaObj);
      }
    }

    // Load from numbered subfolders (1-9)
    for (let n = 1; n <= MAX_SUBFOLDERS; n++) {
      try {
        const subfolderHandle = await handle.getDirectoryHandle(String(n));
        for await (const entry of subfolderHandle.values()) {
          if (entry.kind === 'file' && isMediaFile(entry.name)) {
            const mediaObj = {
              name: entry.name,
              handle: entry,
              status: status,
              parentHandle: subfolderHandle,
              type: isVideoFile(entry.name) ? 'video' : 'image'
            };
            mediaObj[getSubfolderProperty(status)] = n;
            allMedia.push(mediaObj);
          }
        }
      } catch (err) {
        // Subfolder doesn't exist, skip it
      }
    }
  }

  // Sort by name
  allMedia.sort((a, b) => a.name.localeCompare(b.name));

  applyFilters();
}

// Build filtered list based on current filter settings
function buildFilteredList() {
  const selectedFilter = document.querySelector('input[name="filter"]:checked').value;
  return allMedia.filter(m => {
    if (m.status !== selectedFilter) return false;
    if (mediaTypeFilter === 'video' && m.type !== 'video') return false;
    if (mediaTypeFilter === 'image' && m.type !== 'image') return false;
    return true;
  });
}

// Apply filters
function applyFilters() {
  filteredMedia = buildFilteredList();

  if (currentIndex >= filteredMedia.length) {
    currentIndex = Math.max(0, filteredMedia.length - 1);
  }

  if (gridMode) {
    // Refresh grid session snapshot with new filter results
    gridSessionMedia = filteredMedia.map(m => ({ ...m, sorted: false }));
    // Recalculate page index and update grid
    const totalPages = Math.ceil(gridSessionMedia.length / GRID_SIZE);
    if (gridPageIndex >= totalPages) {
      gridPageIndex = Math.max(0, totalPages - 1);
    }
    updateGridDisplay();
  } else {
    updateDisplay();
  }
}

// Apply filters but keep grid state (don't reload grid yet)
function applyFiltersKeepGrid() {
  filteredMedia = buildFilteredList();

  if (currentIndex >= filteredMedia.length) {
    currentIndex = Math.max(0, filteredMedia.length - 1);
  }
}

// Update media type filter indicator
function updateMediaTypeIndicator() {
  const labels = { all: 'All', video: 'Videos', image: 'Images' };
  shortcutMediaType.querySelector('.media-type-label').textContent = labels[mediaTypeFilter];
  shortcutMediaType.classList.toggle('active', mediaTypeFilter !== 'all');
}

// Image timer helpers
function getImageDuration() {
  if (quickPreviewMode) return IMAGE_BASE_DURATION / 2;  // 3s at 2x
  if (halfSpeedMode) return IMAGE_BASE_DURATION * 2;     // 12s at 0.5x
  return IMAGE_BASE_DURATION;                             // 6s normal
}

function clearImageTimer() {
  if (imageAutoScrollTimer) {
    clearTimeout(imageAutoScrollTimer);
    imageAutoScrollTimer = null;
  }
}

function startImageTimer() {
  clearImageTimer();
  if (autoScrollMode && filteredMedia[currentIndex]?.type === 'image') {
    imageAutoScrollTimer = setTimeout(() => {
      nextMedia();
    }, getImageDuration());
  }
}

// Get current playback rate based on speed mode
function getCurrentPlaybackRate() {
  return quickPreviewMode ? 2 : (halfSpeedMode ? 0.5 : 1);
}

// Update media display (single view)
async function updateDisplay() {
  // Ensure we're in single view mode when this is called
  if (gridMode) {
    singleView.classList.add('hidden');
    gridView.classList.remove('hidden');
    return updateGridDisplay();
  }

  singleView.classList.remove('hidden');
  gridView.classList.add('hidden');

  if (filteredMedia.length === 0) {
    videoPlayer.src = '';
    imagePlayer.src = '';
    imagePlayer.style.display = 'none';
    videoPlayer.style.display = '';
    counter.textContent = '0 of 0';
    status.textContent = '';
    status.className = 'status';
    noMediaEl.classList.remove('hidden');
    clearImageTimer();
    return;
  }

  noMediaEl.classList.add('hidden');
  const media = filteredMedia[currentIndex];

  try {
    const file = await media.handle.getFile();
    const url = URL.createObjectURL(file);

    // Revoke previous URLs to avoid memory leaks
    if (videoPlayer.src && videoPlayer.src.startsWith('blob:')) {
      URL.revokeObjectURL(videoPlayer.src);
    }
    if (imagePlayer.src && imagePlayer.src.startsWith('blob:')) {
      URL.revokeObjectURL(imagePlayer.src);
    }

    if (media.type === 'video') {
      imagePlayer.style.display = 'none';
      imagePlayer.src = '';
      videoPlayer.style.display = '';
      videoPlayer.src = url;
      videoPlayer.playbackRate = getCurrentPlaybackRate();
      videoPlayer.play().catch(() => {});
      clearImageTimer();
    } else {
      videoPlayer.style.display = 'none';
      videoPlayer.src = '';
      imagePlayer.style.display = '';
      imagePlayer.src = url;
      startImageTimer();
    }
  } catch (err) {
    console.error('Failed to load media:', err);
  }

  counter.textContent = `${currentIndex + 1} of ${filteredMedia.length}`;

  // Show subfolder in status if applicable
  const subfolderProp = getSubfolderProperty(media.status);
  if (media[subfolderProp]) {
    status.textContent = `${media.status}/${media[subfolderProp]}`;
  } else {
    status.textContent = media.status;
  }
  status.className = `status ${media.status}`;
}

// Render feedback content to an element
function renderFeedback(element, type, isGrid = false) {
  const baseClass = isGrid ? 'grid-feedback feedback' : 'feedback';

  // Handle subfolder types (e.g., 'liked/3', 'super/3')
  if (type.includes('/')) {
    const [statusName, subfolderNum] = type.split('/');
    const symbol = FEEDBACK_SYMBOLS[statusName] || '♥';
    element.textContent = `${symbol}${subfolderNum}`;
    element.className = `${baseClass} ${statusName} show`;
  } else {
    element.textContent = FEEDBACK_SYMBOLS[type] || '♥';
    element.className = `${baseClass} ${type} show`;
  }

  setTimeout(() => {
    element.className = baseClass;
  }, FEEDBACK_DURATION_MS);
}

// Show visual feedback (single view)
function showFeedback(type) {
  renderFeedback(feedback, type, false);
}

// Show feedback on grid slot
function showGridFeedback(slotIndex, type) {
  const slot = gridSlots[slotIndex];
  const feedbackEl = slot.querySelector('.grid-feedback');
  renderFeedback(feedbackEl, type, true);
}

// Navigate
function nextMedia() {
  clearImageTimer();
  if (filteredMedia.length === 0) return;
  currentIndex = (currentIndex + 1) % filteredMedia.length;
  updateDisplay();
}

function prevMedia() {
  clearImageTimer();
  if (filteredMedia.length === 0) return;
  currentIndex = (currentIndex - 1 + filteredMedia.length) % filteredMedia.length;
  updateDisplay();
}

// Move media to a target folder
async function moveMediaFile(media, targetHandle, newStatus) {
  try {
    // Get the file
    const file = await media.handle.getFile();

    // Create new file in target folder
    const newHandle = await targetHandle.getFileHandle(media.name, { create: true });
    const writable = await newHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Delete from original location
    await media.parentHandle.removeEntry(media.name);

    // Update media object
    media.handle = newHandle;
    media.parentHandle = targetHandle;
    media.status = newStatus;

    return true;
  } catch (err) {
    console.error('Failed to move media:', err);
    return false;
  }
}

// Clear a grid slot after sorting
function clearGridSlot(slotIndex) {
  const snapshotIndex = gridPageIndex * GRID_SIZE + slotIndex;
  if (gridSessionMedia[snapshotIndex]) {
    gridSessionMedia[snapshotIndex].sorted = true;
  }
  gridMedia[slotIndex] = null;
  const slot = gridSlots[slotIndex];
  slot.classList.add('empty');
  const videoEl = slot.querySelector('.grid-video');
  const imageEl = slot.querySelector('.grid-image');
  videoEl.src = '';
  videoEl.style.display = 'none';
  imageEl.src = '';
  imageEl.style.display = 'none';
  slot.querySelector('.grid-status').textContent = '';
}

// Generic sort media function - replaces likeMedia, dislikeMedia, superLikeMedia, moveToUnsorted
async function sortMedia(newStatus) {
  const media = getTargetMediaForAction();
  if (!media) return;
  if (media.status === newStatus) return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  const previousStatus = media.status;
  const previousParentHandle = media.parentHandle;
  const previousSubfolder = media.likedSubfolder || media.dislikedSubfolder || media.superSubfolder;

  // Show feedback
  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, newStatus);
  } else {
    showFeedback(newStatus);
  }

  const targetHandle = getHandleForStatus(newStatus);
  const success = await moveMediaFile(media, targetHandle, newStatus);

  if (success) {
    // Clear all subfolder properties
    media.likedSubfolder = null;
    media.dislikedSubfolder = null;
    media.superSubfolder = null;
    lastAction = { media, previousStatus, previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      clearGridSlot(slotIndex);
      applyFiltersKeepGrid();
      checkGridAutoAdvance();
    } else {
      // For unsorted, just refresh display
      if (newStatus === 'unsorted') {
        applyFilters();
        updateDisplay();
      } else {
        const nextUnsortedIndex = findNextUnsortedIndex();
        applyFilters();
        if (nextUnsortedIndex !== -1) {
          const nextItem = allMedia[nextUnsortedIndex];
          currentIndex = filteredMedia.findIndex(m => m.name === nextItem.name);
          if (currentIndex === -1) currentIndex = 0;
        }
        updateDisplay();
      }
    }
  }
}

// Convenience functions for sorting
function likeMedia() { sortMedia('liked'); }
function dislikeMedia() { sortMedia('disliked'); }
function superLikeMedia() { sortMedia('super'); }
function moveToUnsorted() { sortMedia('unsorted'); }

// Move media to a numbered subfolder (1-9) or back to parent folder (0)
// Works for any status that supports subfolders
async function moveToSubfolder(n) {
  const media = getTargetMediaForAction();
  if (!media) return;

  const currentStatus = media.status;
  const subfolderProp = getSubfolderProperty(currentStatus);
  const parentHandle = getHandleForStatus(currentStatus);
  const symbol = FEEDBACK_SYMBOLS[currentStatus] || '♥';

  // Check if this status supports subfolders (unsorted doesn't have a parent category folder)
  if (currentStatus === 'unsorted') return;

  // Prevent no-op moves
  const currentSubfolder = media[subfolderProp];
  if (n === 0 && currentSubfolder === null) return;
  if (n > 0 && currentSubfolder === n) return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  // Save state for undo
  const previousSubfolder = currentSubfolder;
  const previousParentHandle = media.parentHandle;

  // Get target folder handle
  let targetHandle;
  if (n === 0) {
    targetHandle = parentHandle;
  } else {
    // Create subfolder if needed
    targetHandle = await parentHandle.getDirectoryHandle(String(n), { create: true });
  }

  // Show feedback
  const feedbackType = n === 0 ? currentStatus : `${currentStatus}/${n}`;
  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, feedbackType);
  } else {
    showFeedback(feedbackType);
  }

  // Move the media (status stays the same)
  const success = await moveMediaFile(media, targetHandle, currentStatus);
  if (success) {
    media[subfolderProp] = (n === 0) ? null : n;
    lastAction = { media, previousStatus: currentStatus, previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      // Update status badge in grid
      const slot = gridSlots[slotIndex];
      const statusEl = slot.querySelector('.grid-status');
      if (n === 0) {
        statusEl.textContent = '';
        statusEl.className = 'grid-status';
      } else {
        statusEl.textContent = `${symbol}${n}`;
        statusEl.className = `grid-status ${currentStatus}`;
      }
    } else {
      nextMedia();
    }
  }
}

// Undo - restore last moved media to its previous state and navigate to it
async function undoMedia() {
  if (!lastAction) return;

  const { media, previousStatus, previousParentHandle, previousSubfolder } = lastAction;
  const mediaName = media.name;

  const success = await moveMediaFile(media, previousParentHandle, previousStatus);
  if (success) {
    // Clear all subfolder properties first
    media.likedSubfolder = null;
    media.dislikedSubfolder = null;
    media.superSubfolder = null;

    // Restore subfolder state for the previous status
    if (previousSubfolder !== null && previousSubfolder !== undefined) {
      const subfolderProp = getSubfolderProperty(previousStatus);
      media[subfolderProp] = previousSubfolder;
    }

    lastAction = null;

    // Switch to the filter for the previous status so we can see the media
    const filterRadio = {
      'unsorted': filterUnsorted,
      'liked': filterLiked,
      'disliked': filterDisliked,
      'super': filterSuper
    }[previousStatus];
    if (filterRadio) {
      filterRadio.checked = true;
    }

    applyFilters();

    // Find and switch to the undone media
    const newIndex = filteredMedia.findIndex(m => m.name === mediaName);
    if (newIndex !== -1) {
      currentIndex = newIndex;
    }
    updateDisplay();
  }
}

// Find next unsorted media index in allMedia
function findNextUnsortedIndex() {
  const currentName = filteredMedia[currentIndex]?.name;
  const currentAllIndex = allMedia.findIndex(m => m.name === currentName);

  for (let i = currentAllIndex + 1; i < allMedia.length; i++) {
    if (allMedia[i].status === 'unsorted') return i;
  }
  for (let i = 0; i < currentAllIndex; i++) {
    if (allMedia[i].status === 'unsorted') return i;
  }
  return -1;
}

// ========== GRID MODE FUNCTIONS ==========

// Toggle between single and grid view
function toggleGridMode() {
  gridMode = !gridMode;
  shortcutGrid.classList.toggle('active', gridMode);

  if (gridMode) {
    // Create stable snapshot for this grid session
    gridSessionMedia = filteredMedia.map(m => ({ ...m, sorted: false }));
    // Switch to grid view
    singleView.classList.add('hidden');
    gridView.classList.remove('hidden');
    // Calculate which page contains currentIndex
    gridPageIndex = Math.floor(currentIndex / GRID_SIZE);
    updateGridDisplay();
  } else {
    // Clear snapshot when exiting (will be recreated fresh next time)
    gridSessionMedia = [];
    // Switch to single view
    gridView.classList.add('hidden');
    singleView.classList.remove('hidden');
    cleanupGridBlobUrls();
    updateDisplay();
  }
}

// Update the grid display with 9 media items
async function updateGridDisplay() {
  // Use gridSessionMedia for stable positions during grid session
  const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredMedia;

  if (sourceMedia.length === 0) {
    noMediaEl.classList.remove('hidden');
    gridView.classList.add('hidden');
    singleView.classList.add('hidden');
    return;
  }

  noMediaEl.classList.add('hidden');
  gridView.classList.remove('hidden');
  singleView.classList.add('hidden');

  // Clean up previous blob URLs
  cleanupGridBlobUrls();

  const startIndex = gridPageIndex * GRID_SIZE;
  gridMedia = [];
  const playbackRate = getCurrentPlaybackRate();

  for (let i = 0; i < GRID_SIZE; i++) {
    const mediaIndex = startIndex + i;
    const slot = gridSlots[i];
    const videoEl = slot.querySelector('.grid-video');
    const imageEl = slot.querySelector('.grid-image');
    const statusEl = slot.querySelector('.grid-status');

    if (mediaIndex < sourceMedia.length) {
      const mediaSnapshot = sourceMedia[mediaIndex];

      // Check if this item has been sorted (render as black tile)
      if (mediaSnapshot.sorted) {
        gridMedia[i] = null;
        slot.classList.add('empty');
        videoEl.src = '';
        videoEl.style.display = 'none';
        imageEl.src = '';
        imageEl.style.display = 'none';
        statusEl.textContent = '';
        statusEl.className = 'grid-status';
        continue;
      }

      // Find the actual media object in allMedia (it may have been moved)
      const media = allMedia.find(m => m.name === mediaSnapshot.name) || mediaSnapshot;
      gridMedia[i] = media;

      try {
        const file = await media.handle.getFile();
        const url = URL.createObjectURL(file);
        gridBlobUrls.push(url);

        if (media.type === 'video') {
          imageEl.style.display = 'none';
          imageEl.src = '';
          videoEl.style.display = '';
          videoEl.src = url;
          videoEl.playbackRate = playbackRate;
          videoEl.loop = true;
          videoEl.play().catch(() => {});
        } else {
          videoEl.style.display = 'none';
          videoEl.src = '';
          imageEl.style.display = '';
          imageEl.src = url;
        }

        slot.classList.remove('empty');

        // Show status badge only for media with subfolder assigned
        const subfolderProp = getSubfolderProperty(media.status);
        const subfolder = media[subfolderProp];
        if (subfolder) {
          const symbol = FEEDBACK_SYMBOLS[media.status] || '♥';
          statusEl.textContent = `${symbol}${subfolder}`;
          statusEl.className = `grid-status ${media.status}`;
        } else {
          statusEl.textContent = '';
          statusEl.className = 'grid-status';
        }
      } catch (err) {
        console.error('Failed to load media for grid:', err);
        gridMedia[i] = null;
        slot.classList.add('empty');
        videoEl.src = '';
        videoEl.style.display = 'none';
        imageEl.src = '';
        imageEl.style.display = 'none';
        statusEl.textContent = '';
        statusEl.className = 'grid-status';
      }
    } else {
      // Empty slot
      gridMedia[i] = null;
      slot.classList.add('empty');
      videoEl.src = '';
      videoEl.style.display = 'none';
      imageEl.src = '';
      imageEl.style.display = 'none';
      statusEl.textContent = '';
      statusEl.className = 'grid-status';
    }
  }

  // Update counter for grid mode (use sourceMedia for total count)
  const startNum = startIndex + 1;
  const endNum = Math.min(startIndex + GRID_SIZE, sourceMedia.length);
  counter.textContent = `${startNum}-${endNum} of ${sourceMedia.length}`;
}

// Clean up blob URLs used by grid
function cleanupGridBlobUrls() {
  for (const url of gridBlobUrls) {
    URL.revokeObjectURL(url);
  }
  gridBlobUrls = [];
}

// Navigate to next page in grid mode
function nextGridPage() {
  const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredMedia;
  const totalPages = Math.ceil(sourceMedia.length / GRID_SIZE);
  if (totalPages === 0) return;
  gridPageIndex = (gridPageIndex + 1) % totalPages;
  updateGridDisplay();
}

// Navigate to previous page in grid mode
function prevGridPage() {
  const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredMedia;
  const totalPages = Math.ceil(sourceMedia.length / GRID_SIZE);
  if (totalPages === 0) return;
  gridPageIndex = (gridPageIndex - 1 + totalPages) % totalPages;
  updateGridDisplay();
}

// Initialize grid hover tracking
function initGridHoverTracking() {
  gridSlots.forEach((slot, index) => {
    slot.addEventListener('mouseenter', () => {
      if (!slot.classList.contains('empty')) {
        hoveredSlotIndex = index;
      }
    });
    slot.addEventListener('mouseleave', () => {
      if (hoveredSlotIndex === index) {
        hoveredSlotIndex = null;
      }
    });
  });
}

// Initialize grid click handlers
function initGridClickHandlers() {
  gridSlots.forEach((slot, index) => {
    slot.addEventListener('click', () => {
      if (slot.classList.contains('empty')) return;
      if (gridMedia[index] === null) return;

      // Find the clicked media's index in filteredMedia by name
      const clickedMedia = gridMedia[index];
      const mediaIndex = filteredMedia.findIndex(m => m.name === clickedMedia.name);
      if (mediaIndex !== -1) {
        currentIndex = mediaIndex;
      } else {
        // Fallback: use position-based index
        currentIndex = Math.min(gridPageIndex * GRID_SIZE + index, filteredMedia.length - 1);
      }
      toggleGridMode(); // Switch back to single view
    });
  });
}

// Get the target media for sorting actions (grid-aware)
function getTargetMediaForAction() {
  if (gridMode) {
    if (hoveredSlotIndex === null) return null;
    return gridMedia[hoveredSlotIndex] || null;
  } else {
    if (filteredMedia.length === 0) return null;
    return filteredMedia[currentIndex];
  }
}

// Check if all grid media are sorted (null) and auto-advance
function checkGridAutoAdvance() {
  const allNull = gridMedia.every(m => m === null);
  if (allNull) {
    const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredMedia;
    const totalPages = Math.ceil(sourceMedia.length / GRID_SIZE);
    if (totalPages > 0) {
      gridPageIndex = (gridPageIndex + 1) % totalPages;
      updateGridDisplay();
    } else {
      // No media left
      updateGridDisplay();
    }
  }
}

// Update playback rate for all grid videos
function updateGridPlaybackRate() {
  if (!gridMode) return;
  const rate = getCurrentPlaybackRate();
  const gridVideoEls = document.querySelectorAll('.grid-video');
  gridVideoEls.forEach(v => {
    if (v.src) {
      v.playbackRate = rate;
    }
  });
}

// Initialize grid event listeners
initGridHoverTracking();
initGridClickHandlers();

// ========== END GRID MODE FUNCTIONS ==========

// Change folder (click on folder name)
folderNameEl.addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await initializeFolder(handle);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Failed to pick folder:', err);
    }
  }
});

// Russian to English key mapping (based on physical key position)
// Allows using shortcuts without switching keyboard layout
// Only Cyrillic characters - ASCII punctuation (. , / ?) works in both layouts
const russianToEnglish = {
  'г': 'u', 'Г': 'U',
  'ь': 'm', 'Ь': 'M',
  'т': 'n', 'Т': 'N',
  'ф': 'a', 'Ф': 'A',
  'ы': 's', 'Ы': 'S',
  'в': 'd', 'В': 'D',
  'а': 'f', 'А': 'F',
  'ш': 'i', 'Ш': 'I',
  'о': 'j', 'О': 'J',
  'п': 'g', 'П': 'G',
  'э': "'",
  'б': ',',
  'ю': '.'
};

// Keyboard controls
document.addEventListener('keydown', (e) => {
  // Ignore if picker screen is visible
  if (!pickerScreen.classList.contains('hidden')) return;

  // Normalize Russian keys to English equivalents
  const key = russianToEnglish[e.key] || e.key;

  switch (key) {
    case 'ArrowRight':
      e.preventDefault();
      if (gridMode) {
        nextGridPage();
      } else {
        nextMedia();
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (gridMode) {
        prevGridPage();
      } else {
        prevMedia();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      likeMedia();
      break;
    case "'":
      e.preventDefault();
      superLikeMedia();
      break;
    case 'ArrowDown':
      e.preventDefault();
      dislikeMedia();
      break;
    case 'u':
    case 'U':
      e.preventDefault();
      undoMedia();
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      videoPlayer.muted = !videoPlayer.muted;
      shortcutSound.classList.toggle('active', !videoPlayer.muted);
      break;
    case '/':
      e.preventDefault();
      if (gridMode) {
        // Toggle pause for all grid videos
        const gridVideoEls = document.querySelectorAll('.grid-video');
        const anyPlaying = Array.from(gridVideoEls).some(v => !v.paused && v.src);
        if (anyPlaying) {
          gridVideoEls.forEach(v => v.pause());
          shortcutPause.classList.add('active');
        } else {
          gridVideoEls.forEach(v => { if (v.src) v.play().catch(() => {}); });
          shortcutPause.classList.remove('active');
        }
      } else {
        if (videoPlayer.paused) {
          videoPlayer.play();
          shortcutPause.classList.remove('active');
        } else {
          videoPlayer.pause();
          shortcutPause.classList.add('active');
        }
      }
      break;
    case '.':
      e.preventDefault();
      quickPreviewMode = !quickPreviewMode;
      if (quickPreviewMode) halfSpeedMode = false;
      shortcut2xSpeed.classList.toggle('active', quickPreviewMode);
      shortcutHalfSpeed.classList.toggle('active', halfSpeedMode);
      videoPlayer.playbackRate = getCurrentPlaybackRate();
      updateGridPlaybackRate();
      if (filteredMedia[currentIndex]?.type === 'image') {
        startImageTimer();
      }
      break;
    case ',':
      e.preventDefault();
      halfSpeedMode = !halfSpeedMode;
      if (halfSpeedMode) quickPreviewMode = false;
      shortcutHalfSpeed.classList.toggle('active', halfSpeedMode);
      shortcut2xSpeed.classList.toggle('active', quickPreviewMode);
      videoPlayer.playbackRate = getCurrentPlaybackRate();
      updateGridPlaybackRate();
      if (filteredMedia[currentIndex]?.type === 'image') {
        startImageTimer();
      }
      break;
    case 'n':
    case 'N':
      e.preventDefault();
      autoScrollMode = !autoScrollMode;
      shortcutAutoscroll.classList.toggle('active', autoScrollMode);
      videoPlayer.loop = !autoScrollMode;
      if (autoScrollMode && filteredMedia[currentIndex]?.type === 'image') {
        startImageTimer();
      } else {
        clearImageTimer();
      }
      break;
    case 'a':
    case 'A':
      e.preventDefault();
      filterUnsorted.checked = true;
      applyFilters();
      break;
    case 's':
    case 'S':
      e.preventDefault();
      filterLiked.checked = true;
      applyFilters();
      break;
    case 'd':
    case 'D':
      e.preventDefault();
      filterDisliked.checked = true;
      applyFilters();
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      filterSuper.checked = true;
      applyFilters();
      break;
    case 'j':
    case 'J':
      e.preventDefault();
      moveToUnsorted();
      break;
    case 'g':
    case 'G':
      e.preventDefault();
      toggleGridMode();
      break;
    case 'i':
    case 'I':
      e.preventDefault();
      // Cycle: all -> video -> image -> all
      if (mediaTypeFilter === 'all') {
        mediaTypeFilter = 'video';
      } else if (mediaTypeFilter === 'video') {
        mediaTypeFilter = 'image';
      } else {
        mediaTypeFilter = 'all';
      }
      updateMediaTypeIndicator();
      applyFilters();
      break;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      e.preventDefault();
      moveToSubfolder(parseInt(key, 10));
      break;
    case '0':
      e.preventDefault();
      moveToSubfolder(0);
      break;
    case '?':
      e.preventDefault();
      takeScreenshot();
      break;
  }
});

// Take screenshot of current video frame
async function takeScreenshot() {
  if (filteredMedia.length === 0) return;
  const media = filteredMedia[currentIndex];

  // Only works for videos
  if (media.type !== 'video') return;

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

    showFeedback('screenshot');
  } catch (err) {
    console.error('Failed to save screenshot:', err);
  }
}

// Filter change handlers
filterUnsorted.addEventListener('change', applyFilters);
filterLiked.addEventListener('change', applyFilters);
filterDisliked.addEventListener('change', applyFilters);
filterSuper.addEventListener('change', applyFilters);

// Auto-scroll: advance to next media when current ends
videoPlayer.addEventListener('ended', () => {
  if (autoScrollMode) {
    nextMedia();
  }
});
