(function () {
  'use strict';
  var KEY = 'banana_notepad_v1';
  var notes = [];
  var view = 'Notes';
  var currentId = null;
  var saveTimer = null;

  var $ = function (id) { return document.getElementById(id); };

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || '[]');
      notes = Array.isArray(d) ? d : [];
    } catch (e) { notes = []; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) {}
  }
  function now() {
    return new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function get(id) { return notes.filter(function (n) { return n.id === id; })[0]; }

  function visible() {
    var q = $('search').value.toLowerCase().trim();
    return notes.filter(function (n) {
      var ok;
      if (view === 'Notes') ok = !n.archived && !n.trashed;
      else if (view === 'Pinned') ok = n.pinned && !n.archived && !n.trashed;
      else if (view === 'Archive') ok = n.archived && !n.trashed;
      else ok = n.trashed;
      return ok && ((n.title + ' ' + n.content).toLowerCase().indexOf(q) !== -1);
    }).sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.id - a.id;
    });
  }

  function render() {
    var list = $('list');
    list.textContent = '';
    var items = visible();
    if (!items.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Nothing here yet';
      e.appendChild(document.createElement('br'));
      e.appendChild(document.createTextNode('Tap + to create a note'));
      list.appendChild(e);
    }
    items.forEach(function (n) {
      var c = document.createElement('div');
      c.className = 'card';
      var t = document.createElement('div'); t.className = 't'; t.textContent = n.title || 'Untitled note';
      var b = document.createElement('div'); b.className = 'b'; b.textContent = n.content.trim() || 'No additional text';
      var d = document.createElement('div'); d.className = 'd'; d.textContent = n.updated || '';
      c.appendChild(t); c.appendChild(b); c.appendChild(d);
      if (n.pinned) { var p = document.createElement('span'); p.className = 'pin'; p.textContent = '*'; c.appendChild(p); }
      var m = document.createElement('button'); m.className = 'more'; m.textContent = '\u22EE'; m.setAttribute('aria-label', 'More');
      m.onclick = function (ev) { ev.stopPropagation(); openSheet(n.id); };
      c.appendChild(m);
      c.onclick = function () { openEditor(n.id); };
      list.appendChild(c);
    });
    Array.prototype.forEach.call($('nav').children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === view);
    });
    $('heading').textContent = view === 'Notes' ? 'My Notes' : view;
  }

  function show(id) {
    $('home').classList.toggle('active', id === 'home');
    $('editor').classList.toggle('active', id === 'editor');
  }

  function createNote() {
    var n = { id: Date.now(), title: '', content: '', pinned: false, archived: false, trashed: false, updated: now() };
    notes.push(n);
    persist();
    view = 'Notes';
    openEditor(n.id, true);
  }

  function openEditor(id, focus) {
    var n = get(id); if (!n) return;
    currentId = id;
    $('etitle').value = n.title;
    $('ebody').value = n.content;
    syncEditorButtons();
    $('saved').textContent = 'Saved';
    show('editor');
    history.pushState({ editor: true }, '');
    if (focus) setTimeout(function () { $('etitle').focus(); }, 100);
  }

  function syncEditorButtons() {
    var n = get(currentId); if (!n) return;
    $('epin').textContent = n.pinned ? 'Unpin' : 'Pin';
    $('earch').textContent = n.archived ? 'Unarchive' : 'Archive';
  }

  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    var n = get(currentId); if (!n) return;
    n.title = $('etitle').value.trim();
    n.content = $('ebody').value.replace(/\s+$/, '');
    n.updated = now();
    persist();
    $('saved').textContent = 'Saved';
  }
  function scheduleSave() {
    $('saved').textContent = 'Saving...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  // Close editor UI (called from popstate or directly)
  function closeEditor() {
    if (currentId !== null) {
      saveNow();
      var n = get(currentId);
      // empty new note -> discard
      if (n && !n.title && !n.content) {
        notes = notes.filter(function (x) { return x.id !== n.id; });
        persist();
      }
    }
    currentId = null;
    show('home');
    render();
  }

  function goBack() {
    if (history.state && history.state.editor) history.back();
    else closeEditor();
  }

  window.addEventListener('popstate', function () {
    if ($('editor').classList.contains('active')) closeEditor();
    $('sheetbg').classList.remove('open');
  });

  function toggle(id, field) {
    var n = get(id); if (!n) return;
    n[field] = !n[field];
    persist();
  }

  function openSheet(id) {
    var n = get(id); if (!n) return;
    var s = $('sheet');
    s.textContent = '';
    var nm = document.createElement('div'); nm.className = 'name'; nm.textContent = n.title || 'Untitled note';
    s.appendChild(nm);
    function add(label, fn, danger) {
      var b = document.createElement('button');
      b.className = 'btn' + (danger ? ' danger' : '');
      b.textContent = label;
      b.onclick = function () { closeSheet(); fn(); };
      s.appendChild(b);
    }
    if (n.trashed) {
      add('Restore', function () { n.trashed = false; persist(); afterAction(); });
      add('Delete permanently', function () {
        notes = notes.filter(function (x) { return x.id !== id; }); persist(); afterAction();
      }, true);
    } else {
      add(n.pinned ? 'Unpin' : 'Pin', function () { toggle(id, 'pinned'); afterAction(); });
      add(n.archived ? 'Unarchive' : 'Archive', function () { toggle(id, 'archived'); afterAction(true); });
      add('Move to Trash', function () { n.trashed = true; persist(); afterAction(true); }, true);
    }
    add('Cancel', function () {});
    $('sheetbg').classList.add('open');
  }
  function closeSheet() { $('sheetbg').classList.remove('open'); }
  function afterAction(leaveEditor) {
    if (leaveEditor && $('editor').classList.contains('active')) { goBack(); }
    else { syncEditorButtons(); render(); }
  }

  // events
  $('add').onclick = createNote;
  $('back').onclick = goBack;
  $('search').oninput = render;
  $('etitle').oninput = scheduleSave;
  $('ebody').oninput = scheduleSave;
  $('epin').onclick = function () { saveNow(); toggle(currentId, 'pinned'); syncEditorButtons(); };
  $('earch').onclick = function () { saveNow(); toggle(currentId, 'archived'); goBack(); };
  $('emore').onclick = function () { saveNow(); openSheet(currentId); };
  $('sheetbg').onclick = function (e) { if (e.target === $('sheetbg')) closeSheet(); };
  Array.prototype.forEach.call($('nav').children, function (b) {
    b.onclick = function () { view = b.getAttribute('data-v'); $('search').value = ''; render(); };
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && currentId !== null) saveNow(); });
  window.addEventListener('pagehide', function () { if (currentId !== null) saveNow(); });

  load();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
