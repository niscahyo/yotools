/* ============================================================
   sugi-tools clone — app.js
   Flow-based web scraper / AI design document generator
   ============================================================ */

'use strict';

// ─── State ───────────────────────────────────────────────────
const state = {
  nodes: [],          // { id, type, x, y, el, data }
  edges: [],          // { id, from, to, el }
  selected: null,     // node id
  zoom: 1,
  panX: 0,
  panY: 0,
  nodeCounter: 0,
  edgeCounter: 0,
  dragging: null,     // { nodeId, startMouseX, startMouseY, startNodeX, startNodeY }
  connecting: null,   // { fromId, tempPath }
  output: {           // cached results per tab
    mdRendered: '',
    mdRaw: '',
    htmlSource: '',
    htmlPreview: '',
    aiPrompt: '',
  },
  history: [],
};

// ─── Node Definitions ────────────────────────────────────────
const NODE_DEFS = {
  'source-url': {
    label: 'Source URL',
    color: '#a855f7',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>`,
    fields: [
      { key: 'url', label: 'URL', type: 'input', placeholder: 'https://example.com' },
    ],
    hasIn: false,
    hasOut: true,
  },
  'scrape-md': {
    label: 'Scrape MD',
    color: '#3b82f6',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    fields: [],
    hasIn: true,
    hasOut: true,
  },
  'scrape-html': {
    label: 'Scrape HTML',
    color: '#3b82f6',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    fields: [],
    hasIn: true,
    hasOut: true,
  },
  'scrape-img': {
    label: 'Scrape Images',
    color: '#06b6d4',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    fields: [],
    hasIn: true,
    hasOut: true,
  },
  'crawl': {
    label: 'Crawl',
    color: '#f59e0b',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="13" x2="5" y2="16"/><line x1="12" y1="13" x2="19" y2="16"/></svg>`,
    fields: [
      { key: 'depth', label: 'Kedalaman', type: 'input', placeholder: '2' },
      { key: 'limit', label: 'Maks Halaman', type: 'input', placeholder: '10' },
    ],
    hasIn: true,
    hasOut: true,
  },
  'styleguide': {
    label: 'Styleguide',
    color: '#f59e0b',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="10"/></svg>`,
    fields: [],
    hasIn: true,
    hasOut: true,
  },
  'ai-design': {
    label: 'AI Design',
    color: '#22c55e',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><path d="M18 2l4 4-4 4"/><path d="M22 6H14"/></svg>`,
    fields: [
      { key: 'apiKey', label: 'API Key (opsional)', type: 'input', placeholder: 'sk-... (kosongkan untuk gratis)' },
    ],
    hasIn: true,
    hasOut: false,
    badge: { text: 'FREE', cls: 'badge-free' },
  },
  'download-assets': {
    label: 'Download Assets',
    color: '#818cf8',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    fields: [
      { key: 'types', label: 'Tipe Aset (pisah koma)', type: 'input', placeholder: 'img,css,js,font' },
      { key: 'maxSize', label: 'Maks per file (KB)', type: 'input', placeholder: '2048' },
    ],
    hasIn: true,
    hasOut: false,
    badge: { text: 'ZIP', cls: 'badge-zip' },
  },
  'skill-analysis': {
    label: 'Skill Analysis',
    color: '#f472b6',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    fields: [
      { key: 'level', label: 'Level Target', type: 'input', placeholder: 'beginner / intermediate / advanced' },
    ],
    hasIn: true,
    hasOut: false,
    badge: { text: 'SKILLS', cls: 'badge-skills' },
  },
};

// ─── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas          = $('canvas');
const nodesContainer  = $('nodes-container');
const edgesSvg        = $('edges-svg');
const canvasHint      = $('canvas-hint');
const runBar          = $('run-bar');
const btnRun          = $('btn-run');
const runStatus       = $('run-status');
const statusText      = runStatus.querySelector('.status-text');
const zoomDisplay     = $('zoom-display');
const contextMenu     = $('context-menu');
const outputTitle     = $('output-title');
const historyList     = $('history-list');

// ─── Helpers ─────────────────────────────────────────────────
function uid() { return 'n' + (++state.nodeCounter); }
function eid() { return 'e' + (++state.edgeCounter); }

// Safe wrappers around URL constructor
function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return url || 'unknown'; }
}
function safeURL(href, base) {
  try { return new URL(href, base).href; } catch { return null; }
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function setRunStatus(s, msg) {
  runStatus.className = 'run-status ' + s;
  statusText.textContent = msg;
}

function updateHint() {
  canvasHint.style.display = state.nodes.length === 0 ? 'flex' : 'none';
}

// ─── Node Creation ────────────────────────────────────────────
function createNode(type, x, y) {
  const def = NODE_DEFS[type];
  if (!def) return;
  const id = uid();
  const data = {};
  def.fields.forEach(f => { data[f.key] = ''; });

  // Build element
  const el = document.createElement('div');
  el.className = 'flow-node';
  el.dataset.id = id;
  el.dataset.type = type;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  el.innerHTML = `
    <div class="node-ports">
      ${def.hasIn  ? `<button class="port port-in" type="button" data-port="in" data-node="${id}" title="Input: klik untuk menerima koneksi" aria-label="Input ${def.label}"></button>` : ''}
      ${def.hasOut ? `<button class="port port-out" type="button" data-port="out" data-node="${id}" title="Output: klik lalu pilih input node tujuan" aria-label="Output ${def.label}"></button>` : ''}
    </div>
    <div class="node-header">
      <div class="node-type-icon" style="background:${def.color}22; color:${def.color}">${def.icon}</div>
      <span class="node-title">${def.label}</span>
      ${def.badge ? `<span class="node-badge ${def.badge.cls}">${def.badge.text}</span>` : ''}
      <div class="node-status-icon" data-status-icon></div>
    </div>
    <div class="node-body">
      ${def.fields.map(f => `
        <div class="node-field">
          <label>${f.label}</label>
          <input type="text" data-key="${f.key}" placeholder="${f.placeholder || ''}" value="${data[f.key] || ''}" />
        </div>
      `).join('')}
    </div>
  `;

  nodesContainer.appendChild(el);

  const node = { id, type, x, y, el, data };
  state.nodes.push(node);

  // Field input listeners
  el.querySelectorAll('[data-key]').forEach(input => {
    input.addEventListener('input', e => {
      node.data[e.target.dataset.key] = e.target.value;
    });
    // Prevent drag while typing
    input.addEventListener('mousedown', e => e.stopPropagation());
  });

  // Drag
  el.addEventListener('mousedown', onNodeMouseDown);

  // Right-click context menu
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    selectNode(id);
    showContextMenu(e.clientX, e.clientY, id);
  });

  // Click/tap the output port, then click/tap an input port.
  el.querySelectorAll('.port').forEach(port => {
    port.addEventListener('mousedown', e => e.stopPropagation());
    port.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (port.dataset.port === 'out') {
        if (state.connecting?.fromId === id) cancelConnecting();
        else startConnecting(id);
      } else if (state.connecting) {
        finishConnecting(id);
      }
    });
  });

  selectNode(id);
  updateHint();
  return node;
}

// ─── Node Selection ───────────────────────────────────────────
function selectNode(id) {
  if (state.selected) {
    const prev = state.nodes.find(n => n.id === state.selected);
    if (prev) prev.el.classList.remove('selected');
  }
  state.selected = id;
  if (id) {
    const n = state.nodes.find(n => n.id === id);
    if (n) n.el.classList.add('selected');
  }
}

function deleteNode(id) {
  const idx = state.nodes.findIndex(n => n.id === id);
  if (idx === -1) return;
  const node = state.nodes[idx];
  node.el.remove();
  state.nodes.splice(idx, 1);
  // Remove connected edges
  state.edges = state.edges.filter(e => {
    if (e.from === id || e.to === id) {
      if (e.el) e.el.remove();
      return false;
    }
    return true;
  });
  if (state.selected === id) state.selected = null;
  updateHint();
}

// ─── Dragging Nodes ───────────────────────────────────────────
function onNodeMouseDown(e) {
  if (e.target.classList.contains('port')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  e.preventDefault();
  const el = e.currentTarget;
  const id = el.dataset.id;
  selectNode(id);
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;
  state.dragging = {
    nodeId: id,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startNodeX: node.x,
    startNodeY: node.y,
  };
}

document.addEventListener('mousemove', e => {
  if (state.dragging) {
    const d = state.dragging;
    const node = state.nodes.find(n => n.id === d.nodeId);
    if (!node) return;
    const dx = (e.clientX - d.startMouseX) / state.zoom;
    const dy = (e.clientY - d.startMouseY) / state.zoom;
    node.x = d.startNodeX + dx;
    node.y = d.startNodeY + dy;
    node.el.style.left = node.x + 'px';
    node.el.style.top  = node.y + 'px';
    redrawEdges();
  }

  if (state.connecting) {
    const canvasRect = canvas.getBoundingClientRect();
    const mx = (e.clientX - canvasRect.left) / state.zoom;
    const my = (e.clientY - canvasRect.top)  / state.zoom;
    updateTempEdge(mx, my);
  }
});

document.addEventListener('mouseup', e => {
  state.dragging = null;
  if (state.connecting) {
    cancelConnecting();
  }
});

// ─── Edge / Connection Logic ──────────────────────────────────
function getPortCenter(nodeId, portType) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return { x: 0, y: 0 };

  // Use local canvas coordinates. Screen rectangles already contain zoom/pan and
  // caused the SVG transform to be applied twice, making edges appear to wobble.
  return {
    x: node.x + (portType === 'out' ? node.el.offsetWidth : 0),
    y: node.y + node.el.offsetHeight / 2,
  };
}

function connectionPath(x1, y1, x2, y2) {
  // Stable 2D orthogonal connector: horizontal → vertical → horizontal.
  const midX = x1 + (x2 - x1) / 2;
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
}

function setConnectionTargets(active) {
  document.querySelectorAll('.port-in').forEach(port => port.classList.toggle('connect-target', active));
}

function startConnecting(fromId, e) {
  e?.preventDefault();
  cancelConnecting();
  const p = getPortCenter(fromId, 'out');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('flow-edge', 'temp');
  path.setAttribute('d', connectionPath(p.x, p.y, p.x, p.y));
  edgesSvg.appendChild(path);
  state.connecting = { fromId, tempPath: path };
  state.nodes.find(node => node.id === fromId)?.el.querySelector('.port-out')?.classList.add('active');
  setConnectionTargets(true);
  toast('Pilih titik input di sisi kiri node tujuan');
}

function updateTempEdge(mx, my) {
  if (!state.connecting) return;
  const p = getPortCenter(state.connecting.fromId, 'out');
  state.connecting.tempPath.setAttribute('d', connectionPath(p.x, p.y, mx, my));
}

function finishConnecting(toId) {
  if (!state.connecting) return;
  const { fromId } = state.connecting;
  cancelConnecting();
  if (fromId === toId) {
    toast('Node tidak bisa dihubungkan ke dirinya sendiri', 'error');
    return;
  }
  // Avoid duplicate edges
  if (state.edges.find(e => e.from === fromId && e.to === toId)) {
    toast('Koneksi tersebut sudah ada', 'error');
    return;
  }
  addEdge(fromId, toId);
  toast('Node berhasil disambungkan', 'success');
}

function cancelConnecting() {
  if (!state.connecting) return;
  state.connecting.tempPath.remove();
  state.nodes.find(node => node.id === state.connecting.fromId)?.el.querySelector('.port-out')?.classList.remove('active');
  state.connecting = null;
  setConnectionTargets(false);
}

function addEdge(fromId, toId) {
  const id = eid();
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('flow-edge');
  path.dataset.eid = id;
  edgesSvg.appendChild(path);
  const edge = { id, from: fromId, to: toId, el: path };
  state.edges.push(edge);
  redrawEdge(edge);
}

function redrawEdge(edge) {
  const p1 = getPortCenter(edge.from, 'out');
  const p2 = getPortCenter(edge.to,   'in');
  edge.el.setAttribute('d', connectionPath(p1.x, p1.y, p2.x, p2.y));
}

function redrawEdges() {
  state.edges.forEach(redrawEdge);
}

// ─── Zoom / Pan ───────────────────────────────────────────────
function applyTransform() {
  nodesContainer.style.transform = `scale(${state.zoom}) translate(${state.panX}px, ${state.panY}px)`;
  nodesContainer.style.transformOrigin = '0 0';
  edgesSvg.style.transform = `scale(${state.zoom}) translate(${state.panX}px, ${state.panY}px)`;
  edgesSvg.style.transformOrigin = '0 0';
  zoomDisplay.textContent = Math.round(state.zoom * 100) + '%';
}

function zoomBy(delta) {
  state.zoom = Math.min(2, Math.max(0.3, state.zoom + delta));
  applyTransform();
  redrawEdges();
}

$('btn-zoom-in').addEventListener('click', () => zoomBy(0.1));
$('btn-zoom-out').addEventListener('click', () => zoomBy(-0.1));
$('btn-fit').addEventListener('click', () => {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyTransform();
  redrawEdges();
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 0.08 : -0.08);
}, { passive: false });

// ─── Drag & Drop from Palette ─────────────────────────────────
let dragType = null;

document.querySelectorAll('.palette-item').forEach(item => {
  item.addEventListener('dragstart', e => {
    dragType = item.dataset.type;
    e.dataTransfer.setData('text/plain', dragType);
  });
  // Click-to-add
  item.addEventListener('click', () => {
    const rect = canvas.getBoundingClientRect();
    const cx = (rect.width  / 2 - 90) / state.zoom;
    const cy = (rect.height / 2 - 40) / state.zoom;
    createNode(item.dataset.type, cx + Math.random() * 40 - 20, cy + Math.random() * 40 - 20);
    redrawEdges();
  });
});

canvas.addEventListener('dragover', e => {
  e.preventDefault();
  canvas.classList.add('drag-over');
});
canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
canvas.addEventListener('drop', e => {
  e.preventDefault();
  canvas.classList.remove('drag-over');
  const type = e.dataTransfer.getData('text/plain') || dragType;
  if (!type || !NODE_DEFS[type]) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / state.zoom - 90;
  const y = (e.clientY - rect.top)  / state.zoom - 30;
  createNode(type, Math.max(0, x), Math.max(0, y));
  redrawEdges();
});

// ─── Canvas click → deselect ──────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.target === canvas || e.target === nodesContainer || e.target === edgesSvg) {
    selectNode(null);
    hideContextMenu();
  }
});

// ─── Context Menu ─────────────────────────────────────────────
let ctxTargetId = null;
function showContextMenu(x, y, nodeId) {
  ctxTargetId = nodeId;
  contextMenu.style.left = x + 'px';
  contextMenu.style.top  = y + 'px';
  contextMenu.classList.remove('hidden');
}
function hideContextMenu() {
  contextMenu.classList.add('hidden');
  ctxTargetId = null;
}
document.addEventListener('click', e => {
  if (!contextMenu.contains(e.target)) hideContextMenu();
});

contextMenu.querySelector('.ctx-delete').addEventListener('click', () => {
  if (ctxTargetId) { deleteNode(ctxTargetId); hideContextMenu(); }
});
contextMenu.querySelector('.ctx-duplicate').addEventListener('click', () => {
  if (!ctxTargetId) return;
  const orig = state.nodes.find(n => n.id === ctxTargetId);
  if (!orig) return;
  const copy = createNode(orig.type, orig.x + 30, orig.y + 30);
  if (copy) Object.assign(copy.data, JSON.parse(JSON.stringify(orig.data)));
  hideContextMenu();
});
contextMenu.querySelector('.ctx-disconnect').addEventListener('click', () => {
  if (!ctxTargetId) return;
  state.edges = state.edges.filter(e => {
    if (e.from === ctxTargetId || e.to === ctxTargetId) {
      e.el.remove(); return false;
    }
    return true;
  });
  hideContextMenu();
});

// ─── Clear Canvas ─────────────────────────────────────────────
$('btn-clear-canvas').addEventListener('click', () => {
  if (state.nodes.length === 0) return;
  if (!confirm('Hapus semua node dan koneksi?')) return;
  [...state.nodes].forEach(n => deleteNode(n.id));
  state.edges = [];
  clearOutput();
  setRunStatus('idle', 'Siap');
  updateHint();
});

// ─── Tabs ─────────────────────────────────────────────────────
function activateTab(tabKey) {
  // Deactivate all regular tabs and panes
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-drop-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  // Activate pane
  const pane = $('tab-' + tabKey);
  if (pane) pane.classList.add('active');

  // Mark the matching button (regular or dropdown)
  const regularBtn = document.querySelector(`.tab-btn[data-tab="${tabKey}"]`);
  const dropBtn    = document.querySelector(`.tab-drop-item[data-tab="${tabKey}"]`);
  const moreBtn    = $('tab-more-btn');

  if (regularBtn) {
    regularBtn.classList.add('active');
    moreBtn?.classList.remove('active-child');
  } else if (dropBtn) {
    dropBtn.classList.add('active');
    moreBtn?.classList.add('active-child');
    // Update "More" label to show active item name
    if (moreBtn) {
      moreBtn.childNodes[0].textContent = dropBtn.textContent + ' ';
    }
  }

  // Close dropdown
  $('tab-dropdown')?.classList.remove('open');
  $('tab-more-btn')?.classList.remove('open');
}

// Regular tab buttons
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

// Dropdown items
document.querySelectorAll('.tab-drop-item').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    activateTab(btn.dataset.tab);
  });
});

// Toggle dropdown open/close
$('tab-more-btn')?.addEventListener('click', e => {
  e.stopPropagation();
  const dropdown = $('tab-dropdown');
  const moreBtn  = $('tab-more-btn');
  const isOpen   = dropdown.classList.contains('open');
  dropdown.classList.toggle('open', !isOpen);
  moreBtn.classList.toggle('open', !isOpen);
});

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!$('tab-more-wrap')?.contains(e.target)) {
    $('tab-dropdown')?.classList.remove('open');
    $('tab-more-btn')?.classList.remove('open');
  }
});

// ─── Copy Button ──────────────────────────────────────────────
$('btn-copy-output').addEventListener('click', () => {
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  let text = '';
  if (activeTab === 'md-rendered' || activeTab === 'md-raw') text = state.output.mdRaw;
  else if (activeTab === 'html-source') text = state.output.htmlSource;
  else if (activeTab === 'ai-prompt') text = state.output.aiPrompt;
  if (!text) { toast('Tidak ada output untuk disalin', 'error'); return; }
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('btn-copy-output');
    btn.classList.add('copied');
    btn.querySelector('svg + *') || (btn.lastChild.textContent = ' Copied!');
    toast('Disalin ke clipboard!', 'success');
    setTimeout(() => { btn.classList.remove('copied'); }, 1500);
  }).catch(() => toast('Gagal menyalin', 'error'));
});

// ─── Export ───────────────────────────────────────────────────
$('btn-export-txt').addEventListener('click', () => {
  const text = state.output.mdRaw || state.output.aiPrompt;
  if (!text) { toast('Tidak ada output', 'error'); return; }
  downloadFile('DESIGN.md', text, 'text/markdown');
});

$('btn-export-all').addEventListener('click', () => {
  if (!state.output.mdRaw && !state.output.htmlSource) { toast('Jalankan pipeline dulu', 'error'); return; }
  // Simple: download all as a single zip-like bundle (txt with sections)
  let bundle = '';
  if (state.output.mdRaw)      bundle += '=== DESIGN.md ===\n' + state.output.mdRaw + '\n\n';
  if (state.output.htmlSource) bundle += '=== page.html ===\n' + state.output.htmlSource + '\n\n';
  if (state.output.aiPrompt)   bundle += '=== ai_prompt.txt ===\n' + state.output.aiPrompt + '\n\n';
  downloadFile('sugi-tools-export.txt', bundle, 'text/plain');
  toast('Export berhasil!', 'success');
});

$('btn-export-zip').addEventListener('click', () => $('btn-export-all').click());

// ─── Panel Toggle (Sidebar & Output) ──────────────────────────

function createReopenBtn(id, side) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'panel-reopen-btn';
  btn.title = side === 'left' ? 'Buka panel Nodes' : 'Buka panel Output';
  btn.innerHTML = side === 'left'
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
  document.getElementById('canvas-wrapper').appendChild(btn);
  return btn;
}

const reopenSidebarBtn = createReopenBtn('btn-reopen-sidebar', 'left');
const reopenOutputBtn  = createReopenBtn('btn-reopen-output', 'right');

// Create overlay for mobile
const overlay = document.createElement('div');
overlay.className = 'panel-overlay';
overlay.id = 'panel-overlay';
document.body.appendChild(overlay);

const isMobile = () => window.innerWidth <= 768;

function setSidebarHidden(hidden) {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('panel-hidden', hidden);
  reopenSidebarBtn.classList.toggle('visible', hidden && !isMobile());
  // update toggle button arrow direction
  const toggleBtn = $('btn-toggle-sidebar');
  if (toggleBtn) {
    toggleBtn.innerHTML = hidden
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
  }
}

function setOutputHidden(hidden) {
  const panel = document.getElementById('output-panel');
  panel.classList.toggle('panel-hidden', hidden);
  reopenOutputBtn.classList.toggle('visible', hidden && !isMobile());
  const toggleBtn = $('btn-toggle-output');
  if (toggleBtn) {
    toggleBtn.innerHTML = hidden
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  }
}

function closeAllPanels() {
  setSidebarHidden(true);
  setOutputHidden(true);
  overlay.classList.remove('active');
}

// Desktop toggle buttons inside panels
$('btn-toggle-sidebar')?.addEventListener('click', () => {
  const hidden = !document.getElementById('sidebar').classList.contains('panel-hidden');
  setSidebarHidden(hidden);
});

$('btn-toggle-output')?.addEventListener('click', () => {
  const hidden = !document.getElementById('output-panel').classList.contains('panel-hidden');
  setOutputHidden(hidden);
});

// Floating reopen buttons (desktop only)
reopenSidebarBtn.addEventListener('click', () => setSidebarHidden(false));
reopenOutputBtn.addEventListener('click',  () => setOutputHidden(false));

// Mobile header toggle buttons
$('btn-mobile-sidebar')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const isHidden = sidebar.classList.contains('panel-hidden');
  if (isHidden) {
    // close output first, open sidebar
    setOutputHidden(true);
    setSidebarHidden(false);
    overlay.classList.add('active');
  } else {
    setSidebarHidden(true);
    overlay.classList.remove('active');
  }
});

$('btn-mobile-output')?.addEventListener('click', () => {
  const panel = document.getElementById('output-panel');
  const isHidden = panel.classList.contains('panel-hidden');
  if (isHidden) {
    // close sidebar first, open output
    setSidebarHidden(true);
    setOutputHidden(false);
    overlay.classList.add('active');
  } else {
    setOutputHidden(true);
    overlay.classList.remove('active');
  }
});

// Close panels when overlay is tapped (mobile)
overlay.addEventListener('click', closeAllPanels);

// On resize: re-sync reopen buttons visibility
window.addEventListener('resize', () => {
  const sidebarHidden = document.getElementById('sidebar').classList.contains('panel-hidden');
  const outputHidden  = document.getElementById('output-panel').classList.contains('panel-hidden');
  reopenSidebarBtn.classList.toggle('visible', sidebarHidden && !isMobile());
  reopenOutputBtn.classList.toggle('visible',  outputHidden  && !isMobile());
  // Hide overlay if switching to desktop
  if (!isMobile()) overlay.classList.remove('active');
});

// On mobile, hide both panels by default so canvas is full width
if (isMobile()) {
  setSidebarHidden(true);
  setOutputHidden(true);
}

// ─── Touch Pan (canvas) ────────────────────────────────────────
(function initTouchPan() {
  let touchStartX = 0, touchStartY = 0;
  let panStartX = 0, panStartY = 0;
  let lastTouchDist = 0;
  let isTwoFinger = false;

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isTwoFinger = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      panStartX   = state.panX;
      panStartY   = state.panY;
    } else if (e.touches.length === 2) {
      isTwoFinger = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.hypot(dx, dy);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && !isTwoFinger) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      state.panX = panStartX + dx;
      state.panY = panStartY + dy;
      applyTransform();
      redrawEdges();
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist - lastTouchDist;
      lastTouchDist = dist;
      const factor = 1 + delta * 0.005;
      state.zoom = Math.min(2, Math.max(0.2, state.zoom * factor));
      applyTransform();
      redrawEdges();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    isTwoFinger = false;
  }, { passive: true });
})();

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ─── Clear Output ─────────────────────────────────────────────
function clearOutput() {
  state.output = { mdRendered: '', mdRaw: '', htmlSource: '', htmlPreview: '', aiPrompt: '' };
  $('tab-md-rendered').innerHTML = `<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Hasil akan muncul di sini</p></div>`;
  $('md-raw-content').textContent = '';
  $('html-source-content').textContent = '';
  $('ai-prompt-content').textContent = '';
  $('html-preview-frame').srcdoc = '';
  outputTitle.textContent = '';
}

// ─── Run Pipeline ─────────────────────────────────────────────
btnRun.addEventListener('click', runPipeline);

async function runPipeline() {
  // Validate: must have a Source URL node
  const sourceNode = state.nodes.find(n => n.type === 'source-url');
  if (!sourceNode) {
    toast('Tambahkan node Source URL dulu!', 'error');
    return;
  }
  const url = sourceNode.data.url?.trim();
  if (!url) {
    toast('Masukkan URL di node Source URL', 'error');
    sourceNode.el.querySelector('input')?.focus();
    return;
  }
  if (!url.startsWith('http')) {
    toast('URL harus dimulai dengan http:// atau https://', 'error');
    return;
  }

  // Determine pipeline order via BFS from source node
  const pipeline = buildPipeline(sourceNode.id);
  if (pipeline.length === 0) {
    toast('Hubungkan node Source URL ke node lain', 'error');
    return;
  }

  // UI: running
  btnRun.disabled = true;
  btnRun.classList.add('running');
  btnRun.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop`;
  setRunStatus('running', 'Memproses...');
  clearOutput();

  pipeline.forEach(n => { n.el.classList.remove('done', 'error', 'running'); n.el.classList.add('running'); });

  try {
    const results = await executePipeline(url, pipeline);
    renderOutput(url, results, pipeline);
    pipeline.forEach(n => { n.el.classList.remove('running'); n.el.classList.add('done'); });
    setRunStatus('done', 'Selesai!');
    addHistory(url, pipeline);
    toast('Pipeline berhasil dijalankan!', 'success');
  } catch (err) {
    pipeline.forEach(n => { n.el.classList.remove('running'); n.el.classList.add('error'); });
    setRunStatus('error', 'Error');
    clearOutput();
    $('tab-md-rendered').innerHTML = `<div class="empty-state" style="color:#ef4444">${escHtml(err.message)}</div>`;
    toast('Gagal: ' + err.message, 'error');
  } finally {
    btnRun.disabled = false;
    btnRun.classList.remove('running');
    btnRun.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate DESIGN.md (FREE)`;
  }
}

// Build execution order from source node following edges
function buildPipeline(startId) {
  const visited = new Set();
  const order = [];
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const node = state.nodes.find(n => n.id === id);
    if (node && id !== startId) order.push(node);
    state.edges
      .filter(e => e.from === id)
      .forEach(e => queue.push(e.to));
  }
  return order;
}

// ─── Pipeline Execution (simulate + real fetch via allorigins) ─
async function executePipeline(url, pipeline) {
  const results = {};

  for (const node of pipeline) {
    node.el.classList.remove('running');
    node.el.classList.add('running');
    setRunStatus('running', `${NODE_DEFS[node.type]?.label || node.type}...`);

    switch (node.type) {
      case 'scrape-md':
        results.md = await fetchMarkdown(url);
        break;
      case 'scrape-html':
        results.html = await fetchHTML(url);
        break;
      case 'scrape-img':
        results.images = await fetchImages(url, results.html);
        break;
      case 'crawl':
        results.links = await crawlLinks(url, results.html, node.data.depth, node.data.limit);
        break;
      case 'styleguide':
        results.styleguide = await extractStyleguide(url, results.html);
        break;
      case 'ai-design':
        results.design = await generateDesignDoc(url, results);
        break;
      case 'download-assets':
        results.assets = await fetchAllAssets(url, results.html, node.data.types, node.data.maxSize);
        break;
      case 'skill-analysis':
        results.skills = await analyzeSkills(url, results);
        break;
    }

    node.el.classList.remove('running');
    node.el.classList.add('done');
    await sleep(120);
  }

  return results;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Fetchers (multi-proxy with fallback) ─────────────────────

// Try fetching a raw blob/text via multiple CORS proxies in order.
// Returns a Response-like { ok, blob(), text() } from the first that succeeds.
const CORS_PROXIES_RAW = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchRawWithFallback(url, timeoutMs = 12000) {
  let lastErr;
  for (const proxyFn of CORS_PROXIES_RAW) {
    try {
      const res = await fetch(proxyFn(url), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // allorigins /raw may return an empty body for some sites — check blob size
      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Response kosong');
      return blob;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Semua proxy gagal');
}

async function fetchHTML(url) {
  // Try allorigins /get (returns JSON with .contents) first, then fall back to raw proxies
  const proxies = [
    async () => {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.contents) throw new Error('Response kosong');
      return json.contents;
    },
    async () => {
      const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    },
    async () => {
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    },
  ];
  for (const fn of proxies) {
    try { return await fn(); } catch {}
  }
  return `<!-- Gagal mengambil HTML dari semua proxy -->`;
}

async function fetchMarkdown(url) {
  // Use r.jina.ai to get markdown of the page
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/markdown, text/plain, */*' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('Jina HTTP ' + res.status);
    return await res.text();
  } catch (e) {
    // fallback: html → naive text
    const html = await fetchHTML(url);
    return htmlToMarkdown(html, url);
  }
}

function htmlToMarkdown(html, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  // Remove scripts, styles, noscript
  doc.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());
  const title = doc.querySelector('title')?.textContent?.trim() || safeHostname(baseUrl);
  const desc  = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const h1s   = [...doc.querySelectorAll('h1')].map(h => h.textContent.trim()).filter(Boolean);
  const h2s   = [...doc.querySelectorAll('h2')].map(h => h.textContent.trim()).filter(Boolean);
  const paras = [...doc.querySelectorAll('p')].slice(0, 8).map(p => p.textContent.trim()).filter(Boolean);
  const links = [...doc.querySelectorAll('a[href]')].slice(0, 20).map(a => {
    const href = a.getAttribute('href');
    const text = a.textContent.trim();
    if (!text || !href) return null;
    try { return `[${text}](${safeURL(href, baseUrl)})`; } catch { return null; }
  }).filter(Boolean);

  let md = `# ${title}\n`;
  if (desc) md += `\n> ${desc}\n`;
  if (h1s.length) md += `\n## Heading Utama\n${h1s.map(h => `- ${h}`).join('\n')}\n`;
  if (h2s.length) md += `\n## Sub-heading\n${h2s.slice(0, 10).map(h => `- ${h}`).join('\n')}\n`;
  if (paras.length) md += `\n## Konten\n${paras.map(p => p).join('\n\n')}\n`;
  if (links.length) md += `\n## Link\n${links.join('\n')}\n`;
  return md;
}

async function fetchImages(url, html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const imgs = [...doc.querySelectorAll('img')].slice(0, 20).map(img => {
    let src = img.getAttribute('src') || '';
    try { src = safeURL(src, url) || src; } catch {}
    return {
      src,
      alt: img.getAttribute('alt') || '',
      width: img.getAttribute('width') || '?',
      height: img.getAttribute('height') || '?',
    };
  }).filter(i => i.src && i.src.startsWith('http'));
  return imgs;
}

async function crawlLinks(url, html, depth, limit) {
  depth = parseInt(depth) || 2;
  limit = parseInt(limit) || 10;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const base = (() => { try { return new URL(url); } catch { return null; } })();
  const links = [...doc.querySelectorAll('a[href]')]
    .map(a => { try { return safeURL(a.getAttribute('href'), url); } catch { return null; } })
    .filter(h => h && base && h.startsWith(base.origin))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, limit);
  return { links, depth, baseUrl: url };
}

async function extractStyleguide(url, html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const styles = {};

  // Extract inline styles / style tags
  const allStyles = [...doc.querySelectorAll('style')]
    .map(s => s.textContent)
    .join('\n');

  // Naive color extraction
  const colorRx = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsl\([^)]+\)/g;
  const colors = [...new Set(allStyles.match(colorRx) || [])].slice(0, 20);

  // Font families
  const fontRx = /font-family\s*:\s*([^;}"]+)/g;
  const fonts = [];
  let m;
  while ((m = fontRx.exec(allStyles)) !== null) fonts.push(m[1].trim());
  const uniqueFonts = [...new Set(fonts)].slice(0, 8);

  // Google Fonts from link tags
  const gFonts = [...doc.querySelectorAll('link[href*="fonts.googleapis"]')]
    .map(l => l.getAttribute('href'));

  styles.colors = colors;
  styles.fonts = uniqueFonts;
  styles.googleFonts = gFonts;

  // Check for Tailwind or frameworks
  const hasTailwind = html?.includes('tailwind') || html?.includes('tw-');
  const hasBootstrap = html?.includes('bootstrap');
  styles.frameworks = [hasTailwind && 'Tailwind CSS', hasBootstrap && 'Bootstrap'].filter(Boolean);

  return styles;
}

async function generateDesignDoc(url, results) {
  const { md, html, images, links, styleguide } = results;
  const parser = new DOMParser();
  const doc = html ? parser.parseFromString(html, 'text/html') : null;

  const title = doc?.querySelector('title')?.textContent?.trim() || safeHostname(url);
  const desc  = doc?.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const ogImg = doc?.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const canonical = doc?.querySelector('link[rel="canonical"]')?.getAttribute('href') || url;

  const hostname = safeHostname(url);
  const now = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  let design = `# DESIGN.md — ${title}\n\n`;
  design += `> Dibuat otomatis oleh sugi-tools pada ${now}\n> Sumber: ${canonical}\n\n`;
  design += `---\n\n`;

  // Overview
  design += `## Overview\n\n`;
  design += `| Field | Value |\n|---|---|\n`;
  design += `| **Nama Situs** | ${title} |\n`;
  design += `| **Domain** | ${hostname} |\n`;
  design += `| **URL** | ${url} |\n`;
  if (desc) design += `| **Deskripsi** | ${desc} |\n`;
  if (ogImg) design += `| **OG Image** | ${ogImg} |\n`;
  design += `\n`;

  // Content summary from markdown
  if (md) {
    const mdLines = md.split('\n').slice(0, 40);
    design += `## Konten Utama\n\n`;
    design += mdLines.join('\n') + '\n\n';
  }

  // Styleguide
  if (styleguide) {
    design += `## Design System\n\n`;
    if (styleguide.colors?.length) {
      design += `### Warna\n\n`;
      styleguide.colors.forEach(c => { design += `- \`${c}\`\n`; });
      design += '\n';
    }
    if (styleguide.fonts?.length) {
      design += `### Font\n\n`;
      styleguide.fonts.forEach(f => { design += `- ${f}\n`; });
      design += '\n';
    }
    if (styleguide.frameworks?.length) {
      design += `### Framework CSS\n\n`;
      styleguide.frameworks.forEach(f => { design += `- ${f}\n`; });
      design += '\n';
    }
    if (styleguide.googleFonts?.length) {
      design += `### Google Fonts\n\n`;
      styleguide.googleFonts.forEach(f => { design += `- ${f}\n`; });
      design += '\n';
    }
  }

  // Images
  if (images?.length) {
    design += `## Gambar (${images.length})\n\n`;
    design += `| # | Alt | URL |\n|---|---|---|\n`;
    images.forEach((img, i) => {
      design += `| ${i+1} | ${img.alt || '-'} | ${img.src} |\n`;
    });
    design += '\n';
  }

  // Links / crawl
  if (links?.links?.length) {
    design += `## Internal Links (depth: ${links.depth})\n\n`;
    links.links.forEach(l => { design += `- ${l}\n`; });
    design += '\n';
  }

  // Komponen UI yang terdeteksi
  if (doc) {
    const nav = doc.querySelector('nav, [role="navigation"]');
    const footer = doc.querySelector('footer');
    const forms = doc.querySelectorAll('form');
    const buttons = doc.querySelectorAll('button, [role="button"]');
    const inputs = doc.querySelectorAll('input, textarea, select');
    const modals = doc.querySelectorAll('[role="dialog"], .modal');

    design += `## Komponen UI Terdeteksi\n\n`;
    design += `| Komponen | Ditemukan |\n|---|---|\n`;
    design += `| Navigation | ${nav ? 'Ya' : 'Tidak'} |\n`;
    design += `| Footer | ${footer ? 'Ya' : 'Tidak'} |\n`;
    design += `| Form | ${forms.length} |\n`;
    design += `| Button | ${buttons.length} |\n`;
    design += `| Input Fields | ${inputs.length} |\n`;
    design += `| Modal/Dialog | ${modals.length} |\n`;
    design += '\n';
  }

  // Rekomendasi
  design += `## Rekomendasi Desain\n\n`;
  design += `1. Identifikasi palet warna utama dari \`Design System\` di atas\n`;
  design += `2. Replikasi struktur navigasi dan tata letak halaman\n`;
  design += `3. Perhatikan hierarki tipografi dan ukuran font\n`;
  design += `4. Komponen interaktif (form, button) perlu diimplementasikan manual\n`;
  design += `5. Aset gambar dapat diunduh dari tabel \`Gambar\` di atas\n\n`;

  return design;
}

// ─── Render Output ────────────────────────────────────────────
function renderOutput(url, results, pipeline) {
  const hasDesign = !!results.design;
  const hasHTML   = !!results.html;
  const hasMD     = !!results.md;

  const mainContent = results.design || results.md || '';
  const rawHTML     = results.html   || '';

  state.output.mdRaw      = mainContent;
  state.output.mdRendered = mainContent;
  state.output.htmlSource = rawHTML;
  state.output.aiPrompt   = buildAIPrompt(url, results);

  // MD Rendered
  $('tab-md-rendered').innerHTML = markdownToHtml(mainContent) || '<div class="empty-state"><p>Tidak ada output MD</p></div>';

  // MD Raw
  $('md-raw-content').textContent = mainContent || '(kosong)';

  // HTML Source
  $('html-source-content').textContent = rawHTML ? rawHTML.slice(0, 80000) : '(tidak ada)';

  // HTML Preview
  if (rawHTML) {
    $('html-preview-frame').srcdoc = rawHTML;
  } else {
    $('html-preview-frame').srcdoc = '<p style="font-family:sans-serif;padding:16px;color:#888">Tidak ada HTML untuk ditampilkan</p>';
  }

  // AI Prompt
  $('ai-prompt-content').textContent = state.output.aiPrompt;

  // Assets tab
  renderAssetsTab(results.assets || null);

  // Skills tab — only update if skills were actually run
  if (results.skills) {
    renderSkillsTab(results.skills);
  }

  // Title
  outputTitle.textContent = `${pipeline.map(n => NODE_DEFS[n.type]?.label).join(' → ')} — ${safeHostname(url)}`;

  // Switch to most relevant tab
  if (results.skills) {
    activateTab('skills');
  } else if (results.assets) {
    activateTab('assets');
  } else {
    activateTab('md-rendered');
  }
}

function buildAIPrompt(url, results) {
  let prompt = `Kamu adalah seorang UI/UX designer dan developer ahli.\n\n`;
  prompt += `Analisis website berikut dan buat implementasi ulang yang lengkap:\n\nURL: ${url}\n\n`;
  if (results.design) {
    prompt += `## Design Document\n\n${results.design}\n\n`;
  } else if (results.md) {
    prompt += `## Konten Website\n\n${results.md.slice(0, 3000)}\n\n`;
  }
  prompt += `## Instruksi\n\n`;
  prompt += `1. Buat file HTML/CSS/JS yang mereplikasi tampilan dan fungsi website ini\n`;
  prompt += `2. Gunakan desain yang identik atau sangat mirip\n`;
  prompt += `3. Pastikan responsive dan accessible\n`;
  prompt += `4. Tambahkan komentar kode yang jelas\n`;
  prompt += `5. Gunakan teknologi modern (CSS Grid/Flexbox, vanilla JS atau framework ringan)\n`;
  return prompt;
}

// ─── Markdown → HTML (minimal renderer) ──────────────────────
function markdownToHtml(md) {
  if (!md) return '';

  // Process line by line to avoid escaping issues
  const lines = md.split('\n');
  let html = '';
  let inCodeBlock = false;
  let codeLines = [];
  let inTable = false;
  let tableRows = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length) {
      html += '<ul>' + listItems.map(li => `<li>${li}</li>`).join('') + '</ul>\n';
      listItems = [];
    }
  };
  const flushTable = () => {
    if (tableRows.length) {
      html += '<table>' + tableRows.map((row, i) => {
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        const tag = i === 0 ? 'th' : 'td';
        return `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
      }).join('') + '</table>\n';
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        flushList(); flushTable();
        inCodeBlock = true;
        codeLines = [];
      } else {
        html += `<pre><code>${escHtml(codeLines.join('\n'))}</code></pre>\n`;
        inCodeBlock = false;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Table row
    if (line.startsWith('|')) {
      flushList();
      if (!line.match(/^\|[-| :]+\|$/)) tableRows.push(line);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Blank line
    if (line.trim() === '') {
      flushList();
      html += '\n';
      continue;
    }

    // HR
    if (line.match(/^---+$/)) { flushList(); html += '<hr>\n'; continue; }

    // Headers
    if (line.startsWith('### ')) { flushList(); html += `<h3>${inlineFormat(line.slice(4))}</h3>\n`; continue; }
    if (line.startsWith('## '))  { flushList(); html += `<h2>${inlineFormat(line.slice(3))}</h2>\n`; continue; }
    if (line.startsWith('# '))   { flushList(); html += `<h1>${inlineFormat(line.slice(2))}</h1>\n`; continue; }

    // Blockquote
    if (line.startsWith('> ')) { flushList(); html += `<blockquote>${inlineFormat(line.slice(2))}</blockquote>\n`; continue; }

    // List item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(inlineFormat(line.slice(2)));
      continue;
    }
    if (line.match(/^\d+\. /)) {
      listItems.push(inlineFormat(line.replace(/^\d+\. /, '')));
      continue;
    }

    // Paragraph
    flushList();
    html += `<p>${inlineFormat(line)}</p>\n`;
  }

  flushList();
  flushTable();
  if (inCodeBlock) html += `<pre><code>${escHtml(codeLines.join('\n'))}</code></pre>\n`;

  return html;
}

function inlineFormat(text) {
  // Escape HTML first
  let t = escHtml(text);
  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── History ──────────────────────────────────────────────────
function addHistory(url, pipeline) {
  const item = { url, pipeline: pipeline.map(n => n.type), ts: Date.now() };
  state.history.unshift(item);
  renderHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">Belum ada riwayat</div>';
    return;
  }
  historyList.innerHTML = state.history.slice(0, 8).map((item, i) => {
    const hostname = (() => { try { return new URL(item.url).hostname; } catch { return item.url; } })();
    return `<div class="history-item" data-idx="${i}">
      <div class="history-dot"></div>
      <span>${hostname}</span>
    </div>`;
  }).join('');

  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = state.history[+el.dataset.idx];
      if (!item) return;
      // Restore URL to source node if exists
      const src = state.nodes.find(n => n.type === 'source-url');
      if (src) {
        src.data.url = item.url;
        const input = src.el.querySelector('input');
        if (input) input.value = item.url;
      }
      toast('URL dipulihkan dari riwayat', 'success');
    });
  });
}

// ─── Keyboard Shortcuts ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    if (state.selected) {
      deleteNode(state.selected);
      toast('Node dihapus');
    }
  }
  if (e.key === 'Escape') {
    selectNode(null);
    cancelConnecting();
    hideContextMenu();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    runPipeline();
  }
});

// ─── Asset Downloading ───────────────────────────────────────

// Store blob object URLs so we can revoke them on next run
let _assetObjectURLs = [];

function revokeAssetURLs() {
  _assetObjectURLs.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
  _assetObjectURLs = [];
}

/**
 * Discover all asset URLs from page HTML (or fetch HTML directly if not provided),
 * then fetch each asset blob via CORS proxy and return enriched asset objects.
 */
async function fetchAllAssets(pageUrl, html, typesStr, maxSizeKB) {
  revokeAssetURLs();

  const allowedTypes = (typesStr || 'img,css,js,font')
    .split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const maxBytes = (parseInt(maxSizeKB) || 2048) * 1024;

  // If no HTML was scraped yet, fetch it now directly
  let rawHtml = html;
  if (!rawHtml) {
    setRunStatus('running', 'Mengambil HTML untuk asset...');
    rawHtml = await fetchHTML(pageUrl);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  const discovered = [];

  if (allowedTypes.includes('img')) {
    doc.querySelectorAll('img[src]').forEach(el => {
      const src = safeURL(el.getAttribute('src'), pageUrl);
      if (src) discovered.push({ url: src, type: 'img', alt: el.getAttribute('alt') || '' });
    });
    doc.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
      (el.getAttribute('srcset') || '').split(',').forEach(part => {
        const u = safeURL(part.trim().split(/\s+/)[0], pageUrl);
        if (u) discovered.push({ url: u, type: 'img', alt: '' });
      });
    });
    // og:image / twitter:image meta
    doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(el => {
      const src = safeURL(el.getAttribute('content'), pageUrl);
      if (src) discovered.push({ url: src, type: 'img', alt: 'og:image' });
    });
  }

  if (allowedTypes.includes('css')) {
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(el => {
      const href = safeURL(el.getAttribute('href'), pageUrl);
      if (href) discovered.push({ url: href, type: 'css' });
    });
  }

  if (allowedTypes.includes('js')) {
    doc.querySelectorAll('script[src]').forEach(el => {
      const src = safeURL(el.getAttribute('src'), pageUrl);
      if (src) discovered.push({ url: src, type: 'js' });
    });
  }

  if (allowedTypes.includes('font')) {
    doc.querySelectorAll('link[rel="preload"][as="font"][href], link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').forEach(el => {
      const href = safeURL(el.getAttribute('href'), pageUrl);
      if (href) discovered.push({ url: href, type: 'font' });
    });
  }

  // Also scan inline styles for background-image URLs
  if (allowedTypes.includes('img')) {
    const bgRx = /url\(["']?([^"')]+)["']?\)/g;
    doc.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      let m;
      while ((m = bgRx.exec(style)) !== null) {
        const src = safeURL(m[1], pageUrl);
        if (src) discovered.push({ url: src, type: 'img', alt: 'bg-image' });
      }
    });
    // Lazy-load attributes: data-src, data-lazy, data-original, data-image
    doc.querySelectorAll('[data-src],[data-lazy],[data-original],[data-image]').forEach(el => {
      const src = safeURL(
        el.getAttribute('data-src') || el.getAttribute('data-lazy') ||
        el.getAttribute('data-original') || el.getAttribute('data-image'), pageUrl);
      if (src) discovered.push({ url: src, type: 'img', alt: el.getAttribute('alt') || '' });
    });
  }

  // Deduplicate
  const seen = new Set();
  const unique = discovered.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url); return true;
  });

  if (unique.length === 0) {
    toast('Tidak ada asset ditemukan di halaman ini. Coba tambahkan node Scrape HTML terlebih dahulu.', 'error');
    return [];
  }

  // Switch to assets tab and show progress immediately
  activateTab('assets');
  renderAssetsTab(null, unique.length, 0, []);

  const fetched = [];
  for (let i = 0; i < unique.length; i++) {
    const asset = { ...unique[i] };
    renderAssetsTab(null, unique.length, i, fetched);

    try {
      const filename = filenameFromUrl(asset.url);

      // Fetch all asset types (including images) via proxy for reliable blob access
      // and to avoid hotlink protection / CSP issues on the target site.
      const blob = await fetchRawWithFallback(asset.url, 12000);
      if (blob.size > maxBytes) throw new Error(`Terlalu besar: ${(blob.size/1024).toFixed(0)}KB`);
      const objectUrl = URL.createObjectURL(blob);
      _assetObjectURLs.push(objectUrl);
      fetched.push({
        ...asset,
        ok: true,
        blob,
        objectUrl,
        size: blob.size,
        filename,
        mimeType: blob.type || guessMime(asset.type, filename),
        direct: false,
      });
    } catch (e) {
      fetched.push({ ...asset, ok: false, error: e.message, size: 0, filename: filenameFromUrl(asset.url) });
    }

    await sleep(40);
  }

  // Final render with complete list
  renderAssetsTab(fetched);
  return fetched;
}

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const name = u.pathname.split('/').pop().split('?')[0] || 'asset';
    return name || 'asset';
  } catch {
    return url.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-40) || 'asset';
  }
}

function guessMime(type, filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
    css: 'text/css', js: 'application/javascript',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  };
  return map[ext] || (type === 'img' ? 'image/jpeg' : type === 'css' ? 'text/css' : 'application/octet-stream');
}

/**
 * Render the assets tab. Pass assets=null during progress updates.
 */
function renderAssetsTab(assets, total, done, partial) {
  const container = $('assets-list');
  if (!container) return;

  // Progress view
  if (assets === null) {
    const pct = (total || 0) === 0 ? 0 : Math.round(((done || 0) / total) * 100);
    container.innerHTML = `
      <div class="assets-progress">
        <div class="progress-text">Mengunduh asset ${done || 0} / ${total || 0}</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
      ${(partial || []).length ? renderAssetItems(partial) : ''}
    `;
    return;
  }

  // Empty
  if (!assets || assets.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <p>Tidak ada asset ditemukan</p>
    </div>`;
    return;
  }

  const ok       = assets.filter(a => a.ok);
  const fail     = assets.filter(a => !a.ok);
  const totalSz  = ok.reduce((s, a) => s + (a.size || 0), 0);

  container.innerHTML = `
    <div class="assets-summary">
      <span class="assets-summary-text">${ok.length} berhasil &middot; ${fail.length} gagal &middot; ${(totalSz/1024).toFixed(1)} KB</span>
      <span class="assets-summary-count">${assets.length} asset</span>
    </div>
    <div class="assets-action-row">
      <button class="btn-download-zip" id="btn-zip-assets">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Semua (${ok.length}) sebagai ZIP
      </button>
    </div>
    ${renderAssetItems(assets)}
  `;

  $('btn-zip-assets')?.addEventListener('click', () => buildAndDownloadZip(assets));
}

function renderAssetItems(assets) {
  const groups = { img: [], css: [], js: [], font: [], other: [] };
  assets.forEach(a => { (groups[a.type] || groups.other).push(a); });

  const groupLabels = { img: 'Gambar', css: 'CSS', js: 'JavaScript', font: 'Font', other: 'Lainnya' };
  let html = '';

  for (const [type, items] of Object.entries(groups)) {
    if (!items.length) continue;
    html += `<div class="asset-group-title">${groupLabels[type]} (${items.length})</div>`;

    items.forEach((a, idx) => {
      const name = escHtml(a.filename || a.url.split('/').pop().split('?')[0] || 'asset');
      const sizeStr = a.size ? `${(a.size/1024).toFixed(1)}KB` : '';
      const errStr  = a.error ? ` title="${escHtml(a.error)}"` : '';

      // Image preview thumbnail
      const preview = (a.ok && a.type === 'img' && a.objectUrl)
        ? `<img class="asset-thumb" src="${a.objectUrl}" alt="${escHtml(a.alt || '')}" loading="lazy" />`
        : `<div class="asset-thumb asset-thumb-placeholder badge-${type}">${type}</div>`;

      // Per-file download button
      const dlBtn = a.ok && a.objectUrl
        ? `<button class="btn-asset-dl" data-url="${a.objectUrl}" data-name="${name}" data-direct="${a.direct ? 'true' : 'false'}" title="Download ${name}">
             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
           </button>`
        : `<span class="asset-status-fail"${errStr}>✗</span>`;

      html += `
        <div class="asset-item" data-idx="${idx}" data-type="${type}">
          ${preview}
          <div class="asset-info">
            <span class="asset-url" title="${escHtml(a.url)}">${name}</span>
            <span class="asset-size">${sizeStr}</span>
          </div>
          <span class="asset-type-badge badge-${type}">${type}</span>
          ${dlBtn}
        </div>`;
    });
  }
  return html;
}

// Wire per-file download buttons (event delegation on assets-list)
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-asset-dl');
  if (!btn) return;
  const objUrl = btn.dataset.url;
  const name   = btn.dataset.name || 'asset';
  const direct = btn.dataset.direct === 'true';
  if (!objUrl) return;

  if (direct) {
    // Direct image URL — open in new tab (browser handles download)
    window.open(objUrl, '_blank', 'noopener');
  } else {
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = name;
    a.click();
  }
});

/**
 * Build a ZIP of all assets.
 * All ok assets already have a blob from fetchRawWithFallback.
 */
async function buildAndDownloadZip(assets) {
  if (typeof JSZip === 'undefined') {
    toast('JSZip tidak tersedia — cek koneksi internet', 'error');
    return;
  }
  const okAssets = assets.filter(a => a.ok);
  if (!okAssets.length) { toast('Tidak ada asset yang berhasil', 'error'); return; }

  const btn = $('btn-zip-assets');
  if (btn) { btn.disabled = true; btn.textContent = `Membuat ZIP...`; }

  try {
    const zip = new JSZip();
    const folderMap = { img: 'images', css: 'css', js: 'js', font: 'fonts', other: 'other' };
    let added = 0;

    for (const asset of okAssets) {
      const folder   = folderMap[asset.type] || 'other';
      const filename = asset.filename || filenameFromUrl(asset.url);

      if (asset.blob) {
        zip.folder(folder).file(filename, asset.blob);
        added++;
      }
    }

    if (!added) { toast('Tidak ada file yang bisa di-ZIP', 'error'); return; }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const hostname = safeHostname(state.nodes.find(n => n.type === 'source-url')?.data?.url || 'assets');
    downloadFile(`${hostname}-assets.zip`, zipBlob, 'application/zip');
    toast(`ZIP berhasil! ${added} file · ${(zipBlob.size/1024).toFixed(1)}KB`, 'success');
  } catch (e) {
    toast('Gagal membuat ZIP: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      const okCount = assets.filter(a => a.ok).length;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Semua (${okCount}) sebagai ZIP`;
    }
  }
}

// ─── Skill Analysis ──────────────────────────────────────────

// Tech stack signatures: { name, category, level, keywords[], resources[] }
const TECH_SIGNATURES = [
  // Frontend Frameworks
  { name: 'React',      category: 'Frontend Framework', level: 'intermediate', keywords: ['react','reactdom','jsx','useState','useEffect','react-dom','react-router'], resources: [{ title: 'React Docs', url: 'https://react.dev' }, { title: 'Full Stack Open', url: 'https://fullstackopen.com' }] },
  { name: 'Vue.js',     category: 'Frontend Framework', level: 'intermediate', keywords: ['vue','vuex','vue-router','v-model','v-bind','vue.js'], resources: [{ title: 'Vue Docs', url: 'https://vuejs.org' }, { title: 'Vue Mastery', url: 'https://www.vuemastery.com' }] },
  { name: 'Angular',    category: 'Frontend Framework', level: 'advanced',     keywords: ['angular','ng-','ngmodule','ngcomponent','angularjs','@angular'], resources: [{ title: 'Angular Docs', url: 'https://angular.dev' }, { title: 'Angular University', url: 'https://blog.angular-university.io' }] },
  { name: 'Svelte',     category: 'Frontend Framework', level: 'intermediate', keywords: ['svelte','sveltekit','.svelte'], resources: [{ title: 'Svelte Docs', url: 'https://svelte.dev' }, { title: 'Learn Svelte', url: 'https://learn.svelte.dev' }] },
  { name: 'Next.js',    category: 'Frontend Framework', level: 'intermediate', keywords: ['next.js','nextjs','_next','next/router','next/image'], resources: [{ title: 'Next.js Docs', url: 'https://nextjs.org/docs' }, { title: 'Next.js Learn', url: 'https://nextjs.org/learn' }] },
  { name: 'Nuxt.js',    category: 'Frontend Framework', level: 'intermediate', keywords: ['nuxt','nuxtjs','_nuxt'], resources: [{ title: 'Nuxt Docs', url: 'https://nuxt.com' }] },
  { name: 'Remix',      category: 'Frontend Framework', level: 'intermediate', keywords: ['remix','remix-run'], resources: [{ title: 'Remix Docs', url: 'https://remix.run/docs' }] },
  { name: 'Astro',      category: 'Frontend Framework', level: 'intermediate', keywords: ['astro','astrojs','.astro'], resources: [{ title: 'Astro Docs', url: 'https://docs.astro.build' }] },

  // CSS Frameworks
  { name: 'Tailwind CSS',  category: 'CSS Framework', level: 'beginner', keywords: ['tailwind','tailwindcss','tw-','bg-','text-','flex-','grid-','rounded-','p-','m-','w-','h-'], resources: [{ title: 'Tailwind Docs', url: 'https://tailwindcss.com/docs' }, { title: 'Tailwind Play', url: 'https://play.tailwindcss.com' }] },
  { name: 'Bootstrap',     category: 'CSS Framework', level: 'beginner', keywords: ['bootstrap','btn-','col-','container-','navbar-','modal-fade'], resources: [{ title: 'Bootstrap Docs', url: 'https://getbootstrap.com/docs' }] },
  { name: 'Material UI',   category: 'CSS Framework', level: 'intermediate', keywords: ['material-ui','mui','@mui','makeStyles','chakra'], resources: [{ title: 'MUI Docs', url: 'https://mui.com' }] },
  { name: 'Chakra UI',     category: 'CSS Framework', level: 'beginner',     keywords: ['chakra-ui','@chakra'], resources: [{ title: 'Chakra UI Docs', url: 'https://chakra-ui.com/docs' }] },
  { name: 'Styled Components', category: 'CSS Framework', level: 'intermediate', keywords: ['styled-components','styled.div','createGlobalStyle'], resources: [{ title: 'Styled Components Docs', url: 'https://styled-components.com/docs' }] },
  { name: 'Sass/SCSS',     category: 'CSS Framework', level: 'beginner',     keywords: ['.scss','.sass','@mixin','@include','$variable'], resources: [{ title: 'Sass Docs', url: 'https://sass-lang.com/documentation' }] },

  // Backend
  { name: 'Node.js',    category: 'Backend',  level: 'intermediate', keywords: ['node.js','nodejs','express','require(','module.exports','npm'], resources: [{ title: 'Node.js Docs', url: 'https://nodejs.org/en/docs' }, { title: 'The Odin Project', url: 'https://www.theodinproject.com' }] },
  { name: 'Express.js', category: 'Backend',  level: 'beginner',     keywords: ['express','app.get(','app.post(','router.','app.use('], resources: [{ title: 'Express Docs', url: 'https://expressjs.com' }] },
  { name: 'Laravel',    category: 'Backend',  level: 'intermediate', keywords: ['laravel','artisan','eloquent','blade','@extends','@yield'], resources: [{ title: 'Laravel Docs', url: 'https://laravel.com/docs' }, { title: 'Laracasts', url: 'https://laracasts.com' }] },
  { name: 'Django',     category: 'Backend',  level: 'intermediate', keywords: ['django','wsgi','csrftoken','{% block','{% url'], resources: [{ title: 'Django Docs', url: 'https://docs.djangoproject.com' }] },
  { name: 'WordPress',  category: 'Backend',  level: 'beginner',     keywords: ['wp-content','wp-includes','wordpress','wp-login','wp_enqueue'], resources: [{ title: 'WordPress Developer', url: 'https://developer.wordpress.org' }, { title: 'WP Beginner', url: 'https://www.wpbeginner.com' }] },
  { name: 'Shopify',    category: 'E-Commerce', level: 'intermediate', keywords: ['shopify','cdn.shopify','myshopify','liquid','{{ product'], resources: [{ title: 'Shopify Dev', url: 'https://shopify.dev/docs' }] },
  { name: 'FastAPI',    category: 'Backend',  level: 'intermediate', keywords: ['fastapi','uvicorn','pydantic'], resources: [{ title: 'FastAPI Docs', url: 'https://fastapi.tiangolo.com' }] },
  { name: 'NestJS',     category: 'Backend',  level: 'advanced',     keywords: ['nestjs','@controller','@injectable','@module'], resources: [{ title: 'NestJS Docs', url: 'https://docs.nestjs.com' }] },

  // State Management
  { name: 'Redux',      category: 'State Management', level: 'intermediate', keywords: ['redux','createstore','dispatch(','useSelector','useDispatch','@reduxjs'], resources: [{ title: 'Redux Docs', url: 'https://redux.js.org' }] },
  { name: 'Zustand',    category: 'State Management', level: 'beginner',     keywords: ['zustand','create(','useStore'], resources: [{ title: 'Zustand GitHub', url: 'https://github.com/pmndrs/zustand' }] },
  { name: 'Pinia',      category: 'State Management', level: 'beginner',     keywords: ['pinia','defineStore','useStore'], resources: [{ title: 'Pinia Docs', url: 'https://pinia.vuejs.org' }] },

  // Build Tools
  { name: 'Vite',       category: 'Build Tool', level: 'beginner', keywords: ['vite','vite.config','@vitejs'], resources: [{ title: 'Vite Docs', url: 'https://vitejs.dev/guide' }] },
  { name: 'Webpack',    category: 'Build Tool', level: 'intermediate', keywords: ['webpack','webpack.config','bundle.js','chunks'], resources: [{ title: 'Webpack Docs', url: 'https://webpack.js.org/concepts' }] },
  { name: 'TypeScript', category: 'Language',   level: 'intermediate', keywords: ['typescript','.tsx','.ts','interface ','type ','enum '], resources: [{ title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook' }, { title: 'Total TypeScript', url: 'https://www.totaltypescript.com' }] },

  // Analytics & Tracking
  { name: 'Google Analytics', category: 'Analytics', level: 'beginner', keywords: ['google-analytics','gtag','ga(','UA-','G-','googletagmanager'], resources: [{ title: 'GA4 Docs', url: 'https://developers.google.com/analytics' }] },
  { name: 'Google Tag Manager', category: 'Analytics', level: 'beginner', keywords: ['googletagmanager','gtm.js','GTM-'], resources: [{ title: 'GTM Docs', url: 'https://developers.google.com/tag-platform/tag-manager' }] },

  // UI Libraries
  { name: 'jQuery',     category: 'UI Library', level: 'beginner', keywords: ['jquery','$(document)','$.ajax','$.get','$(\'','$("'], resources: [{ title: 'jQuery Docs', url: 'https://api.jquery.com' }, { title: 'jQuery Learning', url: 'https://learn.jquery.com' }] },
  { name: 'Alpine.js',  category: 'UI Library', level: 'beginner', keywords: ['alpinejs','x-data','x-bind','x-on','x-show'], resources: [{ title: 'Alpine.js Docs', url: 'https://alpinejs.dev/start-here' }] },
  { name: 'GSAP',       category: 'Animation', level: 'intermediate', keywords: ['gsap','tweenmax','tweenlite','timeline(','gsap.to('], resources: [{ title: 'GSAP Docs', url: 'https://gsap.com/docs/v3' }] },
  { name: 'Three.js',   category: '3D/WebGL',  level: 'advanced', keywords: ['three.js','threejs','scene.add','webglrenderer','perspectivecamera'], resources: [{ title: 'Three.js Docs', url: 'https://threejs.org/docs' }, { title: 'Three.js Journey', url: 'https://threejs-journey.com' }] },

  // Fonts / CDNs
  { name: 'Google Fonts', category: 'Typography', level: 'beginner', keywords: ['fonts.googleapis.com','fonts.gstatic.com'], resources: [{ title: 'Google Fonts', url: 'https://fonts.google.com' }] },
  { name: 'Font Awesome', category: 'Icon Library', level: 'beginner', keywords: ['font-awesome','fontawesome','fa-','fas ','fab ','far '], resources: [{ title: 'Font Awesome Docs', url: 'https://fontawesome.com/docs' }] },
  { name: 'Lucide',     category: 'Icon Library', level: 'beginner', keywords: ['lucide','lucide-react','lucide-vue'], resources: [{ title: 'Lucide Icons', url: 'https://lucide.dev' }] },

  // CMS / Platforms
  { name: 'Webflow',    category: 'No-Code',  level: 'beginner', keywords: ['webflow','w-nav','w-container','wf-'], resources: [{ title: 'Webflow University', url: 'https://university.webflow.com' }] },
  { name: 'Framer',     category: 'No-Code',  level: 'beginner', keywords: ['framer-motion','framer.com','framer-site'], resources: [{ title: 'Framer Docs', url: 'https://www.framer.com/developers' }] },
  { name: 'Vercel',     category: 'Deployment', level: 'beginner', keywords: ['vercel.com','vercel.app','_vercel'], resources: [{ title: 'Vercel Docs', url: 'https://vercel.com/docs' }] },
  { name: 'Netlify',    category: 'Deployment', level: 'beginner', keywords: ['netlify','netlify.app','netlify.com'], resources: [{ title: 'Netlify Docs', url: 'https://docs.netlify.com' }] },
];

const LEVEL_ORDER = { beginner: 1, intermediate: 2, advanced: 3 };

async function analyzeSkills(url, results) {
  // Combine all available text sources for fingerprinting
  const sources = [
    results.html || '',
    results.md   || '',
    results.design || '',
    url,
  ].join('\n').toLowerCase();

  const detected = [];
  const seen = new Set();

  TECH_SIGNATURES.forEach(tech => {
    const hit = tech.keywords.some(kw => sources.includes(kw.toLowerCase()));
    if (hit && !seen.has(tech.name)) {
      seen.add(tech.name);
      detected.push({ ...tech });
    }
  });

  // Always include base web skills
  const baseSkills = [
    { name: 'HTML5',        category: 'Core Web', level: 'beginner', keywords: [], resources: [{ title: 'MDN HTML', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' }, { title: 'HTML.com', url: 'https://html.com' }] },
    { name: 'CSS3',         category: 'Core Web', level: 'beginner', keywords: [], resources: [{ title: 'MDN CSS', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS' }, { title: 'CSS Tricks', url: 'https://css-tricks.com' }] },
    { name: 'JavaScript',   category: 'Core Web', level: 'beginner', keywords: [], resources: [{ title: 'MDN JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' }, { title: 'JavaScript.info', url: 'https://javascript.info' }] },
    { name: 'Responsive Design', category: 'Core Web', level: 'beginner', keywords: [], resources: [{ title: 'MDN Responsive Design', url: 'https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design' }] },
    { name: 'Git & GitHub', category: 'DevOps',   level: 'beginner', keywords: [], resources: [{ title: 'Git Docs', url: 'https://git-scm.com/doc' }, { title: 'GitHub Skills', url: 'https://skills.github.com' }] },
  ];

  // Merge — avoid duplicates with detected
  baseSkills.forEach(s => { if (!seen.has(s.name)) { seen.add(s.name); detected.push(s); } });

  // Generate the SKILLS.md document
  const skillsMd = generateSkillsMd(url, detected, results);

  return { detected, skillsMd };
}

function generateSkillsMd(url, skills, results) {
  const hostname = safeHostname(url);
  const now = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  // Group by category
  const grouped = {};
  skills.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });

  const levelEmoji = { beginner: '🟢', intermediate: '🟡', advanced: '🔴' };
  const levelLabel = { beginner: 'Pemula', intermediate: 'Menengah', advanced: 'Mahir' };

  let md = `# SKILLS.md — Rekomendasi Skill untuk Clone ${hostname}\n\n`;
  md += `> Dibuat otomatis oleh sugi-tools pada ${now}  \n`;
  md += `> Berdasarkan analisis tech stack dari: ${url}\n\n`;
  md += `---\n\n`;

  // Summary table
  const byLevel = { beginner: 0, intermediate: 0, advanced: 0 };
  skills.forEach(s => { byLevel[s.level] = (byLevel[s.level] || 0) + 1; });

  md += `## Ringkasan\n\n`;
  md += `| Level | Jumlah Skill | Keterangan |\n`;
  md += `|---|---|---|\n`;
  md += `| 🟢 Pemula | ${byLevel.beginner} | Wajib dikuasai terlebih dahulu |\n`;
  md += `| 🟡 Menengah | ${byLevel.intermediate} | Diperlukan untuk membangun fitur utama |\n`;
  md += `| 🔴 Mahir | ${byLevel.advanced} | Untuk optimasi dan fitur lanjutan |\n\n`;

  // Learning path
  md += `## Learning Path yang Disarankan\n\n`;
  const ordered = [...skills].sort((a, b) => (LEVEL_ORDER[a.level] || 1) - (LEVEL_ORDER[b.level] || 1));
  ordered.forEach((s, i) => {
    md += `${i + 1}. **${s.name}** (${levelLabel[s.level] || s.level}) — ${s.category}\n`;
  });
  md += '\n';

  // Detail per category
  md += `## Detail per Kategori\n\n`;
  for (const [cat, items] of Object.entries(grouped)) {
    md += `### ${cat}\n\n`;
    items.sort((a, b) => (LEVEL_ORDER[a.level] || 1) - (LEVEL_ORDER[b.level] || 1)).forEach(s => {
      md += `#### ${levelEmoji[s.level] || ''} ${s.name}\n\n`;
      md += `- **Level**: ${levelLabel[s.level] || s.level}\n`;
      md += `- **Kategori**: ${s.category}\n`;
      if (s.resources?.length) {
        md += `- **Resource Belajar**:\n`;
        s.resources.forEach(r => { md += `  - [${r.title}](${r.url})\n`; });
      }
      md += '\n';
    });
  }

  // Tech stack yang terdeteksi
  const detectedNonBase = skills.filter(s => s.category !== 'Core Web' && s.category !== 'DevOps');
  if (detectedNonBase.length) {
    md += `## Tech Stack Terdeteksi\n\n`;
    md += `Website ini menggunakan teknologi berikut yang perlu dikuasai:\n\n`;
    detectedNonBase.forEach(s => {
      md += `- **${s.name}** — ${s.category}\n`;
    });
    md += '\n';
  }

  // Roadmap estimasi waktu
  md += `## Estimasi Waktu Belajar\n\n`;
  md += `| Fase | Skill | Estimasi |\n`;
  md += `|---|---|---|\n`;
  const phases = [
    { label: 'Fase 1 (Fondasi)', filter: s => s.level === 'beginner' && s.category === 'Core Web' },
    { label: 'Fase 2 (Framework)', filter: s => s.level === 'beginner' && s.category !== 'Core Web' },
    { label: 'Fase 3 (Lanjutan)', filter: s => s.level === 'intermediate' },
    { label: 'Fase 4 (Mahir)', filter: s => s.level === 'advanced' },
  ];
  const timeMap = { beginner: '2-4 minggu', intermediate: '4-8 minggu', advanced: '8-16 minggu' };
  phases.forEach(p => {
    const matched = skills.filter(p.filter);
    if (matched.length) {
      matched.forEach(s => {
        md += `| ${p.label} | ${s.name} | ${timeMap[s.level]} |\n`;
      });
    }
  });
  md += '\n';

  md += `---\n\n`;
  md += `> **Catatan**: Urutan belajar di atas adalah rekomendasi berdasarkan tech stack yang terdeteksi.\n`;
  md += `> Sesuaikan dengan kebutuhan dan kecepatan belajar Anda.\n`;

  return md;
}

/**
 * Render skills tab UI with category cards, level badges, resource links, and export button.
 */
function renderSkillsTab(skillsResult) {
  const panel = $('skills-panel');
  if (!panel) return;

  if (!skillsResult || !skillsResult.detected?.length) {
    panel.innerHTML = `<div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <p>Tambahkan node Skill Analysis dan jalankan pipeline</p>
    </div>`;
    return;
  }

  const { detected, skillsMd } = skillsResult;
  const byLevel = { beginner: 0, intermediate: 0, advanced: 0 };
  detected.forEach(s => { byLevel[s.level] = (byLevel[s.level] || 0) + 1; });

  // Group by category
  const grouped = {};
  detected.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });

  const levelColor = { beginner: 'var(--green)', intermediate: 'var(--yellow)', advanced: 'var(--red)' };
  const levelLabel = { beginner: 'Pemula', intermediate: 'Menengah', advanced: 'Mahir' };

  let html = `
    <div class="skills-header">
      <div class="skills-stats">
        <div class="skill-stat"><span class="stat-dot" style="background:var(--green)"></span>${byLevel.beginner} Pemula</div>
        <div class="skill-stat"><span class="stat-dot" style="background:var(--yellow)"></span>${byLevel.intermediate} Menengah</div>
        <div class="skill-stat"><span class="stat-dot" style="background:var(--red)"></span>${byLevel.advanced} Mahir</div>
      </div>
      <button class="btn-export-skills" id="btn-export-skills-md">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export SKILLS.md
      </button>
    </div>
  `;

  for (const [cat, items] of Object.entries(grouped)) {
    html += `<div class="skill-group-title">${escHtml(cat)}</div>`;
    items.sort((a, b) => (LEVEL_ORDER[a.level] || 1) - (LEVEL_ORDER[b.level] || 1)).forEach(skill => {
      const color = levelColor[skill.level] || 'var(--text-muted)';
      const label = levelLabel[skill.level] || skill.level;
      html += `
        <div class="skill-item">
          <div class="skill-item-top">
            <span class="skill-name">${escHtml(skill.name)}</span>
            <span class="skill-level-badge" style="color:${color};border-color:${color}20;background:${color}15">${label}</span>
          </div>
          ${skill.resources?.length ? `
          <div class="skill-resources">
            ${skill.resources.map(r => `<a href="${escHtml(r.url)}" target="_blank" rel="noopener" class="skill-resource-link">${escHtml(r.title)}</a>`).join('')}
          </div>` : ''}
        </div>`;
    });
  }

  panel.innerHTML = html;

  // Wire export button
  $('btn-export-skills-md')?.addEventListener('click', () => {
    if (!skillsMd) { toast('Tidak ada data skills', 'error'); return; }
    downloadFile('SKILLS.md', skillsMd, 'text/markdown');
    toast('SKILLS.md berhasil diunduh!', 'success');
  });
}

// ─── Init ─────────────────────────────────────────────────────
(function init() {
  updateHint();
  applyTransform();
  renderHistory();

  // Pre-populate a simple default pipeline for demo
  setTimeout(() => {
    const cx = canvas.getBoundingClientRect();
    const srcNode = createNode('source-url', 60, 80);
    const mdNode  = createNode('scrape-md',   320, 60);
    const sgNode  = createNode('styleguide',  320, 180);
    const aiNode  = createNode('ai-design',   580, 120);

    if (srcNode && mdNode) {
      addEdge(srcNode.id, mdNode.id);
      addEdge(srcNode.id, sgNode.id);
      addEdge(mdNode.id,  aiNode.id);
      addEdge(sgNode.id,  aiNode.id);
    }

    selectNode(null);
    redrawEdges();
  }, 50);
})();
