/* ============================================================
   WaterType —— 被水线切开的字。
   同一行字：线以上是玄武墨，线以下是骨白，并在水下折射、焦散。
   全部用 Canvas2D 预渲染 + 横向切片位移，无 WebGL 字体依赖。
   ============================================================ */
(function () {
  'use strict';

  var SERIF = '"Noto Serif SC","Source Han Serif SC","STZhongsong","Songti SC",serif';
  var SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

  var canvas = null, ctx = null;
  var W = 0, H = 0, DPR = 1;
  var SRC = { kicker: '', title: '潮汐书', place: '海南', sub: '' };
  var hero = null;
  var wetCanvas = null, wetCtx = null;
  var bubbles = [], snow = [], drops = [];
  var lastPull = 0;
  var booted = false;

  function init(el, src) {
    canvas = el;
    ctx = canvas.getContext('2d');
    if (src) SRC = src;
    if (!wetCanvas) {
      wetCanvas = document.createElement('canvas');
      wetCtx = wetCanvas.getContext('2d');
    }
    booted = true;
  }

  function setSize(w, h, dpr) {
    W = w; H = h; DPR = dpr;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (booted) {
      layout();
      seed();
    }
  }

  function isLandscapePhone() {
    return H < 520 && W > H;
  }

  function layout() {
    if (!booted || !SRC.title) return;

    var landscape = isLandscapePhone();
    var phone = W < 720;
    var mob = phone || landscape;

    var fs;
    if (landscape) fs = Math.min(W * 0.085, H * 0.23);
    else if (phone) fs = Math.min(W * 0.315, H * 0.15);
    else fs = Math.min(W * 0.132, H * 0.21, 240);

    var cell = fs * 1.055;
    var titleW = fs * 1.02;
    var titleH = cell * SRC.title.length;

    var x = mob ? W * 0.105 : W * 0.085;
    var top = landscape ? H * 0.12 : (phone ? H * 0.19 : H * 0.115);

    var subX = x + titleW + (mob ? 30 : 54);
    var subTop = top + (mob ? 50 : 62);
    var kickerX = mob ? x : x - 42;
    var kickerTop = mob ? top - (landscape ? 30 : 46) : top + 4;

    var subStep = mob ? 20.4 : 23.8;

    var h = {
      fs: fs, cell: cell, titleW: titleW, titleH: titleH,
      x: x, top: top, subX: subX, subTop: subTop,
      kickerX: kickerX, kickerTop: kickerTop,
      subStep: subStep, mob: mob, landscape: landscape
    };

    var bottom = Math.max(top + titleH, subTop + SRC.sub.length * subStep);
    h.x0 = Math.min(kickerX, x) - 16;
    h.y0 = Math.min(top, kickerTop) - 16;
    h.x1 = subX + 26;
    h.y1 = bottom + 16;
    h.w = h.x1 - h.x0;
    h.h = h.y1 - h.y0;

    hero = h;
    prerender();
  }

  function font(weight, size, fam) {
    return weight + ' ' + size + 'px ' + fam;
  }

  function makeLayer(color) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(hero.w * DPR));
    c.height = Math.max(1, Math.round(hero.h * DPR));
    var g = c.getContext('2d');
    g.scale(DPR, DPR);
    g.fillStyle = color;

    var ox = hero.x0, oy = hero.y0;

    /* 大标题：竖排 */
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(500, hero.fs, SERIF);
    var cx = hero.x + hero.titleW / 2 - ox;
    for (var i = 0; i < SRC.title.length; i++) {
      g.fillText(SRC.title.charAt(i), cx, hero.top - oy + hero.cell * i + hero.cell / 2);
    }

    /* 小引 */
    if (!hero.mob) {
      g.font = font(400, 11, SERIF);
      var kcx = hero.kickerX + 6 - ox;
      for (var j = 0; j < SRC.kicker.length; j++) {
        g.fillText(SRC.kicker.charAt(j), kcx, hero.kickerTop - oy + j * 20.4 + 10.2);
      }
    } else {
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.font = font(400, 10.5, SERIF);
      var kx = hero.kickerX - ox;
      var ky = hero.kickerTop - oy;
      for (var k = 0; k < SRC.kicker.length; k++) {
        g.fillText(SRC.kicker.charAt(k), kx, ky);
        kx += g.measureText(SRC.kicker.charAt(k)).width + 1.7;
      }
    }

    /* 海南 */
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.font = font(500, hero.mob ? 11.5 : 12.5, SERIF);
    var px = hero.subX - ox;
    var py = hero.top - oy + (hero.mob ? 0 : 2);
    for (var m = 0; m < SRC.place.length; m++) {
      g.fillText(SRC.place.charAt(m), px, py);
      px += g.measureText(SRC.place.charAt(m)).width + (hero.mob ? 2.6 : 3.4);
    }

    /* 细线 */
    g.fillRect(hero.subX - ox + 0.5, hero.top - oy + (hero.mob ? 24 : 28), 1, hero.mob ? 20 : 28);

    /* 副题：竖排 */
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(400, hero.mob ? 12 : 14, SERIF);
    var scx = hero.subX + (hero.mob ? 6 : 7.5) - ox;
    var sTop = hero.subTop - oy;
    for (var n = 0; n < SRC.sub.length; n++) {
      g.fillText(SRC.sub.charAt(n), scx, sTop + n * hero.subStep + hero.subStep / 2);
    }

    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    return c;
  }

  function prerender() {
    if (!hero) return;
    hero.ink = makeLayer('#111310');
    hero.bone = makeLayer('#F2ECDF');
    wetCanvas.width = Math.max(1, Math.round(hero.w * DPR));
    wetCanvas.height = Math.max(1, Math.round(hero.h * DPR));
  }

  /* ---------- 水下切片 ---------- */

  function drawWet(top, bottom, line, t) {
    var g = wetCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, wetCanvas.width, wetCanvas.height);
    g.scale(DPR, DPR);

    var ox = hero.x0, oy = hero.y0;
    var step = 3;
    var count = Math.max(1, Math.ceil((bottom - top) / step));

    for (var i = 0; i < count; i++) {
      var y = top + i * step;
      if (y >= hero.y1) break;
      var sy = (y - oy) * DPR;
      var sh = Math.min(step + 0.6, hero.y1 - y) * DPR;
      if (sh <= 0) break;

      var depth = Math.max(0, y - line);
      var amp = Math.min(9, depth * 0.028);
      var wob = 0.55 + 0.45 * Math.sin(t * 0.6 + y * 0.015);
      var off = Math.sin(depth * 0.055 + t * 1.15) * amp * wob;

      g.drawImage(
        hero.bone,
        0, sy, hero.w * DPR, sh,
        off, y - oy, hero.w, Math.min(step + 0.9, hero.y1 - y)
      );
    }

    /* 水色、焦散只落在字上 */
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(10,40,44,0.17)';
    g.fillRect(0, 0, hero.w, hero.h);
    g.fillStyle = 'rgba(120,190,175,0.10)';
    g.fillRect(0, 0, hero.w, hero.h);

    g.strokeStyle = 'rgba(238,255,248,0.13)';
    g.lineWidth = 9;
    for (var k = 0; k < 9; k++) {
      g.beginPath();
      var yy = (k / 9) * hero.h + Math.sin(t * 0.4 + k) * 10;
      for (var xx = -30; xx <= hero.w + 30; xx += 10) {
        var y2 = yy
          + Math.sin(xx * 0.018 + t * 0.5 + k * 1.7) * 9
          + Math.sin(xx * 0.045 - t * 0.33) * 4;
        if (xx === -30) g.moveTo(xx, y2); else g.lineTo(xx, y2);
      }
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }

  /* ---------- 粒子 ---------- */

  function seed() {
    bubbles = [];
    snow = [];
    drops = [];
    var n = W < 720 ? 20 : 38;
    for (var i = 0; i < n; i++) {
      bubbles.push({
        x: Math.random() * W,
        y: 80 + Math.random() * Math.max(40, H - 80),
        r: 0.6 + Math.random() * 1.9,
        v: 5 + Math.random() * 14,
        ph: Math.random() * 6.283,
        a: 0.10 + Math.random() * 0.22
      });
    }
    var m = W < 720 ? 55 : 95;
    for (var j = 0; j < m; j++) {
      snow.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.2 + Math.random() * 1.0,
        v: 2 + Math.random() * 5,
        ph: Math.random() * 6.283,
        a: 0.05 + Math.random() * 0.13
      });
    }
  }

  function drawParticles(line, t, dt, intro, pull) {
    var clipped = Math.max(0, line);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipped, W, Math.max(0, H - clipped));
    ctx.clip();
    ctx.globalAlpha = intro;

    /* 海雪 */
    for (var i = 0; i < snow.length; i++) {
      var s = snow[i];
      s.y += s.v * dt;
      s.x += Math.sin(t * 0.25 + s.ph) * 2.2 * dt;
      if (s.y > H) {
        s.y = clipped + Math.random() * 26;
        s.x = Math.random() * W;
      }
      if (s.y < clipped) s.y = clipped + Math.random() * 30;
      ctx.fillStyle = 'rgba(206,238,230,' + s.a + ')';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    /* 气泡 */
    for (var b = 0; b < bubbles.length; b++) {
      var q = bubbles[b];
      q.y -= q.v * dt;
      q.x += Math.sin(t * 0.7 + q.ph) * 7 * dt;
      if (q.y < clipped - 12) {
        q.y = H + 6;
        q.x = Math.random() * W;
      }
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, 6.283);
      ctx.strokeStyle = 'rgba(214,244,235,' + q.a + ')';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      if (q.r > 1.9) {
        ctx.beginPath();
        ctx.arc(q.x - q.r * 0.34, q.y - q.r * 0.34, q.r * 0.2, 0, 6.283);
        ctx.fillStyle = 'rgba(240,255,250,' + q.a * 1.5 + ')';
        ctx.fill();
      }
    }

    /* 水线经过字时落下的水滴 */
    if (pull - lastPull > 0.0011 && drops.length < 24 && line > hero.y0 && line < hero.y1) {
      if (Math.random() < 0.8) {
        drops.push({
          x: hero.x0 + Math.random() * hero.w,
          y: line + 2,
          vy: 10 + Math.random() * 34,
          life: 1,
          r: 0.7 + Math.random() * 1.5
        });
      }
    }
    lastPull = pull;

    for (var d = drops.length - 1; d >= 0; d--) {
      var p = drops[d];
      p.vy += 560 * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.8;
      if (p.life <= 0) { drops.splice(d, 1); continue; }
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 0.8, p.r * 1.25, 0, 0, 6.283);
      ctx.fillStyle = 'rgba(236,252,246,' + (p.life * 0.42) + ')';
      ctx.fill();
    }

    ctx.restore();
  }

  /* ---------- 水面 ---------- */

  function rnd(n) {
    var v = Math.sin(n * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }

  function drawSurface(line, t, intro) {
    if (line <= 0 || line >= H) return;
    ctx.save();
    ctx.globalAlpha = intro;

    ctx.beginPath();
    for (var x = 0; x <= W; x += 6) {
      var wy = line + waveAt(x, t);
      if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
    }
    ctx.strokeStyle = 'rgba(238,252,245,0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();

    var seed = Math.floor(line / 7);
    for (var i = 0; i < 52; i++) {
      var r = rnd(i * 13 + seed);
      var x = ((r + t * 0.004 * ((i % 3) + 1)) % 1) * W;
      var base = line + waveAt(x, t);
      var y = base + (rnd(i * 7.3 + seed) - 0.5) * 11;
      var a = (0.04 + rnd(i * 3.1 + seed) * 0.20) * Math.exp(-Math.abs(y - base) / 8);
      ctx.fillStyle = 'rgba(230,250,242,' + a + ')';
      ctx.fillRect(x, y, 1.2 + rnd(i * 5.7) * 2.6, 0.8);
    }
    ctx.restore();
  }

  /* ---------- 水线（一条很慢的波） ---------- */

  function waveAt(x, t) {
    return Math.sin((x / W) * 23.0 + t * 0.7) * 1.4
      + Math.sin((x / W) * 55.0 - t * 0.5) * 0.7;
  }

  function traceAbove(t, line) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    for (var x = W; x >= 0; x -= 6) ctx.lineTo(x, line + waveAt(x, t));
    ctx.closePath();
  }

  function traceBelow(t, line) {
    ctx.beginPath();
    ctx.moveTo(0, line + waveAt(0, t));
    for (var x = 0; x <= W; x += 6) ctx.lineTo(x, line + waveAt(x, t));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
  }

  /* ---------- 海南岛：退潮时慢慢露出来的那条岸线 ---------- */

  var coastPath = null;

  function mapRect() {
    var C = window.COAST;
    var small = W < 720;
    var iw = small ? Math.min(W * 0.50, 220) : Math.min(W * 0.32, 560);
    var ih = iw * C.h / C.w;
    var ix = small ? W * 0.49 : W * 0.615;
    var iy = small ? H * 0.505 : H * 0.40;
    if (iy + ih > H * 0.88) iy = H * 0.88 - ih;
    return { ix: ix, iy: iy, iw: iw, ih: ih, small: small };
  }

  function drawIsland(line, intro, t) {
    var C = window.COAST;
    if (!C) return;
    if (!coastPath) coastPath = new Path2D(C.path);

    var m = mapRect();
    var small = m.small;
    var iw = m.iw, ih = m.ih, ix = m.ix, iy = m.iy;

    ctx.save();
    ctx.globalAlpha = intro * 0.92;
    traceAbove(t, line);
    ctx.clip();
    paintIsland(ix, iy, iw, ih, false, small);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = intro;
    traceBelow(t, line);
    ctx.clip();
    if (typeof ctx.filter === 'string') ctx.filter = 'blur(0.6px)';
    paintIsland(ix, iy, iw, ih, true, small);
    ctx.restore();
    if (typeof ctx.filter === 'string') ctx.filter = 'none';
  }

  function paintIsland(ix, iy, iw, ih, wet, small) {
    var C = window.COAST;
    var base = wet ? '242,236,223' : '17,19,16';
    var sx = iw / C.w;

    ctx.save();
    ctx.translate(ix, iy);
    ctx.scale(sx, ih / C.h);
    ctx.fillStyle = 'rgba(' + base + ',' + (wet ? 0.045 : 0.030) + ')';
    ctx.fill(coastPath);
    ctx.lineJoin = 'round';

    if (wet) {
      ctx.lineWidth = 4.5 / sx;
      ctx.strokeStyle = 'rgba(' + base + ',0.055)';
      ctx.stroke(coastPath);
    }

    ctx.lineWidth = 1.05 / sx;
    ctx.strokeStyle = 'rgba(' + base + ',' + (wet ? 0.40 : 0.38) + ')';
    ctx.stroke(coastPath);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(400, small ? 7 : 8, SANS);
    for (var i = 0; i < C.cities.length; i++) {
      var c = C.cities[i];
      var x = ix + (c.x / C.w) * iw;
      var y = iy + (c.y / C.h) * ih;
      ctx.fillStyle = 'rgba(' + base + ',' + (wet ? 0.68 : 0.80) + ')';
      ctx.beginPath();
      ctx.arc(x, y, small ? 1.5 : 2.0, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(' + base + ',' + (wet ? 0.56 : 0.66) + ')';
      ctx.fillText(c.name, x + (small ? 4.5 : 5.5), y + 0.5);
    }
  }

  /* ---------- 椰子树：种在岛的东北岸，随潮水长出来 ---------- */

  function palmMetrics() {
    var m = mapRect();
    var bx = m.ix + m.iw * 0.86;
    var by = m.iy + m.ih * 0.10;
    var ph = m.small ? Math.min(H * 0.21, W * 0.38) : Math.min(W, H) * 0.20;
    return {
      bx: bx, by: by, ph: ph,
      lean: ph * (m.small ? 0.10 : 0.26),
      small: m.small
    };
  }

  function drawPalm(line, intro, t, state) {
    if (!window.COAST) return;
    var m = palmMetrics();
    var grow = Math.max(0, Math.min(1, (intro - 0.12) / 0.82));
    grow = grow * grow * (3 - 2 * grow);
    if (grow <= 0.015) return;

    var ptr = (state && state.pointer) || { x: 0.5, y: 0.5 };
    var vel = (state && state.velocity) || 0;
    var wind = (ptr.x - 0.5) * 1.6 + Math.max(-0.6, Math.min(0.6, vel * 0.12));
    var crown = {
      x: m.bx - m.lean * grow + wind * m.ph * 0.04,
      y: m.by - m.ph * grow
    };
    var P = { m: m, crown: crown, grow: grow, wind: wind, t: t };

    ctx.save();
    ctx.globalAlpha = intro * 0.96;
    traceAbove(t, line);
    ctx.clip();
    paintPalm(P, false, line);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = intro;
    traceBelow(t, line);
    ctx.clip();
    if (typeof ctx.filter === 'string') ctx.filter = 'blur(0.55px)';
    paintPalm(P, true, line);
    ctx.restore();
    if (typeof ctx.filter === 'string') ctx.filter = 'none';
  }

  function paintPalm(P, wet, line) {
    var m = P.m, crown = P.crown, grow = P.grow, t = P.t, wind = P.wind;
    var ph = m.ph;
    var small = m.small;
    var base = wet ? '242,236,223' : '17,19,16';
    var ink = 'rgba(' + base + ',' + (wet ? 0.58 : 0.60) + ')';
    var faint = 'rgba(' + base + ',' + (wet ? 0.38 : 0.40) + ')';
    var fill = 'rgba(' + base + ',' + (wet ? 0.05 : 0.035) + ')';
    var vein = 'rgba(' + base + ',' + (wet ? 0.28 : 0.24) + ')';

    function rx(x, y) {
      if (!wet) return x;
      var d = y - line;
      if (d <= 0) return x;
      return x + Math.sin(d * 0.06 + t * 1.15 + x * 0.012) * Math.min(4, d * 0.016);
    }

    var p0 = { x: m.bx, y: m.by };
    var p1 = { x: m.bx - ph * 0.04, y: m.by - ph * 0.46 * grow };
    var p2 = { x: crown.x + ph * 0.06, y: crown.y + ph * 0.28 * grow };
    var p3 = { x: crown.x, y: crown.y };

    /* 树干：一片很窄的轮廓，和岛一样用线 + 极淡的填充 */
    var steps = 16;
    var tl = [], tr = [];
    for (var i = 0; i <= steps; i++) {
      var u = i / steps, mu = 1 - u;
      var x = mu * mu * mu * p0.x + 3 * mu * mu * u * p1.x + 3 * mu * u * u * p2.x + u * u * u * p3.x;
      var y = mu * mu * mu * p0.y + 3 * mu * mu * u * p1.y + 3 * mu * u * u * p2.y + u * u * u * p3.y;
      var tx = 3 * mu * mu * (p1.x - p0.x) + 6 * mu * u * (p2.x - p1.x) + 3 * u * u * (p3.x - p2.x);
      var ty = 3 * mu * mu * (p1.y - p0.y) + 6 * mu * u * (p2.y - p1.y) + 3 * u * u * (p3.y - p2.y);
      var tl2 = Math.hypot(tx, ty) || 1;
      var nx = -ty / tl2, ny = tx / tl2;
      var w = ph * (0.030 * (1 - u) + 0.012 * u) * (0.5 + 0.5 * grow);
      tl.push([x + nx * w, y + ny * w]);
      tr.push([x - nx * w, y - ny * w]);
    }
    ctx.beginPath();
    ctx.moveTo(rx(tl[0][0], tl[0][1]), tl[0][1]);
    for (var q = 1; q < tl.length; q++) ctx.lineTo(rx(tl[q][0], tl[q][1]), tl[q][1]);
    for (var q2 = tr.length - 1; q2 >= 0; q2--) ctx.lineTo(rx(tr[q2][0], tr[q2][1]), tr[q2][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    /* 两条短线，暗示树根 */
    ctx.strokeStyle = faint;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(rx(m.bx - 1, m.by), m.by);
    ctx.quadraticCurveTo(rx(m.bx - 6, m.by + ph * 0.03), m.by + ph * 0.03, rx(m.bx - 11, m.by + ph * 0.035), m.by + ph * 0.035);
    ctx.moveTo(rx(m.bx + 1, m.by), m.by);
    ctx.quadraticCurveTo(rx(m.bx + 5, m.by + ph * 0.025), m.by + ph * 0.025, rx(m.bx + 9, m.by + ph * 0.03), m.by + ph * 0.03);
    ctx.stroke();

    /* 三颗椰子：三个小点 */
    var dots = [
      { x: 0.012, y: 0.060, r: 0.016 },
      { x: -0.016, y: 0.074, r: 0.014 },
      { x: 0.002, y: 0.090, r: 0.012 }
    ];
    ctx.fillStyle = ink;
    for (var c = 0; c < dots.length; c++) {
      var d = dots[c];
      var dx = crown.x + d.x * ph * grow;
      var dy = crown.y + d.y * ph * grow;
      ctx.beginPath();
      ctx.arc(rx(dx, dy), dy, Math.max(1.2, d.r * ph * grow), 0, 6.283);
      ctx.fill();
    }

    /* 叶片：七片宽一点的窄叶轮廓，先扬后垂 */
    var angles = small
      ? [-155, -112, -69, -26, 17, 60, 100]
      : [-158, -122, -86, -50, -14, 22, 58, 100];
    var nF = angles.length;
    var baseLen = ph * 0.62;

    for (var f = 0; f < nF; f++) {
      var seed = Math.sin((f + 1) * 12.9898) * 43758.5453;
      seed = seed - Math.floor(seed);
      var len = baseLen * (0.88 + 0.22 * seed) * (0.32 + 0.68 * grow);
      if (angles[f] > 80) len *= 0.62;
      var rot = Math.sin(t * 0.72 + f * 1.7) * 0.030 + wind * 0.06 * (0.4 + 0.6 * seed);
      var a = angles[f] * Math.PI / 180 + rot;
      var dx = Math.cos(a), dy = Math.sin(a);
      var sx = crown.x + dx * ph * 0.02;
      var sy = crown.y + dy * ph * 0.02;
      var c1x = sx + dx * len * 0.34;
      var c1y = sy + dy * len * 0.34 - len * 0.28;
      var c2x = sx + dx * len * 0.78;
      var c2y = sy + dy * len * 0.78 - len * 0.05;
      var ex = sx + dx * len;
      var ey = sy + dy * len + len * 0.42;

      var lp = [], rp = [];
      var segF = 10;
      for (var k = 0; k <= segF; k++) {
        var tt = k / segF, mt = 1 - tt;
        var b0 = mt * mt * mt, b1 = 3 * mt * mt * tt, b2 = 3 * mt * tt * tt, b3 = tt * tt * tt;
        var px = b0 * sx + b1 * c1x + b2 * c2x + b3 * ex;
        var py = b0 * sy + b1 * c1y + b2 * c2y + b3 * ey;
        var txp = 3 * mt * mt * (c1x - sx) + 6 * mt * tt * (c2x - c1x) + 3 * tt * tt * (ex - c2x);
        var typ = 3 * mt * mt * (c1y - sy) + 6 * mt * tt * (c2y - c1y) + 3 * tt * tt * (ey - c2y);
        var tlp = Math.hypot(txp, typ) || 1;
        var nx = -typ / tlp, ny = txp / tlp;
        var w = len * 0.10 * Math.pow(Math.sin(Math.PI * tt), 0.70) * (0.85 + 0.25 * seed);
        lp.push([px + nx * w, py + ny * w]);
        rp.push([px - nx * w, py - ny * w]);
      }

      ctx.beginPath();
      ctx.moveTo(rx(lp[0][0], lp[0][1]), lp[0][1]);
      for (var q3 = 1; q3 < lp.length; q3++) ctx.lineTo(rx(lp[q3][0], lp[q3][1]), lp[q3][1]);
      for (var q4 = rp.length - 1; q4 >= 0; q4--) ctx.lineTo(rx(rp[q4][0], rp[q4][1]), rp[q4][1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.strokeStyle = vein;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(rx(sx, sy), sy);
      ctx.bezierCurveTo(rx(c1x, c1y), c1y, rx(c2x, c2y), c2y, rx(ex, ey), ey);
      ctx.stroke();
    }
  }

  /* ---------- 主渲染 ---------- */

  function render(state) {
    if (!ctx || !hero) return;

    var line = state.lineY;
    var t = state.time;
    var intro = state.intro;
    var pull = state.pull;

    ctx.clearRect(0, 0, W, H);
    if (intro <= 0.001) return;

    drawIsland(line, intro, t);
    drawPalm(line, intro, t, state);

    ctx.save();
    ctx.globalAlpha = intro;

    /* 干的部分 */
    var dryBottom = Math.min(line, hero.y1);
    if (dryBottom > hero.y0) {
      ctx.save();
      traceAbove(t, line);
      ctx.clip();
      ctx.drawImage(hero.ink, hero.x0, hero.y0, hero.w, hero.h);
      ctx.restore();
    }

    /* 湿的部分 */
    var wetTop = Math.max(line - 4, hero.y0);
    var wetBottom = Math.min(H, hero.y1);
    if (wetBottom > wetTop) {
      drawWet(wetTop, wetBottom, line, t);
      ctx.save();
      traceBelow(t, line);
      ctx.clip();

      /* 水下的字有一层很轻的自发光 */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = intro * 0.30;
      if (typeof ctx.filter === 'string') ctx.filter = 'blur(9px)';
      ctx.drawImage(wetCanvas, hero.x0, hero.y0, hero.w, hero.h);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = intro;
      if (typeof ctx.filter === 'string') ctx.filter = 'blur(0.4px)';
      ctx.drawImage(wetCanvas, hero.x0, hero.y0, hero.w, hero.h);
      ctx.restore();
    }

    /* 水线上方 26px 的湿膜 */
    if (line > hero.y0 && line < hero.y1 + 30) {
      var bandTop = Math.max(hero.y0, line - 26);
      var bandH = Math.min(line, hero.y1) - bandTop;
      if (bandH > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, bandTop, W, bandH);
        ctx.clip();
        ctx.globalAlpha = intro * 0.24;
        ctx.drawImage(hero.bone, hero.x0, hero.y0, hero.w, hero.h);
        ctx.restore();
      }
    }

    ctx.restore();

    drawParticles(line, t, state.dt, intro, pull);
    drawSurface(line, t, intro);
  }

  window.WaterType = {
    init: init,
    resize: setSize,
    layout: layout,
    render: render
  };
})();
