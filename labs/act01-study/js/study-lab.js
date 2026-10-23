/* ============================================================
   01 玄武 · lab harness
   潮位 / 加热 / 输入 / 读数。场景绘制全部在 study-scene.js。
   dev: ?p=0.55  ?tide=0.55  ?heat=0.8  ?hud=0  ?hint=0
        ?debug=1  ?still=1
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  var STOPS = [0.03, 0.55, 0.92];
  var params = new URLSearchParams(window.location.search);

  var stage, seaCanvas, artCanvas, gauge, gmark, gval, stoneBtn, thermal, tempEl;
  var heatDot, heatState, stateCN, stateEN, levelEl, live, hud, hint, tideButtons;
  var raf = 0;

  var S = {
    w: 0, h: 0, dpr: 1,
    lineHigh: 0, lineLow: 0, lineY: 0,
    tide: 0.55, target: 0.55,
    tween: null,
    heat: 0, holding: false, holdId: null,
    forcedHeat: null, forced: false,
    origin: null,
    time: 0, last: 0, running: true,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    still: false,
    drag: null,
    interacted: false,
    idleTimer: 0,
    debug: false,
    fpsFrames: 0, fpsT: 0,
    lastState: '', lastLevel: '', lastTemp: '', lastThermal: '', lastActive: -2,
    liveBucket: -1
  };

  var NAMED = { high: 0.03, mid: 0.55, low: 0.92 };

  /* ---------------- 读数 ---------------- */

  function tideState(p) {
    if (p < 0.22) return ['满潮', 'HIGH WATER'];
    if (p < 0.46) return ['退潮', 'EBB TIDE'];
    if (p < 0.68) return ['半潮', 'HALF TIDE'];
    if (p < 0.86) return ['低潮', 'LOW WATER'];
    return ['见底', 'LOWEST'];
  }

  function heatStateText(heat) {
    if (heat < 0.055) return '冷 · 按住石头';
    if (heat < 0.30) return '温 · 手心';
    if (heat < 0.68) return '热 · 石缝在亮';
    return '烫 · 松手会慢慢凉';
  }

  function levelText(p) {
    var level = 1.9 - 3.1 * p;
    var sign = level > 0.05 ? '+' : (level < -0.05 ? '−' : '');
    return sign + Math.abs(level).toFixed(1);
  }

  function updateUI(force) {
    var level = levelText(S.tide);
    if (force || level !== S.lastLevel) {
      S.lastLevel = level;
      gval.textContent = level;
      levelEl.textContent = level + ' m';
    }

    var st = tideState(S.tide);
    if (force || st[0] !== S.lastState) {
      S.lastState = st[0];
      stateCN.textContent = st[0];
      stateEN.textContent = st[1];
    }

    var temp = Math.round(23 + 38 * S.heat);
    var tempTxt = temp + '°C';
    if (force || tempTxt !== S.lastTemp) {
      S.lastTemp = tempTxt;
      tempEl.textContent = tempTxt;
    }

    var hState = heatStateText(S.heat);
    if (force || hState !== S.lastThermal) {
      S.lastThermal = hState;
      heatState.textContent = hState;
    }
    thermal.classList.toggle('hot', S.heat > 0.07);

    var near = -1;
    for (var i = 0; i < STOPS.length; i++) {
      if (Math.abs(S.tide - STOPS[i]) < 0.014) near = i;
    }
    if (near !== S.lastActive) {
      S.lastActive = near;
      for (var k = 0; k < tideButtons.length; k++) {
        tideButtons[k].classList.toggle('on', k === near);
      }
    }

    gmark.style.top = Math.max(0, S.lineY - S.lineHigh).toFixed(1) + 'px';

    /* 无障碍读数只在粗状态变化时更新，避免每帧刷屏 */
    var bucket = (S.tide < 0.22 ? 0 : S.tide < 0.46 ? 1 : S.tide < 0.68 ? 2 : S.tide < 0.86 ? 3 : 4)
      * 8 + Math.min(4, Math.floor(S.heat * 4.999));
    if (force || bucket !== S.liveBucket) {
      S.liveBucket = bucket;
      live.textContent = '潮位' + st[0] + '，' + level + ' 米。石温 ' + temp + ' 摄氏度，' + hState.replace(/ · .*/, '') + '。';
    }
  }

  /* ---------------- 尺寸 ---------------- */

  function updateStoneRect() {
    var r = StudyScene.getRockRect();
    stoneBtn.style.left = r.x + 'px';
    stoneBtn.style.top = r.y + 'px';
    stoneBtn.style.width = Math.max(24, r.w) + 'px';
    stoneBtn.style.height = Math.max(24, r.h) + 'px';
  }

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === S.w && h === S.h && dpr === S.dpr) {
      updateStoneRect();
      return;
    }

    S.w = w; S.h = h; S.dpr = dpr;
    var seaDpr = Math.min(dpr, (w * h > 850 * 850) ? 1.5 : 1.75);
    StudySea.resize(w, h, seaDpr);
    StudyScene.build(w, h, dpr);

    var b = StudyScene.getBounds();
    S.lineHigh = b.lineHigh;
    S.lineLow = b.lineLow;
    gauge.style.top = b.lineHigh.toFixed(1) + 'px';
    gauge.style.bottom = Math.max(0, h - b.lineLow).toFixed(1) + 'px';

    updateStoneRect();
    updateUI(true);
  }

  /* ---------------- 循环 ---------------- */

  function frame(now) {
    if (!S.running) return;
    raf = requestAnimationFrame(frame);

    if (!S.last) S.last = now;
    var dt = Math.min(0.05, (now - S.last) / 1000) || 0.016;
    S.last = now;

    if (!S.reduced && !S.still) S.time += dt;

    if (S.tween) {
      var k = clamp((now - S.tween.start) / S.tween.dur, 0, 1);
      S.target = S.tween.from + (S.tween.to - S.tween.from) * easeInOut(k);
      if (k >= 1) S.tween = null;
    }

    if (!S.drag) {
      S.tide += (S.target - S.tide) * (1 - Math.pow(0.0028, dt));
      if (Math.abs(S.target - S.tide) < 0.0004) S.tide = S.target;
    }
    S.tide = clamp(S.tide, 0, 1);

    if (S.forcedHeat != null) {
      S.heat = S.forcedHeat;
      S.holding = S.heat > 0.01;
    } else if (S.holding) {
      S.heat += (1 - S.heat) * (1 - Math.exp(-dt / 1.9));
    } else {
      S.heat += (0 - S.heat) * (1 - Math.exp(-dt / 8.5));
    }
    if (S.heat < 0.002) S.heat = 0;

    S.lineY = S.lineHigh + (S.lineLow - S.lineHigh) * S.tide;

    if (!S.noSea) StudySea.render(S.time, S.lineY);
    if (!S.noArt) {
      StudyScene.render({
        lineY: S.lineY,
        time: S.time,
        heat: S.heat,
        origin: S.origin,
        waterline: true
      });
    }

    updateUI(false);

    if (S.debug) {
      S.fpsFrames++;
      if (now - S.fpsT > 600) {
        var fps = Math.round(S.fpsFrames * 1000 / (now - S.fpsT));
        S.fpsFrames = 0;
        S.fpsT = now;
        var st = StudyScene.stats;
        hud.textContent = fps + ' FPS · ' + S.w + '×' + S.h + ' · wet ' + st.slices
          + ' · build ' + st.buildMs.toFixed(1) + 'ms';
        document.title = fps + 'fps · build ' + st.buildMs.toFixed(1) + 'ms · wet ' + st.slices
          + ' · ACT01·1023n · ' + S.w + '×' + S.h;
      }
    }
  }

  /* ---------------- 输入 ---------------- */

  function markInteracted() {
    if (!S.interacted) {
      S.interacted = true;
      hint.classList.add('hide');
    }
    clearTimeout(S.idleTimer);
    S.idleTimer = setTimeout(function () {
      if (!S.holding && S.heat < 0.05) hint.classList.remove('hide');
    }, 10000);
  }

  function eventToScene(e) {
    var r = artCanvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startHold(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    S.forcedHeat = null;
    S.holding = true;
    S.holdId = e.pointerId;
    S.origin = eventToScene(e);
    markInteracted();
    try { stoneBtn.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  function endHold(e) {
    if (e && S.holdId != null && e.pointerId !== S.holdId) return;
    S.holding = false;
    S.holdId = null;
  }

  function onPointerMove(e) {
    if (S.holding && (S.holdId == null || e.pointerId === S.holdId)) {
      S.origin = eventToScene(e);
    }
    if (S.drag && e.pointerId === S.drag.id) {
      var dy = e.clientY - S.drag.y;
      var range = Math.max(1, S.lineLow - S.lineHigh);
      S.target = clamp(S.drag.tide + dy / range, 0, 1);
      S.tide = S.target;
      S.tween = null;
    }
  }

  function onStageDown(e) {
    if (e.target.closest && e.target.closest('button, a')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    S.tween = null;
    S.drag = { id: e.pointerId, y: e.clientY, tide: S.tide };
    markInteracted();
  }

  function endDrag(e) {
    if (!S.drag) return;
    if (e && e.pointerId !== S.drag.id) return;
    S.drag = null;
    S.target = S.tide;
  }

  function setTideStop(v) {
    S.forcedHeat = null;
    S.tween = { from: S.tide, to: clamp(v, 0, 1), start: performance.now(), dur: 1900 };
    S.target = v;
    markInteracted();
  }

  function bind() {
    stoneBtn.addEventListener('pointerdown', startHold);
    stoneBtn.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!S.holding) {
          S.forcedHeat = null;
          S.holding = true;
          var r = StudyScene.getRockRect();
          S.origin = { x: r.x + r.w * 0.5, y: r.y + r.h * 0.45 };
          markInteracted();
        }
      }
    });
    stoneBtn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') endHold(e);
    });
    stoneBtn.addEventListener('blur', function () { if (S.holdId == null) endHold(null); });

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', function (e) { endDrag(e); endHold(e); }, { passive: true });
    window.addEventListener('pointercancel', function (e) { endDrag(e); endHold(e); }, { passive: true });

    stage.addEventListener('pointerdown', onStageDown, { passive: false });
    window.addEventListener('wheel', function (e) {
      e.preventDefault();
      S.tween = null;
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 18;
      else if (e.deltaMode === 2) d *= S.h;
      S.target = clamp(S.target + d / 1900, 0, 1);
      markInteracted();
    }, { passive: false });

    window.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      var k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') {
        e.preventDefault();
        S.tween = null;
        S.target = clamp(S.target + (k === 'PageDown' ? 0.22 : 0.07), 0, 1);
        markInteracted();
      } else if (k === 'ArrowUp' || k === 'PageUp') {
        e.preventDefault();
        S.tween = null;
        S.target = clamp(S.target - (k === 'PageUp' ? 0.22 : 0.07), 0, 1);
        markInteracted();
      } else if (k === 'Home') {
        e.preventDefault();
        setTideStop(0);
      } else if (k === 'End') {
        e.preventDefault();
        setTideStop(1);
      } else if (k === '1') {
        setTideStop(0.03);
      } else if (k === '2') {
        setTideStop(0.55);
      } else if (k === '3') {
        setTideStop(0.92);
      }
    });

    for (var i = 0; i < tideButtons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          setTideStop(parseFloat(btn.getAttribute('data-tide')));
        });
      })(tideButtons[i]);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () {
      setTimeout(resize, 260);
    });

    document.addEventListener('visibilitychange', function () {
      S.running = !document.hidden;
      if (S.running) {
        S.last = 0;
        if (!raf) raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
  }

  /* ---------------- 启动 ---------------- */

  function parseStart() {
    var raw = params.get('p');
    if (raw == null) raw = params.get('tide');
    if (raw != null) {
      var v = NAMED[raw];
      if (v == null) v = parseFloat(raw);
      if (!isNaN(v)) {
        S.tide = S.target = clamp(v, 0, 1);
      }
    }
    var h = params.get('heat');
    if (h != null) {
      var hv = clamp(parseFloat(h), 0, 1);
      if (!isNaN(hv)) {
        S.forcedHeat = hv;
        S.heat = hv;
        S.forced = true;
      }
    }
    if (params.get('still') === '1') {
      S.still = true;
      S.time = 12.4;
    }
    if (params.get('hud') === '0') document.body.classList.add('clean');
    if (params.get('hint') === '0') hint.classList.add('hide');
    S.noSea = params.get('sea') === '0';
    S.noArt = params.get('art') === '0';
    S.debug = params.get('debug') === '1';
    if (S.debug) {
      document.body.classList.add('debug');
      S.fpsT = performance.now();
    }
  }

  function start() {
    stage = $('stage');
    seaCanvas = $('sea');
    artCanvas = $('art');
    gauge = $('gauge');
    gmark = $('gmark');
    gval = $('gval');
    stoneBtn = $('stone');
    thermal = $('thermal');
    tempEl = $('temp');
    heatDot = $('heatDot');
    heatState = $('heatState');
    stateCN = $('stateCN');
    stateEN = $('stateEN');
    levelEl = $('level');
    live = $('live');
    hud = $('hud');
    hint = $('hint');
    tideButtons = document.querySelectorAll('#tides button');

    StudyScene.init(artCanvas);
    StudySea.init(seaCanvas);

    parseStart();
    resize();
    bind();
    updateUI(true);

    /* 字体到位后重建墨 / 骨白两层 */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (S.w) {
          StudyScene.build(S.w, S.h, S.dpr);
          updateStoneRect();
        }
      });
    }

    raf = requestAnimationFrame(frame);
  }

  /* dev: 错误显示在页面上，方便 lab 排查 */
  window.addEventListener('error', function (e) {
    var d = document.getElementById('err');
    if (!d) {
      d = document.createElement('pre');
      d.id = 'err';
      d.style.cssText = 'position:fixed;z-index:99;left:0;bottom:0;margin:0;padding:8px 10px;max-width:100%;white-space:pre-wrap;background:rgba(0,0,0,.82);color:#ff7a6a;font:11px/1.5 Consolas,monospace';
      document.body.appendChild(d);
    }
    d.textContent += (e.message || String(e.error)) + '\n'
      + (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || '') + '\n'
      + (e.error && e.error.stack ? e.error.stack + '\n' : '');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.__STUDY__ = S;
})();
