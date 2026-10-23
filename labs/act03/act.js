/* ============================================================
   ACT 03 · 珊瑚 / CORAL —— R1 scene-only act
   只画：珊瑚、光、卵、极少量图版 label。
   背景 / 水线 / HUD / 章节文案 / 声音 / 收集都在 shell。
   干：墨；湿：骨白 + 折射。水线只用 s.lineY。
   顺序：光停 2s → 开 + 卵升起；移光 → 合上，卵留在水里。
   第一次卵升起时调用 ctx.onCollect('卵')。
   ============================================================ */
(function () {
  'use strict';

  var SERIF = '"Noto Serif SC","Source Han Serif SC","STZhongsong","Songti SC",serif';
  var SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

  var PAL = {
    ink: [17, 19, 16],
    bone: [242, 236, 223],
    live: [226, 69, 47],
    cy: [127, 227, 212]
  };

  var TAU = Math.PI * 2;
  var PAD = 16;

  var S = {
    ctx: null,
    root: null,
    W: 0, H: 0, dpr: 1, narrow: false,
    plate: null,
    geo: null,
    layers: null,
    polyps: [],
    spawn: [],
    eggs: [],
    flashes: [],
    light: null,
    reduced: false,
    needSeed: true,
    seeded: false,
    spawnClock: 0,
    lastT: 0,
    collected: false,
    mounted: false
  };

  /* ---------------- 基础 ---------------- */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length !== 6) return null;
    var n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }

  function applyPalette(ctx) {
    if (!ctx || !ctx.palette) return;
    PAL.ink = hexToRgb(ctx.palette.ink) || PAL.ink;
    PAL.bone = hexToRgb(ctx.palette.bone) || PAL.bone;
  }

  function drawTracked(g, text, x, y, fs, track, base) {
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = '400 ' + fs + 'px ' + (base || SERIF);
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      g.fillText(ch, x, y);
      x += g.measureText(ch).width + track;
    }
  }

  /* ---------------- 版面 ---------------- */

  function layoutPlate() {
    var W = S.W, H = S.H, narrow = S.narrow;
    var w, h, cx, baseScreenY;
    if (narrow) {
      w = Math.min(W * 0.70, H * 0.55);
      h = Math.min(H * 0.60, w * 1.85);
      cx = W * 0.60;
      baseScreenY = H * 0.93;
    } else {
      w = Math.min(W * 0.62, H * 1.0);
      h = Math.min(H * 0.68, w * 0.78);
      cx = W * 0.62;
      baseScreenY = H * 0.93;
    }
    return {
      x: cx - w / 2,
      y: baseScreenY - h * 0.92,
      w: w,
      h: h,
      baseX: w * 0.52,
      baseY: h * 0.92,
      narrow: narrow
    };
  }

  /* ---------------- 珊瑚几何 ---------------- */

  function addBranch(g, x0, y0, ang, len, wid, depth, rand, geo, maxDepth, budget) {
    if (geo.branches.length - budget.start >= budget.max) return;

    var bend = (rand() - 0.5) * 0.55;
    var ex = x0 + Math.cos(ang) * len;
    var ey = y0 + Math.sin(ang) * len;
    var nx = -Math.sin(ang), ny = Math.cos(ang);
    var curve = (rand() - 0.5) * len * 0.30;

    var c1x = x0 + Math.cos(ang + bend * 0.5) * len * 0.42 + nx * curve * 0.55;
    var c1y = y0 + Math.sin(ang + bend * 0.5) * len * 0.42 + ny * curve * 0.55;
    var c2x = ex - Math.cos(ang - bend * 0.55) * len * 0.32 + nx * curve * 0.85;
    var c2y = ey - Math.sin(ang - bend * 0.55) * len * 0.32 + ny * curve * 0.85;

    var N = 8;
    var left = [], right = [], spine = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N, mu = 1 - u;
      var x = mu * mu * mu * x0 + 3 * mu * mu * u * c1x + 3 * mu * u * u * c2x + u * u * u * ex;
      var y = mu * mu * mu * y0 + 3 * mu * mu * u * c1y + 3 * mu * u * u * c2y + u * u * u * ey;
      var tx = 3 * mu * mu * (c1x - x0) + 6 * mu * u * (c2x - c1x) + 3 * u * u * (ex - c2x);
      var ty = 3 * mu * mu * (c1y - y0) + 6 * mu * u * (c2y - c1y) + 3 * u * u * (ey - c2y);
      var tl = Math.hypot(tx, ty) || 1;
      var nnx = -ty / tl, nny = tx / tl;
      var ww = Math.max(0.60, wid * (1 - 0.72 * u));
      left.push([x + nnx * ww, y + nny * ww]);
      right.push([x - nnx * ww, y - nny * ww]);
      spine.push([x, y]);
    }

    var wTip = Math.max(0.45, wid * 0.22);
    var tip = [ex + Math.cos(ang) * wTip * 1.15, ey + Math.sin(ang) * wTip * 1.15];
    var poly = left.concat([tip]);
    for (var q = right.length - 1; q >= 0; q--) poly.push(right[q]);

    geo.branches.push({ poly: poly, spine: spine, wid: wid, depth: depth, tip: tip });
    geo.tips.push({ x: tip[0], y: tip[1], r: Math.max(1.15, wTip * 1.35) });

    var pn = 2 + (rand() < 0.55 ? 1 : 0);
    for (var k = 0; k < pn; k++) {
      var uu = clamp(0.30 + k * 0.23 + rand() * 0.06, 0.2, 0.92);
      var idx = Math.round(uu * N);
      var sp = spine[idx];
      var sa = spine[Math.min(N, idx + 1)], sb = spine[Math.max(0, idx - 1)];
      var sx = sa[0] - sb[0], sy = sa[1] - sb[1];
      var sl = Math.hypot(sx, sy) || 1;
      var side = (k % 2 === 0 ? 1 : -1);
      var pr = Math.max(0.50, wid * 0.21 * (1 - uu * 0.45));
      geo.polyps.push({
        x: sp[0] + (-sy / sl) * side * pr * 0.9,
        y: sp[1] + (sx / sl) * side * pr * 0.9,
        r: pr,
        kind: 'branch',
        tip: false
      });
    }
    geo.polyps.push({ x: tip[0], y: tip[1], r: Math.max(0.72, wTip * 1.25), kind: 'tip', tip: true });
    geo.spawn.push({ x: tip[0], y: tip[1], depth: depth });

    if (depth >= maxDepth) return;

    if (depth < 2 && rand() < 0.64 && geo.branches.length - budget.start < budget.max) {
      var mid = spine[Math.round(N * (0.56 + rand() * 0.22))];
      var ma = clamp(ang + (rand() < 0.5 ? -1.10 : 1.10) + bend * 0.35, -2.68, -0.42);
      var mlen = len * (0.30 + rand() * 0.16);
      addBranch(g, mid[0], mid[1], ma, mlen, Math.max(1.2, wid * 0.46),
        depth + 1, rand, geo, maxDepth, budget);
    }

    var children = depth === 0 ? 3 : (rand() < 0.45 ? 3 : 2);
    var spread = 0.62 + rand() * 0.26;
    for (var j = 0; j < children; j++) {
      if (geo.branches.length - budget.start >= budget.max) break;
      var off = (j - (children - 1) / 2) * spread + (rand() - 0.5) * 0.15;
      var ca = clamp(ang + bend * 0.7 + off, -2.72, -0.36);
      var clen = len * (0.46 + rand() * 0.14);
      var cwid = Math.max(1.45, wid * 0.62);
      addBranch(g, ex - Math.cos(ang) * len * 0.02, ey - Math.sin(ang) * len * 0.02,
        ca, clen, cwid, depth + 1, rand, geo, maxDepth, budget);
    }
  }

  function buildFan(geo, w, h, rand) {
    var baseX = w * 0.855;
    var baseY = h * 0.905;
    var n = S.narrow ? 6 : 10;
    var rx = w * (S.narrow ? 0.105 : 0.13);
    var ry = h * (S.narrow ? 0.25 : 0.33);
    var ribs = [];

    for (var i = 0; i < n; i++) {
      var a = -2.42 + (1.62 * (i / (n - 1)));
      var len = ry * (0.88 + 0.12 * Math.sin(i * 1.7 + 0.4));
      var ex = baseX + Math.cos(a) * len * 0.62;
      var ey = baseY + Math.sin(a) * len;
      var c1x = baseX + Math.cos(a) * len * 0.30 + Math.cos(a - 0.35) * rx * 0.22;
      var c1y = baseY + Math.sin(a) * len * 0.32;
      var c2x = baseX + Math.cos(a) * len * 0.58 + Math.cos(a + 0.25) * rx * 0.18;
      var c2y = baseY + Math.sin(a) * len * 0.60;
      var pts = [];
      for (var k = 0; k <= 12; k++) {
        var u = k / 12, mu = 1 - u;
        var x = mu * mu * mu * baseX + 3 * mu * mu * u * c1x + 3 * mu * u * u * c2x + u * u * u * ex;
        var y = mu * mu * mu * baseY + 3 * mu * mu * u * c1y + 3 * mu * u * u * c2y + u * u * u * ey;
        pts.push([x, y]);
      }
      ribs.push(pts);
      if (!S.narrow) {
        var p = pts[8];
        geo.polyps.push({ x: p[0] + 1.2, y: p[1], r: 0.62, kind: 'fan', tip: false });
        var p2 = pts[11];
        geo.polyps.push({ x: p2[0] - 1.4, y: p2[1], r: 0.55, kind: 'fan', tip: false });
      }
    }

    var envelope = [[baseX, baseY]];
    for (var e = 0; e < n; e++) envelope.push(ribs[e][12]);
    envelope.push([baseX, baseY]);

    var cross = [];
    var fr = [0.34, 0.55, 0.76, 0.92];
    for (var f = 0; f < fr.length; f++) {
      var line = [];
      var uu = fr[f];
      for (var r = 0; r < n; r++) line.push(ribs[r][Math.round(uu * 12)]);
      cross.push(line);
    }

    geo.fan = { base: [baseX, baseY], ribs: ribs, envelope: envelope, cross: cross };
  }

  function buildBrain(geo, w, h, rand) {
    var cx = w * (S.narrow ? 0.16 : 0.17);
    var cy = h * 0.905;
    var rx = w * (S.narrow ? 0.108 : 0.118);
    var ry = h * (S.narrow ? 0.062 : 0.088);
    var outline = [];
    var steps = 22;
    for (var i = 0; i <= steps; i++) {
      var a = Math.PI - (Math.PI * (i / steps));
      var wob = 1 + 0.055 * Math.sin(i * 2.2 + 1.4);
      outline.push([cx + Math.cos(a) * rx * wob, cy - Math.sin(a) * ry * 1.35 * wob]);
    }
    for (var b = 1; b <= 6; b++) {
      var bx = cx + rx - (2 * rx) * (b / 7);
      outline.push([bx, cy + Math.sin(b * 1.5) * ry * 0.06]);
    }

    var meander = [];
    var nLines = S.narrow ? 4 : 6;
    for (var j = 0; j < nLines; j++) {
      var y0 = cy - ry * 0.92 + (j / Math.max(1, nLines - 1)) * ry * 1.12;
      var line = [];
      for (var x = cx - rx * 0.86; x <= cx + rx * 0.86; x += Math.max(3, rx * 0.12)) {
        var yy = y0
          + Math.sin((x - cx) * (0.055 + j * 0.004) + j * 1.9) * ry * 0.18
          + Math.sin((x - cx) * 0.17 - j * 0.8) * ry * 0.06;
        line.push([x, yy]);
      }
      meander.push(line);
    }
    for (var v = 0; v < 3; v++) {
      var vx = cx - rx * 0.5 + (v / 2) * rx * 0.5;
      var line2 = [];
      for (var y = cy - ry * 1.2; y <= cy + ry * 0.05; y += Math.max(3, ry * 0.14)) {
        line2.push([vx + Math.sin((y - cy) * 0.09 + v * 2.1) * rx * 0.10, y]);
      }
      meander.push(line2);
    }

    var count = S.narrow ? 10 : 18;
    for (var p = 0; p < count; p++) {
      var ang = rand() * TAU;
      var rr = Math.sqrt(rand());
      geo.polyps.push({
        x: cx + Math.cos(ang) * rx * 0.72 * rr,
        y: cy - Math.abs(Math.sin(ang)) * ry * 0.82 * rr,
        r: 0.62,
        kind: 'brain',
        tip: false
      });
    }

    geo.brain = { outline: outline, meander: meander, cx: cx, cy: cy, rx: rx, ry: ry };
    geo.spawn.push({ x: cx, y: cy - ry * 0.65, depth: 1 });
    geo.spawn.push({ x: cx - rx * 0.35, y: cy - ry * 0.35, depth: 1 });
  }

  function buildTubes(geo, w, h, rand) {
    var n = S.narrow ? 3 : 5;
    var baseX = w * 0.715;
    var baseY = h * 0.915;
    var tubes = [];
    for (var i = 0; i < n; i++) {
      var bx = baseX + (i - (n - 1) / 2) * w * 0.017 + (rand() - 0.5) * w * 0.008;
      var hh = h * (0.095 + rand() * 0.08);
      var ww = Math.max(2.2, w * 0.0075) * (0.8 + rand() * 0.4);
      var lean = (rand() - 0.5) * w * 0.02;
      var left = [], right = [];
      for (var k = 0; k <= 6; k++) {
        var u = k / 6;
        var x = bx + lean * u * u;
        var y = baseY - hh * u;
        var half = ww * (0.62 + 0.38 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5));
        left.push([x - half, y]);
        right.push([x + half, y]);
      }
      var mouth = { x: bx + lean, y: baseY - hh, rx: ww, ry: Math.max(0.9, ww * 0.32) };
      tubes.push({ left: left, right: right, mouth: mouth });
      for (var p = 0; p < 3; p++) {
        var aa = p / 3 * TAU + 0.4;
        geo.polyps.push({
          x: mouth.x + Math.cos(aa) * ww * 0.72,
          y: mouth.y + Math.sin(aa) * mouth.ry * 0.6,
          r: 0.55,
          kind: 'tube',
          tip: false
        });
      }
      geo.spawn.push({ x: mouth.x, y: mouth.y, depth: 2 });
    }
    geo.tubes = tubes;
  }

  function buildRock(geo, w, h, rand) {
    var top = [];
    var n = 18;
    for (var i = 0; i <= n; i++) {
      var x = w * (0.015 + 0.97 * (i / n));
      var y = h * (0.906
        + 0.010 * Math.sin(i * 2.3 + 0.7)
        + 0.008 * Math.sin(i * 0.9 + 2.1));
      top.push([x, y]);
    }
    var poly = top.slice();
    poly.push([w, h]);
    poly.push([0, h]);

    var strata = [];
    for (var s = 0; s < 3; s++) {
      var line = [];
      for (var x2 = w * 0.02; x2 <= w * 0.98; x2 += w * 0.045) {
        line.push([x2, h * (0.946 + s * 0.020)
          + Math.sin(x2 * 0.055 + s * 1.9) * h * 0.004]);
      }
      strata.push(line);
    }

    var cracks = [];
    for (var c = 0; c < 3; c++) {
      var cx = w * (0.18 + c * 0.28 + rand() * 0.06);
      var line2 = [];
      for (var q = 0; q <= 4; q++) {
        line2.push([cx + Math.sin(q * 1.7 + c) * w * 0.005, h * (0.912 + q * 0.014)]);
      }
      cracks.push(line2);
    }

    var pebbles = [];
    for (var p = 0; p < 5; p++) {
      pebbles.push({
        x: w * (0.08 + rand() * 0.86),
        y: h * (0.918 + rand() * 0.018),
        rx: 1.5 + rand() * 3.2,
        ry: 0.8 + rand() * 1.5
      });
    }

    var algae = [];
    for (var a = 0; a < 2; a++) {
      var ax = w * (a === 0 ? 0.28 : 0.79);
      var stems = [];
      for (var k = 0; k < 3; k++) {
        var pts = [];
        for (var m = 0; m <= 4; m++) {
          pts.push([
            ax + (k - 1) * w * 0.005 + Math.sin(m * 1.5 + k) * w * 0.004,
            h * 0.906 - m * h * 0.018
          ]);
        }
        stems.push(pts);
      }
      algae.push(stems);
    }

    geo.rock = { poly: poly, top: top, strata: strata, cracks: cracks, pebbles: pebbles, algae: algae };
  }

  function buildGeo(plate) {
    var w = plate.w, h = plate.h;
    var rand = mulberry32(0x51ED + Math.round(w) * 7 + Math.round(h) * 13);
    var geo = {
      branches: [], tips: [], polyps: [], spawn: [],
      fan: null, brain: null, tubes: [], rock: null, labels: []
    };

    var bx = plate.baseX, by = plate.baseY;
    var maxDepth = 3;
    var trunks = S.narrow ? [
      { dx: -0.035, ang: -1.98, len: 0.37, wid: 7.2, share: 0.80 },
      { dx: 0.010, ang: -1.54, len: 0.43, wid: 8.6, share: 1.00 },
      { dx: 0.052, ang: -1.12, len: 0.37, wid: 6.9, share: 0.82 }
    ] : [
      { dx: -0.062, ang: -2.16, len: 0.31, wid: 7.0, share: 0.72 },
      { dx: -0.020, ang: -1.84, len: 0.37, wid: 8.5, share: 0.90 },
      { dx: 0.014, ang: -1.52, len: 0.43, wid: 9.8, share: 1.00 },
      { dx: 0.055, ang: -1.19, len: 0.36, wid: 7.5, share: 0.90 },
      { dx: 0.094, ang: -0.93, len: 0.29, wid: 5.8, share: 0.72 }
    ];

    var baseBudget = S.narrow ? 30 : 38;
    for (var i = 0; i < trunks.length; i++) {
      var t = trunks[i];
      var budget = {
        start: geo.branches.length,
        max: Math.max(8, Math.round(baseBudget * t.share))
      };
      addBranch(null,
        bx + t.dx * w + (rand() - 0.5) * w * 0.012,
        by - rand() * h * 0.012,
        t.ang + (rand() - 0.5) * 0.06,
        t.len * h,
        t.wid,
        0, rand, geo, maxDepth, budget);
    }

    var trunkList = [];
    for (var ti = 0; ti < geo.branches.length; ti++) {
      if (geo.branches[ti].depth === 0) trunkList.push(geo.branches[ti]);
    }

    /* 低处分枝 */
    for (var li = 0; li < trunkList.length; li++) {
      var tb = trunkList[li];
      var uu = 0.30 + (li % 3) * 0.10;
      var sp0 = tb.spine[Math.round(uu * (tb.spine.length - 1))];
      var outward = sp0[0] < bx ? -2.30 : -0.84;
      var aa2 = outward + (rand() - 0.5) * 0.28;
      var lb = { start: geo.branches.length, max: S.narrow ? 3 : 4 };
      addBranch(null, sp0[0], sp0[1], aa2,
        h * (S.narrow ? 0.07 + rand() * 0.03 : 0.10 + rand() * 0.05),
        Math.max(1.6, tb.wid * 0.50), 1, rand, geo, 2, lb);
    }

    /* 横向枝：让珊瑚向两侧铺开，不再只向上长 */
    var hspecs = S.narrow ? [
      { ti: 0, u: 0.42, ang: -2.80, len: 0.065, wid: 0.44 },
      { ti: 1, u: 0.55, ang: -0.40, len: 0.070, wid: 0.46 },
      { ti: 2, u: 0.38, ang: -2.55, len: 0.055, wid: 0.40 }
    ] : [
      { ti: 0, u: 0.40, ang: -2.82, len: 0.115, wid: 0.48 },
      { ti: 1, u: 0.55, ang: -0.38, len: 0.125, wid: 0.50 },
      { ti: 3, u: 0.48, ang: -0.55, len: 0.110, wid: 0.46 },
      { ti: 4, u: 0.34, ang: -2.60, len: 0.100, wid: 0.44 }
    ];
    for (var hi = 0; hi < hspecs.length; hi++) {
      var hs = hspecs[hi];
      if (!trunkList[hs.ti]) continue;
      var hb = trunkList[hs.ti];
      var hsp = hb.spine[Math.round(hs.u * (hb.spine.length - 1))];
      var hbudget = { start: geo.branches.length, max: S.narrow ? 2 : 3 };
      addBranch(null, hsp[0], hsp[1], hs.ang, h * hs.len,
        Math.max(1.5, hb.wid * hs.wid), 1, rand, geo, 2, hbudget);
    }

    /* 顶端短芽 */
    var topBranches = [];
    for (var tbi = 0; tbi < geo.branches.length; tbi++) {
      if (geo.branches[tbi].depth === maxDepth) topBranches.push(geo.branches[tbi]);
    }
    var nubCount = 0;
    for (var tbj = 0; tbj < topBranches.length && nubCount < 88; tbj++) {
      var tbr = topBranches[tbj];
      var tsp = tbr.spine;
      var last = tsp[tsp.length - 1];
      var prev = tsp[tsp.length - 2];
      var tang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      for (var nub = 0; nub < 2 && nubCount < 88; nub++) {
        var nb = { start: geo.branches.length, max: 1 };
        var na = clamp(tang + (nub === 0 ? -0.58 : 0.58) + (rand() - 0.5) * 0.2, -2.75, -0.35);
        var pBefore = geo.polyps.length;
        var sBefore = geo.spawn.length;
        addBranch(null, last[0], last[1], na,
          h * (0.017 + rand() * 0.012),
          Math.max(0.85, tbr.wid * 0.52),
          maxDepth, rand, geo, maxDepth, nb);
        geo.polyps.length = pBefore;
        geo.spawn.length = sBefore;
        nubCount++;
      }
    }

    geo.holdfast = [];
    for (var hf = 0; hf < 6; hf++) {
      var hx = bx + (hf - 2.5) * w * 0.022;
      geo.holdfast.push([
        [hx, by - h * 0.005],
        [hx + (hf - 2.5) * w * 0.004, by + h * 0.018],
        [hx + (hf - 2.5) * w * 0.010, by + h * 0.026]
      ]);
    }

    buildTubes(geo, w, h, rand);
    buildBrain(geo, w, h, rand);
    buildFan(geo, w, h, rand);
    buildRock(geo, w, h, rand);

    if (!S.narrow) {
      geo.labels.push({
        cn: '鹿角珊瑚', en: 'STAGHORN CORAL',
        x: w * 0.052, y: h * 0.505,
        ax: w * 0.315, ay: h * 0.585
      });
      geo.labels.push({
        cn: '脑珊瑚', en: 'BRAIN CORAL',
        x: w * 0.038, y: h * 0.795,
        ax: w * 0.170, ay: h * 0.870
      });
    }

    geo.polyps = geo.polyps.filter(function (p) {
      return p.x > -2 && p.x < w + 2 && p.y > h * 0.02 && p.y < h + 2;
    });
    geo.spawn = geo.spawn.filter(function (p) {
      return p.x > 0 && p.x < w && p.y > h * 0.04 && p.y < h;
    });
    return geo;
  }

  /* ---------------- 静态珊瑚 ---------------- */

  function paintBranches(g, geo, mode) {
    var ink = mode === 'ink';
    var line = ink ? rgba(PAL.ink, 0.82) : rgba(PAL.bone, 0.68);
    var soft = ink ? rgba(PAL.ink, 0.34) : rgba(PAL.bone, 0.34);
    var fill = ink ? rgba(PAL.ink, 0.036) : rgba(PAL.bone, 0.041);

    if (!ink) {
      g.save();
      g.strokeStyle = 'rgba(164,240,222,0.030)';
      g.lineWidth = 3.4;
      for (var q = 0; q < geo.branches.length; q++) {
        var bp = geo.branches[q].poly;
        g.beginPath();
        g.moveTo(bp[0][0], bp[0][1]);
        for (var z = 1; z < bp.length; z++) g.lineTo(bp[z][0], bp[z][1]);
        g.closePath();
        g.stroke();
      }
      g.restore();
    }

    g.beginPath();
    for (var i = 0; i < geo.branches.length; i++) {
      var p = geo.branches[i].poly;
      g.moveTo(p[0][0], p[0][1]);
      for (var k = 1; k < p.length; k++) g.lineTo(p[k][0], p[k][1]);
      g.closePath();
    }
    for (var t = 0; t < geo.tips.length; t++) {
      var tip = geo.tips[t];
      g.moveTo(tip.x + tip.r, tip.y);
      g.arc(tip.x, tip.y, tip.r, 0, TAU);
    }
    g.fillStyle = fill;
    g.fill();

    g.strokeStyle = line;
    g.lineWidth = 1.08;
    for (var a = 0; a < geo.branches.length; a++) {
      var pp = geo.branches[a].poly;
      g.beginPath();
      g.moveTo(pp[0][0], pp[0][1]);
      for (var b = 1; b < pp.length; b++) g.lineTo(pp[b][0], pp[b][1]);
      g.closePath();
      g.stroke();
    }
    for (var c = 0; c < geo.tips.length; c++) {
      var tp = geo.tips[c];
      g.beginPath();
      g.arc(tp.x, tp.y, tp.r, 0, TAU);
      g.stroke();
    }

    g.strokeStyle = soft;
    g.lineWidth = 0.55;
    g.globalAlpha = ink ? 0.55 : 0.65;
    for (var d = 0; d < geo.branches.length; d++) {
      var sp = geo.branches[d].spine;
      g.beginPath();
      g.moveTo(sp[0][0], sp[0][1]);
      for (var e = 1; e < sp.length; e++) g.lineTo(sp[e][0], sp[e][1]);
      g.stroke();
    }
    g.globalAlpha = 1;

    g.strokeStyle = soft;
    g.lineWidth = 0.8;
    for (var f = 0; f < geo.holdfast.length; f++) {
      var pts = geo.holdfast[f];
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      g.stroke();
    }
  }

  function paintFan(g, geo, mode) {
    if (!geo.fan) return;
    var ink = mode === 'ink';
    var soft = ink ? rgba(PAL.ink, 0.40) : rgba(PAL.bone, 0.38);
    var faint = ink ? rgba(PAL.ink, 0.22) : rgba(PAL.bone, 0.24);
    var fill = ink ? rgba(PAL.ink, 0.032) : rgba(PAL.bone, 0.036);

    var env = geo.fan.envelope;
    g.beginPath();
    g.moveTo(env[0][0], env[0][1]);
    for (var i = 1; i < env.length; i++) g.lineTo(env[i][0], env[i][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();

    g.strokeStyle = soft;
    g.lineWidth = 0.82;
    for (var r = 0; r < geo.fan.ribs.length; r++) {
      var pts = geo.fan.ribs[r];
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
      g.stroke();
    }

    g.strokeStyle = faint;
    g.lineWidth = 0.62;
    for (var c = 0; c < geo.fan.cross.length; c++) {
      var line = geo.fan.cross[c];
      g.beginPath();
      g.moveTo(line[0][0], line[0][1]);
      for (var l = 1; l < line.length; l++) {
        var prev = line[l - 1], cur = line[l];
        g.quadraticCurveTo(prev[0], prev[1] + 1.5, (prev[0] + cur[0]) / 2, (prev[1] + cur[1]) / 2);
      }
      g.stroke();
    }
  }

  function tracePoly(g, poly) {
    g.beginPath();
    g.moveTo(poly[0][0], poly[0][1]);
    for (var i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
    g.closePath();
  }

  function paintBrain(g, geo, mode) {
    if (!geo.brain) return;
    var ink = mode === 'ink';
    var line = ink ? rgba(PAL.ink, 0.78) : rgba(PAL.bone, 0.68);
    var soft = ink ? rgba(PAL.ink, 0.30) : rgba(PAL.bone, 0.32);
    var fill = ink ? rgba(PAL.ink, 0.036) : rgba(PAL.bone, 0.040);
    var br = geo.brain;
    tracePoly(g, br.outline);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = 1.04;
    g.stroke();

    g.save();
    tracePoly(g, br.outline);
    g.clip();
    g.strokeStyle = soft;
    g.lineWidth = 0.72;
    for (var i = 0; i < br.meander.length; i++) {
      var line2 = br.meander[i];
      g.beginPath();
      g.moveTo(line2[0][0], line2[0][1]);
      for (var k = 1; k < line2.length; k++) g.lineTo(line2[k][0], line2[k][1]);
      g.stroke();
    }
    g.restore();
  }

  function paintTubes(g, geo, mode) {
    var ink = mode === 'ink';
    var line = ink ? rgba(PAL.ink, 0.78) : rgba(PAL.bone, 0.66);
    var soft = ink ? rgba(PAL.ink, 0.32) : rgba(PAL.bone, 0.32);
    var fill = ink ? rgba(PAL.ink, 0.038) : rgba(PAL.bone, 0.042);

    for (var i = 0; i < geo.tubes.length; i++) {
      var t = geo.tubes[i];
      g.beginPath();
      g.moveTo(t.left[0][0], t.left[0][1]);
      for (var l = 1; l < t.left.length; l++) g.lineTo(t.left[l][0], t.left[l][1]);
      for (var r = t.right.length - 1; r >= 0; r--) g.lineTo(t.right[r][0], t.right[r][1]);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = line;
      g.lineWidth = 1.0;
      g.stroke();

      g.beginPath();
      g.ellipse(t.mouth.x, t.mouth.y, t.mouth.rx, t.mouth.ry, 0, 0, TAU);
      g.strokeStyle = soft;
      g.lineWidth = 0.84;
      g.stroke();
    }
  }

  function paintRock(g, geo, mode) {
    if (!geo.rock) return;
    var ink = mode === 'ink';
    var line = ink ? rgba(PAL.ink, 0.70) : rgba(PAL.bone, 0.64);
    var soft = ink ? rgba(PAL.ink, 0.28) : rgba(PAL.bone, 0.26);
    var faint = ink ? rgba(PAL.ink, 0.20) : rgba(PAL.bone, 0.20);
    var fill = ink ? rgba(PAL.ink, 0.032) : rgba(PAL.bone, 0.036);
    var rock = geo.rock;

    tracePoly(g, rock.poly);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = 1.04;
    g.stroke();

    g.strokeStyle = soft;
    g.lineWidth = 0.7;
    for (var i = 0; i < rock.strata.length; i++) {
      var line2 = rock.strata[i];
      g.beginPath();
      g.moveTo(line2[0][0], line2[0][1]);
      for (var k = 1; k < line2.length; k++) g.lineTo(line2[k][0], line2[k][1]);
      g.stroke();
    }
    for (var c = 0; c < rock.cracks.length; c++) {
      var cs = rock.cracks[c];
      g.beginPath();
      g.moveTo(cs[0][0], cs[0][1]);
      for (var q = 1; q < cs.length; q++) g.lineTo(cs[q][0], cs[q][1]);
      g.stroke();
    }
    g.strokeStyle = faint;
    g.lineWidth = 0.65;
    for (var p = 0; p < rock.pebbles.length; p++) {
      var pb = rock.pebbles[p];
      g.beginPath();
      g.ellipse(pb.x, pb.y, pb.rx, pb.ry, 0.2, 0, TAU);
      g.stroke();
    }
    for (var a = 0; a < rock.algae.length; a++) {
      var stems = rock.algae[a];
      for (var s = 0; s < stems.length; s++) {
        var pts = stems[s];
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (var m = 1; m < pts.length; m++) g.lineTo(pts[m][0], pts[m][1]);
        g.stroke();
      }
    }
  }

  function paintLabels(g, geo, mode) {
    for (var i = 0; i < geo.labels.length; i++) {
      var l = geo.labels[i];
      var ink = mode === 'ink';
      var a = ink ? 0.58 : 0.54;
      g.strokeStyle = ink ? 'rgba(17,19,16,0.34)' : 'rgba(242,236,223,0.34)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(l.x + 58, l.y - 1);
      g.lineTo(l.ax - 6, l.ay);
      g.stroke();
      g.fillStyle = ink ? 'rgba(17,19,16,0.62)' : 'rgba(242,236,223,0.58)';
      g.beginPath();
      g.arc(l.ax, l.ay, 1.1, 0, TAU);
      g.fill();

      g.fillStyle = ink ? 'rgba(17,19,16,' + a + ')' : 'rgba(242,236,223,' + a + ')';
      drawTracked(g, l.cn, l.x, l.y + 3, 7.8, 0.7, SERIF);
      g.fillStyle = ink ? 'rgba(17,19,16,0.34)' : 'rgba(242,236,223,0.32)';
      drawTracked(g, l.en, l.x, l.y + 12, 5.8, 0.75, SANS);
    }
  }

  function paintCoralLayer(mode) {
    var pl = S.plate;
    var w = pl.w + PAD * 2;
    var h = pl.h + PAD * 2;
    var c = makeCanvas(w * S.dpr, h * S.dpr);
    var g = c.getContext('2d');
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.translate(PAD, PAD);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    paintFan(g, S.geo, mode);
    paintRock(g, S.geo, mode);
    paintBrain(g, S.geo, mode);
    paintTubes(g, S.geo, mode);
    paintBranches(g, S.geo, mode);
    paintLabels(g, S.geo, mode);
    return c;
  }

  function buildCoral() {
    var pl = layoutPlate();
    S.plate = pl;
    S.geo = buildGeo(pl);
    var meta = {
      originX: pl.x - PAD,
      originY: pl.y - PAD,
      w: pl.w + PAD * 2,
      h: pl.h + PAD * 2
    };
    S.layers = {
      ink: paintCoralLayer('ink'),
      bone: paintCoralLayer('bone'),
      meta: meta
    };
    S.polyps = S.geo.polyps.map(function (p) {
      return {
        x: pl.x + p.x,
        y: pl.y + p.y,
        r: p.r,
        kind: p.kind,
        tip: p.tip,
        wake: 0
      };
    });
    S.spawn = S.geo.spawn.map(function (p) {
      return { x: pl.x + p.x, y: pl.y + p.y };
    });
  }

  /* ---------------- 光 / 虫 / 卵 ---------------- */

  function isOverCoral(x, y, line) {
    var p = S.plate;
    if (!p) return false;
    return x > p.x - 20 && x < p.x + p.w + 20 &&
      y > Math.max(p.y, line + 8) && y < p.y + p.h + 20;
  }

  function initLight() {
    S.light = {
      x: S.W * 0.62,
      y: S.H * 0.58,
      tx: S.W * 0.62,
      ty: S.H * 0.58,
      r: 120,
      open: 0,
      overCoral: false,
      initialized: false,
      lastInput: 0,
      lastMove: 0,
      lastRawX: 0,
      lastRawY: 0,
      burst: false
    };
  }

  function updateLight(s) {
    var L = S.light;
    var line = s.lineY;
    L.r = clamp(Math.min(S.W, S.H) * 0.235, 78, 195);

    var rawX = s.pointer.x * S.W;
    var rawY = s.pointer.y * S.H;

    if (!L.initialized) {
      L.lastRawX = rawX;
      L.lastRawY = rawY;
      /* 初始光落在珊瑚上方；pointer 在水上时也不让光停在纸上 */
      var ix = S.plate ? S.plate.x + S.plate.w * 0.5 : rawX;
      var iy = rawY < line + 60 ? line + 60 : rawY;
      iy = Math.min(iy, S.H - 24);
      L.x = L.tx = ix;
      L.y = L.ty = iy;
      L.initialized = true;
      L.lastInput = s.t;
      L.lastMove = s.t;
    }

    if (S.reduced) {
      L.overCoral = isOverCoral(L.x, L.y, line);
      L.open = L.overCoral ? 0.80 : 0.50;
      return;
    }

    var rawMoved = Math.hypot(rawX - L.lastRawX, rawY - L.lastRawY);
    if (rawMoved > 0.6) {
      L.lastRawX = rawX;
      L.lastRawY = rawY;
      L.tx = rawX;
      L.ty = rawY;
      L.lastInput = s.t;
      L.lastMove = s.t;
      L.burst = false;
    } else if (s.t - L.lastInput > 7) {
      var p = S.plate;
      var ax = p.x + p.w * (0.42 + 0.17 * Math.sin(s.t * 0.085));
      var ay = Math.max(line + 70, p.y + p.h * (0.55 + 0.13 * Math.sin(s.t * 0.062 + 1.7)));
      ay = Math.min(ay, S.H - 30);
      L.tx = ax;
      L.ty = ay;
      L.lastMove = s.t;
    }

    L.x += (L.tx - L.x) * 0.12;
    L.y += (L.ty - L.y) * 0.12;
    if (Math.abs(L.tx - L.x) < 0.05) L.x = L.tx;
    if (Math.abs(L.ty - L.y) < 0.05) L.y = L.ty;

    L.overCoral = isOverCoral(L.x, L.y, line);
    var dwell = s.t - L.lastMove;
    var target = L.overCoral ? (dwell > 2 ? 1 : (dwell > 0.7 ? 0.35 : 0.08)) : 0;
    var rate = target > L.open ? 0.055 : 0.09;
    L.open += (target - L.open) * rate;
    if (L.overCoral && dwell > 2 && !L.burst) {
      L.burst = true;
      releaseBurst();
    }
  }

  function releaseBurst() {
    if (!S.seeded) return;
    var L = S.light;
    if (!L) return;
    var near = [];
    for (var i = 0; i < S.spawn.length; i++) {
      var sp = S.spawn[i];
      var d = Math.hypot(sp.x - L.x, sp.y - L.y);
      if (d < L.r * 1.9) near.push({ p: sp, d: d });
    }
    near.sort(function (a, b) { return a.d - b.d; });
    var take = Math.min(near.length, 6);
    var added = 0;
    for (var j = 0; j < take; j++) {
      var spn = near[j].p;
      for (var k = 0; k < 3; k++) {
        addEgg(spn.x + (Math.random() - 0.5) * 10, spn.y + (Math.random() - 0.5) * 6, j === 0);
        added++;
      }
      S.flashes.push({ x: spn.x, y: spn.y, life: 1 });
    }
    if (near.length === 0) {
      for (var m = 0; m < 10; m++) {
        addEgg(L.x + (Math.random() - 0.5) * 26, L.y + (Math.random() - 0.5) * 20, true);
        added++;
      }
    }
    if (added > 0 && !S.collected) {
      S.collected = true;
      if (S.ctx && typeof S.ctx.onCollect === 'function') {
        try { S.ctx.onCollect('卵'); } catch (err) { /* noop */ }
      }
    }
  }

  function addEgg(x, y, bundleChance) {
    if (S.eggs.length > 118) S.eggs.shift();
    S.eggs.push({
      x: x,
      y: y,
      vy: 6 + Math.random() * 15,
      ph: Math.random() * TAU,
      sw: 1.5 + Math.random() * 5,
      r: 0.90 + Math.random() * 1.00,
      bundle: Math.random() < (bundleChance ? 0.45 : 0.16),
      age: 0
    });
  }

  function seedParticles(p) {
    var rnd = mulberry32(0x0C0A1 + Math.round(S.W) + Math.round(S.H) + Math.round((p || 0) * 100));
    var line = S.lastLine || 0;
    var waterH = Math.max(30, S.H - line);
    var pl = S.plate;
    S.eggs = [];
    S.flashes = [];

    var nEgg = S.narrow ? 56 : 88;
    var spawn = S.spawn.length ? S.spawn : [{ x: S.W * 0.6, y: S.H * 0.8 }];
    for (var i = 0; i < nEgg; i++) {
      var sp = spawn[Math.floor(rnd() * spawn.length)];
      var nearCoral = rnd() < 0.60;
      var x = nearCoral
        ? clamp(pl.x + (rnd() - 0.5) * pl.w * 1.16, 8, S.W - 8)
        : rnd() * S.W;
      var y = line + 14 + rnd() * Math.max(24, waterH - 26);
      if (nearCoral && rnd() < 0.35) y = Math.max(line + 16, sp.y - rnd() * waterH * 0.42);
      S.eggs.push({
        x: clamp(x, 8, S.W - 8),
        y: clamp(y, line + 10, S.H - 8),
        vy: 5 + rnd() * 14,
        ph: rnd() * TAU,
        sw: 1.5 + rnd() * 5,
        r: 0.90 + rnd() * 1.00,
        bundle: rnd() < 0.20,
        age: rnd() * 10
      });
    }
    S.seeded = true;
    S.needSeed = false;
  }

  function updateParticles(dt) {
    if (S.reduced || dt <= 0) return;
    var line = S.lastLine || 0;
    var L = S.light;
    var t = S.lastT;

    for (var i = 0; i < S.eggs.length; i++) {
      var e = S.eggs[i];
      e.age += dt;
      e.y -= e.vy * dt;
      e.x += Math.sin(t * 0.5 + e.ph) * e.sw * dt;
      if (e.x < 4) e.x = 4;
      if (e.x > S.W - 4) e.x = S.W - 4;

      var near = L ? Math.hypot(e.x - L.x, e.y - L.y) : 1e9;
      if (near < L.r * 0.9) {
        e.y -= e.vy * 0.55 * dt;
        e.x += (L.x - e.x) * 0.22 * dt;
      }
      if (e.y < line + 5) {
        var sp = S.spawn.length ? S.spawn[Math.floor(Math.random() * S.spawn.length)] : null;
        if (sp && sp.y > line + 15) {
          e.x = clamp(sp.x + (Math.random() - 0.5) * S.W * 0.12, 6, S.W - 6);
          e.y = sp.y + Math.random() * 18;
        } else {
          e.x = 8 + Math.random() * (S.W - 16);
          e.y = line + 24 + Math.random() * Math.max(16, S.H - line - 32);
        }
        e.vy = 6 + Math.random() * 15;
        e.ph = Math.random() * TAU;
        e.bundle = Math.random() < 0.16;
      }
    }

    S.spawnClock += dt;
    if (S.spawnClock > 1.45 && S.eggs.length < 100) {
      S.spawnClock = 0;
      var sp2 = S.spawn.length ? S.spawn[Math.floor(Math.random() * S.spawn.length)] : null;
      if (sp2) {
        var sx = sp2.x + (Math.random() - 0.5) * 10;
        var sy = sp2.y + (Math.random() - 0.5) * 6;
        if (sy > line + 12) addEgg(sx, sy, false);
      }
    }

    for (var f = S.flashes.length - 1; f >= 0; f--) {
      S.flashes[f].life -= dt * 0.9;
      if (S.flashes[f].life <= 0) S.flashes.splice(f, 1);
    }
  }

  function updatePolyps(s) {
    var L = S.light;
    var line = s.lineY;
    for (var i = 0; i < S.polyps.length; i++) {
      var p = S.polyps[i];
      var wet = p.y > line;
      var target = 0;
      if (wet && L) {
        var d = Math.hypot(p.x - L.x, p.y - L.y);
        if (d < L.r) {
          var infl = Math.pow(1 - d / L.r, 1.45);
          target = infl * (0.52 + 0.48 * L.open);
        }
      }
      if (S.reduced) p.wake = target;
      else p.wake += (target - p.wake) * 0.14;
      if (p.wake < 0.003) p.wake = 0;
    }
  }

  /* ---------------- 渲染 ---------------- */

  function drawCoralWet(g, s) {
    var T = S.layers;
    var m = T.meta;
    var line = s.lineY;
    if (line >= m.originY + m.h - 1) return;
    if (line + 4 < m.originY) line = m.originY - 4;
    var top = Math.max(line - 4, m.originY);
    var bottom = m.originY + m.h;
    for (var y = top; y < bottom; y += 4) {
      var depth = Math.max(0, y - s.lineY);
      var off = Math.sin(depth * 0.052 + s.t * 1.05) * Math.min(4.6, depth * 0.017);
      var sy = (y - m.originY) * S.dpr;
      var sh = Math.min(4.8, bottom - y) * S.dpr;
      if (sh <= 0) break;
      g.drawImage(T.bone, 0, sy, T.bone.width, sh,
        m.originX + off, y, m.w, Math.min(4.8, bottom - y));
    }
  }

  function drawLightBright(g, s) {
    var L = S.light;
    var line = s.lineY;
    if (!L) return;
    var y = Math.max(L.y, line + 20);
    var R = L.r;

    if (L.open > 0.02 && S.layers) {
      var m = S.layers.meta;
      g.save();
      g.beginPath();
      g.arc(L.x, y, R * 0.86, 0, TAU);
      g.clip();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.14 + 0.14 * L.open;
      g.drawImage(S.layers.bone, m.originX, m.originY, m.w, m.h);
      g.restore();
    }

    var grad = g.createRadialGradient(L.x, y, 0, L.x, y, R);
    grad.addColorStop(0, 'rgba(216,245,232,0.180)');
    grad.addColorStop(0.28, 'rgba(150,235,220,0.090)');
    grad.addColorStop(0.62, 'rgba(127,227,212,0.034)');
    grad.addColorStop(1, 'rgba(127,227,212,0)');
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = grad;
    g.fillRect(L.x - R, y - R, R * 2, R * 2);
    g.restore();

    var ringR = R * 0.56;
    g.strokeStyle = 'rgba(220,250,242,' + (0.10 + 0.10 * L.open) + ')';
    g.lineWidth = 1;
    g.beginPath();
    for (var ra = -0.55; ra < Math.PI * 1.75; ra += 0.10) {
      var rr = ringR + Math.sin(ra * 4.2 + s.t * 0.7) * 3.2;
      var rx = L.x + Math.cos(ra) * rr;
      var ry = y + Math.sin(ra) * rr;
      if (ra <= -0.55) g.moveTo(rx, ry); else g.lineTo(rx, ry);
    }
    g.stroke();

    g.strokeStyle = 'rgba(127,227,212,' + (0.16 + 0.18 * L.open) + ')';
    g.beginPath();
    for (var ra2 = Math.PI * 0.48; ra2 < Math.PI * 0.90; ra2 += 0.08) {
      var rr2 = ringR + Math.sin(ra2 * 4.2 + s.t * 0.7) * 3.2;
      var rx2 = L.x + Math.cos(ra2) * rr2;
      var ry2 = y + Math.sin(ra2) * rr2;
      if (ra2 <= Math.PI * 0.48) g.moveTo(rx2, ry2); else g.lineTo(rx2, ry2);
    }
    g.stroke();
  }

  function polypRefract(depth, t) {
    return Math.sin(depth * 0.052 + t * 1.05) * Math.min(4.6, depth * 0.017);
  }

  function drawPolyps(g, s, wetSide) {
    var line = s.lineY;
    var L = S.light;
    for (var i = 0; i < S.polyps.length; i++) {
      var p = S.polyps[i];
      var wet = p.y > line;
      if (wet !== wetSide) continue;
      var x = p.x;
      if (wet) x += polypRefract(p.y - line, s.t);

      if (!wet) {
        g.fillStyle = 'rgba(17,19,16,0.34)';
        g.beginPath();
        g.arc(x, p.y, Math.max(0.55, p.r * 0.85), 0, TAU);
        g.fill();
        continue;
      }

      if (p.wake > 0.04) {
        var w = p.wake;
        g.fillStyle = 'rgba(226,69,47,' + (0.38 + 0.60 * w) + ')';
        g.beginPath();
        g.arc(x, p.y, p.r * (1.15 + 0.95 * w), 0, TAU);
        g.fill();

        g.fillStyle = 'rgba(226,69,47,' + (0.10 * w) + ')';
        g.beginPath();
        g.arc(x, p.y, p.r * (6 + 5 * w), 0, TAU);
        g.fill();

        if (L && L.open > 0.35 && w > 0.35) {
          g.strokeStyle = 'rgba(226,69,47,' + (0.30 + 0.38 * w) + ')';
          g.lineWidth = 0.6;
          g.beginPath();
          g.arc(x, p.y, 2.1 + 2.2 * w, 0, TAU);
          g.stroke();

          g.strokeStyle = 'rgba(242,236,223,' + (0.14 + 0.22 * w) + ')';
          g.lineWidth = 0.55;
          for (var k = 0; k < 5; k++) {
            var a = -Math.PI / 2 + (k - 2) * 0.72 + p.r * 0.2;
            var len = 2.4 + 2.6 * w;
            g.beginPath();
            g.moveTo(x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r);
            g.lineTo(x + Math.cos(a) * (p.r + len), p.y + Math.sin(a) * (p.r + len));
            g.stroke();
          }
        }
      } else {
        g.fillStyle = 'rgba(242,236,223,0.28)';
        g.beginPath();
        g.arc(x, p.y, Math.max(0.5, p.r * 0.78), 0, TAU);
        g.fill();
      }
    }
  }

  function drawEggs(g, s) {
    var L = S.light;
    var line = s.lineY;
    var t = s.t;
    for (var i = 0; i < S.eggs.length; i++) {
      var e = S.eggs[i];
      if (e.y < line + 2 || e.y > S.H + 10) continue;
      var lit = 0;
      if (L) {
        var d = Math.hypot(e.x - L.x, e.y - L.y);
        if (d < L.r) lit = Math.pow(1 - d / L.r, 1.2);
      }
      var alpha = lit > 0.05 ? (0.50 + 0.45 * lit) : (0.40 + 0.28 * (0.5 + 0.5 * Math.sin(t * 0.8 + e.ph)));
      var col = lit > 0.05 ? 'rgba(226,69,47,' + alpha + ')' : 'rgba(242,236,223,' + alpha + ')';

      if (e.bundle) {
        var r = e.r * 0.62;
        g.fillStyle = col;
        g.beginPath();
        g.arc(e.x, e.y, r, 0, TAU);
        g.arc(e.x + r * 1.7, e.y - r * 0.7, r * 0.85, 0, TAU);
        g.arc(e.x + r * 0.6, e.y + r * 1.5, r * 0.8, 0, TAU);
        g.fill();
      } else {
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(e.x, e.y, e.r * 0.82, e.r * 1.12, 0, 0, TAU);
        g.fill();
      }

      if (lit > 0.18) {
        g.fillStyle = 'rgba(226,69,47,' + (0.06 * lit) + ')';
        g.beginPath();
        g.arc(e.x, e.y, e.r * 5.5, 0, TAU);
        g.fill();
      } else {
        g.fillStyle = 'rgba(242,236,223,0.035)';
        g.beginPath();
        g.arc(e.x, e.y, e.r * 3.4, 0, TAU);
        g.fill();
      }
    }

    for (var f = 0; f < S.flashes.length; f++) {
      var fl = S.flashes[f];
      if (fl.life <= 0) continue;
      g.strokeStyle = 'rgba(226,69,47,' + (0.22 * fl.life) + ')';
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(fl.x, fl.y, 4 + (1 - fl.life) * 16, 0, TAU);
      g.stroke();
    }
  }

  function drawMembrane(g, s) {
    var line = s.lineY;
    var band = 26;
    if (!S.layers) return;
    var m = S.layers.meta;
    if (line > m.originY && line < m.originY + m.h) {
      var top = Math.max(m.originY, line - band);
      var h = Math.min(band, line - m.originY);
      if (h > 0) {
        g.save();
        g.beginPath();
        g.rect(0, top, S.W, h);
        g.clip();
        g.globalAlpha = 0.16;
        g.drawImage(S.layers.bone, m.originX, m.originY, m.w, m.h);
        g.restore();
      }
    }
  }

  function render(s) {
    if (!S.ctx) return;
    S.reduced = !!s.reduced;
    S.lastLine = s.lineY;

    var now = s.t || 0;
    var dt = S.lastT ? clamp(now - S.lastT, 0, 0.05) : 0.016;
    S.lastT = now;
    if (S.reduced) dt = 0;

    updateLight(s);
    if (S.needSeed) seedParticles(s.p);
    updatePolyps(s);
    updateParticles(dt);

    var g = S.ctx.g;
    var line = s.lineY;

    /* 干：墨 */
    g.save();
    S.ctx.clipAbove(line);
    g.clip();
    if (S.layers) g.drawImage(S.layers.ink, S.layers.meta.originX, S.layers.meta.originY, S.layers.meta.w, S.layers.meta.h);
    drawPolyps(g, s, false);
    g.restore();

    /* 湿：骨白 + 折射 */
    g.save();
    S.ctx.clipBelow(line);
    g.clip();
    if (S.layers) drawCoralWet(g, s);
    drawLightBright(g, s);
    drawPolyps(g, s, true);
    drawEggs(g, s);
    g.restore();

    /* 水线以上 26px 的湿膜 */
    drawMembrane(g, s);
  }

  /* ---------------- 装配 ---------------- */

  function mount(root, ctx) {
    S.ctx = ctx;
    S.root = root;
    applyPalette(ctx);
    initLight();
    S.mounted = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!S.mounted || !S.W || !S.H) return;
        buildCoral();
        S.needSeed = true;
      });
    }
  }

  function resize(w, h, dpr) {
    S.W = w;
    S.H = h;
    S.dpr = Math.min(dpr || 1, 2);
    S.narrow = w < 820;
    if (!S.ctx) return;

    buildCoral();
    initLight();
    S.needSeed = true;
    S.seeded = false;
    S.eggs = [];
    S.flashes = [];
    S.spawnClock = 0;
    S.lastT = 0;
  }

  var A = {
    id: '03',
    title: '珊瑚',
    en: 'CORAL',
    accent: '#E2452F',
    mount: mount,
    resize: resize,
    render: render
  };

  if (window.ACTS && window.ACTS.register) window.ACTS.register('03', A);
})();
