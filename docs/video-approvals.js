'use strict';
(function () {
  const API = 'https://tsmg-video-notes.theservicema-7423.chatgpt.site/api/reviews';
  const states = new Map(), pending = new Map(), saveErrors = new Map(), busy = new Set();
  let loaded = false, error = '', current = null, generation = 0, controller;
  const key = video => [video.id, video.version, video.sha256].join(':');
  const labels = {ready:'Not approved yet', approved:'Approved', needs_work:'Not approved — needs changes', draft:'Not approved yet', unreviewed:'Not approved yet', loading:'Checking approval…'};
  const labelFor = video => error ? 'Approval status unavailable' : labels[state(video)];
  function state(video) {
    const decision = states.get(key(video));
    const requested = Date.parse(video.review_requested_at || '');
    if (decision && (!Number.isFinite(requested) || Date.parse(decision.updatedAt) >= requested)) return decision.status;
    return loaded ? (video.ready_for_approval === true ? 'ready' : 'draft') : 'loading';
  }
  function changed() { paint(); window.dispatchEvent(new CustomEvent('repair-review-changed')); }
  function paint() {
    const label = document.getElementById('review-state');
    const message = document.getElementById('review-message');
    if (!label || !current) return;
    const value = state(current), saving = busy.has(key(current)), messageError = saveErrors.get(key(current)) || error;
    label.textContent = labelFor(current); label.dataset.state = error ? 'unavailable' : value;
    document.getElementById('approve-video').disabled = !loaded || saving || value === 'approved';
    document.getElementById('needs-work-video').disabled = !loaded || saving;
    document.getElementById('approve-video').setAttribute('aria-pressed', String(value === 'approved'));
    document.getElementById('needs-work-video').setAttribute('aria-pressed', String(value === 'needs_work'));
    if (saving) message.textContent = 'Saving your decision…';
    else if (messageError) message.textContent = messageError;
    else message.textContent = value === 'approved' ? 'This version has been approved.' : value === 'needs_work' ? 'This version is not approved. Changes have been requested; see Video notes.' : 'No approval has been recorded for this version. Watch it, then choose Approve or Needs work.';
    message.classList.toggle('is-error', Boolean(messageError));
    document.getElementById('retry-review').hidden = !error;
  }
  async function refresh() {
    if (busy.size) return;
    const token = ++generation; controller?.abort(); controller = new AbortController();
    const ownController = controller, timer = setTimeout(() => ownController.abort(), 15000);
    try {
      const response = await fetch(API, {credentials:'omit', cache:'no-store', signal:ownController.signal});
      if (!response.ok) throw Error('Review status could not load. Select Retry.');
      const result = await response.json(); if (token !== generation) return;
      if (!Array.isArray(result.reviews)) throw Error('Review status could not load. Select Retry.');
      states.clear(); result.reviews.forEach(r => states.set([r.videoId,r.version,r.sha256].join(':'),r)); loaded = true; error = ''; changed();
    } catch (failure) {
      if (token === generation) { error = 'Review status could not load. Select Retry.'; changed(); }
    } finally { clearTimeout(timer); }
  }
  async function decide(status) {
    if (!current || !loaded) return;
    const video = current, id = key(video), requestKey = id + ':' + status;
    if (busy.has(id)) return;
    if (state(video) === status) { if (status === 'needs_work') document.getElementById('open-video-note').click(); return; }
    generation++; controller?.abort(); busy.add(id); saveErrors.delete(id); paint();
    if (!pending.has(requestKey)) pending.set(requestKey, {id:crypto.randomUUID(),videoId:video.id,version:video.version,sha256:video.sha256,status});
    const cancel = new AbortController(), timer = setTimeout(() => cancel.abort(), 20000);
    try {
      const response = await fetch(API, {method:'POST', credentials:'omit', headers:{'Content-Type':'application/json'}, body:JSON.stringify(pending.get(requestKey)), signal:cancel.signal});
      const result = await response.json();
      if (!response.ok || !result.saved || !result.review) throw Error(result.error || 'Could not confirm the save. Select the decision again to retry safely.');
      const r = result.review; states.set([r.videoId,r.version,r.sha256].join(':'), r); pending.delete(requestKey);
      if (current && key(current) === id && status === 'needs_work') document.getElementById('open-video-note').click();
    } catch (failure) { saveErrors.set(id, failure.name === 'AbortError' ? 'Could not confirm the save. Select the decision again to retry safely.' : failure.message); }
    finally { clearTimeout(timer); busy.delete(id); changed(); }
  }
  window.REPAIR_APPROVALS = {state, label:labelFor, refresh, get loaded(){return loaded;}, get error(){return error;}};
  document.getElementById('approve-video').addEventListener('click', () => decide('approved'));
  document.getElementById('needs-work-video').addEventListener('click', () => decide('needs_work'));
  document.querySelectorAll('.review-retry').forEach(button => button.addEventListener('click',refresh));
  window.addEventListener('repair-video-selected', event => {current = event.detail; paint();});
  window.addEventListener('repair-video-cleared', () => {current = null;});
  window.addEventListener('focus', refresh);
  setInterval(() => {if (!document.hidden) refresh();},30000);
  refresh();
})();
