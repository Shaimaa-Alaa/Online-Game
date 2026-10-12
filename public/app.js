(function () {
'use strict';

/* ================= helpers ================= */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
function h(tag, props) {
  const el = document.createElement(tag); props = props || {};
  Object.keys(props).forEach((k) => {
    const v = props[k];
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  });
  for (let i = 2; i < arguments.length; i++) [].concat(arguments[i]).forEach((c) => { if (c != null && c !== false) el.append(c); });
  return el;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const sess = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const LETTERS = ['A', 'B', 'C', 'D'];
const DIFF = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const COLORS = {
  red: { h: 0, s: 0.82, l: 0.5, css: '#ef4444', sw: '#ef4444', ar: 'أحمر' },
  blue: { h: 215, s: 0.85, l: 0.52, css: '#3b82f6', sw: '#3b82f6', ar: 'أزرق' },
  green: { h: 135, s: 0.7, l: 0.42, css: '#22c55e', sw: '#22c55e', ar: 'أخضر' },
  yellow: { h: 48, s: 0.95, l: 0.5, css: '#eab308', sw: '#facc15', ar: 'أصفر' },
  purple: { h: 278, s: 0.7, l: 0.5, css: '#a855f7', sw: '#a855f7', ar: 'بنفسجي' },
  black: { h: 225, s: 0.12, l: 0.12, css: '#4b5563', sw: '#1f2430', ar: 'أسود' },
  white: { h: 0, s: 0, l: 0.94, css: '#94a3b8', sw: '#f1f5f9', ar: 'أبيض' },
  orange: { h: 24, s: 0.95, l: 0.52, css: '#f97316', sw: '#f97316', ar: 'برتقالي' },
  pink: { h: 330, s: 0.8, l: 0.58, css: '#ec4899', sw: '#ec4899', ar: 'وردي' },
};
const COLOR_KEYS = Object.keys(COLORS);
const R3 = (typeof THREE !== 'undefined' && typeof makeRace3D === 'function') ? makeRace3D(THREE, document) : null;

/* ================= sound ================= */
let muted = store.get('sbq-muted') === '1', ac = null, eng = null;
function audioCtx() { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
function sfx(kind) {
  if (muted) return;
  try {
    const a = audioCtx(); let t = a.currentTime;
    if (kind === 'boost') {
      const len = Math.floor(a.sampleRate * 0.6), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.createBufferSource(), bp = a.createBiquadFilter(), gg = a.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.5);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.14, t + 0.12); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      src.buffer = buf; src.connect(bp); bp.connect(gg); gg.connect(a.destination); src.start(t); return;
    }
    const seq = { good: [[660, .09], [880, .14]], bad: [[200, .18], [150, .22]], finish: [[523, .1], [659, .1], [784, .1], [1047, .25]], beep: [[520, .08]], tick: [[1180, .05]], go: [[880, .35]] }[kind] || [];
    seq.forEach((n) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = n[0];
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + n[1]);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + n[1] + .02); t += n[1] * .9;
    });
  } catch (e) { /* ignore */ }
}
function engineSet(v, accel) {
  if (muted) { if (eng) eng.g.gain.value = 0; return; }
  try {
    if (!eng) {
      const a = audioCtx(), o1 = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.Q.value = 2; g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(a.destination); o1.start(); o2.start();
      eng = { o1, o2, f, g };
    }
    const t = ac.currentTime, rpm = 48 + v * 150 + (accel ? 14 : 0);
    eng.o1.frequency.setTargetAtTime(rpm, t, 0.06); eng.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.06);
    eng.f.frequency.setTargetAtTime(380 + v * 1500, t, 0.08);
    eng.g.gain.setTargetAtTime(0.012 + v * 0.03 + (accel ? 0.012 : 0), t, 0.08);
  } catch (e) { /* ignore */ }
}
function engineStop() {
  if (!eng) return; const e = eng; eng = null;
  try { e.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (x) { /* ignore */ } }, 400); } catch (x) { /* ignore */ }
}
function paintMute() {
  $('#s2-on').style.display = muted ? 'none' : ''; $('#s2-off').style.display = muted ? '' : 'none';
  $('#mute').setAttribute('aria-label', muted ? 'تشغيل الصوت' : 'كتم الصوت');
}
$('#mute').addEventListener('click', () => { muted = !muted; store.set('sbq-muted', muted ? '1' : '0'); paintMute(); if (muted && eng) eng.g.gain.value = 0; });
paintMute();

/* ================= 3D car preview (home / join / lobby) ================= */
const Preview = {
  cur: null,
  extra: [],
  mountHome(el) { if (!R3 || !el || !window.Scenes) return; try { const s = Scenes.home(el, R3, COLORS); if (s) this.extra.push(s); } catch (e) { /* ignore */ } },
  mountGrid(el, players) {
    if (!R3 || !el || !window.Scenes) return;
    if (this.grid && this.grid.el === el && el.querySelector('canvas')) { this.grid.update(players); return; }
    if (this.grid) { this.grid.dispose(); this.extra = this.extra.filter((x) => x !== this.grid); this.grid = null; }
    try { const s = Scenes.grid(el, R3, COLORS); if (s) { s.el = el; this.grid = s; this.extra.push(s); s.update(players); } } catch (e) { /* ignore */ }
  },
  mountPodium(el, top, myId) { if (!R3 || !el || !window.Scenes) return false; try { const s = Scenes.podium(el, R3, COLORS, top, myId); if (s) { this.extra.push(s); return true; } } catch (e) { /* ignore */ } return false; },
  mount(el, colorKey) {
    if (el && el.id === 'pv-home') { this.unmount(); this.mountHome(el); return; }
    this.unmount();
    if (!R3 || !el) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
    if (!renderer.getContext()) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    const cv = renderer.domElement; el.insertBefore(cv, el.firstChild);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 1, 0.5, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a99, 1.0));
    const sun = new THREE.DirectionalLight(0xfff0d6, 0.9); sun.position.set(6, 10, 7); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7aa7ff, 0.6); rim.position.set(-6, 4, -6); scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.3, 40), new THREE.MeshLambertMaterial({ color: 0x1a2550 }));
    disc.position.y = -0.2; scene.add(disc);
    const state = { renderer, scene, cam, car: null, raf: 0, el, key: colorKey, t: 0, dead: false };
    const build = (key) => {
      if (state.car) scene.remove(state.car);
      const mc = R3.makeCar(COLORS[key] || COLORS.red, '★', false, true);
      mc.group.scale.setScalar(1.15); scene.add(mc.group); state.car = mc.group;
    };
    state.build = build; build(colorKey);
    const fit = () => {
      const w = el.clientWidth || 300, h = el.clientHeight || 240; renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.fov = cam.aspect < 1 ? 46 : 34; cam.updateProjectionMatrix();
      cam.position.set(0, 4.2, cam.aspect < 1 ? 15 : 12.5); cam.lookAt(0, 1.2, 0);
    };
    fit();
    state.ro = window.ResizeObserver ? new ResizeObserver(fit) : null; if (state.ro) state.ro.observe(el);
    let last = 0;
    const loop = (now) => {
      if (state.dead) return; state.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; state.t += dt;
      if (state.car) { state.car.rotation.y += dt * 0.7; state.car.position.y = Math.sin(state.t * 2) * 0.04; state.car.children.forEach((c) => { if (c.children && c.children.length && c.position.y > 0.5 && c.position.y < 0.8 && Math.abs(c.position.z) > 1) c.rotation.x += dt * 2; }); }
      renderer.render(scene, cam);
    };
    state.raf = requestAnimationFrame(loop);
    this.cur = state;
  },
  setColor(key) { if (this.cur) { this.cur.key = key; this.cur.build(key); } },
  unmount() {
    this.extra.forEach((x) => { try { x.dispose(); } catch (e) { /* ignore */ } }); this.extra = []; this.grid = null;
    const s = this.cur; if (!s) return; s.dead = true; cancelAnimationFrame(s.raf); if (s.ro) s.ro.disconnect();
    try { s.renderer.dispose(); if (s.renderer.forceContextLoss) s.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    if (s.renderer.domElement.parentNode) s.renderer.domElement.parentNode.removeChild(s.renderer.domElement);
    this.cur = null;
  },
};

/* ================= network ================= */
const S = {
  role: null, offset: 0, bestRtt: 1e9, ws: null, closing: false, retry: 0,
  student: sess.get('sbq-student'), teacher: sess.get('sbq-teacher'), pass: '',
  lobby: null, race: null, color: store.get('sbq-color') || 'red', view: 'home',
};
const handlers = {};
function on(t, fn) { handlers[t] = fn; }
const nowS = () => Date.now() + S.offset;
function send(m) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(m)); }
function connect() {
  if (S.ws && (S.ws.readyState === 0 || S.ws.readyState === 1)) return;
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  S.ws = ws;
  ws.onopen = () => {
    S.retry = 0; $('#conn').hidden = true;
    for (let i = 0; i < 6; i++) setTimeout(() => send({ t: 'ping', c: Date.now() }), i * 140);
    if (S.student && S.student.token) send({ t: 'rejoin', code: S.student.code, token: S.student.token });
    else if (S.teacher && S.teacher.tkey) send({ t: 'tjoin', code: S.teacher.code, tkey: S.teacher.tkey });
  };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'pong') { const rtt = Date.now() - m.c; if (rtt < S.bestRtt) { S.bestRtt = rtt; S.offset = m.s + rtt / 2 - Date.now(); } return; }
    if (handlers[m.t]) handlers[m.t](m);
  };
  ws.onclose = () => {
    if (S.ws === ws) S.ws = null;
    if (S.closing) return;
    if (S.role) $('#conn').hidden = false;
    setTimeout(connect, Math.min(4000, 600 * ++S.retry));
  };
  ws.onerror = () => { /* onclose handles it */ };
}
function whenOpen(fn) {
  connect();
  if (S.ws && S.ws.readyState === 1) return fn();
  const t = setInterval(() => { if (S.ws && S.ws.readyState === 1) { clearInterval(t); fn(); } }, 80);
  setTimeout(() => clearInterval(t), 8000);
}

/* ================= views ================= */
function show(id) {
  $$('.view').forEach((v) => { v.hidden = v.id !== 'v-' + id; });
  S.view = id; document.body.classList.toggle('racing3d', id === 'race');
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  Preview.unmount();
}
function swatches(box, current, onPick) {
  box.replaceChildren();
  COLOR_KEYS.forEach((k) => {
    box.append(h('button', {
      type: 'button', class: 'sw', role: 'radio', 'aria-checked': k === current ? 'true' : 'false', 'aria-label': COLORS[k].ar, title: COLORS[k].ar,
      style: 'background:' + COLORS[k].sw, onclick: () => { onPick(k); $$('.sw', box).forEach((b, i) => b.setAttribute('aria-checked', COLOR_KEYS[i] === k ? 'true' : 'false')); },
    }));
  });
}
function goHome() {
  S.role = null; S.student = null; S.teacher = null; sess.del('sbq-student'); sess.del('sbq-teacher');
  endRace(); $('#conn').hidden = true; show('home'); Preview.mount($('#pv-home'), 'red');
}

/* ---------- home ---------- */
$('#h-join').addEventListener('click', openJoin);
$('#h-teacher').addEventListener('click', () => { show('tlogin'); $('#tl-err').hidden = true; });
function openJoin() {
  show('join'); $('#j-err').hidden = true;
  const q = new URLSearchParams(location.search).get('code');
  if (q) $('#j-code').value = q.replace(/\D/g, '').slice(0, 6);
  /* arrived through the QR / link: the room code is already known, so only the name is asked */
  $('#j-codefield').hidden = !!($('#j-code').value.length === 6 && q);
  $('#j-name').value = store.get('sbq-name') || '';
  swatches($('#j-sw'), S.color, (k) => { S.color = k; Preview.setColor(k); });
  Preview.mount($('#pv-join'), S.color);
}
$('#j-back').addEventListener('click', () => { show('home'); Preview.mount($('#pv-home'), 'red'); });
$('#j-code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('#j-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('#j-code').value.trim(), name = $('#j-name').value.replace(/\s+/g, ' ').trim();
  const err = (t) => { const x = $('#j-err'); x.textContent = t; x.hidden = false; };
  if (code.length !== 6) return err('Enter the 6-digit game code.');
  if (!name) return err('Please enter your name.');
  $('#j-err').hidden = true; store.set('sbq-name', name); store.set('sbq-color', S.color);
  S.role = 'student'; S.student = null;
  whenOpen(() => send({ t: 'join', code, name, color: S.color }));
});

/* ---------- errors from server ---------- */
on('error', (m) => {
  if (S.role === 'student' && (S.view === 'join' || (S.view === 'home'))) { const x = $('#j-err'); x.textContent = m.msg; x.hidden = false; return; }
  if (m.code === 'gone') {
    if (S.role === 'teacher') { S.teacher = null; sess.del('sbq-teacher'); $('#td-resume').hidden = true; if (S.view === 'tlive') openDash(); }
    else if (S.role === 'student') { S.student = null; sess.del('sbq-student'); goHome(); }
    return;
  }
  if (S.role === 'teacher') { const x = S.view === 'tdash' ? $('#g-err') : null; if (x) { x.textContent = m.msg; x.hidden = false; } else alert2(m.msg); return; }
  alert2(m.msg);
});
function alert2(msg) { const c = $('#conn'); c.textContent = msg; c.hidden = false; setTimeout(() => { c.hidden = true; c.textContent = 'الاتصال انقطع… بنحاول نرجّعه'; }, 3500); }
on('kicked', () => { S.student = null; sess.del('sbq-student'); goHome(); alert2('المعلمة شالتك من الغرفة.'); });
on('closed', () => { if (S.role === 'student') { goHome(); alert2('المعلمة قفلت الغرفة.'); } });

/* ---------- student lobby ---------- */
on('joined', (m) => {
  S.role = 'student'; S.student = { code: m.code, token: m.token, pid: m.pid, name: m.name, color: m.color };
  sess.set('sbq-student', S.student); S.color = m.color; $('#conn').hidden = true;
  if (S.view === 'join' || S.view === 'home' || S.view === 'slobby') { show('slobby'); Preview.mount($('#pv-lobby'), m.color); if (S.lobby) Preview.mountGrid($('#pv-grid'), S.lobby.players); }
  $('#sl-code').textContent = m.code; $('#sl-me').textContent = m.name;
  swatches($('#sl-sw'), m.color, (k) => { S.color = k; Preview.setColor(k); send({ t: 'color', color: k }); });
});
function paintPlayers(list, box, meId, teacher) {
  box.replaceChildren();
  list.forEach((p) => {
    const row = h('div', { class: 'prow' + (p.id === meId ? ' me' : '') + (p.connected ? '' : ' off') },
      h('i', { class: 'dot', style: 'background:' + (COLORS[p.color] || COLORS.red).sw }),
      h('span', { class: 'nm', text: p.name + (p.id === meId ? ' (أنت)' : '') }),
      p.connected ? null : h('span', { class: 'chip bad', text: 'منقطع' }),
      teacher ? h('button', { class: 'btn btn-red btn-sm', type: 'button', text: 'إزالة', onclick: () => send({ t: 'kick', pid: p.id }) }) : null);
    box.append(row);
  });
}
on('lobby', (m) => {
  S.lobby = m;
  if (S.role === 'student' && S.student) {
    $('#sl-count').textContent = m.players.length; $('#sl-title').textContent = m.title || 'RACE LOBBY';
    paintPlayers(m.players, $('#sl-list'), S.student.pid, false);
    const me = m.players.find((p) => p.id === S.student.pid);
    if (S.view === 'home' || S.view === 'join') { show('slobby'); Preview.mount($('#pv-lobby'), S.color); }
    if (S.view === 'slobby') Preview.mountGrid($('#pv-grid'), m.players);
  }
  if (S.role === 'teacher') paintTeacherLobby(m);
});

/* ---------- race (student) ---------- */
const Race = { view: null, players: [], total: 0, ready: false, pending: null, q: null, answered: -1, tick: 0, flat: null };
function endRace() {
  engineStop(); clearInterval(Race.tick);
  if (Race.view) { try { Race.view.dispose(); } catch (e) { /* ignore */ } Race.view = null; }
  $$('.gl,.hud,.tags,.cd,.sl,.flash,.toast3d,.flatbars', $('#stage')).forEach((n) => n.remove());
  Race.ready = false; Race.pending = null; Race.q = null; $('#qbox').hidden = true;
}
on('countdown', (m) => {
  if (S.role !== 'student' || !S.student) return;
  if (S.bestRtt > 1e8) S.offset = m.serverNow - Date.now();
  if (Race.view) return;
  Preview.unmount(); show('race'); $('#bar-title').textContent = (S.lobby && S.lobby.title) || 'سباق المعرفة';
  const list = (S.lobby ? S.lobby.players : []).map((p) => ({ id: p.id, name: p.name, color: COLORS[p.color] || COLORS.red, score: 0 }));
  Race.players = list; Race.total = m.total; Race.ready = false; Race.pending = null; Race.answered = -1;
  const R = { cfg: { title: (S.lobby && S.lobby.title) || 'سباق المعرفة' }, players: list, myId: S.student.pid, total: m.total };
  const goIn = m.startAt - nowS();
  let view = null; try { view = R3 ? R3.create($('#stage'), R, { onFrame: engineSet }) : null; } catch (e) { view = null; if (window.console) console.error('race3d create failed', e); }
  if (view) {
    Race.view = view;
    view.countdown(goIn).then(() => { Race.ready = true; if (Race.pending) { const p = Race.pending; Race.pending = null; showQuestion(p); } });
    [3, 2, 1].forEach((n, i) => setTimeout(() => sfx('beep'), Math.max(0, goIn - n * 1000)));
    setTimeout(() => sfx('go'), Math.max(0, goIn));
  } else {
    buildFlat(list); setTimeout(() => { Race.ready = true; if (Race.pending) { const p = Race.pending; Race.pending = null; showQuestion(p); } }, Math.max(0, goIn + 400));
  }
});
function buildFlat(list) {
  const box = h('div', { class: 'flatbars' });
  list.forEach((p) => box.append(h('div', { class: 'fb-row', 'data-id': p.id }, h('span', { class: 'nm', text: p.name }), h('div', { class: 'bar' }, h('i', { style: 'background:' + p.color.css })))));
  $('#stage').insertBefore(box, $('#stage').firstChild); Race.flat = box; document.body.classList.remove('racing3d'); $('#v-race').style.cssText = 'position:static;display:block';
  $('.racebar').style.display = 'none'; $('#stage').style.cssText = 'height:100vh;position:relative';
}
function updateFlat() {
  if (!Race.flat) return;
  Race.players.forEach((p) => { const i = $('.fb-row[data-id="' + p.id + '"] .bar i', Race.flat); if (i) i.style.width = (p.score / Math.max(1, Race.total) * 100) + '%'; });
}
on('question', (m) => {
  if (S.role !== 'student') return;
  if (S.view !== 'race') { /* reconnected mid-game */ rebuildRaceFromLobby(m); }
  if (m.serverNow && S.bestRtt > 1e8) S.offset = m.serverNow - Date.now();
  if (!Race.ready) { Race.pending = m; return; }
  showQuestion(m);
});
function rebuildRaceFromLobby(m) {
  if (Race.view || !S.lobby) return;
  Preview.unmount(); show('race'); $('#bar-title').textContent = S.lobby.title;
  const list = S.lobby.players.map((p) => ({ id: p.id, name: p.name, color: COLORS[p.color] || COLORS.red, score: 0 }));
  Race.players = list; Race.total = m.total;
  const R = { cfg: { title: S.lobby.title }, players: list, myId: S.student.pid, total: m.total };
  let view = null; try { view = R3 ? R3.create($('#stage'), R, { onFrame: engineSet }) : null; } catch (e) { view = null; if (window.console) console.error('race3d create failed', e); }
  if (view) { Race.view = view; Race.needSnap = true; view.countdown(0).then(() => {}); Race.ready = true; } else { buildFlat(list); Race.ready = true; }
}
function isCodey(t) { return !/[؀-ۿ]/.test(t) && /[()\[\]{}=_"'.+*\/<>]/.test(t); }
function showQuestion(m) {
  Race.q = m; Race.answered = -1; Race.lastTick = -1;
  const box = $('#qbox'); box.hidden = false;
  $('#qnum').textContent = 'QUESTION ' + (m.n + 1) + ' / ' + m.total;
  $('#qtext').textContent = m.q;
  const code = $('#qcode'); code.hidden = !(m.code && m.code.trim()); code.textContent = m.code || '';
  const ch = $('#choices'); ch.replaceChildren(); ch.classList.toggle('short', m.type === 'short');
  $('#qchips').textContent = (m.points || 0) + ' PTS' + (m.difficulty ? ' · ' + DIFF[m.difficulty] : '') + (m.category ? ' · ' + m.category : '');
  if (m.type === 'short') {
    const inp = h('input', { type: 'text', class: 'shortin', id: 'shortin', maxlength: 100, autocomplete: 'off', dir: 'auto', placeholder: 'اكتبي إجابتك هنا…', 'aria-label': 'إجابتك' });
    const go = h('button', { type: 'button', class: 'btn btn-go', text: 'إرسال ↵' });
    const submit = () => { const v = inp.value.trim(); if (v) chooseText(v); };
    go.addEventListener('click', submit); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    ch.append(inp, go); setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
  } else m.choices.forEach((t, j) => {
    ch.append(h('button', { type: 'button', class: 'choice', onclick: () => choose(j) },
      h('span', { class: 'key k' + (j + 1), text: String(j + 1) }),
      h('span', { class: 'ctext' + (isCodey(t) ? ' codey' : ''), text: t, dir: 'auto' })));
  });
  const fb = $('#fb'); fb.textContent = ''; fb.className = 'feedback';
  if (Race.view && m.n === m.total - 1 && m.total > 1) Race.view.toast(m.total > 1 ? 'FINAL ROUND' : '', 'gold');
  clearInterval(Race.tick);
  const tick = () => {
    const left = Math.max(0, m.endsAt - nowS()), total = m.secs * 1000;
    $('#timer-fill').style.width = clamp(left / total * 100, 0, 100) + '%';
    $('#qtime').innerHTML = 'TIME LEFT: <b>' + String(Math.ceil(left / 1000)).padStart(2, '0') + '</b>';
    $('#timer').classList.toggle('low', left <= 5000); $('#qtime').classList.toggle('low', left <= 5000 && left > 0);
    const sec = Math.ceil(left / 1000);
    if (left > 0 && left <= 5000 && sec !== Race.lastTick && Race.answered < 0) { Race.lastTick = sec; sfx('tick'); }
    if (left <= 0) { clearInterval(Race.tick); if (Race.answered < 0) { if (Race.view) Race.view.toast("TIME'S UP", 'bad'); sfx('bad'); const si = $('#shortin'); if (si) si.disabled = true; $$('#choices button').forEach((b) => { b.disabled = true; }); $$('#choices .choice').forEach((b) => { b.disabled = true; }); $('#fb').textContent = 'الوقت خلص…'; $('#fb').className = 'feedback wait'; } }
  };
  tick(); Race.tick = setInterval(tick, 100);
}
function lock(j) { $$('#choices .choice').forEach((b, k) => { b.disabled = true; if (k === j) b.classList.add('picked'); }); const si = $('#shortin'); if (si) si.disabled = true; $$('#choices .btn').forEach((b) => { b.disabled = true; }); }
function choose(j) {
  if (!Race.q || Race.answered >= 0) return;
  if (nowS() > Race.q.endsAt + 300) return;
  Race.answered = j; send({ t: 'answer', n: Race.q.n, choice: j }); sfx('beep'); lock(j);
  $('#fb').textContent = 'تم إرسال إجابتك…'; $('#fb').className = 'feedback wait';
}
function chooseText(txt) {
  if (!Race.q || Race.answered >= 0) return;
  if (nowS() > Race.q.endsAt + 300) return;
  Race.answered = 0; send({ t: 'answer', n: Race.q.n, text: txt }); sfx('beep'); lock(-1);
  $('#fb').textContent = 'تم إرسال إجابتك…'; $('#fb').className = 'feedback wait';
}
function popPts(text, good) {
  const el = h('div', { class: 'pts-pop ' + (good ? 'good' : 'bad'), text }); $('#stage').append(el); setTimeout(() => el.remove(), 1500);
}
on('ack', (m) => {
  if (!Race.q || m.n !== Race.q.n) return; Race.answered = Math.max(0, m.choice); Race.myAck = { n: m.n, ok: m.ok };
  lock(m.choice);
  $$('#choices .choice').forEach((b, k) => { if (k === m.choice) b.classList.add(m.ok ? 'correct' : 'wrong'); });
  const fb = $('#fb');
  if (m.ok) {
    fb.textContent = 'إجابة صحيحة! +' + m.pts + ' نقطة'; fb.className = 'feedback good'; sfx('good'); sfx('boost'); popPts('+' + m.pts, true);
    if (Race.view) { Race.view.toast('CORRECT!', 'good'); Race.view.boostMe(); }
  } else {
    fb.textContent = 'إجابة غلط — استني ظهور الإجابة الصحيحة'; fb.className = 'feedback bad'; sfx('bad'); popPts('✕', false);
    if (Race.view) Race.view.wrongMe();
  }
});
document.addEventListener('keydown', (e) => {
  if (S.view !== 'race' || !Race.q || Race.answered >= 0 || e.ctrlKey || e.metaKey || e.altKey) return;
  let k = '1234'.indexOf(e.key); if (k < 0) k = '١٢٣٤'.indexOf(e.key);
  if (k >= 0 && k < Race.q.choices.length) { e.preventDefault(); choose(k); }
});
function applyBoard(board) {
  const order = {}; board.forEach((r, i) => { order[r.id] = i; });
  board.forEach((r) => { const p = Race.players.find((x) => x.id === r.id); if (p) p.score = r.correct; });
  Race.players.sort((a, b) => (order[a.id] == null ? 99 : order[a.id]) - (order[b.id] == null ? 99 : order[b.id]));
}
on('board', (m) => { if (S.role !== 'student') return; applyBoard(m.board); if (Race.needSnap && Race.view) { Race.needSnap = false; Race.view.sync(null); Race.view.snap(); } });
on('reveal', (m) => {
  if (S.role === 'student') {
    clearInterval(Race.tick);
    if (S.view !== 'race') return;
    const me = m.per[S.student.pid] || { ok: false, pts: 0, choice: -1 };
    const handled = Race.myAck && Race.myAck.n === m.n;
    $$('#choices .choice').forEach((b, k) => { b.disabled = true; b.classList.remove('picked', 'wrong', 'correct'); if (k === m.correct) b.classList.add('correct'); else if (k === me.choice) b.classList.add('wrong'); });
    const fb = $('#fb');
    if (m.qtype === 'short') { fb.textContent = (me.ok ? 'إجابة صحيحة! +' + me.pts + ' نقطة' : (me.choice < 0 && !me.text ? 'الوقت خلص. ' : 'إجابة غلط. ') + 'الإجابة الصحيحة: ' + m.correct); fb.className = 'feedback ' + (me.ok ? 'good' : 'bad'); }
    else if (me.ok) { fb.textContent = 'إجابة صحيحة! +' + me.pts + ' نقطة'; fb.className = 'feedback good'; }
    else { fb.textContent = me.choice < 0 ? 'الوقت خلص. الإجابة الصحيحة باللون الأخضر.' : 'إجابة غلط. الإجابة الصحيحة باللون الأخضر.'; fb.className = 'feedback bad'; }
    if (!handled && me.ok) { sfx('good'); sfx('boost'); } else if (!handled && !me.ok && me.choice >= 0) sfx('bad');
    applyBoard(m.board);
    if (Race.view) { Race.view.sync(handled || me.choice >= 0 ? null : false); if (m.last) Race.view.finalize(); } else updateFlat();
  }
  if (S.role === 'teacher') teacherReveal(m);
});
on('results', (m) => {
  if (S.role === 'student') { endRace(); studentResults(m); }
  if (S.role === 'teacher') teacherResults(m);
});
$('#fs').addEventListener('click', () => { try { const el = $('#v-race'), p = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } });

function levelAr(l) { return l.ar + ' · ' + l.en; }
function studentResults(m) {
  show('sresult'); sfx('finish');
  const me = m.board.find((r) => r.id === S.student.pid) || m.board[0];
  $('#sr-winner').hidden = false; $('#sr-winner').textContent = me.rank === 1 ? 'WINNER!' : 'RACE COMPLETE'; $('#sr-winner').classList.toggle('lose', me.rank !== 1);
  const g3 = $('#sr-3d'); g3.hidden = false; const got3d = Preview.mountPodium(g3, m.board.slice(0, 3), me.id); g3.hidden = !got3d;
  const pod = $('#sr-podium'); pod.replaceChildren(); pod.hidden = got3d;
  [1, 0, 2].forEach((i) => {
    const r = m.board[i]; if (!r) return;
    pod.append(h('div', { class: 'pod p' + (i + 1) }, h('div', { class: 'pn', text: String(i + 1) }), h('div', { class: 'pname', text: r.name }), h('div', { class: 'hint', text: r.score + ' نقطة' }), h('i', { class: 'dot', style: 'display:inline-block;width:16px;height:16px;border-radius:50%;border:3px solid #fff;background:' + (COLORS[r.color] || COLORS.red).sw })));
  });
  const st = $('#sr-stats'); st.replaceChildren();
  const stat = (k, v) => st.append(h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: v })));
  stat('Position · المركز', '\u2066' + me.rank + ' / ' + m.board.length + '\u2069'); stat('Score · النقاط', String(me.score));
  stat('Correct · الصح', '\u2066' + me.correct + ' / ' + m.total + '\u2069'); stat('Wrong · الغلط', String(me.wrong));
  stat('Accuracy · الدقة', me.accuracy + '%'); stat('Fastest · أسرع إجابة', me.fastest != null ? (me.fastest / 1000).toFixed(1) + ' ث' : '—');
  stat('Level · المستوى', levelAr(me.level));
  $('#sr-msg').textContent = me.rank === 1 ? 'أنتِ/أنت أول واحد عدّى خط النهاية. مبروك!' : me.accuracy >= 75 ? 'نتيجة قوية. جرّب تاني وهتاخد المركز الأول.' : 'كمّل تدريب، والسباق الجاي فرصتك.';
  const body = $('#sr-rows'); body.replaceChildren();
  m.board.forEach((r) => body.append(h('tr', { class: r.id === me.id ? 'me' : '' }, h('td', { text: String(r.rank) }), h('td', { text: r.name }), h('td', { text: String(r.score) }), h('td', { text: r.correct + '/' + m.total }))));
}
$('#sr-home').addEventListener('click', goHome);

/* ================= teacher ================= */
const Bank = {
  load() { try { return JSON.parse(store.get('sbq-bank')) || null; } catch (e) { return null; } },
  save(a) { store.set('sbq-bank', JSON.stringify(a)); },
};
const SEED = [
  ['ما الكلمة التي تعني دالة في بايثون؟', '', ['list', 'function', 'variable', 'dictionary'], 1],
  ['ما ناتج تنفيذ الكود التالي؟', 'print("5+7")', ['12', '13', '5+7', 'print'], 2],
  ['ما نوع الخطأ في الكود التالي؟', 'score = 15\nif score > 10:\nprint("Great!")', ['IndentationError', 'SyntaxError', 'TypeError', 'Logical error'], 0],
  ['ما نوع البيانات هنا؟', '4.5', ['string', 'integer', 'boolean', 'float'], 3],
  ['ما الوظيفة الأساسية لدالة input() في بايثون؟', '', ['طباعة النتائج على الشاشة', 'إجراء العمليات الحسابية المعقدة', 'أخذ مدخل من المستخدم وتخزينه في متغير', 'تخزين القوائم الكبيرة'], 2],
  ['ما هي النتيجة النهائية للقائمة fruits بعد تنفيذ الكود التالي؟', 'fruits = ["apple", "banana"]\nfruits.append("orange")', ['["orange", "apple", "banana"]', '["apple", "banana", "orange"]', '["banana", "apple", "orange"]', ''], 1],
  ['أي من الطرق التالية هي الطريقة الصحيحة لدمج متغير name داخل النص باستخدام F-String؟', '', ['print("My name is {name}")', 'print("My name is " + name)', 'print(f"My name is {name}")', 'print("My name is %name")'], 2],
  ['ما فائدة while True: ؟', '', ['تكرار مستمر بدون توقف', 'تكرار عدد محدد من المرات', 'لا توجد فائدة', 'تنفيذ مرة واحدة فقط'], 0],
];
function uid() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
let bank = Bank.load();
if (!Array.isArray(bank)) {
  bank = SEED.map((s, i) => ({ id: uid() + i, type: 'mcq', q: s[0], code: s[1], choices: s[2], answer: s[3], secs: 20, points: 100, category: 'بايثون', difficulty: 'medium', at: Date.now() + i }));
  Bank.save(bank);
}
let selected = new Set(JSON.parse(store.get('sbq-selected') || 'null') || bank.map((q) => q.id));

on('tauth', (m) => {
  if (m.ok) { S.role = 'teacher'; openDash(); }
  else { const e = $('#tl-err'); e.textContent = 'كلمة السر غير صحيحة.'; e.hidden = false; }
});
$('#tl-back').addEventListener('click', () => show('home'));
$('#tl-form').addEventListener('submit', (e) => {
  e.preventDefault(); S.pass = $('#tl-pass').value; $('#tl-err').hidden = true;
  whenOpen(() => send({ t: 'tauth', pass: S.pass }));
});
function openDash() {
  S.role = 'teacher'; show('tdash'); setDashTab(S.tab || 'game'); $('#td-resume').hidden = !(S.teacher && S.teacher.code);
}
$('#td-out').addEventListener('click', goHome);
$('#td-resume').addEventListener('click', () => { show('tlive'); });
$$('#v-tdash .tab').forEach((b) => b.addEventListener('click', () => setDashTab(b.dataset.t)));
function setDashTab(t) {
  S.tab = t; $('#tab-game').hidden = t !== 'game'; $('#tab-bank').hidden = t !== 'bank';
  $$('#v-tdash .tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.t === t ? 'true' : 'false'));
  if (t === 'bank') renderBank(); else renderPick();
}

/* ----- question bank ----- */
function matches(q) {
  const s = $('#b-search').value.trim().toLowerCase();
  if (s && !(q.q + ' ' + q.code + ' ' + q.choices.join(' ') + ' ' + q.category).toLowerCase().includes(s)) return false;
  if ($('#b-type').value && q.type !== $('#b-type').value) return false;
  if ($('#b-diff').value && q.difficulty !== $('#b-diff').value) return false;
  if ($('#b-cat').value && q.category !== $('#b-cat').value) return false;
  return true;
}
function sorted(list) {
  const mode = $('#b-sort') ? $('#b-sort').value : 'new', d = { easy: 0, medium: 1, hard: 2 };
  const a = list.slice();
  if (mode === 'old') a.sort((x, y) => x.at - y.at); else if (mode === 'diff') a.sort((x, y) => d[x.difficulty] - d[y.difficulty]); else if (mode === 'type') a.sort((x, y) => x.type.localeCompare(y.type)); else a.sort((x, y) => y.at - x.at);
  return a;
}
function qBody(q) {
  return h('div', {}, h('div', { class: 'qt', text: q.q }),
    q.code ? h('pre', { class: 'code', text: q.code, style: 'margin:6px 0' }) : null,
    h('div', { class: 'qc' }, q.type === 'short' ? (q.accepted || []).map((c) => h('span', { class: 'ans ok', text: c })) : q.choices.filter(Boolean).map((c, i) => h('span', { class: 'ans' + (c === q.choices[q.answer] ? ' ok' : ''), text: (q.type === 'tf' ? '' : LETTERS[q.choices.indexOf(c)] + ') ') + c }))),
    h('div', { class: 'qc' }, h('span', { class: 'chip', text: q.type === 'tf' ? 'صح/غلط' : q.type === 'short' ? 'إجابة قصيرة' : 'اختيار من متعدد' }), h('span', { class: 'chip', text: DIFF[q.difficulty] }), q.category ? h('span', { class: 'chip', text: q.category }) : null, h('span', { class: 'chip', text: q.secs + ' ث' }), h('span', { class: 'chip', text: q.points + ' نقطة' })));
}
function renderBank() {
  const cats = [...new Set(bank.map((q) => q.category).filter(Boolean))];
  const sel = $('#b-cat'), keep = sel.value; sel.replaceChildren(h('option', { value: '', text: 'الكل' }), ...cats.map((c) => h('option', { value: c, text: c }))); sel.value = cats.includes(keep) ? keep : '';
  const list = sorted(bank.filter(matches)), box = $('#b-list'); box.replaceChildren();
  $('#b-count').textContent = list.length + ' من ' + bank.length + ' سؤال';
  list.forEach((q) => {
    let armed = null;
    const del = h('button', { class: 'btn btn-red btn-sm', type: 'button', text: 'حذف' });
    del.addEventListener('click', () => {
      if (armed) { clearTimeout(armed); bank = bank.filter((x) => x.id !== q.id); selected.delete(q.id); Bank.save(bank); renderBank(); }
      else { del.textContent = 'تأكيد الحذف'; armed = setTimeout(() => { armed = null; del.textContent = 'حذف'; }, 3000); }
    });
    box.append(h('div', { class: 'qi', style: 'grid-template-columns:1fr auto' }, qBody(q), h('div', { class: 'acts', style: 'flex-direction:column' },
      h('button', { class: 'btn btn-blue btn-sm', type: 'button', text: 'تعديل', onclick: () => openEditor(q) }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'نسخ', onclick: () => { bank.push({ ...q, id: uid(), choices: q.choices.slice(), at: Date.now() }); Bank.save(bank); renderBank(); } }), del)));
  });
  if (!list.length) box.append(h('p', { class: 'hint', text: 'مفيش أسئلة مطابقة. دوسي «سؤال جديد».' }));
}
['b-search', 'b-type', 'b-diff', 'b-cat', 'b-sort'].forEach((id) => $('#' + id).addEventListener('input', renderBank));
$('#b-add').addEventListener('click', () => openEditor(null));
$('#b-export').addEventListener('click', () => download('questions.json', JSON.stringify(bank, null, 1), 'application/json'));
$('#b-import').addEventListener('click', () => $('#b-file').click());
$('#b-file').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => {
    try {
      const a = JSON.parse(rd.result); if (!Array.isArray(a)) throw new Error('x');
      const add = a.filter((q) => q && q.q && (Array.isArray(q.choices) || Array.isArray(q.accepted))).map((q) => ({ id: uid(), type: q.type === 'tf' ? 'tf' : q.type === 'short' ? 'short' : 'mcq', accepted: Array.isArray(q.accepted) ? q.accepted.map(String) : [], q: String(q.q), code: String(q.code || ''), choices: (q.choices || []).map(String).slice(0, 4), answer: Number(q.answer) || 0, secs: Number(q.secs) || 20, points: Number(q.points) || 100, category: String(q.category || ''), difficulty: DIFF[q.difficulty] ? q.difficulty : 'medium', at: Date.now() }));
      bank = bank.concat(add); Bank.save(bank); renderBank(); alert2('اتضاف ' + add.length + ' سؤال.');
    } catch (err) { alert2('الملف مش مضبوط.'); }
  };
  rd.readAsText(f); e.target.value = '';
});
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ----- question editor ----- */
let editing = null;
function qType() { return $('input[name="mq-type"]:checked').value; }
function syncType() { const t = qType(); $('#mq-mcq').hidden = t !== 'mcq'; $('#mq-tf').hidden = t !== 'tf'; $('#mq-short').hidden = t !== 'short'; }
const PRESETS = [5, 10, 15, 20, 30, 45, 60];
function setSecs(v) { const sel = $('#mq-secs-sel'); v = Number(v) || 20; if (PRESETS.includes(v)) { sel.value = String(v); $('#mq-secs').hidden = true; } else { sel.value = 'custom'; $('#mq-secs').hidden = false; } $('#mq-secs').value = v; }
$('#mq-secs-sel').addEventListener('change', (e) => { if (e.target.value === 'custom') { $('#mq-secs').hidden = false; $('#mq-secs').focus(); } else { $('#mq-secs').hidden = true; $('#mq-secs').value = e.target.value; } });
$$('input[name="mq-type"]').forEach((r) => r.addEventListener('change', syncType));
function openEditor(q) {
  editing = q; $('#mq-title').textContent = q ? 'تعديل السؤال' : 'سؤال جديد'; $('#mq-err').hidden = true;
  const t = q ? q.type : 'mcq'; $$('input[name="mq-type"]').forEach((r) => { r.checked = r.value === t; });
  $('#mq-q').value = q ? q.q : ''; $('#mq-code').value = q ? q.code : '';
  for (let i = 0; i < 4; i++) $('#mq-a' + i).value = q && q.type === 'mcq' ? q.choices[i] || '' : '';
  $('#mq-ans').value = String(q && q.type === 'mcq' ? q.answer : 0); $('#mq-tfans').value = String(q && q.type === 'tf' ? q.answer : 0);
  setSecs(q ? q.secs : 20); $('#mq-acc').value = q && q.type === 'short' ? (q.accepted || []).join('\n') : ''; $('#mq-pts').value = q ? q.points : 100; $('#mq-cat').value = q ? q.category : ''; $('#mq-diff').value = q ? q.difficulty : 'medium';
  syncType(); $('#m-q').hidden = false; $('#mq-q').focus();
}
$('#mq-cancel').addEventListener('click', () => { $('#m-q').hidden = true; });
$('#mq-form').addEventListener('submit', (e) => {
  e.preventDefault(); const err = (t) => { $('#mq-err').textContent = t; $('#mq-err').hidden = false; };
  const type = qType(), text = $('#mq-q').value.trim(); if (!text) return err('اكتبي نص السؤال.');
  let choices, answer;
  let accepted = [];
  if (type === 'short') { accepted = $('#mq-acc').value.split('\n').map((x) => x.trim()).filter(Boolean); if (!accepted.length) return err('اكتبي الإجابة الصحيحة.'); choices = []; answer = 0; }
  else if (type === 'tf') { choices = ['صح', 'غلط']; answer = Number($('#mq-tfans').value); }
  else {
    choices = [0, 1, 2, 3].map((i) => $('#mq-a' + i).value.trim()); answer = Number($('#mq-ans').value);
    if (choices.filter(Boolean).length < 2) return err('اكتبي إجابتين على الأقل.');
    if (!choices[answer]) return err('الإجابة الصحيحة لازم تكون مكتوبة.');
  }
  const rec = { type, accepted, q: text, code: $('#mq-code').value.replace(/\s+$/, ''), choices, answer, secs: clamp(Number($('#mq-secs-sel').value === 'custom' ? $('#mq-secs').value : $('#mq-secs-sel').value) || 20, 5, 180), points: clamp(Number($('#mq-pts').value) || 100, 10, 1000), category: $('#mq-cat').value.trim(), difficulty: $('#mq-diff').value };
  if (editing) Object.assign(editing, rec); else { const n = { id: uid(), at: Date.now(), ...rec }; bank.unshift(n); selected.add(n.id); }
  Bank.save(bank); $('#m-q').hidden = true; renderBank();
});

/* ----- create game ----- */
let order = [], ov = {};
try { order = JSON.parse(store.get('sbq-order') || '[]'); ov = JSON.parse(store.get('sbq-ov') || '{}'); } catch (e) { order = []; ov = {}; }
function syncOrder() { order = order.filter((id) => selected.has(id) && bank.some((q) => q.id === id)); [...selected].forEach((id) => { if (!order.includes(id) && bank.some((q) => q.id === id)) order.push(id); }); store.set('sbq-order', JSON.stringify(order)); store.set('sbq-ov', JSON.stringify(ov)); }
function renderPick() {
  syncOrder();
  const ob = $('#g-order'); ob.replaceChildren();
  order.forEach((id, i) => {
    const q = bank.find((x) => x.id === id); if (!q) return;
    const o = ov[id] || (ov[id] = {}); const secs = o.secs || q.secs, pts = o.points || q.points;
    const sel = h('select', { 'aria-label': 'وقت السؤال' }, ...[...new Set([...PRESETS, secs])].sort((x, y) => x - y).map((v) => h('option', { value: v, text: v + ' ث', selected: v === secs })));
    sel.addEventListener('change', () => { o.secs = Number(sel.value); syncOrder(); });
    const pin = h('input', { type: 'number', min: 10, max: 1000, step: 10, value: pts, 'aria-label': 'النقاط' });
    pin.addEventListener('change', () => { o.points = clamp(Number(pin.value) || 100, 10, 1000); pin.value = o.points; syncOrder(); });
    const mv = (d) => () => { const k = i + d; if (k < 0 || k >= order.length) return; [order[i], order[k]] = [order[k], order[i]]; syncOrder(); renderPick(); };
    ob.append(h('div', { class: 'qi gorder', style: 'grid-template-columns:auto 1fr auto' },
      h('b', { class: 'gnum', text: String(i + 1) }),
      h('div', {}, h('div', { class: 'qt', text: q.q }), h('div', { class: 'qc' }, h('span', { class: 'chip', text: q.type === 'tf' ? 'صح/غلط' : q.type === 'short' ? 'إجابة قصيرة' : 'اختيار' }), h('span', { class: 'chip', text: DIFF[q.difficulty] }), q.category ? h('span', { class: 'chip', text: q.category }) : null),
        h('div', { class: 'qc', style: 'gap:10px;align-items:center' }, h('label', { class: 'mini', text: 'الوقت ' }, sel), h('label', { class: 'mini', text: 'النقاط ' }, pin))),
      h('div', { class: 'acts', style: 'flex-direction:column' }, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '▲', 'aria-label': 'لفوق', onclick: mv(-1) }), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '▼', 'aria-label': 'لتحت', onclick: mv(1) }),
        h('button', { class: 'btn btn-red btn-sm', type: 'button', text: '✕', 'aria-label': 'شيل', onclick: () => { selected.delete(id); persistSel(); renderPick(); } }))));
  });
  if (!order.length) ob.append(h('p', { class: 'hint', text: 'لسه مفيش أسئلة في اللعبة. علّمي أسئلة من البنك تحت.' }));
  const box = $('#g-list'); box.replaceChildren();
  bank.slice().sort((a, b) => a.at - b.at).filter((q) => !selected.has(q.id)).forEach((q) => {
    box.append(h('div', { class: 'qi', style: 'grid-template-columns:1fr auto' }, qBody(q), h('button', { class: 'btn btn-blue btn-sm', type: 'button', text: '+ أضيفي', onclick: () => { selected.add(q.id); order.push(q.id); persistSel(); renderPick(); } })));
  });
  if (!bank.length) box.append(h('p', { class: 'hint', text: 'البنك فاضي. روحي لتبويب بنك الأسئلة وضيفي أسئلة.' }));
  persistSel();
}
function persistSel() { store.set('sbq-selected', JSON.stringify([...selected])); store.set('sbq-order', JSON.stringify(order)); $('#g-count').textContent = order.length + ' سؤال'; }
$('#g-all').addEventListener('click', () => { selected = new Set(bank.map((q) => q.id)); renderPick(); });
$('#g-none').addEventListener('click', () => { selected = new Set(); order = []; renderPick(); });
$('#g-create').addEventListener('click', () => {
  syncOrder(); const qs = order.map((id) => { const q = bank.find((x) => x.id === id); const o = ov[id] || {}; return { ...q, secs: o.secs || q.secs, points: o.points || q.points }; }); const err = $('#g-err'); err.hidden = true;
  if (!qs.length) { err.textContent = 'اختاري سؤالًا واحدًا على الأقل.'; err.hidden = false; return; }
  whenOpen(() => send({ t: 'create', pass: S.pass, game: { title: $('#g-title').value.trim() || 'سباق المعرفة', settings: { shuffleQuestions: $('#g-shq').checked, shuffleChoices: $('#g-shc').checked }, questions: qs } }));
});
on('created', (m) => {
  if (S.role !== 'teacher') return;
  S.teacher = { code: m.code, tkey: m.tkey }; sess.set('sbq-teacher', S.teacher); $('#conn').hidden = true;
  if (!m.resumed || S.view === 'home' || S.view === 'tlogin' || S.view === 'tdash') { show('tlive'); }
  setLiveSection('lobby'); $('#tv-code').textContent = m.code; $('#td-resume').hidden = false;
  const link = location.origin + location.pathname + '?code=' + m.code; $('#tv-link').value = link;
  try { const qr = qrcode(0, 'M'); qr.addData(link); qr.make(); $('#tv-qr').innerHTML = qr.createSvgTag({ scalable: true, margin: 0 }); } catch (e) { $('#tv-qr').textContent = ''; }
});
function setLiveSection(s) { if (s !== 'lobby') Preview.unmount(); $('#tv-lobby').hidden = s !== 'lobby'; $('#tv-live').hidden = s !== 'live'; $('#tv-res').hidden = s !== 'res'; $('#tv-title').textContent = s === 'lobby' ? 'RACE LOBBY' : s === 'live' ? 'LIVE RACE' : 'RACE RESULTS'; }
function paintTeacherLobby(m) {
  S.lobby = m;
  if (S.view === 'tlive' && !$('#tv-lobby').hidden) Preview.mountGrid($('#tv-grid'), m.players); else if (Preview.grid && S.view !== 'tlive') Preview.unmount();
  $('#tv-n').textContent = m.players.length; paintPlayers(m.players, $('#tv-list'), null, true);
  const conn = m.players.filter((p) => p.connected), rd = conn.filter((p) => p.ready).length;
  $('#tv-ready').textContent = conn.length + ' joined'; $('#tv-start').disabled = !conn.length || m.state !== 'lobby';
  if (m.state === 'lobby' && S.view === 'tlive' && $('#tv-lobby').hidden && $('#tv-res').hidden) setLiveSection('lobby');
}
$('#tv-copy').addEventListener('click', () => { const i = $('#tv-link'); i.select(); try { navigator.clipboard.writeText(i.value).then(() => alert2('اتنسخ الرابط')); } catch (e) { /* ignore */ } });
$('#tv-start').addEventListener('click', () => { send({ t: 'start' }); $('#tv-start').disabled = true; });
$('#tv-skip').addEventListener('click', () => send({ t: 'skip' }));
$('#tv-dash').addEventListener('click', openDash);
$('#tv-close').addEventListener('click', () => {
  const b = $('#tv-close'); if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'تأكيد الإغلاق'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'إغلاق الغرفة'; }, 3000); return; }
  send({ t: 'close' }); S.teacher = null; sess.del('sbq-teacher'); b.textContent = 'إغلاق الغرفة'; delete b.dataset.armed; openDash();
});
const origCountdown = handlers.countdown;
on('countdown', (m) => { if (S.role !== 'teacher') return origCountdown(m); { setLiveSection('live'); $('#tv-q').textContent = 'العد التنازلي… السباق هيبدأ بعد لحظات'; $('#tv-qn').textContent = ''; $('#tv-time').textContent = ''; $('#tv-ans').textContent = ''; T.total = m.total; paintLb((S.lobby ? S.lobby.players : []).map((p) => ({ ...p, correct: 0, progress: 0 }))); } });
const T = { total: 0, tick: 0, q: null };
function paintLb(rows) {
  const box = $('#tv-lb'); box.replaceChildren();
  rows.forEach((r, i) => box.append(h('div', { class: 'lb-row' }, h('b', { text: String(r.rank || i + 1) }), h('span', { class: 'nm', text: r.name, style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }),
    h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round((r.progress || 0) * 100) + '%;background:' + (COLORS[r.color] || COLORS.red).sw })), h('span', { text: (r.score || 0) + '', style: 'text-align:end;font-weight:800' }))));
}
const origQuestion = handlers.question;
on('question', (m) => {
  if (S.role === 'teacher') {
    setLiveSection('live'); T.q = m; $('#tv-qn').textContent = 'QUESTION ' + (m.n + 1) + ' / ' + m.total; $('#tv-q').textContent = m.q; $('#tv-ans').textContent = 'أجابوا: 0';
    clearInterval(T.tick); const tick = () => { const left = Math.max(0, m.endsAt - nowS()); $('#tv-time').textContent = 'TIME LEFT: ' + String(Math.ceil(left / 1000)).padStart(2, '0'); if (left <= 0) clearInterval(T.tick); }; tick(); T.tick = setInterval(tick, 200); return;
  }
  origQuestion(m);
});
on('answered', (m) => { if (S.role === 'teacher') $('#tv-ans').textContent = 'أجابوا: \u2066' + m.count + ' / ' + m.of + '\u2069'; });
function teacherReveal(m) { clearInterval(T.tick); $('#tv-time').textContent = 'الإجابة الصحيحة: ' + (T.q ? LETTERS[m.correct] + ') ' + T.q.choices[m.correct] : ''); paintLb(m.board); }
function teacherResults(m) {
  clearInterval(T.tick); setLiveSection('res'); T.results = m;
  const b = m.board, avg = b.length ? Math.round(b.reduce((a, r) => a + r.accuracy, 0) / b.length) : 0;
  const fastest = b.filter((r) => r.fastest != null).sort((x, y) => x.fastest - y.fastest)[0];
  const most = b.slice().sort((x, y) => y.correct - x.correct)[0];
  const need = b.filter((r) => r.level.key === 'practice');
  const sum = $('#tv-sum'); sum.replaceChildren();
  const card = (k, v) => sum.append(h('div', { class: 'sumcard' }, h('span', { text: k }), h('b', { text: v })));
  card('أفضل طالب', b[0] ? b[0].name + ' (' + b[0].score + ' نقطة)' : '—'); card('أكثر إجابات صحيحة', most ? most.name + ' (' + most.correct + '/' + m.total + ')' : '—');
  card('أسرع إجابة صحيحة', fastest ? fastest.name + ' (' + (fastest.fastest / 1000).toFixed(1) + ' ث)' : '—'); card('متوسط الفصل', avg + '%');
  card('يحتاجون تدريب', need.length ? need.map((r) => r.name).join('، ') : 'لا أحد');
  const body = $('#tv-rows'); body.replaceChildren();
  b.forEach((r) => body.append(h('tr', {}, h('td', { text: String(r.rank) }), h('td', { text: r.name }), h('td', { text: String(r.score) }), h('td', { text: String(r.correct) }), h('td', { text: String(r.wrong) }), h('td', { text: r.accuracy + '%' }), h('td', { text: r.avgTime != null ? (r.avgTime / 1000).toFixed(1) + ' ث' : '—' }), h('td', { text: r.fastest != null ? (r.fastest / 1000).toFixed(1) + ' ث' : '—' }), h('td', { text: levelAr(r.level) }))));
}
$('#tv-csv').addEventListener('click', () => {
  const m = T.results; if (!m) return; const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['Rank', 'Student', 'Score', 'Correct', 'Wrong', 'Accuracy %', 'Avg time (s)', 'Fastest (s)', 'Level']].concat(m.board.map((r) => [r.rank, r.name, r.score, r.correct, r.wrong, r.accuracy, r.avgTime != null ? (r.avgTime / 1000).toFixed(1) : '', r.fastest != null ? (r.fastest / 1000).toFixed(1) : '', r.level.en]));
  download('race-results.csv', '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8');
});
$('#tv-new').addEventListener('click', () => { send({ t: 'close' }); S.teacher = null; sess.del('sbq-teacher'); T.results = null; openDash(); });

/* ================= boot ================= */
(function boot() {
  if (S.student && S.student.token) { S.role = 'student'; show('slobby'); whenOpen(() => {}); return; }
  if (S.teacher && S.teacher.tkey) { S.role = 'teacher'; show('tlive'); whenOpen(() => {}); return; }
  const q = new URLSearchParams(location.search).get('code');
  if (q) { openJoin(); return; }
  show('home'); Preview.mount($('#pv-home'), 'red');
})();
window.__sbq = { S, Race, Bank, get bank() { return bank; } };
})();
