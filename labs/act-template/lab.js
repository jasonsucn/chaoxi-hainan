/* ACT LAB harness —— 一般不用改。
   职责：尺寸 / 背景 / 水线 / pointer / 滑杆 / rAF / reduced-motion。
   场景：全部在 act.js 的 render(s) 里。 */
(function () {
  'use strict';

  var canvas = document.getElementById('scene');
  var g = canvas.getContext('2d');
  var stage = document.getElementById('stage');

  var W = 0, H = 0, dpr = 1;
  var p = 0.55;
  var time = 0;
  var last = 0;
  var running = true;
  var act = null;
  var actId = null;

  var pointer = { x: 0.5, y: 0.5, down: false };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var palette = {
    ink: '#111310', bone: '#F2ECDF', sea: '#03100F', teal: '#16332F', coral: '#D8503A'
  };

  var q = new URLSearchParams(window.location.search);
  if (q.has('p')) p = clamp(parseFloat(q.get('p')) || 0.55, 0, 1);
  if (q.get('hud') === '0') document.body.classList.add('clean');
  document.getElementById('p').value = String(p);
  document.getElementById('pval').textContent = p.toFixed(2);

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function waveAt(x, t) {
    return Math.sin((x / Math.max(1, W)) * 23.0 + t * 0.7) * 1.4
      + Math.sin((x / Math.max(1, W)) * 55.0 - t * 0.5) * 0.7;
  }

  function currentLine() {
    return 0.08 * H + p * 0.84 * H;
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

  function drawBackdrop(line) {
    g.fillStyle = palette.bone;
    g.fillRect(0, 0, W, H);

    g.save();
    pathBelow(line);
    g.clip();
    var grad = g.createLinearGradient(0, line, 0, H);
    grad.addColorStop(0, '#123c3a');
    grad.addColorStop(0.45, '#0a2523');
    grad.addColorStop(1, '#03100F');
    g.fillStyle = grad;
    g.fillRect(0, line, W, Math.max(1, H - line));
    g.restore();
  }

  function drawWaterline(line) {
    g.save();
    g.beginPath();
    for (var x = 0; x <= W; x += 6) {
      var y = line + waveAt(x, time);
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(238,252,245,0.38)';
    g.lineWidth = 1;
    g.stroke();

    var seed = Math.floor(line / 7);
    for (var i = 0; i < 32; i++) {
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

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000) || 0.016;
    last = now;
    if (!reduced) time += dt;

    var line = currentLine();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawBackdrop(line);
    if (act && act.render) {
      act.render({
        p: p,
        lineY: line,
        t: time,
        pointer: pointer,
        tide: p,
        reduced: reduced,
        palette: palette
      });
    }
    drawWaterline(line);
    requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.W = W; ctx.H = H; ctx.dpr = dpr;
    if (act && act.resize) act.resize(W, H, dpr);
  }

  function bind() {
    stage.addEventListener('pointerdown', function (e) {
      pointer.down = true;
      pointer.x = e.clientX / Math.max(1, W);
      pointer.y = e.clientY / Math.max(1, H);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX / Math.max(1, W);
      pointer.y = e.clientY / Math.max(1, H);
    }, { passive: true });

    window.addEventListener('pointerup', function () { pointer.down = false; }, { passive: true });
    window.addEventListener('pointercancel', function () { pointer.down = false; }, { passive: true });

    var slider = document.getElementById('p');
    slider.addEventListener('input', function () {
      p = clamp(parseFloat(slider.value) || 0, 0, 1);
      document.getElementById('pval').textContent = p.toFixed(2);
    });

    window.addEventListener('resize', resize);

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) { last = 0; requestAnimationFrame(frame); }
    });
  }

  function start() {
    actId = Object.keys(window.ACTS.list)[0];
    act = window.ACTS.list[actId];
    if (!act) {
      console.error('[lab] no act registered');
      return;
    }
    document.getElementById('act-name').textContent = act.title || actId;
    document.getElementById('act-en').textContent = act.en || '';
    if (act.mount) act.mount(stage, ctx);
    resize();
    bind();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
