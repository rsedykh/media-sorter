// Interactive sorting demo in the hero: a miniature of the app's unsorted view
(() => {
  const PHOTO_COUNT = 9;
  const FEEDBACK_SYMBOLS = { liked: '♥', disliked: '✗', super: '★', undo: '⟲' };
  const KEY_ACTIONS = { ArrowUp: 'liked', ArrowDown: 'disliked', Quote: 'super', KeyU: 'undo' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const demo = document.getElementById('demo');
  const stage = document.getElementById('demo-stage');
  const counter = document.getElementById('demo-count');
  const feedback = document.getElementById('demo-feedback');
  const done = document.getElementById('demo-done');
  const bins = Object.fromEntries(
    [...demo.querySelectorAll('.bin')].map(el => [el.dataset.bin, el])
  );
  const buttons = Object.fromEntries(
    [...demo.querySelectorAll('[data-action]')].map(el => [el.dataset.action, el])
  );

  const items = Array.from({ length: PHOTO_COUNT }, (_, i) => ({
    src: `img/photo-${i + 1}.webp`,
    status: null
  }));
  const history = [];
  let front = null;
  let behind = null;
  let visible = false;

  const unsorted = () => items.filter(item => !item.status);

  function makeCard(item, isBehind) {
    const card = document.createElement('div');
    card.className = 'demo-card' + (isBehind ? ' behind' : '');
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = '';
    card.appendChild(img);
    // insert below the front card so it stays on top
    stage.insertBefore(card, front || feedback);
    return card;
  }

  // Rebuild the front/behind cards from the current state
  function renderStage() {
    front?.remove();
    behind?.remove();
    front = behind = null;
    const [first, second] = unsorted();
    if (second) behind = makeCard(second, true);
    if (first) front = makeCard(first, false);
    updateCounts();
  }

  function updateCounts() {
    const left = unsorted().length;
    counter.textContent = left ? `1 of ${left}` : '0 of 0';
    for (const [status, el] of Object.entries(bins)) {
      el.querySelector('.bin-n').textContent = items.filter(i => i.status === status).length;
    }
    done.classList.toggle('hidden', left > 0);
  }

  function showFeedback(type) {
    feedback.textContent = FEEDBACK_SYMBOLS[type];
    feedback.className = `demo-feedback ${type}`;
    void feedback.offsetWidth; // restart the animation
    feedback.classList.add('show');
  }

  function bump(status) {
    const bin = bins[status];
    bin.classList.remove('bump');
    void bin.offsetWidth;
    bin.classList.add('bump');
  }

  // Transform that moves a card from its resting place into a bin
  function toBin(card, status) {
    const c = card.getBoundingClientRect();
    const b = bins[status].getBoundingClientRect();
    const dx = b.left + b.width / 2 - (c.left + c.width / 2);
    const dy = b.top + b.height / 2 - (c.top + c.height / 2);
    return `translate(${dx}px, ${dy}px) scale(0.12)`;
  }

  function sort(status) {
    const [item] = unsorted();
    if (!item) return;

    item.status = status;
    history.push(item);
    showFeedback(status);
    bump(status);

    const leaving = front;
    if (!reduceMotion && leaving.animate) {
      leaving.style.zIndex = 4;
      leaving.animate(
        [{ transform: 'none', opacity: 1 }, { transform: toBin(leaving, status), opacity: 0.2 }],
        { duration: 380, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' }
      ).onfinish = () => leaving.remove();
    } else {
      leaving.remove();
    }

    front = behind;
    front?.classList.remove('behind');
    const next = unsorted()[1];
    behind = next ? makeCard(next, true) : null;
    updateCounts();
  }

  function undo() {
    const item = history.pop();
    if (!item) return;
    const status = item.status;
    item.status = null;
    showFeedback('undo');
    renderStage();
    if (!reduceMotion && front.animate) {
      front.animate(
        [{ transform: toBin(front, status), opacity: 0.2 }, { transform: 'none', opacity: 1 }],
        { duration: 320, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }
      );
    }
  }

  function run(action) {
    if (action === 'undo') undo();
    else sort(action);
  }

  function flashButton(action) {
    const button = buttons[action];
    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), 150);
  }

  for (const [action, button] of Object.entries(buttons)) {
    button.addEventListener('click', () => run(action));
  }

  document.getElementById('demo-reset').addEventListener('click', () => {
    items.forEach(item => { item.status = null; });
    history.length = 0;
    renderStage();
  });

  // Only take over the keys while the demo is on screen and has something to sort,
  // so arrow-key scrolling keeps working everywhere else
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }, { threshold: 0.6 }).observe(demo);

  document.addEventListener('keydown', (e) => {
    if (!visible || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    if (action !== 'undo' && !unsorted().length) return;
    e.preventDefault();
    flashButton(action);
    run(action);
  });

  renderStage();
})();
