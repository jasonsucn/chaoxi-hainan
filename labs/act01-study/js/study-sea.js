/* ============================================================
   StudySea —— 研究的背景分水层，纯 Canvas2D。
   ------------------------------------------------------------
   M0 的 WebGL 海很漂亮，但在这台机器上实测 6fps（软件光栅）。
   研究改用「一次生成 + 缓存 + 少量动态」的做法：
     · 纸纹、水下焦散、光柱、颗粒全部离屏生成一次；
     · 按当前水线把纸 / 海合成到一张背景缓存，水线变化才重建；
     · 每帧只贴 cache，再叠一条近水面的动态焦散与浪花。
   目标是 60fps，同时保留「骨白纸 / 南海青 / 湿接缝」的终稿质感。
   ============================================================ */
(function () {
  'use strict';

  var canvas = null, g = null;
  var W = 0, H = 0, DPR = 1;
  var paperTex = null, detailTex = null, waterTex = null;
  var bg = null, bgLine = -1, bgAt = -1, bgBuilds = 0;
  var time = 0;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeR(seed) {
    var r = mulberry32(seed);
    return {
      r: r,
      range: function (a, b) { return a + (b - a) * r(); },
      int: function (a, b) { return Math.floor(a + (b - a + 1) * r()); }
    };
  }

  function waveAt(x, t) {
    return Math.sin((x / Math.max(1, W)) * 19.0 + t * 0.62) * 1.9
      + Math.sin((x / Math.max(1, W)) * 47.0 - t * 0.45) * 0.85;
  }

  function clipAbove(c, line, t) {
    c.beginPath();
    c.moveTo(0, -2);
    c.lineTo(W, -2);
    for (var x = W; x >= 0; x -= 6) c.lineTo(x, line + waveAt(x, t));
    c.closePath();
  }

  function clipBelow(c, line, t) {
    c.beginPath();
    c.moveTo(0, line + waveAt(0, t));
    for (var x = 0; x <= W; x += 6) c.lineTo(x, line + waveAt(x, t));
    c.lineTo(W, H + 2);
    c.lineTo(0, H + 2);
    c.closePath();
  }

  function makeCanvas() {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * DPR));
    c.height = Math.max(1, Math.round(H * DPR));
    return c;
  }

  function ctxFor(c) {
    var x = c.getContext('2d');
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    x.lineJoin = 'round';
    x.lineCap = 'round';
    return x;
  }

  /* ---------------- 纸：骨白、盐光、纸纹 ---------------- */

  function buildPaper() {
    paperTex = makeCanvas();
    var c = ctxFor(paperTex);
    var R = makeR(0x9d2c5680);

    var base = c.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#F2ECDF');
    base.addColorStop(0.55, '#F0E9DA');
    base.addColorStop(1, '#EAE2D2');
    c.fillStyle = base;
    c.fillRect(0, 0, W, H);

    /* 右上的过曝盐光，带一点点珊瑚暖 */
    var sx = W * 0.73, sy = H * 0.2;
    var sunR = Math.max(W, H) * 0.55;
    var sun = c.createRadialGradient(sx, sy, 2, sx, sy, sunR);
    sun.addColorStop(0, 'rgba(255,253,244,0.92)');
    sun.addColorStop(0.18, 'rgba(255,251,238,0.52)');
    sun.addColorStop(0.52, 'rgba(255,248,231,0.16)');
    sun.addColorStop(1, 'rgba(255,246,226,0)');
    c.fillStyle = sun;
    c.fillRect(0, 0, W, H);

    var warm = c.createRadialGradient(W * 0.78, H * 0.16, 5, W * 0.78, H * 0.16, Math.min(W, H) * 0.5);
    warm.addColorStop(0, 'rgba(216,80,58,0.022)');
    warm.addColorStop(1, 'rgba(216,80,58,0)');
    c.fillStyle = warm;
    c.fillRect(0, 0, W, H);

    /* 纸纹：极细的横向纤维与颗粒 */
    var n = Math.round(W * H / 2600);
    for (var i = 0; i < n; i++) {
      var x = R.range(0, W);
      var y = R.range(0, H);
      var a = R.range(0.012, 0.045);
      c.fillStyle = 'rgba(17,19,16,' + a.toFixed(3) + ')';
      c.fillRect(x, y, R.range(0.4, 2.2), 0.55);
    }
    c.globalAlpha = 0.24;
    for (var f = 0; f < 26; f++) {
      var fx = R.range(0, W);
      var fy = R.range(0, H);
      c.beginPath();
      c.moveTo(fx, fy);
      c.lineTo(fx + R.range(8, 34), fy + R.range(-0.8, 0.8));
      c.strokeStyle = 'rgba(17,19,16,0.05)';
      c.lineWidth = 0.6;
      c.stroke();
    }
    c.globalAlpha = 1;

    /* 很轻的暗角 */
    var vg = c.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.25, W * 0.5, H * 0.45, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(17,19,16,0)');
    vg.addColorStop(0.72, 'rgba(17,19,16,0.018)');
    vg.addColorStop(1, 'rgba(17,19,16,0.09)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
  }

  /* ---------------- 水下细节：焦散、光柱、颗粒 ---------------- */

  function buildDetail() {
    detailTex = makeCanvas();
    var c = ctxFor(detailTex);
    var R = makeR(0x51a7c3e1);

    c.globalCompositeOperation = 'lighter';

    /* 从右上落下来的光柱，拉得很长 */
    for (var s = 0; s < 6; s++) {
      var x = W * (0.14 + s * 0.15) + R.range(-30, 30);
      var wdt = R.range(40, 120);
      var a = R.range(0.03, 0.075);
      var gr = c.createLinearGradient(x, 0, x - W * 0.12, H);
      gr.addColorStop(0, 'rgba(160,240,220,0)');
      gr.addColorStop(0.3, 'rgba(150,230,210,' + a.toFixed(3) + ')');
      gr.addColorStop(0.78, 'rgba(110,200,182,' + (a * 0.55).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(80,170,150,0)');
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + wdt, 0);
      c.lineTo(x + wdt * 0.5 - W * 0.09, H);
      c.lineTo(x - W * 0.09, H);
      c.closePath();
      c.fill();
    }

    /* 水里的几团亮：不让深海变成一块平色 */
    for (var gl = 0; gl < 7; gl++) {
      var ggx = R.range(0.08, 0.92) * W;
      var ggy = R.range(0.15, 0.95) * H;
      var ggr = R.range(90, 240);
      var ggg = c.createRadialGradient(ggx, ggy, 2, ggx, ggy, ggr);
      ggg.addColorStop(0, 'rgba(70,180,160,0.055)');
      ggg.addColorStop(1, 'rgba(30,100,90,0)');
      c.fillStyle = ggg;
      c.fillRect(ggx - ggr, ggy - ggr, ggr * 2, ggr * 2);
    }

    /* 大面积的柔光带：把水下的光织成一张网 */
    c.filter = 'blur(9px)';
    for (var rb = 0; rb < 12; rb++) {
      var ry0 = R.range(-0.05, 1.05) * H;
      var ramp = R.range(24, 70);
      var rfreq = R.range(0.8, 2.0);
      var rph = R.range(0, Math.PI * 2);
      c.beginPath();
      for (var rx2 = -60; rx2 <= W + 60; rx2 += 24) {
        var uu = rx2 / W;
        var yy2 = ry0
          + Math.sin(uu * Math.PI * rfreq + rph) * ramp
          + Math.sin(uu * Math.PI * rfreq * 2.1 + rph * 1.4) * ramp * 0.35;
        if (rx2 === -60) c.moveTo(rx2, yy2); else c.lineTo(rx2, yy2);
      }
      c.strokeStyle = 'rgba(120,220,198,' + R.range(0.025, 0.06).toFixed(3) + ')';
      c.lineWidth = R.range(10, 26);
      c.stroke();
    }
    c.filter = 'none';


    /* 焦散：柔和的一层 + 更细的一层 */
    c.filter = 'blur(3.1px)';
    for (var i = 0; i < 38; i++) {
      var y0 = R.range(-0.08, 1.08) * H;
      var amp = R.range(6, 30);
      var freq = R.range(1.1, 3.1);
      var ph = R.range(0, Math.PI * 2);
      c.beginPath();
      for (var x2 = -40; x2 <= W + 40; x2 += 16) {
        var u = x2 / W;
        var yy = y0
          + Math.sin(u * Math.PI * freq + ph) * amp
          + Math.sin(u * Math.PI * freq * 2.7 - ph * 1.7) * amp * 0.3;
        if (x2 === -40) c.moveTo(x2, yy); else c.lineTo(x2, yy);
      }
      c.strokeStyle = 'rgba(160,245,220,' + R.range(0.070, 0.190).toFixed(3) + ')';
      c.lineWidth = R.range(0.8, 3.2);
      c.stroke();
    }

    for (var k = 0; k < 30; k++) {
      var cx = R.range(0, W);
      var cy = R.range(0, H);
      var rx = R.range(24, 120);
      var ry = R.range(5, 30);
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, R.range(-0.5, 0.5), R.range(0.3, 2.6), R.range(3.3, 6.1));
      c.strokeStyle = 'rgba(160,248,222,' + R.range(0.050, 0.140).toFixed(3) + ')';
      c.lineWidth = R.range(0.8, 2.6);
      c.stroke();
    }

    /* 斜向的焦散网，打断横向条纹 */
    for (var d = 0; d < 14; d++) {
      var dx0 = R.range(-0.1, 0.8) * W;
      var dy0 = R.range(-0.1, 1.0) * H;
      var dlen = R.range(0.15, 0.45);
      var da = R.range(0.45, 1.15);
      c.beginPath();
      for (var dt = 0; dt <= 1; dt += 0.12) {
        var ddx = dx0 + Math.cos(da) * dlen * W * dt;
        var ddy = dy0 + Math.sin(da) * dlen * H * dt + Math.sin(dt * 7 + d) * 12;
        if (dt === 0) c.moveTo(ddx, ddy); else c.lineTo(ddx, ddy);
      }
      c.strokeStyle = 'rgba(150,240,215,' + R.range(0.050, 0.130).toFixed(3) + ')';
      c.lineWidth = R.range(0.8, 2.4);
      c.stroke();
    }
    c.filter = 'none';

    /* 细亮线 */
    for (var j = 0; j < 14; j++) {
      var yj = R.range(0, H);
      var aj = R.range(4, 18);
      var fj = R.range(1.4, 3.8);
      var pj = R.range(0, Math.PI * 2);
      c.beginPath();
      for (var xj = 0; xj <= W; xj += 12) {
        var uj = xj / W;
        var yyj = yj + Math.sin(uj * Math.PI * fj + pj) * aj + Math.sin(uj * Math.PI * fj * 2.2) * aj * 0.3;
        if (xj === 0) c.moveTo(xj, yyj); else c.lineTo(xj, yyj);
      }
      c.strokeStyle = 'rgba(200,255,240,' + R.range(0.080, 0.220).toFixed(3) + ')';
      c.lineWidth = R.range(0.6, 1.5);
      c.stroke();
    }

    /* 海雪 */
    for (var q = 0; q < 260; q++) {
      var gx = R.range(0, W);
      var gy = R.range(0, H);
      var ga = R.range(0.02, 0.09);
      c.fillStyle = 'rgba(210,250,238,' + ga.toFixed(3) + ')';
      c.fillRect(gx, gy, R.range(0.5, 1.4), R.range(0.5, 1.4));
    }

    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  /* ---------------- 静态海：整幅水下色 + 焦散 ---------------- */

  function buildWater() {
    waterTex = makeCanvas();
    var c = ctxFor(waterTex);

    var gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#205f56');
    gr.addColorStop(0.16, '#123a35');
    gr.addColorStop(0.5, '#071f1d');
    gr.addColorStop(1, '#03100F');
    c.fillStyle = gr;
    c.fillRect(0, 0, W, H);

    var glow = c.createRadialGradient(W * 0.64, H * 0.14, 8, W * 0.64, H * 0.14, Math.max(W, H) * 0.62);
    glow.addColorStop(0, 'rgba(82,190,172,0.24)');
    glow.addColorStop(0.5, 'rgba(34,104,96,0.10)');
    glow.addColorStop(1, 'rgba(20,70,64,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);

    c.globalAlpha = 1;
    c.drawImage(detailTex, 0, 0, W, H);

    var deep = c.createLinearGradient(0, 0, 0, H);
    deep.addColorStop(0, 'rgba(3,16,15,0)');
    deep.addColorStop(0.52, 'rgba(3,16,15,0.10)');
    deep.addColorStop(1, 'rgba(3,16,15,0.42)');
    c.fillStyle = deep;
    c.fillRect(0, 0, W, H);
  }

  /* ---------------- 背景缓存：纸 / 海按水线直切 ---------------- */

  function buildBackdrop(line) {
    if (!bg) bg = makeCanvas();
    var c = bg.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);

    var cut = Math.round(line);
    /* 干：骨白纸 */
    c.drawImage(paperTex, 0, 0, W * DPR, Math.max(1, cut * DPR), 0, 0, W, Math.max(1, cut));
    /* 湿：整幅水下色 */
    if (cut < H) {
      c.drawImage(
        waterTex,
        0, cut * DPR, W * DPR, (H - cut) * DPR,
        0, cut, W, H - cut
      );
    }

    bgLine = line;
    bgAt = time;
    bgBuilds++;
  }

  function render(t, line) {
    if (!g) return;
    time = t;

    /* 背景只在「水线真的变了」时重建；静止时几乎只有一次贴图 */
    if (!bg || Math.abs(line - bgLine) > 0.8) {
      buildBackdrop(line);
    }

    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, H);
    g.drawImage(bg, 0, 0, W, H);

    /* 动态部分：全部裁在水线以下 */
    g.save();
    clipBelow(g, line, t);
    g.clip();

    /* 近水面的天光 */
    var band = Math.min(240, H - line);
    if (band > 4) {
      var near = g.createLinearGradient(0, line, 0, line + band);
      near.addColorStop(0, 'rgba(96,228,202,0.42)');
      near.addColorStop(0.12, 'rgba(55,165,148,0.20)');
      near.addColorStop(0.5, 'rgba(32,108,100,0.07)');
      near.addColorStop(1, 'rgba(24,86,80,0)');
      g.fillStyle = near;
      g.fillRect(0, line, W, band);

      /* 水下的亮池：太阳从右上下来 */
      var pool = g.createRadialGradient(
        W * 0.64 + Math.sin(t * 0.05) * 22, line + 95, 4,
        W * 0.64 + Math.sin(t * 0.05) * 22, line + 95, Math.max(160, W * 0.26)
      );
      pool.addColorStop(0, 'rgba(120,235,210,0.12)');
      pool.addColorStop(1, 'rgba(60,160,145,0)');
      g.fillStyle = pool;
      g.fillRect(0, line, W, band + 80);

      /* 一条会缓慢横移的焦散带 */
      var off = Math.sin(t * 0.16) * 18 + Math.sin(t * 0.058 + 1.7) * 12;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.46;
      g.drawImage(
        detailTex,
        0, Math.max(0, line) * DPR, W * DPR, band * DPR,
        off, line, W, band
      );
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }

    g.restore();

    /* 水线附近的湿接缝：不裁切，向两侧各铺开几像素，
       遮住缓存直切与波形之间的 1–2px 差，同时把纸「打湿」。 */
    g.save();
    g.beginPath();
    for (var x = 0; x <= W; x += 6) {
      var wy = line + waveAt(x, t);
      if (x === 0) g.moveTo(x, wy); else g.lineTo(x, wy);
    }
    g.strokeStyle = 'rgba(128,228,206,0.13)';
    g.lineWidth = 14;
    g.stroke();
    g.strokeStyle = 'rgba(242,236,223,0.50)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();

    /* 水线以上的一层湿膜：纸靠近水的地方微亮 */
    g.save();
    g.beginPath();
    g.rect(0, Math.max(0, line - 24), W, 26);
    g.clip();
    g.globalAlpha = 0.10;
    g.drawImage(paperTex, 0, 0, W, H);
    g.globalAlpha = 1;
    g.restore();

    /* 水面泡沫：几十个光点，水线附近 */
    g.save();
    g.beginPath();
    g.rect(0, Math.max(0, line - 8), W, Math.min(18, H - line + 8));
    g.clip();
    var seed = Math.floor(line / 7);
    var n = W < 720 ? 42 : 64;
    for (var i = 0; i < n; i++) {
      var r = Math.sin(i * 12.9898 + seed) * 43758.5453;
      r = r - Math.floor(r);
      var xx = ((r + t * 0.003 * ((i % 3) + 1)) % 1) * W;
      var base = line + waveAt(xx, t);
      var yy = base + (Math.sin(i * 7.3 + seed) * 0.5) * 11;
      var a = (0.035 + (Math.sin(i * 3.1 + seed) * 0.5 + 0.5) * 0.18) * Math.exp(-Math.abs(yy - base) / 7);
      g.fillStyle = 'rgba(236,250,242,' + a.toFixed(3) + ')';
      g.fillRect(xx, yy, 1.2 + r * 2.4, 0.8);
    }
    g.restore();
  }

  function resize(w, h, dpr) {
    W = Math.max(1, w);
    H = Math.max(1, h);
    DPR = Math.min(dpr || 1, 1.5);

    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    if (!g) g = canvas.getContext('2d');

    buildPaper();
    buildDetail();
    buildWater();
    bg = null;
    bgLine = -1;
    bgAt = -1;
    bgBuilds = 0;
  }

  function init(el) {
    canvas = el;
    g = canvas.getContext('2d');
    canvas.width = 1;
    canvas.height = 1;
  }

  window.StudySea = {
    init: init,
    resize: resize,
    render: render,
    get ok() { return !!g; },
    get builds() { return bgBuilds; }
  };
})();
