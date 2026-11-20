'use strict';
(function () {
  const data = window.REPAIR_LIBRARY;
  const byId = new Map(data.videos.map(function (v) { return [v.id, v]; }));
  const player = document.getElementById('player');
  const search = document.getElementById('search');
  const system = document.getElementById('system');
  const grid = document.getElementById('video-grid');
  const list = document.getElementById('topic-list');
  const empty = document.getElementById('empty');
  const watchSection = document.getElementById('watch-section');
  const collection = document.querySelector('.collection');
  let current = null;
  let watching = false;
  let view = 'saved';
  let returnView = 'saved';
  const approvals = window.REPAIR_APPROVALS;
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function time(seconds) { const total = Math.round(seconds); return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0'); }
  function quality(video) { return video.resolution || '1080p'; }
  function draft(video) { return video.stage === 'review_draft'; }
  function draftLabel(video) { return video.take_label || 'Review draft'; }
  const remaining = data.topics.filter(function (topic) { return !topic.video_id; }).length;
  document.querySelector('.sidebar [data-view="saved"] .nav-count').textContent = data.videos.length;
  document.querySelector('.view-tabs [data-view="saved"] span').textContent = data.videos.length;
  document.querySelector('.view-tabs [data-view="planned"] span').textContent = remaining;
  document.getElementById('stat-video-count').textContent = String(data.videos.length).padStart(2, '0');
  document.getElementById('stat-remaining-count').textContent = remaining;
  function queryMatches(name, category) { return (name + ' ' + category).toLowerCase().includes(search.value.trim().toLowerCase()) && (!system.value || system.value === category); }
  function openCollection(nextView, clearFilters) {
    if (clearFilters) { search.value = ''; system.value = ''; }
    const hash = '#' + (nextView === 'ready' ? 'ready-for-approval' : nextView === 'needs-work' ? 'needs-work' : nextView === 'all' ? 'topics' : nextView === 'planned' ? 'to-build' : 'saved');
    if (location.hash === hash) readHash(); else location.hash = hash;
  }
  data.categories.forEach(function (category) { const option = el('option', '', category); option.value = category; system.appendChild(option); });
  function renderSaved() {
    grid.replaceChildren();
    const shown = data.videos.filter(function (v) { return queryMatches(v.title + ' ' + v.topic, v.category) && (view !== 'ready' || approvals.state(v) === 'ready') && (view !== 'needs-work' || approvals.state(v) === 'needs_work'); });
    if (view === 'ready') shown.reverse();
    shown.forEach(function (v) {
      const card = el('a', 'video-card');
      card.href = '#watch/' + v.id; card.dataset.videoId = v.id;
      card.setAttribute('aria-label', 'Open ' + v.title + ', ' + time(v.duration) + ', ' + v.version);
      const imageWrap = el('div', 'card-image'); const image = el('img'); image.src = v.poster; image.alt = ''; image.loading = 'lazy'; image.width = 1280; image.height = 720;
      imageWrap.append(image, el('span', 'card-duration', time(v.duration)), el('span', 'card-play', '▶'));
      const copy = el('div', 'card-copy'); const bottom = el('div', 'card-footer'); bottom.append(el('span', 'saved-badge' + (draft(v) ? ' draft-badge' : ''), ['approved','needs_work','ready'].includes(approvals.state(v)) ? approvals.label(v) : draft(v) ? draftLabel(v) : 'Video saved'), el('span', '', v.version + ' · ' + quality(v)));
      card.dataset.reviewState = approvals.state(v);
      copy.append(el('div', 'card-category', v.category), el('h3', '', v.title), bottom); card.append(imageWrap, copy);
      grid.append(card);
    });
    return shown.length;
  }
  function renderTopics() {
    list.replaceChildren();
    const shown = data.topics.filter(function (t) { return queryMatches(t.name, t.category) && (view !== 'planned' || !t.video_id); });
    data.categories.forEach(function (category) {
      const items = shown.filter(function (t) { return t.category === category; });
      if (!items.length) return;
      const details = el('details', 'topic-group'); details.open = !!search.value.trim() || !!system.value || category === 'Brakes';
      const summary = el('summary'); summary.append(el('span', '', category), el('span', 'group-count', String(items.length))); details.append(summary);
      items.forEach(function (t) {
        const row = el('div', 'topic-row'); row.dataset.topicId = t.id;
        row.append(el('span', '', t.name));
        if (t.video_id) {
          const button = el('a', 'topic-watch', 'Watch video ↗'); button.href = '#watch/' + t.video_id;
          button.setAttribute('aria-label', 'Watch ' + byId.get(t.video_id).title);
          row.append(button);
        } else { row.append(el('span', 'topic-status' + (t.status === 'Name pending' ? ' pending' : ''), t.status)); }
        details.append(row);
      });
      list.append(details);
    });
    return shown.length;
  }
  function render() {
    const saved = ['saved','ready','needs-work'].includes(view);
    document.querySelectorAll('[data-view=ready] .nav-count,[data-view=ready] span:not(.nav-icon)').forEach(node => {node.textContent = approvals.loaded ? data.videos.filter(v => approvals.state(v) === 'ready').length : '—';});
    document.querySelectorAll('[data-view=needs-work] span').forEach(node => {node.textContent = approvals.loaded ? data.videos.filter(v => approvals.state(v) === 'needs_work').length : '—';});
    const loadStatus = document.getElementById('review-load');
    loadStatus.hidden = !saved || (approvals.loaded && !approvals.error);
    document.getElementById('review-load-message').textContent = approvals.error || 'Loading approval status…';
    loadStatus.querySelector('button').hidden = !approvals.error;
    grid.hidden = !saved; list.hidden = saved;
    watchSection.hidden = !watching;
    collection.hidden = watching;
    document.querySelector('.page-header').hidden = watching;
    document.querySelector('.stats').hidden = watching;
    document.body.dataset.screen = watching ? 'player' : 'gallery';
    document.getElementById('collection-title').textContent = view === 'ready' ? 'Ready for approval' : view === 'needs-work' ? 'Needs work' : saved ? 'Saved videos' : view === 'all' ? 'The full build list' : 'Next explainers to build';
    document.querySelectorAll('[data-view]').forEach(function (b) { const active = b.dataset.view === view; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    const count = saved ? renderSaved() : renderTopics();
    empty.hidden = count > 0 || (saved && !approvals.loaded);
    empty.querySelector('h3').textContent = view === 'ready' && !search.value && !system.value ? 'All caught up' : view === 'needs-work' && !search.value && !system.value ? 'No videos flagged' : 'No matching results';
    empty.querySelector('p').textContent = view === 'ready' && !search.value && !system.value ? 'New review versions will appear here when they are ready.' : 'Try another part name or look through the full build list.';
    document.getElementById('result-count').textContent = count + (view === 'ready' ? ' video' + (count === 1 ? '' : 's') + ' ready for approval' : view === 'needs-work' ? ' video' + (count === 1 ? '' : 's') + ' needing work' : saved ? ' saved video' + (count === 1 ? '' : 's') : ' topic' + (count === 1 ? '' : 's'));
    if (saved && !approvals.loaded) document.getElementById('result-count').textContent = approvals.error ? 'Approval status unavailable' : 'Loading approval status…';
    document.getElementById('clear-filters').hidden = !search.value && !system.value;
    document.getElementById('pending-name').hidden = saved || !data.topics.some(function (t) { return t.status === 'Name pending' && queryMatches(t.name, t.category); });
    if (!watching) player.pause();
  }
  function selectVideo(id) {
    const video = byId.get(id); if (!video) return;
    if (!current || id !== current.id) {
      player.pause(); current = video; player.poster = current.poster;
      player.preload = 'metadata';
      const source = el('source'); source.src = current.file; source.type = 'video/mp4';
      player.replaceChildren(source);
      if (current.captions) {
        const track = el('track'); track.kind = 'captions'; track.srclang = 'en'; track.label = 'English'; track.src = current.captions;
        player.append(track);
      }
      player.load();
    }
    player.setAttribute('aria-label', current.title + ' video');
    document.getElementById('watch-title').textContent = current.title;
    document.getElementById('watch-category').textContent = current.category.toUpperCase();
    document.getElementById('watch-time').textContent = time(current.duration);
    document.getElementById('watch-version').textContent = current.version;
    document.getElementById('watch-quality').textContent = quality(current);
    document.getElementById('watch-format').textContent = (draft(current) ? draftLabel(current) : 'Saved copy') + ' · ' + quality(current) + (approvals.loaded ? ' · ' + approvals.label(current) : '');
    document.getElementById('watch-description').textContent = current.description;
    document.getElementById('download-video').href = current.file;
    document.getElementById('download-captions').hidden = !current.captions;
    if (current.captions) document.getElementById('download-captions').href = current.captions;
    else document.getElementById('download-captions').removeAttribute('href');
    document.getElementById('file-note').textContent = (draft(current) ? draftLabel(current) : 'Saved copy') + ' · MP4 · ' + (current.bytes / 1000000).toFixed(1) + ' MB';
    document.getElementById('video-error').hidden = true;
    if (!watching) returnView = view;
    watching = true; view = returnView;
    const back = document.querySelector('.back-to-videos'); back.href = returnView === 'ready' ? '#ready-for-approval' : returnView === 'needs-work' ? '#needs-work' : '#saved'; back.textContent = returnView === 'ready' ? '← Ready for approval' : returnView === 'needs-work' ? '← Needs work' : '← Saved videos';
    render();
    window.dispatchEvent(new CustomEvent('repair-video-selected', {detail: current}));
  }
  document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { openCollection(b.dataset.view, false); }); });
  document.querySelector('.brand').addEventListener('click', function (event) { event.preventDefault(); openCollection('saved', true); });
  search.addEventListener('input', render); system.addEventListener('change', render);
  document.getElementById('clear-filters').addEventListener('click', function () { search.value = ''; system.value = ''; render(); search.focus(); });
  document.getElementById('show-all').addEventListener('click', function () { system.value = ''; openCollection('all', false); });
  player.addEventListener('error', function () { if (watching) document.getElementById('video-error').hidden = false; });
  player.addEventListener('loadedmetadata', function () { document.getElementById('video-error').hidden = true; });
  function readHash() {
    const pieces = location.hash.slice(1).split('/');
    const id = pieces[1];
    if ((pieces[0] === 'watch' || pieces[0] === 'saved') && id && byId.has(id)) {
      selectVideo(id);
    } else {
      watching = false;
      window.dispatchEvent(new CustomEvent('repair-video-cleared'));
      if (current) {
        player.pause(); player.replaceChildren(); player.removeAttribute('src'); player.removeAttribute('poster');
        player.preload = 'none'; player.load(); current = null;
      }
      view = pieces[0] === 'ready-for-approval' ? 'ready' : pieces[0] === 'needs-work' ? 'needs-work' : pieces[0] === 'topics' ? 'all' : pieces[0] === 'to-build' ? 'planned' : 'saved';
      if (pieces[0] === 'watch') history.replaceState(null, '', '#saved');
      render();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (watching) document.getElementById('watch-title').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', readHash);
  window.addEventListener('repair-review-changed', function () {render(); if (current) document.getElementById('watch-format').textContent = (draft(current) ? draftLabel(current) : 'Saved copy') + ' · ' + quality(current) + (approvals.loaded ? ' · ' + approvals.label(current) : '');});
  readHash();
  console.log('Repair library ready: ' + data.videos.length + ' saved videos, ' + data.topics.length + ' entries, ' + data.categories.length + ' systems.');
})();
