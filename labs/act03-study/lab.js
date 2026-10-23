/* ============================================================
   ACT 03 LAB harness
   背景 / 水线 / 潮位 / HUD / 输入 / rAF。场景全部在 act03-coral.js。
   与 docs/ACT-INTERFACE.md 的 ctx 形状一致，方便 R1 原样取用。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  var stage = $('stage');
  var canvas = $('scene');
  var g = canvas.getContext('2d');

  var W = 0, H = 0, dpr = 1;
  var p = 0.55, target = 0.55;
  var lineStart = 0, lineEnd = 0, lineY = 0;
  var time = 6.4;
  var last = 0;
  var running = true;
  var dragging = false;
  var drag = null;
  var tween = null;

  var pointer = { x: 0.62, y: 0.60, down: false };
  var startPointer = { x: 0.5, y: 0.5 };
  var hintDismissed = false;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q = new URLSearchParams(window.location.search);
  var still = q.get('still') === '1';
  var clean = q.get('hud') === '0';
  var debug = q.get('debug') === '1';
  var forceHint = q.get('hint');
  var STILL_T = 6.4;

  if (q.has('p')) {
    p = clamp(parseFloat(q.get('p')) || 0, 0, 1);
    target = p;
  }
  if (q.has('x')) pointer.x = clamp(parseFloat(q.get('x')) || 0.5, 0, 1);
  if (q.has('y')) pointer.y = clamp(parseFloat(q.get('y')) || 0.5, 0, 1);
  if (q.has('t')) STILL_T = Math.max(0, parseFloat(q.get('t')) || 0);
  if (still || reduced) time = still ? STILL_T : 0;
  if (clean) document.body.classList.add('clean');

  var palette = {
    ink: '#111310',
    bone: '#F2ECDF',
    sea: '#03100F',
    teal: '#16332F',
    coral: '#D8503A'
  };

  var startClock = new Date();
  startClock.setHours(21, 48, 0, 0);

  var FONT_SERIF = '"Noto Serif SC","Source Han Serif SC","STZhongsong","Songti SC",serif';
  var FONT_SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

  var ctx = {
    g: g,
    root: stage,
    W: 0, H: 0, dpr: 1,
    palette: palette,
    font: function (weight, size, family) { return weight + ' ' + size + 'px ' + family; },
    waveAt: function (x) { return waveAt(x, time); },
    clipAbove: function (line) { pathAbove(line); },
    clipBelow: function (line) { pathBelow(line); }
  };

  var act = null;

  /* ---------------- 水 ---------------- */

  function waveAt(x, t) {
    return Math.sin((x / Math.max(1, W)) * 23.0 + t * 0.7) * 1.4
      + Math.sin((x / Math.max(1, W)) * 55.0 - t * 0.5) * 0.7;
  }

  function pathAbove(line) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W, 0);
    for (var x = W; x >= 0; x -= 6) g.lineTo(x, line + waveAt(x, time));
    g.closePath();
  }

  function pathBelow(line) {
    g.beginPath();
    g.moveTo(0, line + waveAt(0, time));
    for (var x = 0; x <= W; x += 6) g.lineTo(x, line + waveAt(x, time));
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
  }

  function drawBackdrop(line) {
    /* 干侧：骨白纸，底部略暖，像纸靠近水 */
    var sky = g.createLinearGradient(0, 0, 0, Math.max(1, line));
    sky.addColorStop(0, '#F5EFE3');
    sky.addColorStop(1, '#F0E9DA');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    /* 湿侧：深青 -> 最深的海 */
    g.save();
    pathBelow(line);
    g.clip();
    var grad = g.createLinearGradient(0, line, 0, H);
    grad.addColorStop(0, '#123C3A');
    grad.addColorStop(0.42, '#0A2523');
    grad.addColorStop(0.78, '#051715');
    grad.addColorStop(1, '#03100F');
    g.fillStyle = grad;
    g.fillRect(0, line, W, Math.max(1, H - line));

    /* 水面下一点点天光 */
    var sheen = g.createLinearGradient(0, line, 0, line + Math.min(120, H - line));
    sheen.addColorStop(0, 'rgba(127,227,212,0.045)');
    sheen.addColorStop(1, 'rgba(127,227,212,0)');
    g.fillStyle = sheen;
    g.fillRect(0, line, W, Math.min(120, H - line));
    g.restore();
  }

  function drawWaterline(line) {
    g.save();

    /* 水面下的薄光带 */
    g.save();
    pathBelow(line);
    g.clip();
    var band = g.createLinearGradient(0, line, 0, line + 34);
    band.addColorStop(0, 'rgba(210,255,245,0.075)');
    band.addColorStop(1, 'rgba(210,255,245,0)');
    g.fillStyle = band;
    g.fillRect(0, line, W, 34);
    g.restore();

    /* 水线 */
    g.beginPath();
    for (var x = 0; x <= W; x += 6) {
      var y = line + waveAt(x, time);
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(238,252,245,0.40)';
    g.lineWidth = 1;
    g.stroke();

    /* 细小碎光 */
    var seed = Math.floor(line / 7);
    for (var i = 0; i < 34; i++) {
      var r = rnd(i * 13 + seed);
      var xx = ((r + time * 0.004 * ((i % 3) + 1)) % 1) * W;
      var base = line + waveAt(xx, time);
      var yy = base + (rnd(i * 7.3 + seed) - 0.5) * 10;
      var a = (0.04 + rnd(i * 3.1 + seed) * 0.18) * Math.exp(-Math.abs(yy - base) / 8);
      g.fillStyle = 'rgba(230,250,242,' + a + ')';
      g.fillRect(xx, yy, 1.2 + rnd(i * 5.7) * 2.4, 0.8);
    }

    g.restore();
  }

  function rnd(n) {
    var v = Math.sin(n * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }

  /* ---------------- HUD ---------------- */

  var el = {
    gauge: $('gauge'),
    gmark: $('gmark'),
    gval: $('gval'),
    stops: Array.prototype.slice.call(document.querySelectorAll('.gstop')),
    stateCN: $('stateCN'),
    stateEN: $('stateEN'),
    level: $('level'),
    clock: $('clock'),
    hint: $('hint'),
    replay: $('replay'),
    dbg: $('dbg')
  };

  function tideState(v) {
    if (v < 0.17) return ['满潮', 'HIGH WATER'];
    if (v < 0.58) return ['半潮', 'HALF TIDE'];
    if (v < 0.86) return ['低潮', 'LOW WATER'];
    return ['见底', 'LOWEST'];
  }

  function levelText(v) {
    var lv = 2.1 - 3.5 * v;
    var sign = lv > 0.05 ? '+' : (lv < -0.05 ? '\u2212' : '');
    return sign + Math.abs(lv).toFixed(1);
  }

  function clockText(v) {
    var d = new Date(startClock.getTime() + v * (6 * 3600 + 13 * 60) * 1000);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  var lastState = '';
  var lastClock = '';
  var lastLevel = '';
  var hudP = -1;
  var hudActive = -2;

  function updateHUD() {
    if (hudP >= 0 && Math.abs(p - hudP) < 0.0004) return;
    hudP = p;

    var st = tideState(p);
    if (st[0] !== lastState) {
      lastState = st[0];
      el.stateCN.textContent = st[0];
      el.stateEN.textContent = st[1];
    }
    var lv = levelText(p);
    if (lv !== lastLevel) {
      lastLevel = lv;
      el.gval.textContent = lv;
      el.level.textContent = lv + ' m';
    }
    var ck = clockText(p);
    if (ck !== lastClock) {
      lastClock = ck;
      el.clock.textContent = ck;
    }
    el.gmark.style.top = (clamp(p, 0, 1) * 100).toFixed(3) + '%';

    var active = -1;
    for (var i = 0; i < el.stops.length; i++) {
      var stopP = parseFloat(el.stops[i].getAttribute('data-stop'));
      if (Math.abs(p - stopP) < 0.055) active = i;
    }
    if (active !== hudActive) {
      hudActive = active;
      for (var j = 0; j < el.stops.length; j++) {
        var on = j === active;
        el.stops[j].classList.toggle('on', on);
        el.stops[j].setAttribute('aria-pressed', String(on));
      }
    }
    el.replay.classList.toggle('show', p > 0.24);
  }

  function dismissHint() {
    if (hintDismissed) return;
    if (forceHint === '1') return;
    hintDismissed = true;
    el.hint.classList.add('hide');
  }

  if (forceHint === '0') {
    hintDismissed = true;
    el.hint.classList.add('hide');
  }

  /* ---------------- 输入 ---------------- */

  function setPull(v) {
    target = clamp(v, 0, 1);
    if (still || reduced) p = target;
  }

  function onWheel(e) {
    if (e.ctrlKey) return;
    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 18;
    else if (e.deltaMode === 2) d *= H;
    setPull(target + d / 1900);
    dismissHint();
  }

  function onPointerDown(e) {
    if (e.target && e.target.closest && e.target.closest('button, a')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointer.down = true;
    pointer.x = e.clientX / Math.max(1, W);
    pointer.y = e.clientY / Math.max(1, H);
    drag = { id: e.pointerId, y: e.clientY, start: target };
    dragging = true;
    if (e.cancelable) e.preventDefault();
  }

  function onPointerMove(e) {
    pointer.x = e.clientX / Math.max(1, W);
    pointer.y = e.clientY / Math.max(1, H);
    var dx = (pointer.x - startPointer.x) * W;
    var dy = (pointer.y - startPointer.y) * H;
    if (Math.hypot(dx, dy) > 26) dismissHint();

    if (!drag || e.pointerId !== drag.id) return;
    var range = Math.max(1, lineEnd - lineStart);
    var next = clamp(drag.start + (e.clientY - drag.y) / range, 0, 1);
    target = next;
    p = next;
  }

  function onPointerUp(e) {
    if (e && drag && e.pointerId !== drag.id) return;
    pointer.down = false;
    drag = null;
    dragging = false;
  }

  function onKey(e) {
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') {
      e.preventDefault();
      setPull(target + (k === 'PageDown' ? 0.2 : 0.08));
      dismissHint();
    } else if (k === 'ArrowUp' || k === 'PageUp') {
      e.preventDefault();
      setPull(target - (k === 'PageUp' ? 0.2 : 0.08));
      dismissHint();
    } else if (k === 'Home') {
      e.preventDefault();
      setPull(0);
      dismissHint();
    } else if (k === 'End') {
      e.preventDefault();
      setPull(1);
      dismissHint();
    } else if (k >= '1' && k <= '4') {
      var stops = [0, 0.34, 0.68, 0.92];
      e.preventDefault();
      setPull(stops[parseInt(k, 10) - 1]);
      dismissHint();
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
      setTimeout(resize, 220);
    });
    window.addEventListener('touchmove', function (e) {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    for (var i = 0; i < el.stops.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var v = parseFloat(btn.getAttribute('data-stop'));
          setPull(v);
          dismissHint();
        });
      })(el.stops[i]);
    }

    el.replay.addEventListener('click', function (e) {
      e.stopPropagation();
      if (still || reduced) {
        p = target = 0;
        return;
      }
      tween = { from: p, to: 0, start: performance.now(), dur: 2000 };
      target = 0;
    });

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) {
        last = 0;
        requestAnimationFrame(loop);
      }
    });
  }

  /* ---------------- 尺寸 ---------------- */

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    lineStart = Math.round(H * 0.08);
    lineEnd = Math.round(H * 0.92);
    if (lineEnd - lineStart < 180) lineEnd = lineStart + 180;

    ctx.W = W;
    ctx.H = H;
    ctx.dpr = dpr;

    el.gauge.style.top = lineStart + 'px';
    el.gauge.style.bottom = Math.max(0, H - lineEnd) + 'px';

    if (act && act.resize) act.resize(W, H, dpr);
    lineY = lineStart + (lineEnd - lineStart) * p;
    updateHUD();
  }

  /* ---------------- 循环 ---------------- */

  var frames = 0;
  var fpsT = performance.now();
  var fps = 0;
  var cpuMs = 0;

  function updateDebug(now) {
    if (!debug) return;
    frames++;
    if (now - fpsT >= 700) {
      fps = Math.round(frames * 1000 / (now - fpsT));
      frames = 0;
      fpsT = now;
      var info = act && act.debug ? act.debug() : null;
      var polyps = info ? info.polyps : 0;
      var eggs = info ? info.eggs : 0;
      el.dbg.textContent = fps + ' fps · cpu ' + cpuMs.toFixed(1) + ' ms · ' + W + '×' + H + ' · dpr ' + dpr +
        '\np= ' + p.toFixed(2) + ' · eggs ' + eggs + ' · polyps ' + polyps +
        (info && info.light ? '\nlight ' + info.light.x + ',' + info.light.y + ' open ' + info.light.open : '');
    }
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);

    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (!reduced && !still) time += dt;

    if (tween) {
      var k = clamp((now - tween.start) / tween.dur, 0, 1);
      target = tween.from + (tween.to - tween.from) * easeInOut(k);
      if (k >= 1) tween = null;
    }

    if (!dragging) {
      if (still || reduced) p = target;
      else {
        var f = 1 - Math.pow(0.0032, dt);
        p += (target - p) * Math.min(1, f);
        if (Math.abs(target - p) < 0.00025) p = target;
      }
    }
    p = clamp(p, 0, 1);
    lineY = lineStart + (lineEnd - lineStart) * p;

    var cpuT0 = debug ? performance.now() : 0;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawBackdrop(lineY);

    if (act && act.render) {
      act.render({
        p: p,
        lineY: lineY,
        t: time,
        pointer: pointer,
        tide: p,
        reduced: reduced,
        still: still,
        dt: (reduced || still) ? 0 : dt
      });
    }

    drawWaterline(lineY);
    updateHUD();
    if (debug) {
      var cpuNow = performance.now() - cpuT0;
      cpuMs = cpuMs * 0.82 + cpuNow * 0.18;
    }
    updateDebug(now);
  }

  /* ---------------- 启动 ---------------- */

  function start() {
    act = (window.ACTS && window.ACTS.list && window.ACTS.list['03']) || window.Act03;
    if (!act) {
      console.error('[lab] act 03 not registered');
      return;
    }
    document.title = '03 ' + (act.title || '珊瑚') + ' · 潮汐书 LAB';
    if (act.mount) act.mount(stage, ctx);
    resize();
    bind();
    if (debug) el.dbg.hidden = false;

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (act && act.resize) act.resize(W, H, dpr);
      });
    }

    requestAnimationFrame(loop);
    try {
      var hasSerif = document.fonts && document.fonts.check('500 80px "Noto Serif SC"');
      console.info('[act03 lab] Noto Serif SC:', hasSerif, '| q:', window.location.search);
    } catch (err) { /* noop */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
