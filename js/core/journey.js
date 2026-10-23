/* ============================================================
   多幕 shell —— 00 满潮（M0）+ 01–05。
   journey 0..1；水线切开；章节切换用同一条水线做擦除。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };

  var SRC = {
    kicker: document.querySelector('[data-kicker]').textContent.trim(),
    title: document.querySelector('[data-title]').textContent.trim(),
    place: document.querySelector('[data-place]').textContent.trim(),
    sub: document.querySelector('[data-sub]').textContent.trim()
  };

  var PALETTE = {
    ink: '#111310', bone: '#F2ECDF', sea: '#03100F', teal: '#16332F', coral: '#D8503A'
  };

  var COPY = {
    '01': {
      kicker: '火沉在石里', title: '玄武', tone: 'ink',
      body1: '玄武岩是凉的。你按住它，它才把白天还给你。',
      body2: '水退到岩层，气孔里还留着白天的热。',
      hint: '按住岩面，二到四秒', hintEn: 'PRESS AND HOLD, 2–4 SEC'
    },
    '02': {
      kicker: '一天翻开两次', title: '潮间带', tone: 'ink',
      body1: '水退到脚踝，沙上浮出一层没写完的字。',
      body2: '你拖多远，它就写多远；松手，海擦掉一半。',
      hint: '拖水线；点一下，捡起一个字', hintEn: 'DRAG THE LINE — TAP TO PICK UP A WORD'
    },
    '03': {
      kicker: '夜里，珊瑚下雪', title: '珊瑚', tone: 'ink',
      body1: '珊瑚把卵吐进水里，像一场很慢的雪。',
      body2: '把光停住两秒，它才开。别急着移开。',
      hint: '移光找珊瑚；停住两秒', hintEn: 'MOVE THE LIGHT — HOLD STILL'
    },
    '04': {
      kicker: '把海折成路', title: '航线', tone: 'ink',
      body1: '一本巴掌大的手抄本，记着从清澜港去西沙的针路。',
      body2: '一更六十里。名字，是走过的人留下的。',
      hint: '顺着针路划一笔', hintEn: 'TRACE THE RHUMB LINE'
    },
    '05': {
      kicker: '海把书合上', title: '归潮', tone: 'ink',
      body1: '海回来了。它不问你看过什么，只把沙上的字收走。',
      body2: '留下的这一张，是它允许你带走的。',
      hint: '把海推回去', hintEn: 'PUSH THE SEA BACK'
    }
  };

  var CH = [
    { id: '00', start: 0.00, end: 0.16 },
    { id: '01', start: 0.16, end: 0.34 },
    { id: '02', start: 0.34, end: 0.54 },
    { id: '03', start: 0.54, end: 0.72 },
    { id: '04', start: 0.72, end: 0.88 },
    { id: '05', start: 0.88, end: 1.00 }
  ];

  var TRANS = 0.018;

  var PLATES = {
    '01': 'assets/plates/treated/01-xuanwu.webp',
    '03': 'assets/plates/treated/03-coral.webp',
    '04': 'assets/plates/treated/04-route.webp'
  };

  var S = {
    w: 0, h: 0, dpr: 1,
    lineStart: 64, lineEnd: 720,
    journey: 0, target: 0, prevJourney: 0, vel: 0,
    chapter: 0, trans: null,
    time: 0, intro: 0, dt: 0.016,
    pointer: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, down: false },
    dragging: false, drag: null,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      new URLSearchParams(window.location.search).get('reduced') === '1',
    started: new Date(),
    tide: {},
    interacted: false
  };

  var el = {
    gauge: $('gauge'), gmark: $('gmark'), gval: $('gval'),
    stateCN: $('stateCN'), stateEN: $('stateEN'),
    level: $('level'), clock: $('clock'),
    hint: $('hint'),
    hintTxt: document.querySelector('#hint .txt'),
    hintEn: document.querySelector('#hint .en'),
    sound: $('sound'), soundState: $('soundState'),
    veil: $('veil'), brand: document.querySelector('.brand'),
    index: $('chapterIndex'),
    copy: $('chapterCopy'), rail: $('rail'), found: $('found')
  };

  var acts = {};
  var plateImgs = {};
  var last = 0, raf = 0, running = true;
  var lastState = '', lastClock = '', lastCopy = '', lastHint = '', lastAudio = 0;
  var DBG = /[?&]debug=1/.test(window.location.search);
  var dbgEl = null, frames = 0, fpsT = 0;

  /* ---------------- 尺寸 ---------------- */

  function resize() {
    S.w = window.innerWidth;
    S.h = window.innerHeight;
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);

    S.lineStart = Math.max(58, Math.round(S.h * 0.078));
    S.lineEnd = Math.round(S.h * 0.9);
    if (S.lineEnd - S.lineStart < 180) S.lineEnd = S.lineStart + 180;

    el.gauge.style.top = S.lineStart + 'px';
    el.gauge.style.bottom = Math.max(0, S.h - S.lineEnd) + 'px';

    var seaDpr = Math.min(S.dpr, (S.w * S.h > 850 * 850) ? 1.5 : 1.75);
    Sea.resize(S.w, S.h, seaDpr);
    WaterType.resize(S.w, S.h, S.dpr);

    for (var id in acts) if (acts[id]) resizeHost(acts[id]);

    var tl = $('transLine');
    tl.width = Math.round(S.w * S.dpr);
    tl.height = Math.round(S.h * S.dpr);
    tl.style.width = S.w + 'px';
    tl.style.height = S.h + 'px';

    S.pointer.x = S.pointer.tx;
    S.pointer.y = S.pointer.ty;
  }

  /* ---------------- 章节 ---------------- */

  function chapterAt(j) {
    for (var i = CH.length - 1; i >= 0; i--) if (j >= CH[i].start) return i;
    return 0;
  }

  function localOf(i, j) {
    var c = CH[i];
    return clamp((j - c.start) / Math.max(0.0001, c.end - c.start), 0, 1);
  }

  function computeTrans(j) {
    if (S.reduced) return null;
    for (var i = 1; i < CH.length; i++) {
      var b = CH[i].start;
      if (Math.abs(j - b) < TRANS) {
        var dir = S.vel >= 0 ? 1 : -1;
        var from, to, t;
        if (dir > 0) {
          from = i - 1; to = i;
          t = (j - (b - TRANS)) / (2 * TRANS);
        } else {
          from = i; to = i - 1;
          t = ((b + TRANS) - j) / (2 * TRANS);
        }
        if (t > 0.001 && t < 0.999) {
          return { from: from, to: to, t: clamp(t, 0, 1), dir: dir };
        }
      }
    }
    return null;
  }

  function actState(i, j, id) {
    var local = localOf(i, j);
    var line = S.lineStart + (S.lineEnd - S.lineStart) * local;
    if (id === '05') line = S.lineStart + (S.lineEnd - S.lineStart) * (1 - local);
    if (S.tide[id] != null) line = S.tide[id];
    return { local: local, line: line };
  }

  function tideState(p) {
    if (p < 0.06) return ['满潮', 'HIGH WATER'];
    if (p < 0.32) return ['退潮', 'EBB TIDE'];
    if (p < 0.56) return ['半潮', 'HALF TIDE'];
    if (p < 0.86) return ['低潮', 'LOW WATER'];
    return ['见底', 'LOWEST'];
  }

  /* 05 归潮：潮水在涨，状态词要反过来 */
  function tideStateRising(p) {
    if (p < 0.06) return ['见底', 'LOWEST'];
    if (p < 0.32) return ['涨潮', 'FLOOD TIDE'];
    if (p < 0.56) return ['半潮', 'HALF TIDE'];
    if (p < 0.86) return ['涨潮', 'FLOOD TIDE'];
    return ['满潮', 'HIGH WATER'];
  }

  function clockText(p) {
    var t = new Date(S.started.getTime() + p * (6 * 3600 + 13 * 60) * 1000);
    var hh = String(t.getHours()).padStart(2, '0');
    var mm = String(t.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

  /* ---------------- 潮波 ---------------- */

  function hostWave(a, x) {
    return Math.sin((x / Math.max(1, a.W)) * 23 + S.time * 0.7) * 1.4
      + Math.sin((x / Math.max(1, a.W)) * 55 - S.time * 0.5) * 0.7;
  }

  function hostPathAbove(a, line) {
    var g = a.g;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(a.W, 0);
    for (var x = a.W; x >= 0; x -= 6) g.lineTo(x, line + hostWave(a, x));
    g.closePath();
  }

  function hostPathBelow(a, line) {
    var g = a.g;
    g.beginPath();
    g.moveTo(0, line + hostWave(a, 0));
    for (var x = 0; x <= a.W; x += 6) g.lineTo(x, line + hostWave(a, x));
    g.lineTo(a.W, a.H);
    g.lineTo(0, a.H);
    g.closePath();
  }

  /* ---------------- act host ---------------- */

  function makeAct(id) {
    var layer = document.createElement('div');
    layer.className = 'act-layer';
    layer.dataset.act = id;

    var canvas = document.createElement('canvas');
    layer.appendChild(canvas);
    $('acts').appendChild(layer);

    var g = canvas.getContext('2d');
    var a = {
      id: id, layer: layer, canvas: canvas, g: g,
      act: null, ready: false,
      W: 0, H: 0, dpr: 1, line: 0, local: 0,
      ctx: null
    };

    a.ctx = {
      g: g, root: layer, W: 0, H: 0, dpr: 1, palette: PALETTE,
      font: function (w, s, f) { return w + ' ' + s + 'px ' + f; },
      waveAt: function (x) { return hostWave(a, x); },
      clipAbove: function (line) { hostPathAbove(a, line); },
      clipBelow: function (line) { hostPathBelow(a, line); },
      setTide: function (y) { S.tide[id] = clamp(y, S.lineStart, S.lineEnd); },
      onCollect: function (word) { collect(word, id); }
    };

    acts[id] = a;
    return a;
  }

  function resizeHost(a) {
    var w = S.w, h = S.h, dpr = Math.min(S.dpr, 2);
    a.W = w; a.H = h; a.dpr = dpr;
    a.canvas.width = Math.max(1, Math.round(w * dpr));
    a.canvas.height = Math.max(1, Math.round(h * dpr));
    a.canvas.style.width = w + 'px';
    a.canvas.style.height = h + 'px';
    a.ctx.W = w; a.ctx.H = h; a.ctx.dpr = dpr;
    if (a.act && a.act.resize) a.act.resize(w, h, dpr);
  }

  function attachAct(id, act) {
    var a = acts[id];
    if (!a) return;
    a.act = act;
    a.ready = true;
    if (act.mount) act.mount(a.layer, a.ctx);
    resizeHost(a);
    if (id === '05') {
      if (window.TideCard) TideCard.bind(a, act);
      if (window.Gate) Gate.bind();
    }
  }

  function loadAct(id) {
    if (id === '00') return;
    if (window.ACTS.list[id]) { attachAct(id, window.ACTS.list[id]); return; }
    var sc = document.createElement('script');
    sc.src = 'js/acts/act' + id + '.js';
    sc.onload = function () {
      var act = window.ACTS.list[id];
      if (act) attachAct(id, act);
    };
    sc.onerror = function () { /* 保持 placeholder */ };
    document.body.appendChild(sc);
  }

  function placeholderAct(id) {
    var ch = null;
    for (var i = 0; i < CH.length; i++) if (CH[i].id === id) ch = CH[i];
    return {
      id: id, title: COPY[id] ? COPY[id].title : id, en: '',
      mount: function (root, ctx) { this.ctx = ctx; },
      resize: function (w, h, dpr) { this.W = w; this.H = h; this.dpr = dpr; },
      render: function (s) {
        var g = this.ctx.g, W = this.W, H = this.H;
        var dark = (id === '03' || id === '05');
        if (dark) {
          g.fillStyle = '#061a18';
          g.fillRect(0, 0, W, H);
        }
        var p = plateImgs[id];
        if (p && p.complete && p.naturalWidth) {
          var dw = W * 0.4, dh = dw * 0.666;
          var dx = W * 0.53, dy = H * 0.22;
          var sx = p.naturalWidth * 0.06, sw = p.naturalWidth * 0.88;
          var sy = p.naturalHeight * 0.06, sh = p.naturalHeight * 0.88;
          g.save();
          g.globalAlpha = dark ? 0.8 : 0.9;
          g.drawImage(p, sx, sy, sw, sh, dx, dy, dw, dh);
          g.restore();
        } else if (id === '05') {
          g.save();
          g.strokeStyle = 'rgba(242,236,223,.45)';
          g.lineWidth = 0.8;
          g.beginPath();
          g.arc(W * 0.72, H * 0.3, Math.min(W, H) * 0.09, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
        g.save();
        g.font = '400 8px Consolas, monospace';
        g.fillStyle = dark ? 'rgba(242,236,223,.32)' : 'rgba(17,19,16,.32)';
        g.fillText('R1 · 这一幕正在制作', W * 0.53, H * 0.82);
        g.restore();
      }
    };
  }

  function drawBackdrop(a, line) {
    var g = a.g, W = a.W, H = a.H;
    g.fillStyle = PALETTE.bone;
    g.fillRect(0, 0, W, H);
    g.save();
    hostPathBelow(a, line);
    g.clip();
    var grad = g.createLinearGradient(0, line, 0, H);
    grad.addColorStop(0, '#123c3a');
    grad.addColorStop(0.45, '#0a2523');
    grad.addColorStop(1, '#03100F');
    g.fillStyle = grad;
    g.fillRect(0, line, W, Math.max(1, H - line));
    g.restore();
  }

  function drawWaterline(a, line) {
    var g = a.g, W = a.W, H = a.H;
    g.save();
    g.beginPath();
    for (var x = 0; x <= W; x += 6) {
      var y = line + hostWave(a, x);
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(238,252,245,0.38)';
    g.lineWidth = 1;
    g.stroke();

    var seed = Math.floor(line / 7);
    for (var i = 0; i < 26; i++) {
      var r = Math.sin(i * 12.9898 + seed) * 43758.5453;
      r = r - Math.floor(r);
      var xx = ((r + S.time * 0.01 * ((i % 3) + 1)) % 1) * W;
      var base = line + hostWave(a, xx);
      var yy = base + (Math.sin(i * 7.3 + seed) * 0.5) * 8;
      var alpha = (0.04 + r * 0.15) * Math.exp(-Math.abs(yy - base) / 8);
      g.fillStyle = 'rgba(230,250,242,' + alpha + ')';
      g.fillRect(xx, yy, 1 + r * 2, 0.8);
    }
    g.restore();
  }

  function renderHost(a, local, line) {
    if (!a.W || !a.H) return;
    a.local = local;
    a.line = line;
    var g = a.g;
    g.setTransform(a.dpr, 0, 0, a.dpr, 0, 0);
    g.clearRect(0, 0, a.W, a.H);
    drawBackdrop(a, line);
    if (a.act && a.act.render) {
      a.act.render({
        p: local, lineY: line, t: S.reduced ? 0 : S.time,
        pointer: S.pointer, tide: local,
        reduced: S.reduced, palette: PALETTE,
        onCollect: function (word) { collect(word, a.id); }
      });
    }
    drawWaterline(a, line);
  }

  /* ---------------- hero ---------------- */

  function initHero() {
    var noGL = new URLSearchParams(window.location.search).get('nowebgl') === '1';
    Sea.init($('sea'));
    if (!Sea.ok || noGL) {
      document.documentElement.classList.add('no-webgl');
      $('sea').style.display = 'none';
    }
    WaterType.init($('type'), SRC);
    if (/[?&]dbg=1/.test(window.location.search)) {
      var d = document.createElement('div');
      d.id = 'dbg';
      d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;font:10px Consolas,monospace;color:#ff7a6a;background:#000;padding:4px 6px;max-width:90vw';
      d.textContent = 'html=' + document.documentElement.className +
        ' | sea=' + getComputedStyle($('sea')).display +
        ' | type=' + getComputedStyle($('type')).display +
        ' | ok=' + Sea.ok;
      document.body.appendChild(d);
    }
  }

  function renderHero(p) {
    var line = S.lineStart + (S.lineEnd - S.lineStart) * p;
    var ambient = S.reduced ? 0 : S.time;
    Sea.render(ambient, line, p, S.pointer);
    WaterType.render({
      lineY: line,
      time: ambient,
      intro: smooth(clamp(S.intro, 0, 1)),
      dt: S.reduced ? 0 : S.dt,
      pull: p,
      pointer: S.pointer,
      velocity: 0
    });
  }

  /* ---------------- 转场 ---------------- */

  function transWave(x) {
    return Math.sin(x / 34 + S.time * 1.3) * 3.2 + Math.sin(x / 83 - S.time * 0.9) * 1.6;
  }

  function transClipAbove(y) {
    var pts = ['0px 0px', S.w + 'px 0px'];
    for (var x = S.w; x >= 0; x -= 24) pts.push(x + 'px ' + (y + transWave(x)) + 'px');
    return 'polygon(' + pts.join(',') + ')';
  }

  function transClipBelow(y) {
    var pts = [];
    for (var x = 0; x <= S.w; x += 24) pts.push(x + 'px ' + (y + transWave(x)) + 'px');
    pts.push(S.w + 'px ' + S.h + 'px');
    pts.push('0px ' + S.h + 'px');
    return 'polygon(' + pts.join(',') + ')';
  }

  function applyClip(i, clip) {
    if (i === 0) {
      $('sea').style.clipPath = clip;
      $('type').style.clipPath = clip;
    } else {
      var a = acts[CH[i].id];
      if (a) a.canvas.style.clipPath = clip;
    }
  }

  function clearClips() {
    $('sea').style.clipPath = '';
    $('type').style.clipPath = '';
    for (var id in acts) if (acts[id]) acts[id].canvas.style.clipPath = '';
  }

  function drawTransLine(y) {
    var c = $('transLine');
    c.style.display = 'block';
    var g = c.getContext('2d');
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.clearRect(0, 0, S.w, S.h);

    g.beginPath();
    for (var x = 0; x <= S.w; x += 5) {
      var yy = y + transWave(x);
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.strokeStyle = 'rgba(238,252,245,.5)';
    g.lineWidth = 1;
    g.stroke();

    for (var i = 0; i < 34; i++) {
      var r = Math.sin(i * 12.9898 + Math.floor(y / 9)) * 43758.5453;
      r = r - Math.floor(r);
      var xx = ((r + S.time * 0.02 * ((i % 3) + 1)) % 1) * S.w;
      var base = y + transWave(xx);
      var dy = base + (Math.sin(i * 7.3) * 0.5) * 10;
      g.fillStyle = 'rgba(230,250,242,' + (0.05 + r * 0.2) + ')';
      g.fillRect(xx, dy, 1 + r * 2.2, 0.8);
    }
  }

  function hideTransLine() {
    $('transLine').style.display = 'none';
  }

  function showHero(on) {
    $('sea').style.display = on ? 'block' : 'none';
    $('type').style.display = on ? 'block' : 'none';
  }

  function setLayer(a, on) {
    a.layer.classList.toggle('on', !!on);
  }

  function renderChapter(i) {
    var heroOn = (i === 0);
    showHero(heroOn);
    for (var id in acts) if (acts[id]) setLayer(acts[id], !heroOn && id === CH[i].id);
    clearClips();
    hideTransLine();

    if (heroOn) {
      renderHero(localOf(0, S.journey));
    } else {
      var a = acts[CH[i].id];
      if (a) {
        var st = actState(i, S.journey, CH[i].id);
        renderHost(a, st.local, st.line);
      }
    }
  }

  function renderTransition(tr) {
    var from = tr.from, to = tr.to;
    var heroFrom = (from === 0), heroTo = (to === 0);
    showHero(heroFrom || heroTo);

    for (var id in acts) {
      if (acts[id]) setLayer(acts[id], id === CH[from].id || id === CH[to].id);
    }

    if (heroFrom) renderHero(1);
    else if (acts[CH[from].id]) {
      var sf = actState(from, S.journey, CH[from].id);
      renderHost(acts[CH[from].id], sf.local, sf.line);
    }

    if (heroTo) renderHero(0);
    else if (acts[CH[to].id]) {
      var st = actState(to, S.journey, CH[to].id);
      renderHost(acts[CH[to].id], st.local, st.line);
    }

    var y = tr.dir > 0 ? (S.h + 50 - tr.t * (S.h + 100)) : (-50 + tr.t * (S.h + 100));
    var cf = tr.dir > 0 ? transClipAbove(y) : transClipBelow(y);
    var ct = tr.dir > 0 ? transClipBelow(y) : transClipAbove(y);
    applyClip(from, cf);
    applyClip(to, ct);
    drawTransLine(y);
  }

  /* ---------------- UI ---------------- */

  function buildRail() {
    CH.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rail-item';
      b.dataset.i = String(i);
      var name = COPY[c.id] ? COPY[c.id].title : '满潮';
      b.innerHTML = '<span class="ri-num">' + c.id + '</span><span class="ri-name">' + name + '</span>';
      b.addEventListener('click', function () { go(i); });
      el.rail.appendChild(b);
    });
  }

  function go(i) {
    S.target = i === CH.length - 1 ? 1 : clamp(CH[i].start + 0.001, 0, 1);
    S.interacted = true;
  }

  function updateRail(cur) {
    var items = el.rail.children;
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('on', i === cur);
  }

  function setCopy(i) {
    var c = COPY[CH[i].id];
    var key = CH[i].id;
    if (key === lastCopy) return;
    lastCopy = key;
    if (!c) { el.copy.classList.add('off'); return; }
    el.copy.dataset.tone = c.tone || 'ink';
    el.copy.dataset.len = String(c.title.length);
    var inner =
      '<div class="cc-kicker">' + c.kicker + '</div>' +
      '<div class="cc-title">' + c.title + '</div>' +
      '<div class="cc-body"><p>' + c.body1 + '</p><p>' + c.body2 + '</p></div>';
    el.copy.innerHTML =
      '<div class="cc-layer cc-ink">' + inner + '</div>' +
      '<div class="cc-layer cc-wet" aria-hidden="true">' + inner + '</div>';
    lastCopyLine = -1;
    el.copy.classList.remove('off');
  }

  /* 文案的干 / 湿两层：干侧墨，湿侧骨白，同一条水线切开 */
  var lastCopyLine = -1;
  function updateCopyClip(line) {
    if (!el.copy || el.copy.classList.contains('off')) return;
    if (Math.abs(line - lastCopyLine) < 0.5) return;
    lastCopyLine = line;
    var above = transClipAbove(line);
    var below = transClipBelow(line);
    for (var i = 0; i < el.copy.children.length; i++) {
      var layer = el.copy.children[i];
      if (layer.classList.contains('cc-ink')) layer.style.clipPath = above;
      else if (layer.classList.contains('cc-wet')) layer.style.clipPath = below;
    }
  }

  function setHint(cn, en) {
    var k = cn + '|' + en;
    if (k === lastHint) return;
    lastHint = k;
    el.hintTxt.textContent = cn;
    el.hintEn.textContent = en;
  }

  function updateUI(cur) {
    var hero = (cur === 0);
    var st = hero
      ? { local: localOf(0, S.journey), line: S.lineStart + (S.lineEnd - S.lineStart) * localOf(0, S.journey) }
      : actState(cur, S.journey, CH[cur].id);
    var p = clamp((st.line - S.lineStart) / Math.max(1, S.lineEnd - S.lineStart), 0, 1);
    if (CH[cur].id === '05') p = 1 - st.local;

    var level = 2.1 - 3.5 * p;
    var sign = level > 0.05 ? '+' : (level < -0.05 ? '\u2212' : '');
    var levelText = sign + Math.abs(level).toFixed(1);

    el.gval.textContent = levelText;
    el.level.textContent = levelText + ' m';
    el.gmark.style.top = (st.line - S.lineStart) + 'px';

    var ts = (CH[cur].id === '05') ? tideStateRising(st.local) : tideState(p);
    if (ts[0] !== lastState) {
      lastState = ts[0];
      el.stateCN.textContent = ts[0];
      el.stateEN.textContent = ts[1];
    }

    var c = clockText(p);
    if (c !== lastClock) {
      lastClock = c;
      el.clock.textContent = c;
    }

    el.index.textContent = CH[cur].id + ' / 05';

    var tone = hero ? 'bone' : (COPY[CH[cur].id].tone || 'ink');
    el.rail.style.color = tone === 'bone' ? 'var(--bone)' : 'var(--ink)';

    if (hero || CH[cur].id === '04' || (CH[cur].id === '05' && st.local <= 0.9)) {
      el.copy.classList.add('off');
      lastCopy = '';
    } else if (CH[cur].id === '05') {
      el.copy.style.top = '7%';
      setCopy(cur);
    } else {
      el.copy.style.top = '';
      setCopy(cur);
    }

    updateRail(cur);

    if (hero) setHint('向下，把海拉下去', 'PULL THE SEA DOWN');
    else setHint(COPY[CH[cur].id].hint, COPY[CH[cur].id].hintEn);

    if (window.Gate) Gate.toggle(CH[cur].id === '05');

    updateCopyClip(st.line);

    if (window.Soundscape && Soundscape.on) {
      Soundscape.setAct(CH[cur].id);
      Soundscape.update({
        tide: S.journey, line: st.line, act: CH[cur].id, p: st.local,
        pointer: S.pointer, velocity: S.vel, reduced: S.reduced
      });
    }
  }

  function collect(word, id) {
    if (!window.Collection) return;
    var ok = window.Collection.add(word, id);
    if (!ok) return;
    el.found.textContent = '拾得 · ' + word + ' · ' + window.Collection.count() + ' / 5';
    el.found.classList.add('show');
    clearTimeout(collect.t);
    collect.t = setTimeout(function () { el.found.classList.remove('show'); }, 2600);
  }

  /* ---------------- 循环 ---------------- */

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);

    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.dt = dt;
    S.time += dt;

    if (S.reduced) S.intro = 1;
    else if (S.intro < 1) S.intro = Math.min(1, S.intro + dt / 1.35);

    var prev = S.journey;
    if (!S.dragging) {
      var f = 1 - Math.pow(0.0035, dt);
      S.journey += (S.target - S.journey) * Math.min(1, f);
      if (Math.abs(S.target - S.journey) < 0.00005) S.journey = S.target;
    }
    S.journey = clamp(S.journey, 0, 1);
    S.vel = (S.journey - prev) / Math.max(dt, 0.016);
    S.prevJourney = S.journey;

    S.pointer.x += (S.pointer.tx - S.pointer.x) * 0.07;
    S.pointer.y += (S.pointer.ty - S.pointer.y) * 0.07;

    var tr = computeTrans(S.journey);
    S.trans = tr;
    var cur = tr ? (tr.t < 0.5 ? tr.from : tr.to) : chapterAt(S.journey);
    S.chapter = cur;

    if (tr) renderTransition(tr);
    else renderChapter(cur);

    updateUI(cur);

    if (window.Ambience && Ambience.on && now - lastAudio > 120) {
      lastAudio = now;
      Ambience.update(S.journey);
    }

    if (DBG) {
      frames++;
      if (now - fpsT > 1000) {
        if (dbgEl) dbgEl.textContent = Math.round(frames * 1000 / (now - fpsT)) + ' fps · ' + S.w + '×' + S.h;
        frames = 0;
        fpsT = now;
      }
    }
  }

  /* ---------------- 输入 ---------------- */

  function markInteracted() { S.interacted = true; }

  function onWheel(e) {
    if (e.ctrlKey) return;
    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 18;
    else if (e.deltaMode === 2) d *= S.h;
    S.target = clamp(S.target + d / 12000, 0, 1);
    markInteracted();
  }

  function onDown(e) {
    S.pointer.down = true;
    S.pointer.tx = e.clientX / Math.max(1, S.w);
    S.pointer.ty = e.clientY / Math.max(1, S.h);
    S.pointer.x = S.pointer.tx;
    S.pointer.y = S.pointer.ty;
    if (e.target.closest && e.target.closest('button, a')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (S.trans || S.chapter !== 0) return;
    S.drag = { id: e.pointerId, y: e.clientY, start: S.target };
    S.dragging = true;
    markInteracted();
    if (e.cancelable) e.preventDefault();
  }

  function onMove(e) {
    S.pointer.tx = e.clientX / S.w;
    S.pointer.ty = e.clientY / S.h;
    if (!S.drag || e.pointerId !== S.drag.id) return;
    var dy = e.clientY - S.drag.y;
    S.target = clamp(S.drag.start + dy / (S.h * 0.8) * 0.16, 0, 0.16);
    S.journey = S.target;
  }

  function onUp(e) {
    S.pointer.down = false;
    if (!S.drag || e.pointerId !== S.drag.id) return;
    S.target = S.journey;
    S.drag = null;
    S.dragging = false;
  }

  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && CH[S.chapter] && CH[S.chapter].id === '05') {
      e.preventDefault();
      if (window.TideCard) TideCard.seal();
      return;
    }
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown') {
      e.preventDefault();
      S.target = clamp(S.target + (k === 'PageDown' ? 0.12 : 0.05), 0, 1);
    } else if (k === 'ArrowUp' || k === 'PageUp') {
      e.preventDefault();
      S.target = clamp(S.target - (k === 'PageUp' ? 0.12 : 0.05), 0, 1);
    } else if (k === 'Home') {
      e.preventDefault(); S.target = 0;
    } else if (k === 'End') {
      e.preventDefault(); S.target = 1;
    }
    markInteracted();
  }

  function bind() {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
    window.addEventListener('touchmove', function (e) {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    el.brand.addEventListener('click', function (e) { e.preventDefault(); });

    el.sound.addEventListener('click', function (e) {
      e.stopPropagation();
      var want = !Ambience.on;
      var ok = false;
      try { ok = Ambience.enable(want); } catch (err) { ok = false; }
      try { if (window.Soundscape) Soundscape.enable(want); } catch (err2) { ok = ok; }
      if (!ok) return;
      el.sound.classList.toggle('on', want);
      el.sound.setAttribute('aria-pressed', String(want));
      el.sound.setAttribute('aria-label', want ? '关闭声音' : '开启声音');
      el.soundState.textContent = want ? 'ON' : 'OFF';
    });

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) {
        last = 0;
        raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
      }
    });

    document.addEventListener('tide:again', function () {
      S.target = CH[CH.length - 1].start + 0.001;
      S.journey = S.target;
      S.intro = 1;
      if (window.Soundscape) Soundscape.event('again');
    });

    document.addEventListener('tide:collect', function () {
      if (!window.Soundscape) return;
      var id = CH[S.chapter] ? CH[S.chapter].id : '00';
      Soundscape.event(id === '03' ? 'spawn' : (id === '04' ? 'needle' : 'pick'));
    });

    document.addEventListener('tide:card-open', function () {
      if (window.Soundscape) {
        Soundscape.event('card');
        Soundscape.event('seal');
      }
    });
  }

  /* ---------------- 启动 ---------------- */

  function start() {
    initHero();
    if (window.Soundscape) Soundscape.init();

    for (var i = 1; i < CH.length; i++) {
      var a = makeAct(CH[i].id);
      var ph = placeholderAct(CH[i].id);
      a.act = ph;
      a.ready = true;
      if (ph.mount) ph.mount(a.layer, a.ctx);
    }

    for (var id in PLATES) {
      var img = new Image();
      img.src = PLATES[id];
      plateImgs[id] = img;
    }

    buildRail();
    resize();

    var q = new URLSearchParams(window.location.search);
    if (q.has('act')) {
      var idx = -1;
      for (var k = 0; k < CH.length; k++) if (CH[k].id === q.get('act')) idx = k;
      if (idx >= 0) {
        var lp = clamp(parseFloat(q.get('p')) || 0, 0, 1);
        S.journey = S.target = CH[idx].start + lp * (CH[idx].end - CH[idx].start);
        S.intro = 1;
      }
    } else if (q.has('p')) {
      S.journey = S.target = clamp(parseFloat(q.get('p')), 0, 1) * CH[0].end;
      S.intro = 1;
    }

    loadAct('02');
    loadAct('01');
    loadAct('03');
    loadAct('04');
    loadAct('05');

    bind();

    if (DBG) {
      dbgEl = document.createElement('div');
      dbgEl.style.cssText = 'position:fixed;right:14px;bottom:64px;z-index:99;font:9px/1 Consolas,monospace;letter-spacing:.08em;color:#D8503A;opacity:.8;pointer-events:none';
      document.body.appendChild(dbgEl);
      fpsT = performance.now();
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { WaterType.layout(); });
    }

    setTimeout(function () {
      if (el.veil) el.veil.classList.add('gone');
    }, 140);

    raf = requestAnimationFrame(loop);

    try {
      var hasSerif = document.fonts && document.fonts.check('600 80px "Noto Serif SC"');
      console.info('[潮汐书·五幕] font Noto Serif SC:', hasSerif, '| webgl:', Sea.ok);
    } catch (err) { /* noop */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
