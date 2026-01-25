// Constants
const FEEDBACK_DURATION_MS = 300;
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const IMAGE_BASE_DURATION = 6000; // 6 seconds for images in auto-scroll

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

let allVideos = [];
let filteredVideos = [];
let currentIndex = 0;
let quickPreviewMode = true;
let halfSpeedMode = false;
let autoScrollMode = false;
let lastAction = null; // { video, previousStatus, previousParentHandle, previousSubfolder }
let imageAutoScrollTimer = null;
let mediaTypeFilter = 'all'; // 'all', 'video', 'image'

// Grid mode state
let gridMode = false;
let gridPageIndex = 0;        // Current page (0-based)
let hoveredSlotIndex = null;  // Which slot (0-8) mouse is over
let gridVideos = [];          // Array of video objects for current page (or null for empty/sorted)
let gridBlobUrls = [];        // For cleanup
let gridSessionMedia = [];    // Snapshot of filteredVideos for stable grid positions
const GRID_SIZE = 9;

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
const noVideos = document.getElementById('no-videos');
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

  await loadVideos();
}

// Load videos from all folders
async function loadVideos() {
  allVideos = [];

  // Load unsorted media from root
  for await (const entry of rootHandle.values()) {
    if (entry.kind === 'file' && isMediaFile(entry.name)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'unsorted',
        parentHandle: rootHandle,
        type: isVideoFile(entry.name) ? 'video' : 'image'
      });
    }
  }

  // Load liked media from main liked/ folder
  for await (const entry of likedHandle.values()) {
    if (entry.kind === 'file' && isMediaFile(entry.name)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'liked',
        parentHandle: likedHandle,
        type: isVideoFile(entry.name) ? 'video' : 'image',
        likedSubfolder: null
      });
    }
  }

  // Load liked media from numbered subfolders (1-9)
  for (let n = 1; n <= 9; n++) {
    try {
      const subfolderHandle = await likedHandle.getDirectoryHandle(String(n));
      for await (const entry of subfolderHandle.values()) {
        if (entry.kind === 'file' && isMediaFile(entry.name)) {
          allVideos.push({
            name: entry.name,
            handle: entry,
            status: 'liked',
            parentHandle: subfolderHandle,
            type: isVideoFile(entry.name) ? 'video' : 'image',
            likedSubfolder: n
          });
        }
      }
    } catch (err) {
      // Subfolder doesn't exist, skip it
    }
  }

  // Load disliked media
  for await (const entry of dislikedHandle.values()) {
    if (entry.kind === 'file' && isMediaFile(entry.name)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'disliked',
        parentHandle: dislikedHandle,
        type: isVideoFile(entry.name) ? 'video' : 'image'
      });
    }
  }

  // Load super media from main super/ folder
  for await (const entry of superHandle.values()) {
    if (entry.kind === 'file' && isMediaFile(entry.name)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'super',
        parentHandle: superHandle,
        type: isVideoFile(entry.name) ? 'video' : 'image',
        superSubfolder: null
      });
    }
  }

  // Load super media from numbered subfolders (1-9)
  for (let n = 1; n <= 9; n++) {
    try {
      const subfolderHandle = await superHandle.getDirectoryHandle(String(n));
      for await (const entry of subfolderHandle.values()) {
        if (entry.kind === 'file' && isMediaFile(entry.name)) {
          allVideos.push({
            name: entry.name,
            handle: entry,
            status: 'super',
            parentHandle: subfolderHandle,
            type: isVideoFile(entry.name) ? 'video' : 'image',
            superSubfolder: n
          });
        }
      }
    } catch (err) {
      // Subfolder doesn't exist, skip it
    }
  }

  // Sort by name
  allVideos.sort((a, b) => a.name.localeCompare(b.name));

  applyFilters();
}

// Apply filters
function applyFilters() {
  const selectedFilter = document.querySelector('input[name="filter"]:checked').value;

  filteredVideos = allVideos.filter(v => {
    if (v.status !== selectedFilter) return false;
    if (mediaTypeFilter === 'video' && v.type !== 'video') return false;
    if (mediaTypeFilter === 'image' && v.type !== 'image') return false;
    return true;
  });

  if (currentIndex >= filteredVideos.length) {
    currentIndex = Math.max(0, filteredVideos.length - 1);
  }

  if (gridMode) {
    // Refresh grid session snapshot with new filter results
    gridSessionMedia = filteredVideos.map(v => ({ ...v, sorted: false }));
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
  const selectedFilter = document.querySelector('input[name="filter"]:checked').value;
  filteredVideos = allVideos.filter(v => {
    if (v.status !== selectedFilter) return false;
    if (mediaTypeFilter === 'video' && v.type !== 'video') return false;
    if (mediaTypeFilter === 'image' && v.type !== 'image') return false;
    return true;
  });

  if (currentIndex >= filteredVideos.length) {
    currentIndex = Math.max(0, filteredVideos.length - 1);
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
  if (autoScrollMode && filteredVideos[currentIndex]?.type === 'image') {
    imageAutoScrollTimer = setTimeout(() => {
      nextVideo();
    }, getImageDuration());
  }
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

  if (filteredVideos.length === 0) {
    videoPlayer.src = '';
    imagePlayer.src = '';
    imagePlayer.style.display = 'none';
    videoPlayer.style.display = '';
    counter.textContent = '0 of 0';
    status.textContent = '';
    status.className = 'status';
    noVideos.classList.remove('hidden');
    clearImageTimer();
    return;
  }

  noVideos.classList.add('hidden');
  const media = filteredVideos[currentIndex];

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
      videoPlayer.playbackRate = quickPreviewMode ? 2 : (halfSpeedMode ? 0.5 : 1);
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

  counter.textContent = `${currentIndex + 1} of ${filteredVideos.length}`;

  // Show subfolder in status if applicable
  if (media.status === 'liked' && media.likedSubfolder) {
    status.textContent = `liked/${media.likedSubfolder}`;
  } else if (media.status === 'super' && media.superSubfolder) {
    status.textContent = `super/${media.superSubfolder}`;
  } else {
    status.textContent = media.status;
  }
  status.className = `status ${media.status}`;
}

// Show visual feedback
function showFeedback(type) {
  const symbols = { liked: '♥', disliked: '✗', super: '★', unsorted: '⟲', screenshot: '📷' };

  // Handle liked subfolders (e.g., 'liked/3')
  if (type.startsWith('liked/')) {
    const subfolderNum = type.split('/')[1];
    feedback.textContent = `♥${subfolderNum}`;
    feedback.className = 'feedback liked show';
  } else if (type.startsWith('super/')) {
    const subfolderNum = type.split('/')[1];
    feedback.textContent = `★${subfolderNum}`;
    feedback.className = 'feedback super show';
  } else {
    feedback.textContent = symbols[type] || '♥';
    feedback.className = `feedback ${type} show`;
  }

  setTimeout(() => {
    feedback.className = 'feedback';
  }, FEEDBACK_DURATION_MS);
}

// Navigate
function nextVideo() {
  clearImageTimer();
  if (filteredVideos.length === 0) return;
  currentIndex = (currentIndex + 1) % filteredVideos.length;
  updateDisplay();
}

function prevVideo() {
  clearImageTimer();
  if (filteredVideos.length === 0) return;
  currentIndex = (currentIndex - 1 + filteredVideos.length) % filteredVideos.length;
  updateDisplay();
}

// Move video to a target folder
async function moveVideo(video, targetHandle, newStatus) {
  try {
    // Get the file
    const file = await video.handle.getFile();

    // Create new file in target folder
    const newHandle = await targetHandle.getFileHandle(video.name, { create: true });
    const writable = await newHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Delete from original location
    await video.parentHandle.removeEntry(video.name);

    // Update video object
    video.handle = newHandle;
    video.parentHandle = targetHandle;
    video.status = newStatus;

    return true;
  } catch (err) {
    console.error('Failed to move video:', err);
    return false;
  }
}

// Like current video (or hovered video in grid mode)
async function likeVideo() {
  const video = getTargetVideoForAction();
  if (!video) return;
  if (video.status === 'liked') return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  const previousStatus = video.status;
  const previousParentHandle = video.parentHandle;
  const previousSubfolder = video.likedSubfolder || video.superSubfolder;

  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, 'liked');
  } else {
    showFeedback('liked');
  }

  const success = await moveVideo(video, likedHandle, 'liked');

  if (success) {
    video.likedSubfolder = null;
    video.superSubfolder = null;
    lastAction = { video, previousStatus, previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      // Mark item as sorted in the grid session snapshot
      const snapshotIndex = gridPageIndex * GRID_SIZE + slotIndex;
      if (gridSessionMedia[snapshotIndex]) {
        gridSessionMedia[snapshotIndex].sorted = true;
      }
      // Mark slot as sorted (null) in grid mode
      gridVideos[slotIndex] = null;
      const slot = gridSlots[slotIndex];
      slot.classList.add('empty');
      const videoEl = slot.querySelector('.grid-video');
      const imageEl = slot.querySelector('.grid-image');
      videoEl.src = '';
      videoEl.style.display = 'none';
      imageEl.src = '';
      imageEl.style.display = 'none';
      slot.querySelector('.grid-status').textContent = '';
      applyFiltersKeepGrid();
      checkGridAutoAdvance();
    } else {
      const nextUnsortedIndex = findNextUnsortedIndex();
      applyFilters();
      if (nextUnsortedIndex !== -1) {
        const nextVideo = allVideos[nextUnsortedIndex];
        currentIndex = filteredVideos.findIndex(v => v.name === nextVideo.name);
        if (currentIndex === -1) currentIndex = 0;
      }
      updateDisplay();
    }
  }
}

// Dislike current video (or hovered video in grid mode)
async function dislikeVideo() {
  const video = getTargetVideoForAction();
  if (!video) return;
  if (video.status === 'disliked') return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  const previousStatus = video.status;
  const previousParentHandle = video.parentHandle;
  const previousSubfolder = video.likedSubfolder || video.superSubfolder;

  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, 'disliked');
  } else {
    showFeedback('disliked');
  }

  const success = await moveVideo(video, dislikedHandle, 'disliked');

  if (success) {
    video.likedSubfolder = null;
    video.superSubfolder = null;
    lastAction = { video, previousStatus, previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      // Mark item as sorted in the grid session snapshot
      const snapshotIndex = gridPageIndex * GRID_SIZE + slotIndex;
      if (gridSessionMedia[snapshotIndex]) {
        gridSessionMedia[snapshotIndex].sorted = true;
      }
      // Mark slot as sorted (null) in grid mode
      gridVideos[slotIndex] = null;
      const slot = gridSlots[slotIndex];
      slot.classList.add('empty');
      const videoEl = slot.querySelector('.grid-video');
      const imageEl = slot.querySelector('.grid-image');
      videoEl.src = '';
      videoEl.style.display = 'none';
      imageEl.src = '';
      imageEl.style.display = 'none';
      slot.querySelector('.grid-status').textContent = '';
      applyFiltersKeepGrid();
      checkGridAutoAdvance();
    } else {
      const nextUnsortedIndex = findNextUnsortedIndex();
      applyFilters();
      if (nextUnsortedIndex !== -1) {
        const nextVideo = allVideos[nextUnsortedIndex];
        currentIndex = filteredVideos.findIndex(v => v.name === nextVideo.name);
        if (currentIndex === -1) currentIndex = 0;
      }
      updateDisplay();
    }
  }
}

// Super like current video (or hovered video in grid mode)
async function superLikeVideo() {
  const video = getTargetVideoForAction();
  if (!video) return;
  if (video.status === 'super') return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  const previousStatus = video.status;
  const previousParentHandle = video.parentHandle;
  const previousSubfolder = video.likedSubfolder || video.superSubfolder;

  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, 'super');
  } else {
    showFeedback('super');
  }

  const success = await moveVideo(video, superHandle, 'super');

  if (success) {
    video.likedSubfolder = null;
    video.superSubfolder = null;
    lastAction = { video, previousStatus, previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      // Mark item as sorted in the grid session snapshot
      const snapshotIndex = gridPageIndex * GRID_SIZE + slotIndex;
      if (gridSessionMedia[snapshotIndex]) {
        gridSessionMedia[snapshotIndex].sorted = true;
      }
      // Mark slot as sorted (null) in grid mode
      gridVideos[slotIndex] = null;
      const slot = gridSlots[slotIndex];
      slot.classList.add('empty');
      const videoEl = slot.querySelector('.grid-video');
      const imageEl = slot.querySelector('.grid-image');
      videoEl.src = '';
      videoEl.style.display = 'none';
      imageEl.src = '';
      imageEl.style.display = 'none';
      slot.querySelector('.grid-status').textContent = '';
      applyFiltersKeepGrid();
      checkGridAutoAdvance();
    } else {
      const nextUnsortedIndex = findNextUnsortedIndex();
      applyFilters();
      if (nextUnsortedIndex !== -1) {
        const nextVideo = allVideos[nextUnsortedIndex];
        currentIndex = filteredVideos.findIndex(v => v.name === nextVideo.name);
        if (currentIndex === -1) currentIndex = 0;
      }
      updateDisplay();
    }
  }
}

// Move current video back to unsorted (root folder)
async function moveToUnsorted() {
  const video = getTargetVideoForAction();
  if (!video) return;
  if (video.status === 'unsorted') return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  const previousStatus = video.status;
  const previousParentHandle = video.parentHandle;
  const previousSubfolder = video.likedSubfolder || video.superSubfolder;

  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, 'unsorted');
  } else {
    showFeedback('unsorted');
  }

  const success = await moveVideo(video, rootHandle, 'unsorted');

  if (success) {
    video.likedSubfolder = null;
    video.superSubfolder = null;
    lastAction = { video, previousStatus, previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      // Mark item as sorted in the grid session snapshot
      const snapshotIndex = gridPageIndex * GRID_SIZE + slotIndex;
      if (gridSessionMedia[snapshotIndex]) {
        gridSessionMedia[snapshotIndex].sorted = true;
      }
      // Mark slot as sorted (null) in grid mode
      gridVideos[slotIndex] = null;
      const slot = gridSlots[slotIndex];
      slot.classList.add('empty');
      const videoEl = slot.querySelector('.grid-video');
      const imageEl = slot.querySelector('.grid-image');
      videoEl.src = '';
      videoEl.style.display = 'none';
      imageEl.src = '';
      imageEl.style.display = 'none';
      slot.querySelector('.grid-status').textContent = '';
      applyFiltersKeepGrid();
      checkGridAutoAdvance();
    } else {
      applyFilters();
      updateDisplay();
    }
  }
}

// Move liked video to a numbered subfolder (1-9) or back to parent liked/ (0)
async function moveToLikedSubfolder(n) {
  const video = getTargetVideoForAction();
  if (!video) return;

  // Only works on liked videos
  if (video.status !== 'liked') return;

  // Prevent no-op moves
  if (n === 0 && video.likedSubfolder === null) return;
  if (n > 0 && video.likedSubfolder === n) return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  // Save state for undo
  const previousSubfolder = video.likedSubfolder;
  const previousParentHandle = video.parentHandle;

  // Get target folder handle
  let targetHandle;
  if (n === 0) {
    targetHandle = likedHandle;
  } else {
    // Create subfolder if needed
    targetHandle = await likedHandle.getDirectoryHandle(String(n), { create: true });
  }

  // Show feedback
  const feedbackType = n === 0 ? 'liked' : `liked/${n}`;
  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, feedbackType);
  } else {
    showFeedback(feedbackType);
  }

  // Move the video (status stays 'liked')
  const success = await moveVideo(video, targetHandle, 'liked');
  if (success) {
    video.likedSubfolder = (n === 0) ? null : n;
    lastAction = { video, previousStatus: 'liked', previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      // Update status badge in grid
      const slot = gridSlots[slotIndex];
      const statusEl = slot.querySelector('.grid-status');
      if (n === 0) {
        statusEl.textContent = '♥';
      } else {
        statusEl.textContent = `♥${n}`;
      }
      statusEl.className = 'grid-status liked';
    } else {
      nextVideo();
    }
  }
}

// Move super video to a numbered subfolder (1-9) or back to parent super/ (0)
async function moveToSuperSubfolder(n) {
  const video = getTargetVideoForAction();
  if (!video) return;

  // Only works on super videos
  if (video.status !== 'super') return;

  // Prevent no-op moves
  if (n === 0 && video.superSubfolder === null) return;
  if (n > 0 && video.superSubfolder === n) return;

  const slotIndex = gridMode ? hoveredSlotIndex : null;

  // Save state for undo
  const previousSubfolder = video.superSubfolder;
  const previousParentHandle = video.parentHandle;

  // Get target folder handle
  let targetHandle;
  if (n === 0) {
    targetHandle = superHandle;
  } else {
    // Create subfolder if needed
    targetHandle = await superHandle.getDirectoryHandle(String(n), { create: true });
  }

  // Show feedback
  const feedbackType = n === 0 ? 'super' : `super/${n}`;
  if (gridMode && slotIndex !== null) {
    showGridFeedback(slotIndex, feedbackType);
  } else {
    showFeedback(feedbackType);
  }

  // Move the video (status stays 'super')
  const success = await moveVideo(video, targetHandle, 'super');
  if (success) {
    video.superSubfolder = (n === 0) ? null : n;
    lastAction = { video, previousStatus: 'super', previousParentHandle, previousSubfolder };

    if (gridMode && slotIndex !== null) {
      // Update status badge in grid
      const slot = gridSlots[slotIndex];
      const statusEl = slot.querySelector('.grid-status');
      if (n === 0) {
        statusEl.textContent = '★';
      } else {
        statusEl.textContent = `★${n}`;
      }
      statusEl.className = 'grid-status super';
    } else {
      nextVideo();
    }
  }
}

// Undo - restore last moved video to its previous state and navigate to it
async function undoVideo() {
  if (!lastAction) return;

  const { video, previousStatus, previousParentHandle, previousSubfolder } = lastAction;
  const videoName = video.name;

  const success = await moveVideo(video, previousParentHandle, previousStatus);
  if (success) {
    // Restore subfolder state for liked/super videos
    if (previousStatus === 'liked') {
      video.likedSubfolder = previousSubfolder;
      video.superSubfolder = null;
    } else if (previousStatus === 'super') {
      video.superSubfolder = previousSubfolder;
      video.likedSubfolder = null;
    } else {
      video.likedSubfolder = null;
      video.superSubfolder = null;
    }

    lastAction = null;

    // Switch to the filter for the previous status so we can see the video
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

    // Find and switch to the undone video
    const newIndex = filteredVideos.findIndex(v => v.name === videoName);
    if (newIndex !== -1) {
      currentIndex = newIndex;
    }
    updateDisplay();
  }
}

// Find next unsorted video index in allVideos
function findNextUnsortedIndex() {
  const currentName = filteredVideos[currentIndex]?.name;
  const currentAllIndex = allVideos.findIndex(v => v.name === currentName);

  for (let i = currentAllIndex + 1; i < allVideos.length; i++) {
    if (allVideos[i].status === 'unsorted') return i;
  }
  for (let i = 0; i < currentAllIndex; i++) {
    if (allVideos[i].status === 'unsorted') return i;
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
    gridSessionMedia = filteredVideos.map(v => ({ ...v, sorted: false }));
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
  const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredVideos;

  if (sourceMedia.length === 0) {
    noVideos.classList.remove('hidden');
    gridView.classList.add('hidden');
    singleView.classList.add('hidden');
    return;
  }

  noVideos.classList.add('hidden');
  gridView.classList.remove('hidden');
  singleView.classList.add('hidden');

  // Clean up previous blob URLs
  cleanupGridBlobUrls();

  const startIndex = gridPageIndex * GRID_SIZE;
  gridVideos = [];

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
        gridVideos[i] = null;
        slot.classList.add('empty');
        videoEl.src = '';
        videoEl.style.display = 'none';
        imageEl.src = '';
        imageEl.style.display = 'none';
        statusEl.textContent = '';
        statusEl.className = 'grid-status';
        continue;
      }

      // Find the actual video object in allVideos (it may have been moved)
      const media = allVideos.find(v => v.name === mediaSnapshot.name) || mediaSnapshot;
      gridVideos[i] = media;

      try {
        const file = await media.handle.getFile();
        const url = URL.createObjectURL(file);
        gridBlobUrls.push(url);

        if (media.type === 'video') {
          imageEl.style.display = 'none';
          imageEl.src = '';
          videoEl.style.display = '';
          videoEl.src = url;
          videoEl.playbackRate = quickPreviewMode ? 2 : (halfSpeedMode ? 0.5 : 1);
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
        if (media.status === 'liked' && media.likedSubfolder) {
          statusEl.textContent = `♥${media.likedSubfolder}`;
          statusEl.className = 'grid-status liked';
        } else if (media.status === 'super' && media.superSubfolder) {
          statusEl.textContent = `★${media.superSubfolder}`;
          statusEl.className = 'grid-status super';
        } else {
          statusEl.textContent = '';
          statusEl.className = 'grid-status';
        }
      } catch (err) {
        console.error('Failed to load media for grid:', err);
        gridVideos[i] = null;
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
      gridVideos[i] = null;
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
  const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredVideos;
  const totalPages = Math.ceil(sourceMedia.length / GRID_SIZE);
  if (totalPages === 0) return;
  gridPageIndex = (gridPageIndex + 1) % totalPages;
  updateGridDisplay();
}

// Navigate to previous page in grid mode
function prevGridPage() {
  const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredVideos;
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
      if (gridVideos[index] === null) return;

      // Find the clicked video's index in filteredVideos by name
      const clickedVideo = gridVideos[index];
      const videoIndex = filteredVideos.findIndex(v => v.name === clickedVideo.name);
      if (videoIndex !== -1) {
        currentIndex = videoIndex;
      } else {
        // Fallback: use position-based index
        currentIndex = Math.min(gridPageIndex * GRID_SIZE + index, filteredVideos.length - 1);
      }
      toggleGridMode(); // Switch back to single view
    });
  });
}

// Get the target video for sorting actions (grid-aware)
function getTargetVideoForAction() {
  if (gridMode) {
    if (hoveredSlotIndex === null) return null;
    return gridVideos[hoveredSlotIndex] || null;
  } else {
    if (filteredVideos.length === 0) return null;
    return filteredVideos[currentIndex];
  }
}

// Show feedback on grid slot
function showGridFeedback(slotIndex, type) {
  const slot = gridSlots[slotIndex];
  const feedbackEl = slot.querySelector('.grid-feedback');
  const symbols = { liked: '♥', disliked: '✗', super: '★', unsorted: '⟲' };

  if (type.startsWith('liked/')) {
    const subfolderNum = type.split('/')[1];
    feedbackEl.textContent = `♥${subfolderNum}`;
    feedbackEl.className = 'grid-feedback feedback liked show';
  } else if (type.startsWith('super/')) {
    const subfolderNum = type.split('/')[1];
    feedbackEl.textContent = `★${subfolderNum}`;
    feedbackEl.className = 'grid-feedback feedback super show';
  } else {
    feedbackEl.textContent = symbols[type] || '♥';
    feedbackEl.className = `grid-feedback feedback ${type} show`;
  }

  setTimeout(() => {
    feedbackEl.className = 'grid-feedback feedback';
  }, FEEDBACK_DURATION_MS);
}

// Check if all grid videos are sorted (null) and auto-advance
function checkGridAutoAdvance() {
  const allNull = gridVideos.every(v => v === null);
  if (allNull) {
    const sourceMedia = gridSessionMedia.length > 0 ? gridSessionMedia : filteredVideos;
    const totalPages = Math.ceil(sourceMedia.length / GRID_SIZE);
    if (totalPages > 0) {
      gridPageIndex = (gridPageIndex + 1) % totalPages;
      updateGridDisplay();
    } else {
      // No videos left
      updateGridDisplay();
    }
  }
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
        nextVideo();
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (gridMode) {
        prevGridPage();
      } else {
        prevVideo();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      likeVideo();
      break;
    case "'":
      e.preventDefault();
      superLikeVideo();
      break;
    case 'ArrowDown':
      e.preventDefault();
      dislikeVideo();
      break;
    case 'u':
    case 'U':
      e.preventDefault();
      undoVideo();
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
      videoPlayer.playbackRate = quickPreviewMode ? 2 : (halfSpeedMode ? 0.5 : 1);
      if (filteredVideos[currentIndex]?.type === 'image') {
        startImageTimer();
      }
      break;
    case ',':
      e.preventDefault();
      halfSpeedMode = !halfSpeedMode;
      if (halfSpeedMode) quickPreviewMode = false;
      shortcutHalfSpeed.classList.toggle('active', halfSpeedMode);
      shortcut2xSpeed.classList.toggle('active', quickPreviewMode);
      videoPlayer.playbackRate = halfSpeedMode ? 0.5 : (quickPreviewMode ? 2 : 1);
      if (filteredVideos[currentIndex]?.type === 'image') {
        startImageTimer();
      }
      break;
    case 'n':
    case 'N':
      e.preventDefault();
      autoScrollMode = !autoScrollMode;
      shortcutAutoscroll.classList.toggle('active', autoScrollMode);
      videoPlayer.loop = !autoScrollMode;
      if (autoScrollMode && filteredVideos[currentIndex]?.type === 'image') {
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
      {
        const video = getTargetVideoForAction();
        if (video) {
          if (video.status === 'liked') {
            moveToLikedSubfolder(parseInt(key));
          } else if (video.status === 'super') {
            moveToSuperSubfolder(parseInt(key));
          }
        }
      }
      break;
    case '0':
      e.preventDefault();
      {
        const video = getTargetVideoForAction();
        if (video) {
          if (video.status === 'liked') {
            moveToLikedSubfolder(0);
          } else if (video.status === 'super') {
            moveToSuperSubfolder(0);
          }
        }
      }
      break;
    case '?':
      e.preventDefault();
      takeScreenshot();
      break;
  }
});



// Take screenshot of current video frame
async function takeScreenshot() {
  if (filteredVideos.length === 0) return;
  const video = filteredVideos[currentIndex];

  // Create canvas and draw current frame
  const canvas = document.createElement('canvas');
  canvas.width = videoPlayer.videoWidth;
  canvas.height = videoPlayer.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoPlayer, 0, 0);

  // Convert to blob
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

  // Generate filename: video.mp4 -> video_screenshot.png
  const baseName = video.name.replace(/\.[^.]+$/, '');
  const screenshotName = `${baseName}_screenshot.png`;

  try {
    // Save to same folder as video
    const fileHandle = await video.parentHandle.getFileHandle(screenshotName, { create: true });
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

// Auto-scroll: advance to next video when current ends
videoPlayer.addEventListener('ended', () => {
  if (autoScrollMode) {
    nextVideo();
  }
});
