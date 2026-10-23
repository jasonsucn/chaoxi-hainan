/* ============================================================
   App —— 一条潮汐的状态机。
   输入：滚轮 / 拖拽（直接拉海）/ 键盘。
   输出：水线、大字、潮位尺、读数、声音。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  var SRC = {
    kicker: document.querySelector('[data-kicker]').textContent.trim(),
    title: document.querySelector('[data-title]').textContent.trim(),
    place: document.querySelector('[data-place]').textContent.trim(),
    sub: document.querySelector('[data-sub]').textContent.trim()
  };

  var el = {
    gauge: $('gauge'),
    gmark: $('gmark'),
    gval: $('gval'),
    stateCN: $('stateCN'),
    stateEN: $('stateEN'),
    level: $('level'),
    clock: $('clock'),
    hint: $('hint'),
    teaser: $('teaser'),
    replay: $('replay'),
    sound: $('sound'),
    soundState: $('soundState'),
    veil: $('veil'),
    brand: document.querySelector('.brand')
  };

  var S = {
    w: 0, h: 0, dpr: 1,
    lineStart: 64, lineEnd: 740,
    lineY: 64,
    pull: 0, target: 0,
    prevPull: 0, pullVel: 0,
    time: 0, intro: 0, dt: 0.016,
    pointer: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 },
    dragging: false,
    drag: null,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    started: new Date(),
    moon: null,
    interacted: false
  };
  /* 月相仍用于后面的「大潮之门」；画面上已由椰子树取代 */
  S.moon = moonInfo(S.started);

  var tween = null;
  var raf = 0;
  var running = true;
  var last = 0;
  var lastClock = '';
  var lastState = '';
  var lastAudio = 0;

  var DBG = /[?&]debug=1/.test(window.location.search);
  var dbgEl = null;
  var frames = 0;
  var fpsT = 0;

  /* ---------------- 尺寸 ---------------- */

  function resize() {
    S.w = window.innerWidth;
    S.h = window.innerHeight;
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);

    S.lineStart = Math.max(58, Math.round(S.h * 0.078));
    S.lineEnd = Math.round(S.h * 0.88);
    if (S.lineEnd - S.lineStart < 180) S.lineEnd = S.lineStart + 180;

    el.gauge.style.top = S.lineStart + 'px';
    el.gauge.style.bottom = Math.max(0, S.h - S.lineEnd) + 'px';

    var seaDpr = Math.min(S.dpr, (S.w * S.h > 850 * 850) ? 1.5 : 1.75);
    Sea.resize(S.w, S.h, seaDpr);
    WaterType.resize(S.w, S.h, S.dpr);

    S.lineY = S.lineStart + (S.lineEnd - S.lineStart) * S.pull;
    S.pointer.x = S.pointer.tx;
    S.pointer.y = S.pointer.ty;
  }

  /* ---------------- 读数 ---------------- */

  function tideState(p) {
    if (p < 0.06) return ['满潮', 'HIGH WATER'];
    if (p < 0.32) return ['退潮', 'EBB TIDE'];
    if (p < 0.56) return ['半潮', 'HALF TIDE'];
    if (p < 0.86) return ['低潮', 'LOW WATER'];
    return ['见底', 'LOWEST'];
  }

  function moonInfo(d) {
    var synodic = 29.530588853;
    var ref = Date.UTC(2000, 0, 6, 18, 14);
    var days = (d.getTime() - ref) / 86400000;
    var phase = ((days % synodic) + synodic) % synodic / synodic;
    var illum = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    var name, en;
    if (phase < 0.03 || phase >= 0.97) { name = '新月'; en = 'NEW MOON'; }
    else if (phase < 0.22) { name = '娥眉月'; en = 'WAXING CRESCENT'; }
    else if (phase < 0.28) { name = '上弦'; en = 'FIRST QUARTER'; }
    else if (phase < 0.47) { name = '盈凸'; en = 'WAXING GIBBOUS'; }
    else if (phase < 0.53) { name = '满月'; en = 'FULL MOON'; }
    else if (phase < 0.72) { name = '亏凸'; en = 'WANING GIBBOUS'; }
    else if (phase < 0.78) { name = '下弦'; en = 'LAST QUARTER'; }
    else { name = '残月'; en = 'WANING CRESCENT'; }
    return { phase: phase, illum: illum, name: name, en: en };
  }

  function clockText(p) {
    var t = new Date(S.started.getTime() + p * (6 * 3600 + 13 * 60) * 1000);
    var hh = String(t.getHours()).padStart(2, '0');
    var mm = String(t.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

  function updateUI() {
    var p = S.pull;
    var level = 2.1 - 3.5 * p;
    var sign = level > 0.05 ? '+' : (level < -0.05 ? '\u2212' : '');
    var levelText = sign + Math.abs(level).toFixed(1);

    el.gval.textContent = levelText;
    el.level.textContent = levelText + ' m';
    el.gmark.style.top = (S.lineY - S.lineStart) + 'px';

    var st = tideState(p);
    var key = st[0];
    if (key !== lastState) {
      lastState = key;
      el.stateCN.textContent = st[0];
      el.stateEN.textContent = st[1];
    }

    var c = clockText(p);
    if (c !== lastClock) {
      lastClock = c;
      el.clock.textContent = c;
    }

    if (p > 0.72) el.replay.classList.add('show');
    else el.replay.classList.remove('show');

    if (p > 0.84) el.teaser.classList.add('show');
    else el.teaser.classList.remove('show');
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

    if (S.reduced) {
      S.intro = 1;
    } else if (S.intro < 1) {
      S.intro = Math.min(1, S.intro + dt / 1.35);
    }

    if (tween) {
      var k = clamp((now - tween.start) / tween.dur, 0, 1);
      S.target = tween.from + (tween.to - tween.from) * easeInOut(k);
      if (k >= 1) tween = null;
    }

    if (!S.dragging) {
      var f = 1 - Math.pow(0.0028, dt);
      S.pull += (S.target - S.pull) * Math.min(1, f);
      if (Math.abs(S.target - S.pull) < 0.0003) S.pull = S.target;
    }

    S.pull = clamp(S.pull, 0, 1);
    S.pullVel = (S.pull - S.prevPull) / Math.max(dt, 0.016);
    S.prevPull = S.pull;
    S.lineY = S.lineStart + (S.lineEnd - S.lineStart) * S.pull;

    S.pointer.x += (S.pointer.tx - S.pointer.x) * 0.07;
    S.pointer.y += (S.pointer.ty - S.pointer.y) * 0.07;

    var ambient = S.reduced ? 0 : S.time;

    Sea.render(ambient, S.lineY, S.pull, S.pointer);
    WaterType.render({
      lineY: S.lineY,
      time: ambient,
      intro: smooth(clamp(S.intro, 0, 1)),
      dt: S.reduced ? 0 : dt,
      pull: S.pull,
      pointer: S.pointer,
      velocity: S.pullVel
    });

    updateUI();

    if (Ambience.on && now - lastAudio > 120) {
      lastAudio = now;
      Ambience.update(S.pull);
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

  function markInteracted() {
    if (S.interacted) return;
    S.interacted = true;
    el.hint.classList.add('hide');
  }

  function onWheel(e) {
    if (e.ctrlKey) return; // 保留触控板缩放
    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 18;
    else if (e.deltaMode === 2) d *= S.h;
    S.target = clamp(S.target + d / 1900, 0, 1);
    markInteracted();
  }

  function onPointerDown(e) {
    if (e.target.closest && e.target.closest('button, a')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    S.drag = { id: e.pointerId, y: e.clientY, start: S.target };
    S.dragging = true;
    markInteracted();
    if (e.cancelable) e.preventDefault();
  }

  function onPointerMove(e) {
    S.pointer.tx = e.clientX / S.w;
    S.pointer.ty = e.clientY / S.h;

    if (!S.drag || e.pointerId !== S.drag.id) return;
    var dy = e.clientY - S.drag.y;
    var range = Math.max(1, S.lineEnd - S.lineStart);
    S.target = clamp(S.drag.start + dy / range, 0, 1);
    S.pull = S.target;
  }

  function onPointerUp(e) {
    if (!S.drag || e.pointerId !== S.drag.id) return;
    S.target = S.pull;
    S.drag = null;
    S.dragging = false;
  }

  function onKey(e) {
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;

    var k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') {
      e.preventDefault();
      S.target = clamp(S.target + (k === 'PageDown' ? 0.2 : 0.08), 0, 1);
      markInteracted();
    } else if (k === 'ArrowUp' || k === 'PageUp') {
      e.preventDefault();
      S.target = clamp(S.target - (k === 'PageUp' ? 0.2 : 0.08), 0, 1);
      markInteracted();
    } else if (k === 'Home') {
      e.preventDefault();
      S.target = 0;
    } else if (k === 'End') {
      e.preventDefault();
      S.target = 1;
    }
  }

  function bind() {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () {
      setTimeout(resize, 250);
    });
    window.addEventListener('touchmove', function (e) {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    el.brand.addEventListener('click', function (e) { e.preventDefault(); });

    el.sound.addEventListener('click', function (e) {
      e.stopPropagation();
      var want = !Ambience.on;
      var ok = false;
      try { ok = Ambience.enable(want); } catch (err) { ok = false; }
      if (!ok) return;
      el.sound.classList.toggle('on', want);
      el.sound.setAttribute('aria-pressed', String(want));
      el.sound.setAttribute('aria-label', want ? '关闭声音' : '开启声音');
      el.soundState.textContent = want ? 'ON' : 'OFF';
    });

    el.replay.addEventListener('click', function (e) {
      e.stopPropagation();
      tween = { from: S.pull, to: 0, start: performance.now(), dur: 2400 };
      setTimeout(function () {
        el.hint.classList.remove('hide');
        S.interacted = false;
      }, 1200);
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
  }

  /* ---------------- 启动 ---------------- */

  function start() {
    Sea.init($('sea'));
    WaterType.init($('type'), SRC);

    /* dev: ?p=0.45 直接看某个潮位 */
    var m = /[?&]p=([0-9.]+)/.exec(window.location.search);
    if (m) {
      S.pull = S.target = clamp(parseFloat(m[1]), 0, 1);
      S.intro = 1;
      S.interacted = true;
      if (S.pull > 0.03 && el.hint) el.hint.classList.add('hide');
      if (el.veil) el.veil.style.display = 'none';
    }

    resize();
    bind();

    if (DBG) {
      dbgEl = document.createElement('div');
      dbgEl.style.cssText = 'position:fixed;right:14px;bottom:64px;z-index:99;font:9px/1 Consolas,monospace;letter-spacing:.08em;color:#D8503A;opacity:.8;pointer-events:none';
      document.body.appendChild(dbgEl);
      fpsT = performance.now();
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        WaterType.layout();
      });
    }

    /* 开场：黑幕退去，字从水里浮上来 */
    setTimeout(function () {
      if (el.veil) el.veil.classList.add('gone');
    }, 140);

    raf = requestAnimationFrame(loop);

    try {
      var hasSerif = document.fonts && document.fonts.check('600 80px "Noto Serif SC"');
      console.info('[潮汐书] font Noto Serif SC:', hasSerif, '| webgl:', Sea.ok);
    } catch (err) { /* noop */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
