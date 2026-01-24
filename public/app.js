// Constants
const FEEDBACK_DURATION_MS = 300;
const VIDEO_EXTENSION = '.mp4';

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

// DOM elements
const pickerScreen = document.getElementById('picker-screen');
const appScreen = document.getElementById('app-screen');
const pickFolderBtn = document.getElementById('pick-folder');
const dropZone = document.getElementById('drop-zone');
const folderNameEl = document.getElementById('folder-name');
const videoPlayer = document.getElementById('video-player');
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

  // Load unsorted videos from root
  for await (const entry of rootHandle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith(VIDEO_EXTENSION)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'unsorted',
        parentHandle: rootHandle
      });
    }
  }

  // Load liked videos from main liked/ folder
  for await (const entry of likedHandle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith(VIDEO_EXTENSION)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'liked',
        parentHandle: likedHandle,
        likedSubfolder: null
      });
    }
  }

  // Load liked videos from numbered subfolders (1-9)
  for (let n = 1; n <= 9; n++) {
    try {
      const subfolderHandle = await likedHandle.getDirectoryHandle(String(n));
      for await (const entry of subfolderHandle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith(VIDEO_EXTENSION)) {
          allVideos.push({
            name: entry.name,
            handle: entry,
            status: 'liked',
            parentHandle: subfolderHandle,
            likedSubfolder: n
          });
        }
      }
    } catch (err) {
      // Subfolder doesn't exist, skip it
    }
  }

  // Load disliked videos
  for await (const entry of dislikedHandle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith(VIDEO_EXTENSION)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'disliked',
        parentHandle: dislikedHandle
      });
    }
  }

  // Load super videos
  for await (const entry of superHandle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith(VIDEO_EXTENSION)) {
      allVideos.push({
        name: entry.name,
        handle: entry,
        status: 'super',
        parentHandle: superHandle
      });
    }
  }

  // Sort by name
  allVideos.sort((a, b) => a.name.localeCompare(b.name));

  applyFilters();
}

// Apply filters
function applyFilters() {
  const activeFilters = {
    unsorted: filterUnsorted.checked,
    liked: filterLiked.checked,
    disliked: filterDisliked.checked,
    super: filterSuper.checked
  };

  filteredVideos = allVideos.filter(v => activeFilters[v.status]);

  if (currentIndex >= filteredVideos.length) {
    currentIndex = Math.max(0, filteredVideos.length - 1);
  }

  updateDisplay();
}

// Update video display
async function updateDisplay() {
  if (filteredVideos.length === 0) {
    videoPlayer.src = '';
    counter.textContent = '0 of 0';
    status.textContent = '';
    status.className = 'status';
    noVideos.classList.remove('hidden');
    return;
  }

  noVideos.classList.add('hidden');
  const video = filteredVideos[currentIndex];

  try {
    const file = await video.handle.getFile();
    const url = URL.createObjectURL(file);

    // Revoke previous URL to avoid memory leaks
    if (videoPlayer.src && videoPlayer.src.startsWith('blob:')) {
      URL.revokeObjectURL(videoPlayer.src);
    }

    videoPlayer.src = url;
    videoPlayer.playbackRate = quickPreviewMode ? 2 : (halfSpeedMode ? 0.5 : 1);
    videoPlayer.play().catch(() => {});
  } catch (err) {
    console.error('Failed to load video:', err);
  }

  counter.textContent = `${currentIndex + 1} of ${filteredVideos.length}`;

  // Show subfolder in status if applicable
  if (video.status === 'liked' && video.likedSubfolder) {
    status.textContent = `liked/${video.likedSubfolder}`;
  } else {
    status.textContent = video.status;
  }
  status.className = `status ${video.status}`;
}

// Show visual feedback
function showFeedback(type) {
  const symbols = { liked: '♥', disliked: '✗', super: '★', screenshot: '📷' };

  // Handle liked subfolders (e.g., 'liked/3')
  if (type.startsWith('liked/')) {
    const subfolderNum = type.split('/')[1];
    feedback.textContent = `♥${subfolderNum}`;
    feedback.className = 'feedback liked show';
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
  if (filteredVideos.length === 0) return;
  currentIndex = (currentIndex + 1) % filteredVideos.length;
  updateDisplay();
}

function prevVideo() {
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

// Get folder handle from status
function getHandleForStatus(status) {
  switch (status) {
    case 'liked': return likedHandle;
    case 'disliked': return dislikedHandle;
    case 'super': return superHandle;
    default: return rootHandle;
  }
}

// Like current video
async function likeVideo() {
  if (filteredVideos.length === 0) return;
  const video = filteredVideos[currentIndex];
  if (video.status === 'liked') return;

  const previousStatus = video.status;
  const previousParentHandle = video.parentHandle;
  const previousSubfolder = video.likedSubfolder;

  showFeedback('liked');
  const success = await moveVideo(video, likedHandle, 'liked');

  if (success) {
    video.likedSubfolder = null;
    lastAction = { video, previousStatus, previousParentHandle, previousSubfolder };
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

// Dislike current video
async function dislikeVideo() {
  if (filteredVideos.length === 0) return;
  const video = filteredVideos[currentIndex];
  if (video.status === 'disliked') return;

  const previousStatus = video.status;
  const previousParentHandle = video.parentHandle;
  const previousSubfolder = video.likedSubfolder;

  showFeedback('disliked');
  const success = await moveVideo(video, dislikedHandle, 'disliked');

  if (success) {
    video.likedSubfolder = null;
    lastAction = { video, previousStatus, previousParentHandle, previousSubfolder };
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

// Super like current video
async function superLikeVideo() {
  if (filteredVideos.length === 0) return;
  const video = filteredVideos[currentIndex];
  if (video.status === 'super') return;

  const previousStatus = video.status;
  const previousParentHandle = video.parentHandle;
  const previousSubfolder = video.likedSubfolder;

  showFeedback('super');
  const success = await moveVideo(video, superHandle, 'super');

  if (success) {
    video.likedSubfolder = null;
    lastAction = { video, previousStatus, previousParentHandle, previousSubfolder };
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

// Move liked video to a numbered subfolder (1-9) or back to parent liked/ (0)
async function moveToLikedSubfolder(n) {
  if (filteredVideos.length === 0) return;
  const video = filteredVideos[currentIndex];

  // Only works on liked videos
  if (video.status !== 'liked') return;

  // Prevent no-op moves
  if (n === 0 && video.likedSubfolder === null) return;
  if (n > 0 && video.likedSubfolder === n) return;

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
  showFeedback(n === 0 ? 'liked' : `liked/${n}`);

  // Move the video (status stays 'liked')
  const success = await moveVideo(video, targetHandle, 'liked');
  if (success) {
    video.likedSubfolder = (n === 0) ? null : n;
    lastAction = { video, previousStatus: 'liked', previousParentHandle, previousSubfolder };
    nextVideo();
  }
}

// Undo - restore last moved video to its previous state and navigate to it
async function undoVideo() {
  if (!lastAction) return;

  const { video, previousStatus, previousParentHandle, previousSubfolder } = lastAction;
  const videoName = video.name;

  const success = await moveVideo(video, previousParentHandle, previousStatus);
  if (success) {
    // Restore subfolder state for liked videos
    if (previousStatus === 'liked') {
      video.likedSubfolder = previousSubfolder;
    }

    lastAction = null;

    // Enable the filter for the previous status so we can see the video
    const filterCheckbox = {
      'unsorted': filterUnsorted,
      'liked': filterLiked,
      'disliked': filterDisliked,
      'super': filterSuper
    }[previousStatus];
    if (filterCheckbox && !filterCheckbox.checked) {
      filterCheckbox.checked = true;
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

// Keyboard controls
document.addEventListener('keydown', (e) => {
  // Ignore if picker screen is visible
  if (!pickerScreen.classList.contains('hidden')) return;

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault();
      nextVideo();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      prevVideo();
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
      if (videoPlayer.paused) {
        videoPlayer.play();
        shortcutPause.classList.remove('active');
      } else {
        videoPlayer.pause();
        shortcutPause.classList.add('active');
      }
      break;
    case '.':
      e.preventDefault();
      quickPreviewMode = !quickPreviewMode;
      if (quickPreviewMode) halfSpeedMode = false;
      shortcut2xSpeed.classList.toggle('active', quickPreviewMode);
      shortcutHalfSpeed.classList.toggle('active', halfSpeedMode);
      videoPlayer.playbackRate = quickPreviewMode ? 2 : (halfSpeedMode ? 0.5 : 1);
      break;
    case ',':
      e.preventDefault();
      halfSpeedMode = !halfSpeedMode;
      if (halfSpeedMode) quickPreviewMode = false;
      shortcutHalfSpeed.classList.toggle('active', halfSpeedMode);
      shortcut2xSpeed.classList.toggle('active', quickPreviewMode);
      videoPlayer.playbackRate = halfSpeedMode ? 0.5 : (quickPreviewMode ? 2 : 1);
      break;
    case 'n':
    case 'N':
      e.preventDefault();
      autoScrollMode = !autoScrollMode;
      shortcutAutoscroll.classList.toggle('active', autoScrollMode);
      videoPlayer.loop = !autoScrollMode;
      break;
    case 'a':
    case 'A':
      e.preventDefault();
      filterUnsorted.checked = !filterUnsorted.checked;
      applyFilters();
      break;
    case 's':
    case 'S':
      e.preventDefault();
      filterLiked.checked = !filterLiked.checked;
      applyFilters();
      break;
    case 'd':
    case 'D':
      e.preventDefault();
      filterDisliked.checked = !filterDisliked.checked;
      applyFilters();
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      filterSuper.checked = !filterSuper.checked;
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
      moveToLikedSubfolder(parseInt(e.key));
      break;
    case '0':
      e.preventDefault();
      moveToLikedSubfolder(0);
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
