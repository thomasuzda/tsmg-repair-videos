'use strict';
(function () {
  const API = 'https://tsmg-video-notes.theservicema-7423.chatgpt.site/api/notes';
  const byId = id => document.getElementById(id);
  const player = byId('player'), form = byId('note-form'), list = byId('note-list');
  const text = byId('note-text'), author = byId('note-author'), status = byId('note-status');
  const save = byId('save-note'), refresh = byId('refresh-notes'), more = byId('more-notes');
  let current = null, generation = 0, controller = null, cursor = null, busy = false, pending = null;
  const drafts = new Map();
  function element(tag, cls, value) { const node = document.createElement(tag); if (cls) node.className = cls; if (value !== undefined) node.textContent = value; return node; }
  function clock(value) { const n = Math.floor(value || 0); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); }
  function tell(message, error) { status.textContent = message; status.classList.toggle('is-error', !!error); }
  function count() { byId('note-character-count').textContent = text.value.length.toLocaleString() + ' / 2,000'; pending = null; }
  function snapshot() { if (current) drafts.set(current.id, {text: text.value, author: author.value, includeTime: byId('note-include-time').checked}); }
  function renderNote(note) {
    const row = element('li', 'video-note'), header = element('div', 'video-note-header');
    header.append(element('strong', '', note.author || 'Guest'));
    const stamp = element('time'); stamp.dateTime = note.createdAt;
    stamp.textContent = new Date(note.createdAt).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); header.append(stamp);
    const context = element('div', 'video-note-context');
    if (note.videoTime !== null && note.version === current.version) {
      const seek = element('button', 'note-seek', clock(note.videoTime)); seek.type = 'button'; seek.setAttribute('aria-label', 'Jump to ' + clock(note.videoTime));
      seek.addEventListener('click', () => { player.currentTime = Math.min(note.videoTime, current.duration); player.focus(); }); context.append(seek);
    } else if (note.videoTime !== null) context.append(element('span', '', clock(note.videoTime)));
    context.append(element('span', '', note.version + (note.version !== current.version ? ' · Earlier version' : '')));
    row.append(header, context, element('p', 'video-note-text', note.text)); return row;
  }
  async function load(append, quiet) {
    if (!current) return;
    const token = generation, id = current.id, before = append ? cursor : null;
    if (!append && controller) controller.abort();
    const ownController = new AbortController(); controller = ownController;
    const timer = setTimeout(() => ownController.abort(), 15000);
    refresh.disabled = true; more.disabled = true;
    if (!quiet) tell('Loading shared notes…');
    try {
      const response = await fetch(API + '?video=' + encodeURIComponent(id) + (before ? '&before=' + encodeURIComponent(before) : ''), {signal: ownController.signal, credentials:'omit', cache:'no-store'});
      if (!response.ok) throw Error('Shared notes could not load. Select Refresh to try again.');
      const result = await response.json(); if (generation !== token || current?.id !== id) return;
      if (!append) list.replaceChildren();
      const existing = new Set([...list.children].map(n => n.dataset.noteId));
      result.notes.forEach(note => { if (!existing.has(note.id)) { const row = renderNote(note); row.dataset.noteId = note.id; list.append(row); } });
      cursor = result.next; more.hidden = !cursor;
      if (!busy && !quiet) tell(list.children.length ? '' : 'No notes yet. Add the first one.');
    } catch (error) { if (generation === token && !quiet) tell(error.name === 'AbortError' ? 'Notes took too long to load. Select Refresh to retry.' : error.message, true); }
    finally { clearTimeout(timer); if (generation === token) { refresh.disabled = false; more.disabled = false; } }
  }
  function selected(video) {
    if (current?.id === video.id) return;
    snapshot(); generation++; controller?.abort(); current = video; pending = null; cursor = null; busy = false;
    list.replaceChildren(); more.hidden = true; form.hidden = true; save.disabled = false; text.disabled = false; author.disabled = false; byId('note-include-time').disabled = false;
    const draft = drafts.get(video.id); text.value = draft?.text || ''; author.value = draft?.author || author.value; byId('note-include-time').checked = draft?.includeTime ?? true;
    count(); load(false, false);
  }
  function openForm() { if (!current) return; form.hidden = false; byId('note-time-label').textContent = clock(player.currentTime); text.focus({preventScroll:true}); form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'}); }
  byId('open-video-note').addEventListener('click', openForm);
  byId('cancel-note').addEventListener('click', () => { snapshot(); form.hidden = true; });
  text.addEventListener('input', () => { count(); snapshot(); }); author.addEventListener('input', () => { pending = null; snapshot(); });
  byId('note-include-time').addEventListener('change', () => { pending = null; snapshot(); });
  player.addEventListener('timeupdate', () => { if (!form.hidden && !busy && !pending) byId('note-time-label').textContent = clock(player.currentTime); });
  refresh.addEventListener('click', () => load(false, false)); more.addEventListener('click', () => load(true, false));
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!current || busy || !form.reportValidity() || !text.value.trim()) return;
    const token = generation, id = current.id; busy = true; save.disabled = true; text.disabled = true; author.disabled = true;
    byId('note-include-time').disabled = true; tell('Saving your note…');
    if (!pending) pending = {id:crypto.randomUUID(),videoId:id,version:current.version,author:author.value.trim(),text:text.value.trim(),videoTime:byId('note-include-time').checked?Math.round(Math.min(player.currentTime,current.duration)*100)/100:null};
    const cancel = new AbortController(), timer = setTimeout(() => cancel.abort(), 20000);
    try {
      const response = await fetch(API, {method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending),signal:cancel.signal});
      const result = await response.json(); if (!response.ok || !result.saved) throw Error(result.error || 'Your note could not be saved. Please retry.');
      drafts.delete(id);
      if (generation !== token || current?.id !== id) return;
      text.value = ''; count(); form.hidden = true; await load(false, true); tell('Note saved. Everyone viewing this video can see it.');
    } catch(error) { if (generation === token) tell(error.name === 'AbortError' ? 'Could not confirm the save. Your text is kept; retry safely.' : error.message, true); }
    finally { clearTimeout(timer); if (generation === token) { busy = false; save.disabled = false; text.disabled = false; author.disabled = false; byId('note-include-time').disabled = false; } }
  });
  window.addEventListener('repair-video-selected', event => selected(event.detail));
  window.addEventListener('repair-video-cleared', () => { snapshot(); generation++; controller?.abort(); current = null; pending = null; });
  window.addEventListener('focus', () => { if (current && form.hidden && !busy) load(false,true); });
  setInterval(() => { if (current && !document.hidden && form.hidden && !busy) load(false,true); }, 30000);
  const parts = location.hash.slice(1).split('/');
  if (parts[0] === 'watch' || parts[0] === 'saved') { const initial = window.REPAIR_LIBRARY.videos.find(v => v.id === parts[1]); if (initial) selected(initial); }
})();
