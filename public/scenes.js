/* Showroom scenes: animated home backdrop (cars on a speed road) and the lobby starting grid. Needs THREE + race3d module (R3). */
(function (global) {
  function makeRenderer(el) {
    var r; try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
    if (!r.getContext()) return null;
    r.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.75)); r.setClearColor(0x000000, 0);
    el.insertBefore(r.domElement, el.firstChild); return r;
  }
  function lights(scene, warm) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a99, 1.0));
    var sun = new THREE.DirectionalLight(0xfff0d6, 0.9); sun.position.set(6, 10, 7); scene.add(sun);
    var rim = new THREE.DirectionalLight(warm ? 0xffa060 : 0x7aa7ff, 0.7); rim.position.set(-6, 4, -6); scene.add(rim);
  }
  function labelSprite(text, bg) {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; var ctx = cv.getContext('2d');
    var tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sp = new THREE.Sprite(mat); sp.scale.set(5.6, 1.4, 1); sp.renderOrder = 10;
    sp.userData.draw = function (t, color, ready) {
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = color; var w = 480, x = 16, y = 16, h = 96, r = 48;
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 56px Cairo, Tahoma, sans-serif';
      var s = (ready ? '✓ ' : '') + t; while (ctx.measureText(s).width > 430 && s.length > 3) s = s.slice(0, -2);
      ctx.fillText(s, 256, 66); tex.needsUpdate = true;
    };
    sp.userData.draw(text, bg, false); return sp;
  }
  function ro(el, fit) { fit(); var o = global.ResizeObserver ? new ResizeObserver(fit) : null; if (o) o.observe(el); return o; }

  /* ---------- home: three cars cruising, road dashes rushing past ---------- */
  function home(el, R3, COLORS) {
    var renderer = makeRenderer(el); if (!renderer) return null;
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
    scene.fog = new THREE.Fog(0x0a1230, 25, 70); lights(scene, true);
    var road = new THREE.Mesh(new THREE.PlaneGeometry(16, 140), new THREE.MeshLambertMaterial({ color: 0x1b2347 })); road.rotation.x = -Math.PI / 2; road.position.set(0, -0.02, -30); scene.add(road);
    [-8, 8].forEach(function (x) { var k = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 140), new THREE.MeshLambertMaterial({ color: x < 0 ? 0xe63946 : 0xf4f4f4 })); k.position.set(x, 0.1, -30); scene.add(k); });
    var dashes = []; var dm = new THREE.MeshBasicMaterial({ color: 0xdfe6ff });
    for (var i = 0; i < 18; i++) for (var s = -1; s <= 1; s += 2) { var d = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 3), dm); d.position.set(s * 2.75, 0.01, 12 - i * 7); scene.add(d); dashes.push(d); }
    var streaks = []; var sm = new THREE.MeshBasicMaterial({ color: 0x9ec5ff, transparent: true, opacity: 0.55 });
    for (var j = 0; j < 14; j++) { var st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 5 + Math.random() * 5), sm); st.position.set((Math.random() < .5 ? -1 : 1) * (6 + Math.random() * 8), 0.3 + Math.random() * 4, -Math.random() * 60); scene.add(st); streaks.push(st); }
    var keys = ['red', 'blue', 'yellow'], pos = [[0, 0.0], [-3.4, -4], [3.4, -7]], cars = [];
    keys.forEach(function (k, n) {
      var mc = R3.makeCar(COLORS[k], '★', false, true); mc.group.scale.setScalar(1.05);
      mc.group.position.set(pos[n][0], 0, pos[n][1]); mc.group.rotation.y = Math.PI + (n === 0 ? 0.25 : n === 1 ? 0.1 : -0.1); scene.add(mc.group); cars.push({ g: mc.group, x: pos[n][0], z: pos[n][1], ph: n * 2 });
    });
    var st = { dead: false, raf: 0, t: 0 };
    function fit() { var w = el.clientWidth || 300, h = el.clientHeight || 240; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = cam.aspect < 1 ? 58 : 42; cam.updateProjectionMatrix(); }
    st.ro = ro(el, fit); var last = 0;
    function loop(now) {
      if (st.dead) return; st.raf = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; st.t += dt;
      dashes.forEach(function (d) { d.position.z += dt * 34; if (d.position.z > 14) d.position.z -= 126; });
      streaks.forEach(function (s) { s.position.z += dt * 48; if (s.position.z > 14) s.position.z -= 80; });
      cars.forEach(function (c) { c.g.position.y = Math.abs(Math.sin(st.t * 9 + c.ph)) * 0.035; c.g.position.x = c.x + Math.sin(st.t * 0.8 + c.ph) * 0.5; c.g.rotation.z = Math.sin(st.t * 0.8 + c.ph) * 0.025; });
      cam.position.set(Math.sin(st.t * 0.25) * 2.2, 3.4 + Math.sin(st.t * 0.4) * 0.25, 13); cam.lookAt(0, 1.1, -4);
      renderer.render(scene, cam);
    }
    st.raf = requestAnimationFrame(loop);
    st.dispose = function () { st.dead = true; cancelAnimationFrame(st.raf); if (st.ro) st.ro.disconnect(); try { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {} if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); };
    return st;
  }

  /* ---------- lobby: starting grid with every joined player's car + name ---------- */
  function grid(el, R3, COLORS) {
    var renderer = makeRenderer(el); if (!renderer) return null;
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.5, 300);
    scene.fog = new THREE.Fog(0x0a1230, 40, 120); lights(scene, false);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 200), new THREE.MeshLambertMaterial({ color: 0x1b2347 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.02, -60); scene.add(floor);
    var lm = new THREE.MeshBasicMaterial({ color: 0xdfe6ff });
    for (var r = 0; r < 12; r++) { var line = new THREE.Mesh(new THREE.BoxGeometry(11, 0.03, 0.25), lm); line.position.set(0, 0.01, 2.6 - r * 6.5); scene.add(line); }
    var st = { dead: false, raf: 0, t: 0, items: {}, count: 0 };
    var cols = 2, MAXN = 12;
    function slot(i) { var c = i % cols, r = Math.floor(i / cols); return { x: (c ? 1 : -1) * 2.7, z: -r * 6.5 - (c ? 3 : 0) }; }
    function fit() { var w = el.clientWidth || 300, h = el.clientHeight || 240; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = cam.aspect < 1 ? 62 : 44; cam.updateProjectionMatrix(); frameCam(true); }
    var camTarget = { z: 14, y: 5, look: -2 }, camNow = { z: 14, y: 5, look: -2 };
    function frameCam(snap) {
      var rows = Math.max(1, Math.ceil(Math.min(st.count, MAXN) / cols)); var back = 6.5 + rows * 2.4 + (cam.aspect < 1 ? 4 : 0);
      camTarget.z = back; camTarget.y = 3.2 + rows * 0.9; camTarget.look = -(rows - 1) * 3.0 - 1;
      if (snap) { camNow.z = camTarget.z; camNow.y = camTarget.y; camNow.look = camTarget.look; }
    }
    st.update = function (players) {
      var list = players.slice(0, MAXN); st.count = list.length; var ids = {};
      list.forEach(function (p, i) {
        ids[p.id] = 1; var it = st.items[p.id], sl = slot(i);
        if (!it) {
          var mc = R3.makeCar(COLORS[p.color] || COLORS.red, '★', false, true); mc.group.rotation.y = Math.PI;
          var lab = labelSprite(p.name, '#2563eb'); lab.position.set(0, 3.4, 0); mc.group.add(lab);
          var ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 40), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; mc.group.add(ring);
          mc.group.position.set(sl.x, 0, sl.z); mc.group.scale.setScalar(0.001); scene.add(mc.group);
          it = st.items[p.id] = { g: mc.group, lab: lab, ring: ring, born: st.t, color: p.color, name: p.name, ready: null, ph: Math.random() * 6, x: sl.x, z: sl.z };
        }
        it.x = sl.x; it.z = sl.z;
        if (it.color !== p.color) { scene.remove(it.g); var nc = R3.makeCar(COLORS[p.color] || COLORS.red, '★', false, true); nc.group.rotation.y = Math.PI; nc.group.add(it.lab); nc.group.add(it.ring); nc.group.position.copy(it.g.position); nc.group.scale.copy(it.g.scale); scene.add(nc.group); it.g = nc.group; it.color = p.color; it.born = st.t - 1; }
        if (it.ready !== !!p.ready || it.name !== p.name) { it.ready = !!p.ready; it.name = p.name; it.lab.userData.draw(p.name, p.ready ? '#16a34a' : '#2563eb', p.ready); }
        it.ring.material.color.setHex(p.connected === false ? 0x6b7280 : (p.ready ? 0x4ade80 : 0xfacc15));
      });
      Object.keys(st.items).forEach(function (id) { if (!ids[id]) { scene.remove(st.items[id].g); delete st.items[id]; } });
      Object.keys(st.items).forEach(function (id) { st.items[id].lab.visible = list.length <= 10; });
      frameCam(false);
    };
    st.ro = ro(el, fit); var last = 0;
    function loop(now) {
      if (st.dead) return; st.raf = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; st.t += dt;
      Object.keys(st.items).forEach(function (id) {
        var it = st.items[id], age = st.t - it.born, k;
        if (age < 0.6) { var u = age / 0.6; k = u < 0.7 ? (u / 0.7) * 1.25 : 1.25 - 0.25 * ((u - 0.7) / 0.3); } else k = 1;
        it.g.scale.setScalar(Math.max(0.001, k));
        it.g.position.x += (it.x - it.g.position.x) * Math.min(1, dt * 6); it.g.position.z += (it.z - it.g.position.z) * Math.min(1, dt * 6);
        var rev = it.ready ? 1.6 : 0.6; it.g.position.y = Math.abs(Math.sin(st.t * 11 * rev + it.ph)) * 0.03 * rev + (age < 0.6 ? Math.sin(Math.min(1, age / 0.6) * Math.PI) * 1.2 : 0);
        it.ring.scale.setScalar(1 + 0.06 * Math.sin(st.t * 3 + it.ph)); it.ring.material.opacity = 0.55 + 0.35 * Math.sin(st.t * 3 + it.ph);
      });
      var e = Math.min(1, dt * 3); camNow.z += (camTarget.z - camNow.z) * e; camNow.y += (camTarget.y - camNow.y) * e; camNow.look += (camTarget.look - camNow.look) * e;
      cam.position.set(Math.sin(st.t * 0.3) * 2.0, camNow.y, camNow.z); cam.lookAt(0, 1, camNow.look);
      renderer.render(scene, cam);
    }
    st.raf = requestAnimationFrame(loop);
    st.dispose = function () { st.dead = true; cancelAnimationFrame(st.raf); if (st.ro) st.ro.disconnect(); try { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {} if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); };
    return st;
  }

  /* ---------- winners podium with the real cars + falling confetti ---------- */
  function podium(el, R3, COLORS, top, myId) {
    var renderer = makeRenderer(el); if (!renderer) return null;
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.5, 200); lights(scene, true);
    scene.fog = new THREE.Fog(0x0a1230, 30, 90);
    var floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshLambertMaterial({ color: 0x151d42 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; scene.add(floor);
    var spots = [0xffd23f, 0x7aa7ff, 0xff7aa8];
    var heights = { 1: 3.2, 2: 2.2, 3: 1.5 }, xs = { 1: 0, 2: -5.4, 3: 5.4 }, cols = { 1: 0xf5c518, 2: 0xc7ced9, 3: 0xcd7f32 };
    var items = [];
    top.slice(0, 3).forEach(function (p, i) {
      var rk = i + 1, h = heights[rk];
      var base = new THREE.Mesh(new THREE.BoxGeometry(4.4, h, 5.6), new THREE.MeshStandardMaterial({ color: cols[rk], metalness: 0.6, roughness: 0.35 })); base.position.set(xs[rk], h / 2, 0); scene.add(base);
      var mc = R3.makeCar(COLORS[p.color] || COLORS.red, '★', false, true); mc.group.scale.setScalar(0.85); mc.group.position.set(xs[rk], h, 0); mc.group.rotation.y = Math.PI + (rk === 1 ? 0.0 : rk === 2 ? 0.35 : -0.35); scene.add(mc.group);
      var lab = labelSprite(p.name, p.id === myId ? '#16a34a' : '#2563eb'); lab.position.set(xs[rk], h + 3.6, 0); lab.scale.set(5.2, 1.3, 1); scene.add(lab);
      var num = labelSprite(String(rk), '#' + cols[rk].toString(16).padStart(6, '0')); num.scale.set(1.6, 0.4, 1); num.userData.draw(['1ST', '2ND', '3RD'][i], '#' + cols[rk].toString(16).padStart(6, '0'), false); num.position.set(xs[rk], h * 0.55, 3.0); num.scale.set(3.6, 0.9, 1); scene.add(num);
      items.push({ g: mc.group, base: h, rk: rk, born: 0.35 * (4 - rk), ph: i });
      var sp = new THREE.PointLight(spots[i], 0.9, 18); sp.position.set(xs[rk], h + 6, 4); scene.add(sp);
    });
    var N = 260, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), colr = new Float32Array(N * 3), vel = [];
    var pal = [0xffd23f, 0xff5a5f, 0x4ade80, 0x60a5fa, 0xc084fc, 0xffffff];
    for (var k = 0; k < N; k++) { pos[k * 3] = (Math.random() - .5) * 26; pos[k * 3 + 1] = 6 + Math.random() * 16; pos[k * 3 + 2] = (Math.random() - .5) * 14; var c = new THREE.Color(pal[k % pal.length]); colr[k * 3] = c.r; colr[k * 3 + 1] = c.g; colr[k * 3 + 2] = c.b; vel.push([(Math.random() - .5) * 1.2, -(2 + Math.random() * 3), (Math.random() - .5) * 1.2, Math.random() * 6]); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    var conf = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, opacity: 0.95 })); scene.add(conf);
    var st = { dead: false, raf: 0, t: 0 };
    function fit() { var w = el.clientWidth || 300, h = el.clientHeight || 240; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = cam.aspect < 1 ? 62 : 40; cam.updateProjectionMatrix(); }
    st.ro = ro(el, fit); var last = 0;
    function loop(now) {
      if (st.dead) return; st.raf = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; st.t += dt;
      items.forEach(function (it) {
        var a = Math.max(0, st.t - it.born), u = Math.min(1, a / 0.8); var drop = (1 - u) * (1 - u) * 14;
        it.g.position.y = it.base + drop + (u >= 1 ? Math.abs(Math.sin(st.t * 5 + it.ph)) * 0.05 * (it.rk === 1 ? 2 : 1) : 0);
        if (it.rk === 1) it.g.rotation.y = Math.PI + Math.sin(st.t * 0.9) * 0.5;
      });
      var p = geo.attributes.position.array;
      for (var q = 0; q < N; q++) { p[q * 3] += Math.sin(st.t * 2 + vel[q][3]) * dt * 1.2 + vel[q][0] * dt; p[q * 3 + 1] += vel[q][1] * dt; p[q * 3 + 2] += vel[q][2] * dt; if (p[q * 3 + 1] < 0) { p[q * 3 + 1] = 16 + Math.random() * 4; p[q * 3] = (Math.random() - .5) * 26; } }
      geo.attributes.position.needsUpdate = true;
      cam.position.set(Math.sin(st.t * 0.35) * 5, 5.5, 17); cam.lookAt(0, 2.8, 0);
      renderer.render(scene, cam);
    }
    st.raf = requestAnimationFrame(loop);
    st.dispose = function () { st.dead = true; cancelAnimationFrame(st.raf); if (st.ro) st.ro.disconnect(); try { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {} if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); };
    return st;
  }
  global.Scenes = { home: home, grid: grid, podium: podium };
})(window);
