/* 02 潮间带 —— Lead 的正式幕。
   湿沙上浮出一层没写完的字；拖水线把它露出来；点完整的「拾」。 */
(function () {
  'use strict';

  var S = {
    ctx: null,
    root: null,
    W: 0, H: 0, dpr: 1,
    line: 0, time: 0,
    collected: false, flash: 0,
    drag: null,
    words: [], objects: [], sand: [], ripples: []
  };

  var IND = 'rgba(43,76,126,0.88)';

  function lcg(s) {
    return (s * 16807) % 2147483647;
  }

  function erosion(w, seed) {
    if (w.full) return null;
    var pts = [], n = 9, r = w.size * 0.64;
    seed = lcg(seed + 5);
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      seed = lcg(seed + i * 11 + 3);
      var rr = r * (0.58 + (seed % 1000) / 1000 * 0.55);
      pts.push([
        Math.cos(a) * rr + w.size * 0.03,
        Math.sin(a) * rr + w.size * 0.06
      ]);
    }
    return pts;
  }

  function build() {
    var W = S.W, H = S.H, i, seed = 17;

    S.words = [
      { c: '拾', x: 0.575, y: 0.575, s: 0.190, full: true,  rot: -2 },
      { c: '潮', x: 0.735, y: 0.335, s: 0.110, full: false, rot: 4 },
      { c: '汐', x: 0.835, y: 0.500, s: 0.095, full: false, rot: -6 },
      { c: '书', x: 0.465, y: 0.405, s: 0.090, full: false, rot: 3 },
      { c: '海', x: 0.665, y: 0.760, s: 0.095, full: false, rot: -3 },
      { c: '南', x: 0.400, y: 0.710, s: 0.080, full: false, rot: 5 }
    ];

    S.words.forEach(function (w) {
      w.px = w.x * W;
      w.py = w.y * H;
      w.size = Math.min(W, H) * w.s;
      w.rot = w.rot * Math.PI / 180;
      w.erosion = erosion(w, seed++);
    });

    S.objects = [
      { kind: 'thread', x: 0.795, y: 0.660, s: 0.095 },
      { kind: 'salt',   x: 0.425, y: 0.555, s: 0.055 },
      { kind: 'leaf',   x: 0.395, y: 0.835, s: 0.065 },
      { kind: 'shell',  x: 0.700, y: 0.865, s: 0.050 }
    ];

    S.objects.forEach(function (o) {
      o.px = o.x * W;
      o.py = o.y * H;
      o.size = Math.min(W, H) * o.s;
    });

    S.sand = [];
    var n = Math.floor(W * H / 2400);
    for (i = 0; i < n; i++) {
      seed = lcg(seed + i * 17 + 3);
      var rx = (seed % 10000) / 10000;
      seed = lcg(seed + 7);
      var ry = (seed % 10000) / 10000;
      S.sand.push({
        x: rx * W,
        y: 0.12 * H + ry * 0.82 * H,
        r: 0.35 + rx * 0.8,
        a: 0.025 + ry * 0.05
      });
    }

    S.ripples = [];
    for (i = 0; i < 12; i++) {
      seed = lcg(seed + i * 13 + 1);
      S.ripples.push({
        x: (0.12 + (seed % 1000) / 1000 * 0.78) * W,
        y: (0.16 + (i % 7) * 0.1) * H,
        w: (0.05 + (i % 4) * 0.025) * W,
        a: 0.035 + (i % 3) * 0.012
      });
    }
  }

  function drawSand(g, mode) {
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';
    g.fillStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.018 : 0.022) + ')';
    g.fillRect(0, 0, S.W, S.H);

    var da = mode === 'ink' ? 1 : 0.65;
    for (var i = 0; i < S.sand.length; i++) {
      var d = S.sand[i];
      g.fillStyle = 'rgba(' + base + ',' + (d.a * da) + ')';
      g.fillRect(d.x, d.y, d.r, d.r);
    }

    g.strokeStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.045 : 0.035) + ')';
    g.lineWidth = 0.6;
    for (var k = 0; k < S.ripples.length; k++) {
      var r = S.ripples[k];
      g.beginPath();
      g.ellipse(r.x, r.y, r.w, r.w * 0.11, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function drawObjects(g, mode) {
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';
    for (var i = 0; i < S.objects.length; i++) {
      var o = S.objects[i], s = o.size;
      g.save();
      g.translate(o.px, o.py);

      if (o.kind === 'thread') {
        g.strokeStyle = mode === 'ink' ? IND : 'rgba(120,165,200,0.55)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(-s, s * 0.1);
        g.bezierCurveTo(-s * 0.5, -s * 0.9, s * 0.3, s * 0.8, s, -s * 0.2);
        g.stroke();
        g.beginPath();
        g.moveTo(-s, s * 0.1);
        g.lineTo(-s * 1.15, s * 0.35);
        g.stroke();

      } else if (o.kind === 'salt') {
        g.strokeStyle = 'rgba(' + base + ',0.55)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(0, -s * 0.7);
        g.lineTo(s * 0.55, 0);
        g.lineTo(0, s * 0.7);
        g.lineTo(-s * 0.55, 0);
        g.closePath();
        g.stroke();
        g.beginPath();
        g.moveTo(-s * 0.25, 0);
        g.lineTo(s * 0.25, 0);
        g.stroke();

      } else if (o.kind === 'leaf') {
        g.strokeStyle = 'rgba(' + base + ',0.6)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -s * 0.8);
        g.bezierCurveTo(s * 0.8, -s * 0.2, s * 0.6, s * 0.6, 0, s * 0.9);
        g.bezierCurveTo(-s * 0.6, s * 0.6, -s * 0.8, -s * 0.2, 0, -s * 0.8);
        g.stroke();
        g.beginPath();
        g.moveTo(0, -s * 0.75);
        g.lineTo(0, s * 0.8);
        g.stroke();
        g.lineWidth = 0.5;
        for (var k = 1; k < 5; k++) {
          g.beginPath();
          g.moveTo(0, -s * 0.5 + k * s * 0.28);
          g.lineTo(s * 0.35 * (1 - k / 6), -s * 0.35 + k * s * 0.3);
          g.stroke();
        }

      } else if (o.kind === 'shell') {
        g.strokeStyle = 'rgba(' + base + ',0.55)';
        g.lineWidth = 0.8;
        for (var a = 0; a < 3; a++) {
          g.beginPath();
          g.arc(-s * 0.1, 0, s * (0.3 + a * 0.2), -0.9, 1.4);
          g.stroke();
        }
        g.beginPath();
        g.moveTo(s * 0.25, s * 0.55);
        g.lineTo(s * 0.8, s * 0.2);
        g.stroke();
      }

      g.restore();
    }
  }

  function drawWords(g, mode) {
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';

    for (var i = 0; i < S.words.length; i++) {
      var w = S.words[i];
      if (w.full && S.collected) continue;

      var alpha = w.full
        ? (mode === 'ink' ? 0.9 : 0.78)
        : (mode === 'ink' ? 0.4 : 0.34);

      g.save();
      g.translate(w.px, w.py);
      g.rotate(w.rot);

      if (w.erosion) {
        g.beginPath();
        g.moveTo(w.erosion[0][0], w.erosion[0][1]);
        for (var j = 1; j < w.erosion.length; j++) {
          g.lineTo(w.erosion[j][0], w.erosion[j][1]);
        }
        g.closePath();
        g.clip();
      }

      g.fillStyle = 'rgba(' + base + ',' + alpha + ')';
      g.font = '500 ' + w.size + 'px "Noto Serif SC","Songti SC",serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(w.c, 0, w.size * 0.02);
      g.restore();
    }

    if (!S.collected) drawRing(g, mode);
  }

  function drawRing(g, mode) {
    var w = S.words[0];
    if (S.line < w.py + w.size * 0.55) return;
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';
    var a = 0.16 + 0.05 * Math.sin(S.time * 2.2);
    g.save();
    g.strokeStyle = 'rgba(' + base + ',' + a + ')';
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(w.px, w.py + w.size * 0.04, w.size * 0.56, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(w.px, w.py + w.size * 0.04, w.size * 0.62, 0.2, 0.7);
    g.stroke();
    g.restore();
  }

  function drawEmpty(g, mode) {
    if (!S.collected) return;
    var w = S.words[0];
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';
    g.save();
    g.strokeStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.22 : 0.28) + ')';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(w.px - w.size * 0.3, w.py + w.size * 0.05);
    g.lineTo(w.px + w.size * 0.3, w.py + w.size * 0.05);
    g.stroke();
    g.restore();
  }

  function drawFlash(g) {
    var w = S.words[0];
    var t = 1 - S.flash;
    g.save();
    g.strokeStyle = 'rgba(43,76,126,' + (0.45 * S.flash) + ')';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(w.px, w.py, w.size * (0.55 + t * 0.5), 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function nearWord(x, y) {
    var w = S.words[0];
    return Math.abs(x - w.px) < w.size * 0.5 && Math.abs(y - w.py) < w.size * 0.5;
  }

  function wordDry() {
    var w = S.words[0];
    return S.line > w.py + w.size * 0.55;
  }

  function onDown(e) {
    if (!S.ctx) return;
    var x = e.clientX, y = e.clientY;

    if (!S.collected && S.words.length && nearWord(x, y) && wordDry()) {
      S.collected = true;
      S.flash = 1;
      if (S.ctx.onCollect) S.ctx.onCollect('拾');
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (Math.abs(y - S.line) < 110) {
      S.drag = { y: y, line: S.line };
      if (e.cancelable) e.preventDefault();
    }
  }

  function onMove(e) {
    if (!S.drag || !S.ctx) return;
    if (S.ctx.setTide) S.ctx.setTide(S.drag.line + (e.clientY - S.drag.y));
  }

  function onUp() {
    S.drag = null;
  }

  function bind() {
    if (!S.root) return;
    S.root.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
  }

  function unbind() {
    if (!S.root) return;
    S.root.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  var A = {
    id: '02',
    title: '潮间带',
    en: 'INTERTIDAL',
    accent: '#2B4C7E',

    mount: function (root, ctx) {
      S.root = root;
      S.ctx = ctx;
      S.collected = false;
      S.drag = null;
      S.flash = 0;
      bind();
    },

    resize: function (w, h, dpr) {
      S.W = w;
      S.H = h;
      S.dpr = dpr;
      build();
    },

    render: function (s) {
      if (!S.ctx || !S.words.length) return;
      var g = S.ctx.g;
      S.line = s.lineY;
      S.time = s.t || 0;

      /* 干 */
      g.save();
      S.ctx.clipAbove(s.lineY);
      g.clip();
      drawSand(g, 'ink');
      drawObjects(g, 'ink');
      drawWords(g, 'ink');
      drawEmpty(g, 'ink');
      g.restore();

      /* 湿 */
      g.save();
      S.ctx.clipBelow(s.lineY);
      g.clip();
      if (typeof g.filter === 'string') g.filter = 'blur(0.3px)';
      drawSand(g, 'bone');
      drawObjects(g, 'bone');
      drawWords(g, 'bone');
      drawEmpty(g, 'bone');
      g.restore();
      if (typeof g.filter === 'string') g.filter = 'none';

      if (S.flash > 0.01) {
        drawFlash(g);
        S.flash -= 0.025;
      }
    },

    unmount: function () {
      unbind();
      S.ctx = null;
    }
  };

  window.ACTS.register('02', A);
})();
