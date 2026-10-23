/* ============================================================
   04 航线 / ROUTE —— 《潮汐书 · 海南》
   一张摊开的更路簿：旧纸、罗盘、旧岛名、12 段针路。
   用 pointer/touch 顺着针路划一笔；划过的段亮成星金 #C9A96A；
   第 12 段到岸，得「更」（s.onCollect('更')）。
   停下：线干掉、被水擦回去。
   干 = 墨印在纸上；湿 = 骨白 + 折射，切分只认 s.lineY。
   只改 act.js；图版 assets/plates/treated/04-route.webp 做 30–50% 内嵌，
   相对路径在 labs/act04/ 与 js/acts/ 两级深度相同，移动后仍成立。
   ============================================================ */
(function () {
  'use strict';

  var SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","STZhongsong",serif';
  var SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
  var MONO = 'Consolas,"JetBrains Mono","SFMono-Regular",monospace';

  var COPY = {
    kicker: '把海折成路',
    title: '航线',
    body1: '一本巴掌大的手抄本，记着从清澜港去西沙的针路。',
    body2: '一更六十里。名字，是走过的人留下的。',
    hint: '顺着针路划一笔',
    hintEn: 'TRACE THE RHUMB LINE',
    word: '更',
    plateLabel: '图版 04 / PLATE 04',
    plateCaption: '用乾巽，使到十二更。',
    header: '更路簿',
    headerEn: 'ROUTE BOOK',
    labels: {
      compass: ['罗盘', 'COMPASS'],
      rhumb: ['针路', 'RHUMB LINE'],
      island: ['峙', 'ISLAND'],
      gap: ['门', 'REEF GAP'],
      cat: ['猫峙', 'CAT ISLAND'],
      ledger: ['流水簿', 'TIDE LEDGER']
    }
  };

  var RGB = {
    ink: [17, 19, 16],
    bone: [242, 236, 223],
    gold: [201, 169, 106],
    teal: [22, 51, 47],
    sea: [3, 16, 15]
  };
  var GOLD = '#C9A96A';
  var PLATE_SRC = '../../assets/plates/treated/04-route.webp';

  var S = {
    ctx: null, root: null, W: 0, H: 0, dpr: 1, narrow: false,
    chart: null, plate: null, copy: null, path: null, compass: null,
    labels: [], ledger: null, reef: null, island2: null, island1: null,
    word: null, plateImg: null, plateReady: false, plateFailed: false,
    grain: [], stars: [],
    /* trace */
    mode: 'idle', prog: 0, target: 0, dry: 0, dryT: 0, settleT: 0,
    stillT: 0, offT: 0, crossed: false, sawCat: false,
    done: false, granted: false, wordT: 0,
    status: '', statusUntil: 0,
    lastDown: false, lastPx: -1, lastPy: -1, lastNow: 0, now: 0,
    state: null, reduced: false,
    debugTrace: -1, perf: false, fps: 60, fpsAcc: 0, drawMs: 0,
    auto: 0, autoT: 0,
    ticked: 0
  };

  /* ---------- util ---------- */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fontStr(weight, size, family) { return weight + ' ' + size + 'px ' + family; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function prep(str, fs, track, weight, family) {
    var g = S.ctx.g;
    g.font = fontStr(weight || 400, fs, family || SERIF);
    var chars = [], pos = [], x = 0;
    for (var i = 0; i < str.length; i++) {
      chars.push(str.charAt(i));
      pos.push(x);
      x += g.measureText(str.charAt(i)).width + fs * track;
    }
    return {
      chars: chars, pos: pos, w: Math.max(0, x - fs * track),
      font: fontStr(weight || 400, fs, family || SERIF)
    };
  }

  function put(g, p, x, y, color, align) {
    var ox = align === 'right' ? -p.w : (align === 'center' ? -p.w / 2 : 0);
    g.font = p.font;
    g.fillStyle = color;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    for (var i = 0; i < p.chars.length; i++) g.fillText(p.chars[i], x + ox + p.pos[i], y);
  }

  function putWhole(g, str, x, y, fs, weight, family, color, align) {
    g.font = fontStr(weight, fs, family);
    g.fillStyle = color;
    g.textAlign = align || 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(str, x, y);
  }

  function line(g, x1, y1, x2, y2, w, color) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineWidth = w;
    g.strokeStyle = color;
    g.stroke();
  }

  function rect(g, x, y, w, h, lw, color) {
    g.beginPath();
    g.rect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.lineWidth = lw;
    g.strokeStyle = color;
    g.stroke();
  }

  /* ---------- plate ---------- */

  function loadPlate() {
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () { S.plateReady = true; };
    img.onerror = function () { S.plateFailed = true; };
    img.src = PLATE_SRC;
    S.plateImg = img;
  }

  /* ---------- path ---------- */

  /* 24 方位是 15° 一格：12 段针路只走 45/60/75 三档，像一条真实的更路。 */
  var DIRS = [-60, -75, -45, -75, -60, -45, -60, -75, -60, -45, -60, -75];

  function buildPath() {
    var c = S.chart;
    var dxs = 0, dys = 0, i;
    for (i = 0; i < DIRS.length; i++) {
      dxs += Math.cos(DIRS[i] * Math.PI / 180);
      dys += -Math.sin(DIRS[i] * Math.PI / 180);
    }
    var end, L;
    if (S.narrow) {
      end = { x: c.x + c.w * 0.80, y: c.y + c.h * 0.32 };
      L = Math.min(c.w * 0.62 / dxs, c.h * 0.66 / dys);
    } else {
      end = { x: c.x + c.w * 0.66, y: c.y + c.h * 0.205 };
      L = Math.min(c.w * 0.60 / dxs, c.h * 0.76 / dys);
    }
    var start = { x: end.x - L * dxs, y: end.y + L * dys };
    var pts = [start];
    var x = start.x, y = start.y;
    for (i = 0; i < DIRS.length; i++) {
      var a = DIRS[i] * Math.PI / 180;
      x += Math.cos(a) * L;
      y += Math.sin(a) * L;
      pts.push({ x: x, y: y });
    }
    S.path = {
      pts: pts, seg: L, total: L * DIRS.length, start: start, end: end,
      dx: dxs * L, dy: -dys * L
    };
    S.path.end = pts[pts.length - 1];
  }

  function pathAt(u) {
    var p = S.path;
    if (!p) return { x: 0, y: 0 };
    u = clamp(u, 0, 1);
    var f = u * 12;
    var i = Math.min(11, Math.floor(f));
    var t = f - i;
    var a = p.pts[i], b = p.pts[i + 1];
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  }

  function nearest(px, py) {
    var pts = S.path.pts, best = { dist: 1e9, u: 0 };
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var vx = b.x - a.x, vy = b.y - a.y;
      var l2 = vx * vx + vy * vy || 1;
      var t = clamp(((px - a.x) * vx + (py - a.y) * vy) / l2, 0, 1);
      var qx = a.x + vx * t, qy = a.y + vy * t;
      var d = Math.hypot(px - qx, py - qy);
      if (d < best.dist) best = { dist: d, u: (i + t) / 12 };
    }
    return best;
  }

  /* ---------- layout ---------- */

  function rebuild() {
    var W = S.W, H = S.H;
    var c, pl, cp;

    if (W >= 820) {
      S.narrow = false;
      c = { x: W * 0.048, y: H * 0.072, w: W * 0.535, h: H * 0.855 };
      var pw = clamp(W * 0.42, 300, 620);
      pl = { w: pw, h: pw * 0.6667, x: W * 0.955 - pw, y: H * 0.40 };
      cp = {
        x: W * 0.655, w: W * 0.30, top: H * 0.085,
        kickerY: H * 0.085 + 10,
        titleFs: clamp(W * 0.045, 36, 62),
        bodyFs: clamp(W * 0.0105, 10.5, 14.5),
        hintFs: 9, hintEnFs: 6.4, labelFs: 8, microFs: 6.6
      };
    } else {
      S.narrow = true;
      c = { x: 13, y: 140, w: W - 26, h: H - 140 - 76 };
      var pw2 = clamp(W * 0.42, 150, 280);
      pl = {
        w: pw2, h: pw2 * 0.6667, x: W - 14 - pw2,
        y: c.y + Math.max(16, H * 0.022)
      };
      cp = {
        x: 17, w: W - 34, top: H * 0.036,
        kickerY: H * 0.035 + 2,
        titleFs: clamp(W * 0.075, 26, 34),
        bodyFs: clamp(W * 0.0285, 10.5, 11.8),
        hintFs: 9, labelFs: 8, microFs: 6.1
      };
    }
    S.chart = c;
    S.plate = pl;
    buildPath();

    /* copy block */
    if (S.narrow) {
      cp.titleY = cp.kickerY + cp.titleFs + 8;
      cp.ruleY = cp.titleY + 12;
      cp.body1Y = cp.ruleY + 18;
      cp.body2Y = cp.body1Y + cp.bodyFs * 1.72;
    } else {
      cp.titleY = cp.kickerY + cp.titleFs + 12;
      cp.ruleY = cp.titleY + 20;
      cp.body1Y = cp.ruleY + 26;
      cp.body2Y = cp.body1Y + cp.bodyFs * 1.85;
    }
    cp.hintY = cp.body2Y + 38;
    cp.hintEnY = cp.hintY + 11;
    if (S.narrow) {
      cp.hintX = 27;
      cp.hintY = H - 40;
      cp.hintEnY = 0;
      cp.statusY = H - 58;
      cp.readoutX = W - 16;
      cp.readoutY = H - 40;
    } else {
      cp.hintX = cp.x;
      cp.statusY = cp.hintY + 34;
      cp.readoutX = cp.x + cp.w;
      cp.readoutY = cp.statusY;
    }
    S.copy = cp;

    var bodyFs = cp.bodyFs;
    var cnFs = cp.labelFs;
    var enFs = cp.microFs;

    S.copy.kicker = prep(COPY.kicker, 9, 0.20, 400, SANS);
    S.copy.title = prep(COPY.title, cp.titleFs, 0.14, 500, SERIF);
    S.copy.hint = prep(COPY.hint, cp.hintFs, 0.06, 400, SANS);
    S.copy.hintEn = prep(COPY.hintEn, cp.hintEnFs || 6.4, 0.20, 400, MONO);
    S.copy.body1 = COPY.body1;
    S.copy.body2 = COPY.body2;
    S.copy.enRoute = prep('ROUTE', 7, 0.20, 400, MONO);
    S.copy.header = prep(COPY.header, 8.5, 0.12, 500, SERIF);
    S.copy.headerEn = prep(COPY.headerEn, 6, 0.22, 400, MONO);
    S.copy.plateLabel = prep(COPY.plateLabel, S.narrow ? 6.4 : 7, 0.16, 400, MONO);
    S.copy.plateCaption = prep(COPY.plateCaption, 8, 0, 400, SANS);
    S.copy.wordCn = prep('到岸', 7.4, 0.14, 400, SANS);
    S.copy.wordEn = prep('THE 12TH LEG', 6.2, 0.20, 400, MONO);
    S.copy.labels = {};
    for (var k in COPY.labels) {
      if (!COPY.labels.hasOwnProperty(k)) continue;
      S.copy.labels[k] = {
        cn: prep(COPY.labels[k][0], cnFs, 0.10, 400, SERIF),
        en: prep(COPY.labels[k][1], enFs, 0.18, 400, MONO)
      };
    }

    layoutFeatures();
    seedMarks();
  }

  function mkLabel(key, x, y, align, leader) {
    var L = S.copy.labels[key];
    return {
      key: key, x: x, y: y, align: align || 'left',
      leader: leader || null, cn: L.cn, en: L.en
    };
  }

  function layoutFeatures() {
    var c = S.chart, p = S.plate, cp = S.copy, W = S.W, H = S.H;
    var narrow = S.narrow;

    /* compass */
    var cr = Math.min(c.w, c.h) * (narrow ? 0.085 : 0.09);
    var cx = c.x + c.w * 0.15;
    var cy = c.y + c.h * 0.155;
    S.compass = { x: cx, y: cy, r: cr };

    /* labels */
    S.labels = [];
    var lbC = mkLabel('compass', cx - cr * 0.92, cy + cr + (narrow ? 22 : 26), 'left',
      [cx - cr * 0.60, cy + cr * 0.80, cx - cr * 0.92 + 12, cy + cr + (narrow ? 12 : 16)]);
    S.labels.push(lbC);

    /* island 2 (峙) */
    var i2x = c.x + c.w * (narrow ? 0.30 : 0.22);
    var i2y = c.y + c.h * (narrow ? 0.63 : 0.60);
    var i2r = narrow ? 14 : 22;
    S.island2 = { x: i2x, y: i2y, r: i2r };
    S.labels.push(mkLabel('island', i2x - i2r * 1.0, i2y + i2r + (narrow ? 30 : 38), 'left',
      [i2x - i2r * 0.3, i2y + i2r * 0.8, i2x - i2r * 0.6, i2y + i2r * 0.8 + (narrow ? 20 : 27)]));

    /* reef gap (门) */
    var rfx = c.x + c.w * (narrow ? 0.70 : 0.62);
    var rfy = c.y + c.h * (narrow ? 0.60 : 0.575);
    var rfr = narrow ? 20 : 25;
    S.reef = { x: rfx, y: rfy, r: rfr };
    S.labels.push(mkLabel('gap', rfx - rfr * 0.5, rfy + rfr + (narrow ? 30 : 44), 'left',
      [rfx - rfr * 0.2, rfy + rfr * 0.75, rfx - rfr * 0.1, rfy + rfr + (narrow ? 18 : 32)]));

    /* landfall island (猫峙) */
    var end = S.path.end;
    var i1x = end.x + 14;
    var i1y = end.y - 7;
    var i1r = narrow ? 16 : 22;
    S.island1 = { x: i1x, y: i1y, r: i1r, harbor: { x: end.x, y: end.y } };
    S.labels.push(mkLabel('cat',
      narrow ? 300 : i1x + 30,
      narrow ? 300 : i1y - 14, 'left',
      [narrow ? 304 : i1x + i1r * 0.55, narrow ? 311 : i1y - i1r * 0.55,
        narrow ? 314 : i1x + i1r * 0.35, narrow ? 324 : i1y - i1r * 0.2]));

    /* ledger */
    var lx = c.x + c.w * (narrow ? 0.72 : 0.53);
    var ly = c.y + c.h * (narrow ? 0.885 : 0.78);
    var lw = c.w * (narrow ? 0.17 : 0.085);
    var lh = c.h * (narrow ? 0.075 : 0.10);
    S.ledger = { x: lx, y: ly, w: lw, h: lh, rows: narrow ? 6 : 7 };
    var ledgerLabelY = narrow ? ly - 20 : ly - 18;
    S.labels.push(mkLabel('ledger', lx, ledgerLabelY, 'left',
      [lx + 6, ledgerLabelY + 4, lx + 6, ly - 3]));

    /* rhumb line label: anchored to the path, not to the page */
    var pt = pathAt(0.30);
    S.labels.push(mkLabel('rhumb', pt.x + (narrow ? 22 : 26), pt.y + (narrow ? 34 : 36), 'left',
      [pt.x + 5, pt.y + 6, pt.x + (narrow ? 24 : 28), pt.y + (narrow ? 23 : 25)]));

    /* word inscription */
    var ws = narrow ? 64 : 78;
    var wpad = narrow ? 10 : 12;
    if (narrow) {
      S.word = { x: 178, y: 292, s: ws, pad: wpad };
    } else {
      S.word = { x: end.x + 58, y: end.y + 26, s: ws, pad: wpad };
    }
    S.word.fs = narrow ? 42 : 56;

    /* plate crop: keep the empty middle paper + the atoll, leave the rosette out */
    p.sx = 300; p.sy = 170; p.sw = 900; p.sh = 600;
    p.captionX = p.x - (narrow ? 0 : 22);
    p.captionY = p.y + p.h - 34;
    p.labelY = p.y - (narrow ? 8 : 12);
    p.labelX = p.x + p.w - S.copy.plateLabel.w;
  }

  function seedMarks() {
    var c = S.chart, i, rnd = mulberry32(4412);
    /* paper grain: two alpha buckets, 3–4% */
    S.grain = [];
    for (i = 0; i < 150; i++) {
      S.grain.push({
        x: c.x + rnd() * c.w,
        y: c.y + rnd() * c.h,
        w: 0.5 + rnd() * 0.75,
        h: 0.5 + rnd() * 0.5,
        a: rnd() < 0.45 ? 0.038 : 0.022
      });
    }
    /* star flecks: avoid the route corridor and the plate */
    S.stars = [];
    var tries = 0;
    while (S.stars.length < 11 && tries < 240) {
      tries++;
      var x = c.x + (0.06 + rnd() * 0.88) * c.w;
      var y = c.y + (0.05 + rnd() * 0.90) * c.h;
      if (x > S.plate.x - 6 && x < S.plate.x + S.plate.w + 6 &&
          y > S.plate.y - 6 && y < S.plate.y + S.plate.h + 6) continue;
      if (nearest(x, y).dist < 30) continue;
      if (S.word && x > S.word.x - 12 && x < S.word.x + S.word.s + 12 &&
          y > S.word.y - 12 && y < S.word.y + S.word.s + 12) continue;
      S.stars.push({ x: x, y: y, r: 1.5 + rnd() * 1.9, a: 0.34 + rnd() * 0.22 });
    }
    /* 岛上方的一小簇星：桌面右上角空纸的落点；移动端那里是图版 */
    if (!S.narrow) {
      var fixed = [[0.790, 0.090], [0.858, 0.148], [0.906, 0.108]];
      for (var f = 0; f < fixed.length; f++) {
        S.stars.push({
          x: c.x + c.w * fixed[f][0],
          y: c.y + c.h * fixed[f][1],
          r: 2.1 + f * 0.35, a: 0.5
        });
      }
    }
  }

  /* ---------- scene parts ---------- */

  function dryInk(mode, a) { return mode === 'ink' ? rgba(RGB.ink, a) : rgba(RGB.bone, a); }
  function accent(mode, a) { return mode === 'ink' ? rgba(RGB.gold, a) : rgba(RGB.bone, a); }

  function drawPaper(g, mode) {
    var c = S.chart;
    g.fillStyle = mode === 'ink' ? 'rgba(17,19,16,0.028)' : 'rgba(242,236,223,0.030)';
    g.fillRect(c.x, c.y, c.w, c.h);

    /* 折痕 / 书口：字落在折痕上时让开一条缝 */
    var foldX = c.x + c.w * 0.545;
    var foldCol = mode === 'ink' ? 'rgba(17,19,16,0.06)' : 'rgba(242,236,223,0.055)';
    var wb = S.word;
    if (S.done && wb && foldX > wb.x + 4 && foldX < wb.x + wb.s - 4) {
      line(g, foldX, c.y + 4, foldX, wb.y - 8, 0.6, foldCol);
      line(g, foldX, wb.y + wb.s + 8, foldX, c.y + c.h - 4, 0.6, foldCol);
    } else {
      line(g, foldX, c.y + 4, foldX, c.y + c.h - 4, 0.6, foldCol);
    }

    /* 纸纹 */
    var i;
    g.fillStyle = mode === 'ink' ? 'rgba(17,19,16,0.038)' : 'rgba(242,236,223,0.042)';
    for (i = 0; i < S.grain.length; i++) {
      var o = S.grain[i];
      if (o.a > 0.03) g.fillRect(o.x, o.y, o.w, o.h);
    }
    g.fillStyle = mode === 'ink' ? 'rgba(17,19,16,0.022)' : 'rgba(242,236,223,0.028)';
    for (i = 0; i < S.grain.length; i++) {
      var q = S.grain[i];
      if (q.a <= 0.03) g.fillRect(q.x, q.y, q.w, q.h);
    }
  }

  function drawChartFrame(g, mode) {
    var c = S.chart;
    /* 边框：外 1.05 / 内 0.6；画在图版之上，让线真的压过图版 */
    rect(g, c.x, c.y, c.w, c.h, 1.05, dryInk(mode, mode === 'ink' ? 0.50 : 0.44));
    rect(g, c.x + 7, c.y + 7, c.w - 14, c.h - 14, 0.6, dryInk(mode, mode === 'ink' ? 0.18 : 0.16));

    /* 四角定位角标 */
    var k = 9, col = accent(mode, mode === 'ink' ? 0.55 : 0.40);
    var pts = [[c.x + 2, c.y + 2, 1, 1], [c.x + c.w - 2, c.y + 2, -1, 1],
      [c.x + 2, c.y + c.h - 2, 1, -1], [c.x + c.w - 2, c.y + c.h - 2, -1, -1]];
    for (var j = 0; j < 4; j++) {
      var P = pts[j];
      line(g, P[0], P[1], P[0] + k * P[2], P[1], 0.6, col);
      line(g, P[0], P[1], P[0], P[1] + k * P[3], 0.6, col);
    }
    /* 书口刻度：每一格对应一更，不写数字 */
    if (!S.narrow) {
      var sx = c.x + c.w * 0.055, sy = c.y + c.h - 16;
      line(g, sx, sy, sx + 84, sy, 0.6, dryInk(mode, mode === 'ink' ? 0.22 : 0.20));
      for (var n = 0; n < 7; n++) {
        line(g, sx + n * 14, sy, sx + n * 14, sy - (n === 0 || n === 6 ? 5 : 3),
          0.6, dryInk(mode, mode === 'ink' ? 0.22 : 0.20));
      }
      g.font = fontStr(400, 6.2, MONO);
      g.fillStyle = dryInk(mode, mode === 'ink' ? 0.26 : 0.22);
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText('更', sx + 90, sy + 1);
    }
  }

  function drawPlate(g, mode, s) {
    var p = S.plate;
    if (S.plateFailed) drawPlateFallback(g, mode);
    if (S.plateReady && S.plateImg) {
      g.save();
      g.beginPath();
      g.rect(p.x, p.y, p.w, p.h);
      g.clip();

      if (mode === 'ink') {
        /* 印在骨白纸上：multiply ≈ CSS 的 .plate--04 img{mix-blend-mode:multiply} */
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = 0.92;
        g.drawImage(S.plateImg, p.sx, p.sy, p.sw, p.sh, p.x, p.y, p.w, p.h);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        /* 一层极淡的南海青，把暖纸压回 token */
        g.fillStyle = rgba(RGB.teal, 0.045);
        g.fillRect(p.x, p.y, p.w, p.h);
      } else {
        /* 水下的图版：骨白的残影 + 横向折射切片 */
        var bands = 4, bh = p.h / bands;
        g.globalAlpha = 0.27;
        for (var i = 0; i < bands; i++) {
          var off = Math.sin(s.t * 0.55 + i * 1.7) * 1.4;
          g.drawImage(S.plateImg, p.sx, p.sy + (p.sh / bands) * i, p.sw, p.sh / bands + 0.5,
            p.x + off, p.y + bh * i, p.w, bh + 0.6);
        }
        g.globalAlpha = 1;
        g.fillStyle = rgba(RGB.bone, 0.05);
        g.fillRect(p.x, p.y, p.w, p.h);
      }
      g.restore();
    }

    /* 线框、编号、竖排图版原文（真文字，不烧进图里） */
    rect(g, p.x, p.y, p.w, p.h, 1.05, dryInk(mode, mode === 'ink' ? 0.46 : 0.40));
    var tick = mode === 'ink' ? rgba(RGB.gold, 0.55) : rgba(RGB.bone, 0.34);
    line(g, p.x, p.y, p.x + 14, p.y, 0.6, tick);
    line(g, p.x, p.y, p.x, p.y + 14, 0.6, tick);
    line(g, p.x + p.w, p.y + p.h, p.x + p.w - 14, p.y + p.h, 0.6, tick);
    line(g, p.x + p.w, p.y + p.h, p.x + p.w, p.y + p.h - 14, 0.6, tick);

    var labelCol = mode === 'ink' ? rgba(RGB.gold, 0.72) : rgba(RGB.bone, 0.42);
    put(g, S.copy.plateLabel, p.labelX, p.labelY, labelCol, 'left');
    var ruleCol = mode === 'ink' ? rgba(RGB.gold, 0.28) : rgba(RGB.bone, 0.22);
    line(g, p.labelX, p.labelY + 3.5, p.labelX + S.copy.plateLabel.w, p.labelY + 3.5, 0.6, ruleCol);

    if (!S.narrow) {
      var cap = S.copy.plateCaption;
      g.font = cap.font;
      g.fillStyle = dryInk(mode, mode === 'ink' ? 0.46 : 0.38);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      for (var n = 0; n < cap.chars.length; n++) {
        g.fillText(cap.chars[n], p.captionX, p.captionY - n * 10.6);
      }
    }
  }

  function drawPlateFallback(g, mode) {
    /* 图版没有加载时的兜底：不报错，用细线画一张空海图 */
    var p = S.plate;
    g.save();
    g.beginPath();
    g.rect(p.x, p.y, p.w, p.h);
    g.clip();
    g.fillStyle = mode === 'ink' ? 'rgba(17,19,16,0.035)' : 'rgba(242,236,223,0.035)';
    g.fillRect(p.x, p.y, p.w, p.h);
    for (var i = 1; i < 5; i++) {
      line(g, p.x + p.w * i / 5, p.y, p.x + p.w * i / 5, p.y + p.h,
        0.5, dryInk(mode, 0.10));
      line(g, p.x, p.y + p.h * i / 5, p.x + p.w, p.y + p.h * i / 5,
        0.5, dryInk(mode, 0.10));
    }
    var ix = p.x + p.w * 0.66, iy = p.y + p.h * 0.46, ir = Math.min(p.w, p.h) * 0.13;
    g.beginPath();
    g.ellipse(ix, iy, ir, ir * 0.7, 0.4, 0, Math.PI * 2);
    g.lineWidth = 1;
    g.strokeStyle = dryInk(mode, 0.45);
    g.stroke();
    g.restore();
  }

  function drawCompass(g, mode) {
    var cp = S.compass, x = cp.x, y = cp.y, r = cp.r;
    var col = dryInk(mode, mode === 'ink' ? 0.52 : 0.46);
    var thin = dryInk(mode, mode === 'ink' ? 0.28 : 0.24);

    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.lineWidth = 1.05;
    g.strokeStyle = col;
    g.stroke();

    g.beginPath();
    g.arc(x, y, r * 0.83, 0, Math.PI * 2);
    g.lineWidth = 0.6;
    g.strokeStyle = thin;
    g.stroke();

    g.beginPath();
    for (var i = 0; i < 24; i++) {
      var a = -Math.PI / 2 + i * (Math.PI / 12);
      var main = i % 3 === 0;
      var r1 = r * (main ? 0.93 : 0.955);
      var r2 = r * (main ? 0.80 : 0.895);
      g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    }
    g.lineWidth = 0.6;
    g.strokeStyle = thin;
    g.stroke();

    /* 八个主向 */
    g.beginPath();
    for (var j = 0; j < 8; j++) {
      var aa = -Math.PI / 2 + j * (Math.PI / 4);
      var rr = r * 0.72;
      g.moveTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
      g.lineTo(x + Math.cos(aa) * (rr + 5), y + Math.sin(aa) * (rr + 5));
    }
    g.lineWidth = 0.7;
    g.strokeStyle = col;
    g.stroke();

    /* 四字 */
    if (r > 44) {
      var names = ['北', '东', '南', '西'];
      var angs = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
      g.font = fontStr(400, Math.max(5.5, r * 0.13), SERIF);
      g.fillStyle = thin;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (var k = 0; k < 4; k++) {
        g.fillText(names[k], x + Math.cos(angs[k]) * r * 0.52,
          y + Math.sin(angs[k]) * r * 0.52 + 0.5);
      }
    }

    /* 一根针：只有一根，不转 */
    var na = -Math.PI / 2 - 0.34;
    var nx = x + Math.cos(na) * r * 0.70, ny = y + Math.sin(na) * r * 0.70;
    var bx = x - Math.cos(na) * r * 0.34, by = y - Math.sin(na) * r * 0.34;
    var px = Math.cos(na + Math.PI / 2) * 3.2, py = Math.sin(na + Math.PI / 2) * 3.2;
    g.beginPath();
    g.moveTo(nx, ny);
    g.lineTo(x + px, y + py);
    g.lineTo(x - px, y - py);
    g.closePath();
    g.fillStyle = mode === 'ink' ? 'rgba(17,19,16,0.58)' : rgba(RGB.bone, 0.52);
    g.fill();
    line(g, x + px * 0.5, y + py * 0.5, bx, by, 0.6, thin);

    g.beginPath();
    g.arc(x, y, 1.5, 0, Math.PI * 2);
    g.fillStyle = accent(mode, mode === 'ink' ? 0.9 : 0.6);
    g.fill();

    /* 外圈引一条细线到标签 */
    var lb = S.labels[0];
    if (lb.leader) {
      line(g, lb.leader[0], lb.leader[1], lb.leader[2], lb.leader[3], 0.6,
        dryInk(mode, mode === 'ink' ? 0.26 : 0.22));
    }
  }

  function blobPath(g, x, y, r, seed) {
    var rnd = mulberry32(seed), n = 9, pts = [], i;
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + 0.3;
      var rr = r * (0.78 + rnd() * 0.34);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.74]);
    }
    g.beginPath();
    var first = pts[0], last = pts[n - 1];
    g.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.closePath();
  }

  function drawIslands(g, mode) {
    var fillC = mode === 'ink' ? 'rgba(17,19,16,0.035)' : 'rgba(242,236,223,0.04)';
    var lineC = dryInk(mode, mode === 'ink' ? 0.52 : 0.46);
    var inner = dryInk(mode, mode === 'ink' ? 0.22 : 0.20);
    var i, isl;

    /* 峙 */
    isl = S.island2;
    blobPath(g, isl.x, isl.y, isl.r, 77);
    g.fillStyle = fillC; g.fill();
    g.lineWidth = 1.0; g.strokeStyle = lineC; g.stroke();
    g.beginPath();
    g.arc(isl.x, isl.y, isl.r * 0.44, 0.4, Math.PI * 1.55);
    g.lineWidth = 0.6; g.strokeStyle = inner; g.stroke();

    /* 猫峙 */
    isl = S.island1;
    blobPath(g, isl.x, isl.y, isl.r, 213);
    g.fillStyle = fillC; g.fill();
    g.lineWidth = 1.05; g.strokeStyle = lineC; g.stroke();
    g.beginPath();
    g.arc(isl.x, isl.y, isl.r * 0.5, 2.1, Math.PI * 1.75);
    g.lineWidth = 0.6; g.strokeStyle = inner; g.stroke();
    /* 港口点：针路的终点 */
    g.beginPath();
    g.arc(isl.harbor.x, isl.harbor.y, 2.2, 0, Math.PI * 2);
    g.fillStyle = accent(mode, mode === 'ink' ? 0.85 : 0.55);
    g.fill();

    /* 小沙点（点，不是面） */
    var rnd = mulberry32(88);
    g.fillStyle = dryInk(mode, mode === 'ink' ? 0.34 : 0.30);
    for (i = 0; i < 7; i++) {
      var a = rnd() * Math.PI * 2;
      var d = S.island1.r * (1.25 + rnd() * 1.0);
      g.beginPath();
      g.arc(S.island1.x + Math.cos(a) * d, S.island1.y + Math.sin(a) * d * 0.7,
        0.7 + rnd() * 0.7, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawReef(g, mode) {
    var r = S.reef;
    var lineC = dryInk(mode, mode === 'ink' ? 0.48 : 0.42);
    var inner = dryInk(mode, mode === 'ink' ? 0.2 : 0.18);
    g.lineWidth = 1.0;
    g.strokeStyle = lineC;
    g.beginPath();
    g.arc(r.x, r.y, r.r, -0.35, Math.PI - 0.42);
    g.stroke();
    g.beginPath();
    g.arc(r.x, r.y, r.r * 1.36, Math.PI * 0.82, Math.PI * 2 - 0.2);
    g.stroke();
    /* 缺口里的三粒沙 */
    g.fillStyle = inner;
    for (var i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(r.x - r.r * 0.22 + i * r.r * 0.22, r.y - r.r * 0.55 - i * 2.4,
        1.1, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawLedger(g, mode) {
    var l = S.ledger;
    var col = dryInk(mode, mode === 'ink' ? 0.24 : 0.22);
    line(g, l.x, l.y - 4, l.x, l.y + l.h, 0.6, col);
    var rnd = mulberry32(31);
    for (var i = 0; i < l.rows; i++) {
      var y = l.y + (l.h / (l.rows - 1)) * i;
      var w = l.w * (0.62 + rnd() * 0.38);
      line(g, l.x + 2, y, l.x + w, y, 0.6, col);
    }
  }

  function drawHeader(g, mode) {
    var c = S.chart;
    put(g, S.copy.header, c.x + 14, c.y + 20, dryInk(mode, mode === 'ink' ? 0.52 : 0.46), 'left');
    put(g, S.copy.headerEn, c.x + 14, c.y + 29, dryInk(mode, mode === 'ink' ? 0.30 : 0.26), 'left');
    line(g, c.x + 14, c.y + 34, c.x + 14 + S.copy.header.w, c.y + 34, 0.6,
      accent(mode, mode === 'ink' ? 0.45 : 0.3));
  }

  function drawChartMarks(g, mode) {
    var c = S.chart;
    var faint = dryInk(mode, mode === 'ink' ? 0.15 : 0.14);
    /* 旧纸的横折痕 */
    line(g, c.x + 6, c.y + c.h * 0.415, c.x + c.w - 6, c.y + c.h * 0.415, 0.6,
      mode === 'ink' ? 'rgba(17,19,16,0.05)' : 'rgba(242,236,223,0.045)');

    /* 浅滩：小的开圈，成簇；不写数字 */
    var clusters = [
      [0.295, 0.355, 5], [0.455, 0.205, 4], [0.785, 0.405, 5], [0.145, 0.525, 4]
    ];
    var rnd = mulberry32(9182);
    g.lineWidth = 0.6;
    g.strokeStyle = faint;
    for (var k = 0; k < clusters.length; k++) {
      var cx = c.x + c.w * clusters[k][0];
      var cy = c.y + c.h * clusters[k][1];
      for (var i = 0; i < clusters[k][2]; i++) {
        var a = rnd() * Math.PI * 2;
        var d = rnd() * 20;
        var rr = 1.2 + rnd() * 2.4;
        g.beginPath();
        g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, rr, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.fillStyle = dryInk(mode, mode === 'ink' ? 0.22 : 0.20);
    for (var j = 0; j < 6; j++) {
      var bx = c.x + (0.12 + rnd() * 0.74) * c.w;
      var by = c.y + (0.12 + rnd() * 0.70) * c.h;
      g.fillRect(bx, by, 0.8, 0.8);
    }
  }

  function drawStars(g, mode) {
    var i, st;
    g.strokeStyle = mode === 'ink' ? rgba(RGB.gold, 0.62) : rgba(RGB.bone, 0.40);
    g.lineWidth = 0.55;
    g.beginPath();
    for (i = 0; i < S.stars.length; i++) {
      st = S.stars[i];
      g.moveTo(st.x - st.r, st.y); g.lineTo(st.x + st.r, st.y);
      g.moveTo(st.x, st.y - st.r); g.lineTo(st.x, st.y + st.r);
    }
    g.stroke();
    g.fillStyle = mode === 'ink' ? rgba(RGB.gold, 0.55) : rgba(RGB.bone, 0.34);
    g.beginPath();
    for (i = 0; i < S.stars.length; i++) {
      st = S.stars[i];
      g.moveTo(st.x + 1.3, st.y);
      g.arc(st.x, st.y, 1.3, 0, Math.PI * 2);
    }
    g.fill();
  }

  function drawLabels(g, mode) {
    var cnC = dryInk(mode, mode === 'ink' ? 0.64 : 0.56);
    var enC = dryInk(mode, mode === 'ink' ? 0.36 : 0.32);
    var ldC = dryInk(mode, mode === 'ink' ? 0.24 : 0.20);
    var dotC = mode === 'ink' ? rgba(RGB.gold, 0.6) : rgba(RGB.bone, 0.38);
    for (var i = 0; i < S.labels.length; i++) {
      var lb = S.labels[i];
      if (lb.leader) {
        line(g, lb.leader[0], lb.leader[1], lb.leader[2], lb.leader[3], 0.6, ldC);
        g.beginPath();
        g.arc(lb.leader[0], lb.leader[1], 1.3, 0, Math.PI * 2);
        g.fillStyle = dotC;
        g.fill();
      }
      put(g, lb.cn, lb.x, lb.y, cnC, lb.align);
      put(g, lb.en, lb.x, lb.y + 9.5, enC, lb.align);
    }
  }

  function drawBaseLine(g, mode) {
    var p = S.path, i;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(p.pts[0].x, p.pts[0].y);
    for (i = 1; i < p.pts.length; i++) g.lineTo(p.pts[i].x, p.pts[i].y);
    g.lineWidth = 0.8;
    g.strokeStyle = dryInk(mode, mode === 'ink' ? 0.38 : 0.30);
    g.stroke();

    /* 每一更的界标：细十字；不画数字 */
    g.lineWidth = 0.6;
    g.strokeStyle = dryInk(mode, mode === 'ink' ? 0.36 : 0.30);
    g.beginPath();
    for (i = 1; i < p.pts.length - 1; i++) {
      g.moveTo(p.pts[i].x - 2.6, p.pts[i].y);
      g.lineTo(p.pts[i].x + 2.6, p.pts[i].y);
      g.moveTo(p.pts[i].x, p.pts[i].y - 2.6);
      g.lineTo(p.pts[i].x, p.pts[i].y + 2.6);
    }
    g.stroke();
  }

  function drawTrail(g, mode) {
    if (S.prog <= 0.0005) return;
    var p = S.path, i, upto = S.prog * 12;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    /* 干掉的墨底：先铺一层，再叠星金 */
    if (mode === 'ink' && S.dry > 0.01) {
      g.beginPath();
      g.moveTo(p.pts[0].x, p.pts[0].y);
      for (i = 0; i < Math.min(12, Math.floor(upto)); i++) g.lineTo(p.pts[i + 1].x, p.pts[i + 1].y);
      var tip0 = pathAt(S.prog);
      g.lineTo(tip0.x, tip0.y);
      g.lineWidth = 1.0;
      g.strokeStyle = rgba(RGB.ink, 0.30 * S.dry);
      g.stroke();
    }

    g.beginPath();
    g.moveTo(p.pts[0].x, p.pts[0].y);
    for (i = 0; i < Math.min(12, Math.floor(upto)); i++) g.lineTo(p.pts[i + 1].x, p.pts[i + 1].y);
    var tip = pathAt(S.prog);
    g.lineTo(tip.x, tip.y);
    g.lineWidth = mode === 'ink' ? 1.2 - 0.2 * S.dry : 1.2;
    g.strokeStyle = mode === 'ink'
      ? rgba(RGB.gold, 1 - 0.5 * S.dry)
      : rgba(RGB.bone, 0.9);
    g.stroke();

    /* 已完成的更：金点 / 水下的骨点 */
    var lit = Math.floor(S.prog * 12 + 0.0001);
    g.fillStyle = mode === 'ink' ? rgba(RGB.gold, 0.95 - 0.45 * S.dry) : rgba(RGB.bone, 0.75);
    for (i = 1; i <= Math.min(lit, 11); i++) {
      g.beginPath();
      g.arc(p.pts[i].x, p.pts[i].y, 1.8, 0, Math.PI * 2);
      g.fill();
    }

    /* 笔头 */
    if (!S.done && S.mode !== 'dry') {
      var tc = mode === 'ink' ? rgba(RGB.gold, 0.92) : rgba(RGB.bone, 0.72);
      g.beginPath();
      g.arc(tip.x, tip.y, 2.1, 0, Math.PI * 2);
      g.fillStyle = tc;
      g.fill();
      g.beginPath();
      g.arc(tip.x, tip.y, 4.6, 0, Math.PI * 2);
      g.lineWidth = 0.6;
      g.strokeStyle = mode === 'ink' ? rgba(RGB.gold, 0.55) : rgba(RGB.bone, 0.35);
      g.stroke();
    }

    if (S.done) {
      var e = p.pts[p.pts.length - 1];
      g.strokeStyle = mode === 'ink' ? rgba(RGB.gold, 0.95) : rgba(RGB.bone, 0.72);
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(e.x - 4.2, e.y); g.lineTo(e.x + 4.2, e.y);
      g.moveTo(e.x, e.y - 4.2); g.lineTo(e.x, e.y + 4.2);
      g.moveTo(e.x - 2.3, e.y - 2.3); g.lineTo(e.x + 2.3, e.y + 2.3);
      g.moveTo(e.x + 2.3, e.y - 2.3); g.lineTo(e.x - 2.3, e.y + 2.3);
      g.stroke();
    }
  }

  function drawStart(g, mode, s) {
    if (S.done || S.prog > 0.02) return;
    var st = S.path.pts[0];
    var breathe = s.reduced ? 0.65 : 0.45 + 0.28 * Math.sin(s.t * 1.7);
    var col = mode === 'ink' ? rgba(RGB.gold, 0.9) : rgba(RGB.bone, 0.55);
    g.beginPath();
    g.arc(st.x, st.y, 2.3, 0, Math.PI * 2);
    g.fillStyle = col;
    g.fill();
    g.beginPath();
    g.arc(st.x, st.y, 5.5 + (s.reduced ? 0 : 1.6 * (0.5 + 0.5 * Math.sin(s.t * 1.7))), 0, Math.PI * 2);
    g.lineWidth = 0.6;
    g.strokeStyle = mode === 'ink' ? rgba(RGB.gold, breathe) : rgba(RGB.bone, breathe * 0.8);
    g.stroke();
  }

  function drawWord(g, mode, s) {
    if (!S.done) return;
    var b = S.word;
    var t = S.reduced ? 1 : clamp(S.wordT, 0, 1);
    var frameC = mode === 'ink' ? rgba(RGB.gold, 0.62) : rgba(RGB.bone, 0.40);
    var glyphC = mode === 'ink' ? 'rgba(17,19,16,0.90)' : 'rgba(242,236,223,0.86)';
    var microC = mode === 'ink' ? rgba(RGB.gold, 0.78) : rgba(RGB.bone, 0.44);

    if (t > 0.52) {
      var ft = (t - 0.52) / 0.48;
      g.globalAlpha = 0.4 + 0.6 * ft;
      rect(g, b.x, b.y, b.s, b.s, 1.0, frameC);
      var k = 7;
      line(g, b.x - 4, b.y - 4, b.x - 4 + k, b.y - 4, 0.6, frameC);
      line(g, b.x - 4, b.y - 4, b.x - 4, b.y - 4 + k, 0.6, frameC);
      line(g, b.x + b.s + 4, b.y + b.s + 4, b.x + b.s + 4 - k, b.y + b.s + 4, 0.6, frameC);
      line(g, b.x + b.s + 4, b.y + b.s + 4, b.x + b.s + 4, b.y + b.s + 4 - k, 0.6, frameC);
      g.globalAlpha = 1;
      put(g, S.copy.wordCn, b.x, b.y - 9, microC, 'left');
      put(g, S.copy.wordEn, b.x, b.y + b.s + 12, microC, 'left');
    }

    /* 字的露出：横向切片，从下往上；不画第二条水线 */
    var n = 12, vis = Math.ceil(t * n);
    if (vis <= 0) return;
    g.save();
    g.beginPath();
    for (var i = 0; i < vis; i++) {
      var sy = b.y + b.pad + (b.s - b.pad * 2) * i / n;
      g.rect(b.x + b.pad, sy, b.s - b.pad * 2, (b.s - b.pad * 2) / n + 0.8);
    }
    g.clip();
    g.font = fontStr(500, b.fs, SERIF);
    g.fillStyle = glyphC;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(COPY.word, b.x + b.s / 2, b.y + b.s / 2 + 1);
    g.restore();
  }

  /* ---------- copy column ---------- */

  function drawCopy(g, mode, s) {
    var cp = S.copy;
    var inkish = mode === 'ink';

    put(g, cp.kicker, cp.x, cp.kickerY, dryInk(mode, inkish ? 0.52 : 0.46), 'left');
    put(g, cp.enRoute, cp.x + cp.w, cp.kickerY, accent(mode, inkish ? 0.62 : 0.34), 'right');

    put(g, cp.title, cp.x - 2, cp.titleY, inkish ? 'rgba(17,19,16,0.92)' : 'rgba(242,236,223,0.86)', 'left');

    /* 规矩线：细线 + 一小段星金 */
    line(g, cp.x, cp.ruleY, cp.x + cp.w * 0.46, cp.ruleY, 0.6, dryInk(mode, inkish ? 0.22 : 0.18));
    line(g, cp.x, cp.ruleY, cp.x + 26, cp.ruleY, 0.8, accent(mode, inkish ? 0.7 : 0.4));

    var bodyC = inkish ? 'rgba(17,19,16,0.70)' : 'rgba(242,236,223,0.64)';
    putWhole(g, cp.body1, cp.x, cp.body1Y, cp.bodyFs, 400, SERIF, bodyC, 'left');
    putWhole(g, cp.body2, cp.x, cp.body2Y, cp.bodyFs, 400, SERIF, bodyC, 'left');

    /* hint：一个 0.6 的十字 + 中文 + 英文 micro */
    var hx = cp.hintX;
    var hy = cp.hintY;
    line(g, hx - 12, hy - 3, hx - 2, hy - 3, 0.7, accent(mode, inkish ? 0.7 : 0.4));
    line(g, hx - 7, hy - 8, hx - 7, hy + 2, 0.7, accent(mode, inkish ? 0.7 : 0.4));
    put(g, cp.hint, hx, hy, dryInk(mode, inkish ? 0.58 : 0.52), 'left');
    if (!S.narrow) put(g, cp.hintEn, hx, cp.hintEnY, dryInk(mode, inkish ? 0.30 : 0.26), 'left');

    drawStatus(g, mode);
  }

  function drawStatus(g, mode) {
    var cp = S.copy;
    var inkish = mode === 'ink';
    var txt = '';
    if (S.done) txt = '第十二更。';
    else if (S.statusUntil > S.now && S.status) txt = S.status;
    if (txt) {
      putWhole(g, txt, cp.x, cp.statusY, 8.5, 400, SANS,
        dryInk(mode, inkish ? 0.50 : 0.44), 'left');
    }
    var lit = Math.floor(S.prog * 12 + 0.0001);
    if (S.done) lit = 12;
    var read = '更 ' + (lit < 10 ? '0' : '') + lit + ' / 12';
    var rc = S.done
      ? (inkish ? rgba(RGB.gold, 0.82) : rgba(RGB.bone, 0.5))
      : dryInk(mode, inkish ? 0.44 : 0.36);
    g.font = fontStr(400, 7.6, MONO);
    g.fillStyle = rc;
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    g.fillText(read, cp.readoutX, cp.readoutY);
  }

  /* ---------- state machine ---------- */

  function setStatus(txt, dur) {
    S.status = txt;
    S.statusUntil = S.now + dur;
  }

  function startDry() {
    if (S.done) return;
    S.mode = 'dry';
    S.dryT = 0;
    S.target = S.prog;
    S.crossed = false;
    S.sawCat = false;
  }

  function beginTrace(u) {
    S.mode = 'trace';
    S.settleT = 0;
    S.stillT = 0;
    S.offT = 0;
    S.dry = 0;
    S.dryT = 0;
    S.crossed = false;
    S.sawCat = false;
    if (u > S.prog) S.target = u;
    if (S.prog < 0.02) setStatus('从水里起笔。', 2.4);
  }

  function complete() {
    if (S.done) return;
    S.done = true;
    S.mode = 'done';
    S.prog = 1;
    S.target = 1;
    S.wordT = 0;
    S.dry = 0;
    S.status = '';
    S.statusUntil = 0;
    if (!S.granted) {
      S.granted = true;
      var st = S.state;
      if (st && typeof st.onCollect === 'function') {
        try { st.onCollect(COPY.word); } catch (e) { /* 钩子由 Lead 接 */ }
      }
    }
  }

  function update(s) {
    S.state = s;
    S.reduced = !!s.reduced;
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    var raw = now - (S.lastNow || now);
    var dt = clamp(raw, 0, 0.05);
    S.lastNow = now;
    S.now = now;
    if (raw > 0 && raw < 0.2) S.fps = S.fps * 0.92 + (1 / raw) * 0.08;

    var cp = s.pointer;
    var px = cp.x * S.W, py = cp.y * S.H;
    var down = !!cp.down;
    var near = nearest(px, py);
    var tol = S.narrow ? 34 : 46;

    /* QA：?auto=0.7 —— 合成一条手指，沿针路划到 70% 再松开，用来看干掉那一段 */
    if (S.auto > 0 && !S.done) {
      S.autoT += dt;
      var T0 = 0.4, TR = 3.6, au = 0.005, adown = true;
      if (S.autoT >= T0 && S.autoT < T0 + TR) {
        au = 0.005 + (S.auto - 0.005) * ((S.autoT - T0) / TR);
      } else if (S.autoT >= T0 + TR) {
        au = S.auto; adown = false;
      }
      var ap = pathAt(au);
      px = ap.x; py = ap.y; down = adown;
      near = nearest(px, py);
    }

    if (S.debugTrace >= 0) {
      if (S.debugTrace >= 0.999) {
        if (!S.done) complete();
        S.wordT = 1;
        S.prog = 1;
        S.mode = 'done';
        S.dry = 0;
      } else {
        S.prog = S.debugTrace;
        S.target = S.debugTrace;
        S.mode = 'trace';
        S.dry = 0;
      }
      S.status = ''; S.statusUntil = 0;
    } else if (S.mode === 'done') {
      if (!S.reduced) S.wordT = Math.min(1, S.wordT + dt / 0.9);
      else S.wordT = 1;
    } else if (S.mode === 'idle') {
      if (down && !S.lastDown && near.dist <= tol) {
        if (near.u > 0.20) setStatus('从水里起笔。', 2.4);
        else beginTrace(near.u);
      }
      if (S.prog > 0) S.prog = Math.max(0, S.prog - dt / 3.0);
      S.dry = Math.max(0, S.dry - dt / 0.4);
    } else if (S.mode === 'trace') {
      if (!down) {
        S.mode = 'settle';
        S.settleT = 0;
      } else {
        if (near.dist <= tol) {
          S.offT = 0;
          if (near.u > S.target) S.target = near.u;
          if (Math.abs(px - S.lastPx) < 0.8 && Math.abs(py - S.lastPy) < 0.8) S.stillT += dt;
          else S.stillT = 0;
        } else {
          S.offT += dt;
          if (S.offT > 0.5) startDry();
        }
        if (S.mode === 'trace') {
          var dv = S.target - S.prog;
          if (dv > 0.0005) {
            S.prog = Math.min(S.target, S.prog + Math.max(0.0015, 1.9 * dt));
          }
          if (S.stillT > 1.6 && Math.abs(S.target - S.prog) < 0.004) startDry();
          var tip = pathAt(S.prog);
          if (!S.crossed && tip.y < s.lineY) {
            S.crossed = true;
            if (S.prog > 0.06) setStatus('线干了，变成星金。', 2.4);
          }
          if (!S.sawCat && S.prog > 0.93) {
            S.sawCat = true;
            setStatus('猫峙。', 2.0);
          }
          if (S.prog >= 0.999) complete();
        }
      }
    } else if (S.mode === 'settle') {
      S.settleT += dt;
      if (down && near.dist <= tol) {
        S.mode = 'trace';
        S.stillT = 0;
        S.offT = 0;
      } else if (S.settleT > 0.7) {
        startDry();
      }
    } else if (S.mode === 'dry') {
      S.dryT += dt;
      S.dry = clamp(S.dryT / 0.45, 0, 1);
      if (S.dryT > 0.45) S.prog = Math.max(0, S.prog - dt / 2.4);
      if (down && !S.lastDown && near.dist <= tol) {
        beginTrace(near.u);
      } else if (S.prog <= 0.0005) {
        S.mode = 'idle';
        S.dry = 0;
        S.dryT = 0;
        S.prog = 0;
        S.target = 0;
      }
    }

    S.lastPx = px;
    S.lastPy = py;
    S.lastDown = down;
  }

  /* ---------- render ---------- */

  function drawScene(g, mode, s) {
    drawPaper(g, mode);
    drawPlate(g, mode, s);
    drawChartFrame(g, mode);
    drawChartMarks(g, mode);
    drawStars(g, mode);
    drawHeader(g, mode);
    drawCompass(g, mode);
    drawIslands(g, mode);
    drawReef(g, mode);
    drawLedger(g, mode);
    drawBaseLine(g, mode);
    drawTrail(g, mode);
    drawStart(g, mode, s);
    drawLabels(g, mode);
    drawWord(g, mode, s);
    drawCopy(g, mode, s);
  }

  function drawPerf(g) {
    g.font = fontStr(400, 8, MONO);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = S.fps < 45 ? 'rgba(216,80,58,0.9)' : 'rgba(17,19,16,0.65)';
    g.fillText(Math.round(S.fps) + ' FPS · ' + S.drawMs.toFixed(1) + ' ms', 10, 16);
  }

  /* ---------- act ---------- */

  var A = {
    id: '04',
    title: '航线',
    en: 'ROUTE',
    accent: GOLD,

    mount: function (root, ctx) {
      S.root = root;
      S.ctx = ctx;
      S.lastNow = 0;
      var q = (typeof location !== 'undefined' ? location.search : '') || '';
      var mt = /[?&]trace=([\d.]+)/.exec(q);
      if (mt) S.debugTrace = clamp(parseFloat(mt[1]), 0, 1);
      var ma = /[?&]auto=([\d.]+)/.exec(q);
      if (ma) { S.auto = clamp(parseFloat(ma[1]), 0, 1); S.autoT = 0; }
      S.perf = /[?&]perf=1/.test(q);
      loadPlate();
    },

    resize: function (w, h, dpr) {
      S.W = w; S.H = h; S.dpr = dpr;
      rebuild();
    },

    render: function (s) {
      if (!S.ctx || !S.path) return;
      update(s);
      var g = S.ctx.g;
      var lineY = s.lineY;
      var t0 = (typeof performance !== 'undefined') ? performance.now() : 0;

      /* 干：墨 */
      g.save();
      S.ctx.clipAbove(lineY);
      g.clip();
      drawScene(g, 'ink', s);
      g.restore();

      /* 湿：骨白 + 折射 */
      g.save();
      S.ctx.clipBelow(lineY);
      g.clip();
      if (typeof g.filter === 'string') g.filter = 'blur(0.35px)';
      drawScene(g, 'bone', s);
      g.restore();
      if (typeof g.filter === 'string') g.filter = 'none';

      if (t0) {
        var ms = ((typeof performance !== 'undefined') ? performance.now() : 0) - t0;
        S.drawMs = S.drawMs ? S.drawMs * 0.9 + ms * 0.1 : ms;
      }
      if (S.perf) drawPerf(g);
    },

    unmount: function () {
      /* 没有监听器；状态留给下一次 mount。 */
    }
  };

  window.ACTS.register('04', A);
})();
