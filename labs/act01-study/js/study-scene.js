/* ============================================================
   01 玄武 · 场景 —— 程序化石头 / 黑沙 / 珊瑚石灰墙
   ------------------------------------------------------------
   一张场景画两遍：干（玄武墨）与湿（骨白）。两遍几何完全一致，
   由水线切开，湿侧再用横条切片做折射。
   石头可以被按住加热：珊瑚色从内部渗出来，松手慢慢冷却。
   ============================================================ */
(function () {
  'use strict';

  var SERIF = '"Noto Serif SC","Source Han Serif SC","STZhongsong","Songti SC",serif';
  var SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
  var MONO = '"Consolas","JetBrains Mono","SFMono-Regular",monospace';
  var TAU = Math.PI * 2;
  var CORAL = '216,80,58';

  var canvas = null, ctx = null;
  var W = 0, H = 0, DPR = 1;
  var L = null;
  var inkLayer = null, boneLayer = null;
  var built = false;
  var WET = false;
  var stats = { buildMs: 0, slices: 0 };

  /* ---------------- 小工具 ---------------- */

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
      int: function (a, b) { return Math.floor(a + (b - a + 1) * r()); },
      sign: function () { return r() < 0.5 ? -1 : 1; }
    };
  }

  function inPoly(pts, x, y) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1];
      var xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function tracePoly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }

  function polyPath(pts) {
    var p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return p;
  }

  function waveAt(x, t) {
    return Math.sin((x / Math.max(1, W)) * 19.0 + t * 0.62) * 1.9
      + Math.sin((x / Math.max(1, W)) * 47.0 - t * 0.45) * 0.85;
  }

  function sandEdge(x) {
    if (!L) return 0;
    return L.sand.top
      + Math.sin((x / Math.max(1, W)) * Math.PI * 2.5 + 0.6) * L.sand.amp
      + Math.sin((x / Math.max(1, W)) * Math.PI * 6.2 + 2.2) * L.sand.amp * 0.32;
  }

  function refractAt(y, line, t) {
    if (y <= line) return 0;
    var d = y - line;
    return Math.sin(d * 0.05 + t * 0.95) * Math.min(6.5, d * 0.022);
  }

  function rnd(n) {
    var v = Math.sin(n * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }

  function drawSpaced(g, text, x, y, tracking) {
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      g.fillText(ch, cx, y);
      cx += g.measureText(ch).width + tracking;
    }
    return cx - tracking;
  }

  function drawVertical(g, text, x, top, fs, step, weight, color, family) {
    g.save();
    g.fillStyle = color;
    g.font = weight + ' ' + fs + 'px ' + (family || SERIF);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch !== ' ') g.fillText(ch, x, top + step * i + step * 0.5);
    }
    g.restore();
  }

  /* ---------------- 调色：同形两色 ---------------- */

  var PAL = {
    ink: {
      rgb: '17,19,16',
      line: 'rgba(17,19,16,0.62)',
      lineStrong: 'rgba(17,19,16,0.95)',
      lineSoft: 'rgba(17,19,16,0.38)',
      lineFaint: 'rgba(17,19,16,0.20)',
      hatch: 'rgba(17,19,16,0.14)',
      fill: 'rgba(17,19,16,0.034)',
      fillStrong: 'rgba(17,19,16,0.040)',
      wallLine: 'rgba(17,19,16,0.37)',
      wallFill: 'rgba(17,19,16,0.030)',
      wallPore: 'rgba(17,19,16,0.20)',
      text: 'rgba(17,19,16,0.93)',
      textSoft: 'rgba(17,19,16,0.78)',
      label: 'rgba(17,19,16,0.58)',
      labelFaint: 'rgba(17,19,16,0.38)',
      dot: 'rgba(17,19,16,0.76)',
      fossil: 'rgba(17,19,16,0.35)'
    },
    bone: {
      rgb: '242,236,223',
      line: 'rgba(242,236,223,0.46)',
      lineStrong: 'rgba(242,236,223,0.70)',
      lineSoft: 'rgba(242,236,223,0.29)',
      lineFaint: 'rgba(242,236,223,0.17)',
      hatch: 'rgba(242,236,223,0.12)',
      fill: 'rgba(242,236,223,0.038)',
      fillStrong: 'rgba(242,236,223,0.040)',
      wallLine: 'rgba(242,236,223,0.29)',
      wallFill: 'rgba(242,236,223,0.034)',
      wallPore: 'rgba(242,236,223,0.15)',
      text: 'rgba(242,236,223,0.88)',
      textSoft: 'rgba(242,236,223,0.72)',
      label: 'rgba(242,236,223,0.50)',
      labelFaint: 'rgba(242,236,223,0.32)',
      dot: 'rgba(242,236,223,0.64)',
      fossil: 'rgba(242,236,223,0.26)'
    }
  };

  /* ============================================================
     几何生成
     ============================================================ */

  function makeLayout(w, h) {
    var mob = w < 720;
    var R = makeR(0x51a7c3e1);
    var out = { w: w, h: h, mob: mob };
    L = out; /* sandEdge() 需要在几何生成期间读到当前布局 */

    out.lineHigh = h * (mob ? 0.36 : 0.42);
    out.lineLow = h * (mob ? 0.85 : 0.855);

    /* ---- 竖排字 ---- */
    var titleFs = mob ? Math.min(w * 0.235, h * 0.108) : Math.min(w * 0.112, h * 0.205, 164);
    out.title = {
      x: mob ? w * 0.190 : w * 0.150,
      top: mob ? h * 0.150 : h * 0.145,
      fs: titleFs,
      cell: titleFs * 1.055
    };
    out.kicker = {
      x: mob ? w * 0.035 : w * 0.070,
      top: mob ? h * 0.180 : h * 0.19,
      fs: mob ? 8.6 : 10.5,
      step: mob ? 16.2 : 20.2,
      text: '最先露出来的不是沙，是火'
    };
    out.meta = {
      x: mob ? w * 0.860 : w * 0.214,
      top: mob ? h * 0.145 : h * 0.15,
      fs: mob ? 9.5 : 11.5,
      step: mob ? 15.6 : 18.4,
      text: '海口 · 石山'
    };
    if (!mob) {
      out.rule = { x: w * 0.225, y0: h * 0.335, y1: h * 0.365 };
      out.sub = { x: w * 0.242, top: h * 0.385, fs: 13.5, step: 22.6, text: '火与海的接缝' };
    }

    /* ---- 构图 ---- */
    var sandTop = h * (mob ? 0.70 : 0.70);
    out.sand = { top: sandTop, amp: mob ? 5 : 8 };

    out.wall = {
      x0: mob ? w * 0.27 : w * 0.325,
      x1: mob ? w * 0.955 : w * 0.90,
      top: mob ? h * 0.38 : h * 0.435,
      bottom: h * 0.74,
      courses: mob ? 4 : 3
    };

    out.rock = {
      cx: mob ? w * 0.72 : w * 0.655,
      top: mob ? h * 0.335 : h * 0.22,
      base: mob ? h * 0.79 : h * 0.77,
      w: mob ? w * 0.42 : w * 0.25
    };

    buildWall(R, out);
    buildSand(R, out);
    buildRock(R, out);
    buildHeat(R, out);
    buildLabels(out);

    out.defaultOrigin = {
      x: out.rock.main.cx + out.rock.main.w * 0.06,
      y: out.rock.main.top + (out.rock.main.base - out.rock.main.top) * 0.34
    };
    out.hit = {
      cx: out.rock.cx,
      cy: (out.rock.top + Math.min(out.rock.base, sandEdge(out.rock.cx) + 20)) / 2,
      rx: out.rock.w * 0.66,
      ry: (Math.min(out.rock.base, sandEdge(out.rock.cx) + 20) - out.rock.top) * 0.58
    };
    return out;
  }

  function buildWall(R, out) {
    var wall = out.wall;
    var courseH = (wall.bottom - wall.top) / wall.courses;
    var blocks = [];
    for (var c = 0; c < wall.courses; c++) {
      var y0 = wall.top + c * courseH;
      var y1 = y0 + courseH;
      var x = wall.x0 - (c % 2 ? R.range(0, out.mob ? 18 : 34) : 0);
      var idx = 0;
      while (x < wall.x1 && blocks.length < 80) {
        var bw = out.mob ? R.range(36, 68) : R.range(72, 132);
        var x0 = x;
        var x1 = Math.min(wall.x1 + 4, x0 + bw);
        /* 每块石头的高度不完全一致，墙就会显得旧 */
        var topJ = R.range(-7, 7);
        var botJ = R.range(-7, 7);
        var shoulder = courseH * (0.42 + R.range(-0.08, 0.08));
        var notch = c === 0 && R.r() < 0.34 ? R.range(8, 15) : 0;
        var pts = [
          [x0 + R.range(0, 5), y0 + topJ + 2],
          [x0 + bw * 0.42, y0 + topJ + R.range(-2.5, 2.5) - notch * 0.3],
          [x1 - R.range(0, 6), y0 + topJ - notch],
          [x1 + R.range(-2, 2), y0 + shoulder + R.range(-4, 4)],
          [x1 - R.range(0, 5), y1 + botJ - 2],
          [x0 + bw * 0.58, y1 + botJ + R.range(-2, 3)],
          [x0 - R.range(0, 5), y1 - R.range(0, 5) + R.range(-2, 2)],
          [x0 - R.range(0, 4), y0 + shoulder + R.range(-3, 3)]
        ];
        if (notch > 0) {
          pts.splice(2, 0, [x1 - bw * 0.16, y0 + topJ - notch - R.range(0, 5)]);
        }
        var pores = [];
        var pc = R.int(4, out.mob ? 7 : 10);
        for (var k = 0; k < pc; k++) {
          pores.push({
            x: R.range(x0 + 8, x1 - 8),
            y: R.range(y0 + 10, y1 - 7),
            r: R.range(0.4, out.mob ? 1.5 : 2.0),
            ring: R.r() < 0.34
          });
        }
        blocks.push({
          pts: pts, pores: pores, fossil: null, missing: false, course: c, idx: idx,
          fillA: R.range(0.030, 0.040),
          lineA: R.range(0.28, 0.42)
        });
        x = x1 + (out.mob ? R.range(0, 1.5) : R.range(0, 2.6));
        idx++;
      }
    }
    if (blocks.length > 8) {
      var misses = [
        blocks[Math.floor(blocks.length * 0.46)],
        blocks[Math.floor(blocks.length * 0.71)],
        blocks[Math.floor(blocks.length * 0.92)]
      ];
      for (var mm = 0; mm < misses.length; mm++) {
        if (misses[mm]) misses[mm].missing = true;
      }
      var fossils = ['coral', 'shell', 'coral', 'shell'];
      var picks = [
        blocks[Math.floor(blocks.length * 0.14)],
        blocks[Math.floor(blocks.length * 0.48)],
        blocks[Math.floor(blocks.length * 0.76)],
        blocks[Math.floor(blocks.length * 0.95)]
      ];
      for (var f = 0; f < picks.length; f++) {
        if (picks[f] && !picks[f].missing) picks[f].fossil = fossils[f];
      }
    }
    wall.blocks = blocks;

    /* 墙顶的草 */
    wall.grass = [];
    var tufts = out.mob ? 2 : 3;
    for (var t = 0; t < tufts; t++) {
      var gx = wall.x0 + (wall.x1 - wall.x0) * (0.17 + 0.31 * t);
      var gy = wall.top + 2;
      var stems = [];
      var n = out.mob ? 4 : 5;
      for (var s = 0; s < n; s++) {
        stems.push({
          x: gx + R.range(-9, 9),
          h: R.range(10, out.mob ? 20 : 27),
          bend: R.range(-6, 6)
        });
      }
      wall.grass.push({ x: gx, y: gy, stems: stems });
    }
    wall.flecks = [];
    for (var q = 0; q < 10; q++) {
      wall.flecks.push({
        x: R.range(wall.x0, wall.x1),
        y: R.range(wall.bottom - 60, wall.bottom - 12),
        r: R.range(0.4, 1.1),
        a: R.range(0.14, 0.34)
      });
    }
    /* 一道穿过两块石头的裂缝 */
    var cx = wall.x0 + (wall.x1 - wall.x0) * 0.64;
    wall.crack = [
      [cx, wall.top + 22],
      [cx + 4, wall.top + 42],
      [cx - 3, wall.top + 66],
      [cx + 5, wall.top + 92]
    ];
  }

  function makeColumn(R, cx, top, base, w, opt) {
    var isMain = !!opt.main;
    var rx = w * (isMain ? 0.56 : 0.52);
    var ry = w * (isMain ? 0.165 : 0.15);
    var rot = R.range(-0.14, 0.14) + (isMain ? 0.05 : 0);
    var nTop = isMain ? 7 : 6;
    var topFace = [];
    for (var i = 0; i < nTop; i++) {
      var a = -Math.PI / 2 + i * TAU / nTop + rot + R.range(-0.06, 0.06);
      var rr = 0.90 + R.range(-0.06, 0.06);
      var lift = (isMain && i === 1) ? R.range(2, 5) : 0;
      topFace.push([cx + Math.cos(a) * rx * rr, top + Math.sin(a) * ry * rr - lift]);
    }

    var left = [], right = [];
    var segs = 7;
    var prof = [1.00, 0.965, 1.015, 0.945, 1.040, 0.985, 1.020, 1.060];
    var startY = top + ry * 0.42;
    for (var s = 0; s <= segs; s++) {
      var u = s / segs;
      var y = startY + (base - startY) * u;
      var taper = 1 - 0.035 * u;
      var ww = w * 0.5 * prof[s] * taper;
      var lean = opt.lean * u;
      left.push([
        cx - ww + lean + (isMain ? R.range(-3.0, 3.0) : R.range(-1.6, 1.6)),
        y + R.range(-2.0, 2.0)
      ]);
      right.push([
        cx + ww + lean + (isMain ? R.range(-3.0, 3.0) : R.range(-1.6, 1.6)),
        y + R.range(-2.0, 2.0)
      ]);
    }
    if (isMain) {
      /* 右侧被崩掉的一角 */
      right[2][0] -= w * 0.085;
      right[3][0] -= w * 0.030;
      /* 左侧一道凸出的台 */
      left[4][0] -= w * 0.022;
      left[5][0] -= w * 0.012;
    }
    var body = left.concat(right.slice().reverse());

    var vesicles = [];
    var nV = isMain ? 64 : 20;
    var tries = 0;
    while (vesicles.length < nV && tries < 420) {
      tries++;
      var vx = cx + R.range(-w * 0.46, w * 0.46) + opt.lean * 0.5;
      var vy = R.range(top + ry * 0.7, base - 18);
      if (!inPoly(body, vx, vy)) continue;
      vesicles.push({
        x: vx, y: vy,
        r: R.range(0.35, isMain ? 1.6 : 1.1),
        a: R.range(0.10, 0.38),
        ring: R.r() < 0.32
      });
    }

    /* 下半部与左侧的密集气孔，让石头读起来更黑、更重 */
    var stipple = [];
    var targetStipple = isMain ? 2800 : 300;
    tries = 0;
    while (stipple.length < targetStipple && tries < 14000) {
      tries++;
      var stx = cx - w * 0.52 + R.range(0, w * 0.82) + opt.lean * 0.5;
      var sty = R.range(top + (base - top) * 0.28, base - 8);
      if (!inPoly(body, stx, sty)) continue;
      stipple.push({
        x: stx, y: sty,
        r: R.range(0.24, 1.05),
        a: R.range(0.05, 0.30)
      });
    }

    /* 潮间带：石头腰部的一圈藤壶点 */
    var barnacles = [];
    if (isMain) {
      var bandY = top + (base - top) * 0.54;
      tries = 0;
      while (barnacles.length < 22 && tries < 160) {
        tries++;
        var bx = cx - w * 0.48 + R.range(0, w * 0.96) + opt.lean * 0.5;
        var byy = bandY + Math.sin((bx - cx) * 0.05) * 8 + R.range(-9, 9);
        if (!inPoly(body, bx, byy)) continue;
        barnacles.push({
          x: bx, y: byy,
          r: R.range(0.6, 1.7),
          ring: R.r() < 0.42
        });
      }
    }

    /* 右上方崩掉的一块面 */
    var chip = null;
    if (isMain) {
      var chY = top + (base - top) * 0.19;
      chip = [
        [cx + w * 0.33, chY],
        [cx + w * 0.52, chY + w * 0.055],
        [cx + w * 0.47, chY + w * 0.17],
        [cx + w * 0.29, chY + w * 0.13]
      ];
    }

    var facets = [];
    var fidx = isMain ? [1, 4, 6] : [1, 4];
    for (var f = 0; f < fidx.length; f++) {
      var p0 = topFace[fidx[f]];
      var p1x = p0[0] + opt.lean * 0.7 + R.range(-8, 8);
      var p1y = top + (base - top) * R.range(0.46, 0.86);
      facets.push([[p0[0], p0[1]], [p0[0] * 0.55 + p1x * 0.45, top + (p1y - top) * 0.5], [p1x, p1y]]);
    }

    var bands = [];
    var bandT = isMain ? [0.30, 0.58, 0.82] : [0.42];
    for (var b = 0; b < bandT.length; b++) {
      var pts = [];
      for (var q = 0; q <= 8; q++) {
        var uu = q / 8;
        var bx = cx - w * 0.5 + w * uu + opt.lean * bandT[b];
        var by = top + (base - top) * bandT[b] + Math.sin(uu * 7 + b * 2.4) * 2.5 + R.range(-0.9, 0.9);
        pts.push([bx, by]);
      }
      bands.push(pts);
    }

    /* 黑色玄武岩的体积：贴着轮廓的短线 + 内部的石纹 */
    var hatches = [];
    var nH = isMain ? 15 : 6;
    for (var h = 0; h < nH; h++) {
      var hy = R.range(top + w * 0.30, base - 12);
      var hx = cx + opt.lean * 0.5 + (h % 3 === 0 ? w * 0.40 : -w * 0.40) * R.range(0.55, 0.95);
      hatches.push([
        [hx, hy],
        [hx + R.range(-8, 8), hy + R.range(-2.5, 2.5)]
      ]);
    }

    var scratches = [];
    for (var sc = 0; sc < (isMain ? 4 : 2); sc++) {
      var sx = cx + R.range(-w * 0.34, w * 0.30);
      var sy = R.range(top + w * 0.32, base - 40);
      var sp = [[sx, sy]];
      var sa = R.range(-1.2, -0.2);
      for (var seg = 0; seg < 3; seg++) {
        sa += R.range(-0.35, 0.35);
        var sl = R.range(6, 16);
        sx += Math.cos(sa) * sl;
        sy += Math.sin(sa) * sl;
        sp.push([sx, sy]);
      }
      scratches.push(sp);
    }

    var fracture = [
      [cx - w * 0.30 + opt.lean, top + (base - top) * 0.235],
      [cx - w * 0.10, top + (base - top) * 0.285],
      [cx + w * 0.07, top + (base - top) * 0.275],
      [cx + w * 0.245, top + (base - top) * 0.345]
    ];

    var mineral = [];
    for (var m = 0; m < (isMain ? 4 : 1); m++) {
      var mx = cx + R.range(-w * 0.30, w * 0.30);
      var my = R.range(top + 28, base - 40);
      if (!inPoly(body, mx, my)) continue;
      mineral.push([mx, my, R.range(-2.6, 2.6), R.range(1.5, 3.4)]);
    }

    return {
      cx: cx, top: top, base: base, w: w, lean: opt.lean, main: !!opt.main,
      topFace: topFace, body: body, left: left, right: right,
      path: polyPath(body), topPath: polyPath(topFace),
      vesicles: vesicles, facets: facets, bands: bands, mineral: mineral,
      hatches: hatches, scratches: scratches, fracture: fracture,
      stipple: stipple, barnacles: barnacles, chip: chip
    };
  }

  function buildRock(R, out) {
    var rock = out.rock;
    rock.left = makeColumn(
      R,
      rock.cx - rock.w * 0.30,
      rock.top + rock.w * 0.19,
      rock.base,
      rock.w * 0.30,
      { lean: rock.w * 0.015, main: false }
    );
    rock.right = makeColumn(
      R,
      rock.cx + rock.w * 0.345,
      rock.top + rock.w * 0.58,
      rock.base,
      rock.w * 0.17,
      { lean: -rock.w * 0.02, main: false }
    );
    rock.main = makeColumn(
      R,
      rock.cx,
      rock.top,
      rock.base,
      rock.w * 0.56,
      { lean: -rock.w * 0.035, main: true }
    );
    rock.columns = [rock.left, rock.right, rock.main];

    /* 脚边一块崩落的石头 */
    var fx = rock.cx - rock.w * 0.60;
    var fy = Math.min(rock.base - 10, sandEdge(fx) + 20);
    var fpts = [];
    var n = 8;
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU;
      fpts.push([
        fx + Math.cos(a) * R.range(22, 36),
        fy + Math.sin(a) * R.range(9, 16)
      ]);
    }
    rock.fallen = { pts: fpts, path: polyPath(fpts), y: fy };
  }

  function buildHeat(R, out) {
    var main = out.rock.main;
    var cracks = [];
    var n = out.mob ? 10 : 14;
    for (var i = 0; i < n; i++) {
      var sx = main.cx + R.range(-main.w * 0.34, main.w * 0.34);
      var sy = main.top + R.range(main.w * 0.5, (main.base - main.top) * 0.72);
      var pts = [[sx, sy]];
      var ang = -Math.PI / 2 + R.range(-0.55, 0.55);
      var segs = R.int(4, 6);
      for (var s = 0; s < segs; s++) {
        ang += R.range(-0.5, 0.5);
        var len = main.w * R.range(0.10, 0.20);
        sx += Math.cos(ang) * len;
        sy += Math.sin(ang) * len;
        pts.push([sx, sy]);
      }
      cracks.push({
        pts: pts,
        th: R.range(0.02, 0.48),
        speed: R.range(0.7, 1.3),
        width: R.range(0.95, 1.15)
      });

      if (R.r() < 0.80 && pts.length > 2) {
        var b = pts[1 + (R.r() * (pts.length - 2) | 0)];
        var bp = [[b[0], b[1]]];
        var ba = ang + (R.r() < 0.5 ? -1 : 1) * R.range(0.7, 1.3);
        for (var q = 0; q < 3; q++) {
          ba += R.range(-0.35, 0.35);
          var bl = main.w * R.range(0.07, 0.13);
          bp.push([bp[bp.length - 1][0] + Math.cos(ba) * bl, bp[bp.length - 1][1] + Math.sin(ba) * bl]);
        }
        cracks.push({
          pts: bp,
          th: R.range(0.22, 0.62),
          speed: R.range(0.8, 1.2),
          width: R.range(0.9, 1.05)
        });
      }
    }
    out.rock.cracks = cracks;
  }

  function buildSand(R, out) {
    var sand = out.sand;
    sand.ripples = [];
    var n = out.mob ? 4 : 5;
    for (var i = 0; i < n; i++) {
      sand.ripples.push({
        y: sand.top + (out.h - sand.top) * (0.18 + i * 0.165) + R.range(-8, 8),
        amp: R.range(3.2, 8.2),
        phase: R.range(0, TAU),
        freq: R.range(0.007, 0.013),
        a: R.range(0.16, 0.30)
      });
    }
    sand.grains = [];
    var count = out.mob ? 1200 : 3000;
    for (var g = 0; g < count; g++) {
      var x = R.range(0, out.w);
      var edge = sandEdge(x);
      if (out.h - edge < 24) continue;
      sand.grains.push({
        x: x,
        y: R.range(edge + 4, out.h - 6),
        r: R.range(0.35, 1.5),
        a: R.range(0.08, 0.38),
        dash: R.r() < 0.16
      });
    }

    /* 黑沙会聚成几小片：退潮后留下的重矿物 */
    sand.clusters = [];
    var nCl = out.mob ? 3 : 6;
    for (var c = 0; c < nCl; c++) {
      var ccx = R.range(out.w * 0.08, out.w * 0.92);
      var ccy = R.range(sandEdge(ccx) + 26, out.h - 22);
      var pts = [];
      var qn = out.mob ? 70 : 130;
      for (var q = 0; q < qn; q++) {
        pts.push({
          x: ccx + R.range(-42, 42),
          y: ccy + R.range(-9, 9),
          r: R.range(0.35, 1.35),
          a: R.range(0.16, 0.42)
        });
      }
      sand.clusters.push(pts);
    }
    sand.pebbles = [];
    for (var p = 0; p < (out.mob ? 4 : 7); p++) {
      var px = R.range(out.w * 0.08, out.w * 0.94);
      var pending = {
        x: px,
        y: R.range(sandEdge(px) + 20, out.h - 30),
        rx: R.range(2.5, 7.5),
        ry: R.range(1.1, 2.8)
      };
      sand.pebbles.push(pending);
    }

    /* 潮池：低潮时露出来的两小洼 */
    var poolY = sandEdge(out.w * 0.48) + 42;
    sand.pools = [
      {
        cx: out.w * (out.mob ? 0.40 : 0.50),
        cy: out.mob ? sand.top + 58 : poolY + 20,
        rx: out.mob ? 32 : 43,
        ry: out.mob ? 9 : 12
      }
    ];
    if (!out.mob) {
      sand.pools.push({ cx: out.w * 0.365, cy: out.h * 0.79, rx: 28, ry: 8 });
    }
    for (var q = 0; q < sand.pools.length; q++) {
      var pool = sand.pools[q];
      pool.pts = [];
      var pn = 18;
      for (var k = 0; k < pn; k++) {
        var a = k / pn * TAU;
        var r = 1 + R.range(-0.13, 0.12);
        pool.pts.push([pool.cx + Math.cos(a) * pool.rx * r, pool.cy + Math.sin(a) * pool.ry * r]);
      }
    }
  }

  function buildLabels(out) {
    var rock = out.rock;
    var sand = out.sand;
    out.labels = [
      {
        x: out.mob ? out.w * 0.42 : out.wall.x0 + 24,
        y: out.wall.top - (out.mob ? 15 : 18),
        cn: '珊瑚石灰墙',
        en: 'CORAL LIME WALL'
      },
      {
        x: rock.cx + (out.mob ? rock.w * 0.24 : rock.w * 0.62),
        y: out.mob ? rock.top - 15 : rock.top + 34,
        cn: '玄武岩',
        en: 'BASALT'
      },
      {
        x: out.w * (out.mob ? 0.30 : 0.18),
        y: sand.top + (out.mob ? 80 : 80),
        cn: '黑沙',
        en: 'BLACK SAND'
      }
    ];
  }

  /* ============================================================
     上色：同一套几何，两遍
     ============================================================ */

  function makeLayer(mode) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * DPR));
    c.height = Math.max(1, Math.round(H * DPR));
    var g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    var pal = PAL[mode];
    WET = mode === 'bone';
    /* 不在整个 bone 层上开 filter：几千个沙粒/气孔会让每次 fillRect 都过一遍模糊，
       在软件光栅下会直接把首帧拖死。湿侧的柔化交给横条切片。 */

    paintWall(g, pal);
    paintSand(g, pal);
    eraseUnderRock(g);
    paintRock(g, pal);
    paintSandFront(g, pal);
    paintPools(g, pal);
    paintType(g, pal);
    paintLabels(g, pal);

    if (typeof g.filter === 'string') g.filter = 'none';
    WET = false;

    if (mode === 'bone') {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(3,16,15,0.17)';
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  /* ---- 珊瑚石灰墙 ---- */

  function clipAboveSand(g) {
    g.beginPath();
    g.moveTo(0, -2);
    g.lineTo(W, -2);
    g.lineTo(W, sandEdge(W));
    for (var x = W; x >= 0; x -= 6) g.lineTo(x, sandEdge(x));
    g.closePath();
    g.clip();
  }

  function paintWall(g, pal) {
    var wall = L.wall;
    g.save();
    clipAboveSand(g);

    for (var i = 0; i < wall.blocks.length; i++) {
      var b = wall.blocks[i];
      var pts = b.pts;

      if (b.missing) {
        /* 缺石：纸色的缺口，边缘有断口与碎屑 */
        g.strokeStyle = 'rgba(' + pal.rgb + ',0.24)';
        g.lineWidth = 0.9;
        for (var q = 0; q < 4; q++) {
          var p0 = pts[(q * 2 + 1) % pts.length];
          g.beginPath();
          g.moveTo(p0[0], p0[1]);
          g.lineTo(p0[0] + (q % 2 ? -7 : 9), p0[1] + 6);
          g.lineTo(p0[0] + (q % 2 ? -4 : 5), p0[1] + 12);
          g.stroke();
        }
        g.fillStyle = pal.wallFill;
        g.beginPath();
        g.ellipse(
          (pts[0][0] + pts[3][0]) / 2,
          (pts[0][1] + pts[3][1]) / 2,
          10, 12, 0.15, 0, TAU
        );
        g.fill();
        continue;
      }

      tracePoly(g, pts);
      g.fillStyle = 'rgba(' + pal.rgb + ',' + b.fillA + ')';
      g.fill();
      g.strokeStyle = 'rgba(' + pal.rgb + ',' + b.lineA + ')';
      g.lineWidth = 1.05;
      g.stroke();

      /* 珊瑚石的气孔：多、大小不一 */
      for (var p = 0; p < b.pores.length; p++) {
        var hole = b.pores[p];
        g.beginPath();
        g.arc(hole.x, hole.y, hole.r, 0, TAU);
        g.fillStyle = 'rgba(' + pal.rgb + ',' + (0.12 + hole.r * 0.09) + ')';
        g.fill();
        if (hole.ring) {
          g.beginPath();
          g.arc(hole.x, hole.y, hole.r + 1.05, 0, TAU);
          g.strokeStyle = 'rgba(' + pal.rgb + ',0.13)';
          g.lineWidth = 0.8;
          g.stroke();
        }
      }

      if (b.fossil) paintFossil(g, b, pal);
    }

    /* 墙顶的草 */
    g.strokeStyle = pal.lineSoft;
    g.lineWidth = 1;
    for (var t = 0; t < wall.grass.length; t++) {
      var tuft = wall.grass[t];
      for (var s = 0; s < tuft.stems.length; s++) {
        var st = tuft.stems[s];
        g.beginPath();
        g.moveTo(st.x, tuft.y);
        g.quadraticCurveTo(st.x + st.bend * 0.4, tuft.y - st.h * 0.55, st.x + st.bend, tuft.y - st.h);
        g.stroke();
        g.beginPath();
        g.arc(st.x + st.bend, tuft.y - st.h, 0.8, 0, TAU);
        g.fillStyle = pal.labelFaint;
        g.fill();
      }
    }

    /* 穿过石缝的裂缝与石灰屑 */
    g.beginPath();
    g.moveTo(wall.crack[0][0], wall.crack[0][1]);
    for (var c = 1; c < wall.crack.length; c++) g.lineTo(wall.crack[c][0], wall.crack[c][1]);
    g.strokeStyle = pal.lineFaint;
    g.lineWidth = 1;
    g.stroke();

    for (var f = 0; f < wall.flecks.length; f++) {
      var fl = wall.flecks[f];
      g.fillStyle = 'rgba(' + pal.rgb + ',' + fl.a + ')';
      g.beginPath();
      g.arc(fl.x, fl.y, fl.r, 0, TAU);
      g.fill();
    }

    g.restore();
  }

  function paintFossil(g, b, pal) {
    var pts = b.pts;
    var cx = 0, cy = 0;
    for (var i = 0; i < pts.length; i++) { cx += pts[i][0]; cy += pts[i][1]; }
    cx /= pts.length; cy /= pts.length;

    g.save();
    g.strokeStyle = pal.fossil;
    g.lineWidth = 0.9;

    if (b.fossil === 'coral') {
      for (var w = -3; w <= 3; w++) {
        var a = -Math.PI / 2 + w * 0.30;
        var len = 12 + Math.abs(w) * -1.4;
        var ex = cx + Math.cos(a) * len;
        var ey = cy + Math.sin(a) * len;
        g.beginPath();
        g.moveTo(cx, cy);
        g.quadraticCurveTo(cx + Math.cos(a) * len * 0.45 + w * 1.8, cy + Math.sin(a) * len * 0.55, ex, ey);
        g.stroke();
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * len * 0.55, cy + Math.sin(a) * len * 0.6);
        g.lineTo(cx + Math.cos(a + 0.42) * len * 0.92, cy + Math.sin(a + 0.42) * len * 0.92);
        g.stroke();
        if (w % 2 === 0) {
          g.beginPath();
          g.arc(ex, ey, 0.8, 0, TAU);
          g.fillStyle = pal.fossil;
          g.fill();
        }
      }
    } else {
      for (var k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(cx - 2, cy, 3.2 + k * 2.3, 0.5, 3.9);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(cx + 2, cy - 9);
      g.quadraticCurveTo(cx + 13, cy - 2, cx + 3, cy + 9);
      g.stroke();
    }
    g.restore();
  }

  /* ---- 黑沙 ---- */

  function paintSand(g, pal) {
    var sand = L.sand;

    g.beginPath();
    g.moveTo(0, sandEdge(0));
    for (var x = 8; x <= W; x += 8) g.lineTo(x, sandEdge(x));
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fillStyle = pal.fillStrong;
    g.fill();
    g.strokeStyle = pal.lineSoft;
    g.lineWidth = 1.05;
    g.beginPath();
    g.moveTo(0, sandEdge(0));
    for (var x2 = 8; x2 <= W; x2 += 8) g.lineTo(x2, sandEdge(x2));
    g.stroke();

    /* 退潮留下的沙纹 */
    for (var i = 0; i < sand.ripples.length; i++) {
      var rp = sand.ripples[i];
      g.beginPath();
      for (var xx = 0; xx <= W; xx += 8) {
        var yy = rp.y
          + Math.sin(xx * rp.freq + rp.phase) * rp.amp
          + Math.sin(xx * rp.freq * 2.7 + rp.phase * 1.7) * rp.amp * 0.28;
        yy = Math.max(yy, sandEdge(xx) + 6);
        if (xx === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.strokeStyle = 'rgba(' + pal.rgb + ',' + rp.a + ')';
      g.lineWidth = 1;
      g.stroke();
    }

    /* 颗粒：黑沙靠点，不靠填充 */
    for (var q = 0; q < sand.grains.length; q++) {
      var gr = sand.grains[q];
      var ga = gr.a * (WET ? 0.30 : 1);
      g.fillStyle = 'rgba(' + pal.rgb + ',' + ga + ')';
      if (gr.dash) g.fillRect(gr.x, gr.y, gr.r * 2.4 + 0.8, 0.8);
      else g.fillRect(gr.x, gr.y, gr.r * 1.5 + 0.35, gr.r * 1.5 + 0.35);
    }

    /* 聚成片的黑沙 */
    for (var cl = 0; cl < sand.clusters.length; cl++) {
      var cluster = sand.clusters[cl];
      for (var cq = 0; cq < cluster.length; cq++) {
        var cg = cluster[cq];
        g.fillStyle = 'rgba(' + pal.rgb + ',' + (cg.a * (WET ? 0.24 : 1)) + ')';
        g.fillRect(cg.x, cg.y, cg.r * 1.6 + 0.4, cg.r * 1.6 + 0.4);
      }
    }

    /* 小卵石 */
    for (var p = 0; p < sand.pebbles.length; p++) {
      var pb = sand.pebbles[p];
      g.beginPath();
      g.ellipse(pb.x, pb.y, pb.rx, pb.ry, 0, 0, TAU);
      g.strokeStyle = pal.lineFaint;
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = pal.fill;
      g.fill();
    }
  }

  function paintSandFront(g, pal) {
    var rock = L.rock;
    var y = Math.min(rock.base - 8, sandEdge(rock.cx) + 26);
    g.save();
    g.strokeStyle = pal.lineFaint;
    g.lineWidth = 1;
    for (var k = 0; k < 2; k++) {
      var yy = y + k * 8;
      g.beginPath();
      var x0 = rock.cx - rock.w * 0.52;
      var x1 = rock.cx + rock.w * 0.52;
      for (var x = x0; x <= x1; x += 8) {
        var wy = yy + Math.sin(x * 0.024 + k * 1.8) * 2.2;
        if (x === x0) g.moveTo(x, wy); else g.lineTo(x, wy);
      }
      g.stroke();
    }
    g.restore();
  }

  function paintPools(g, pal) {
    var pools = L.sand.pools;
    for (var i = 0; i < pools.length; i++) {
      var pool = pools[i];
      tracePoly(g, pool.pts);
      g.fillStyle = pal.fillStrong;
      g.fill();
      g.strokeStyle = pal.line;
      g.lineWidth = 1.1;
      g.stroke();

      for (var k = 1; k <= 2; k++) {
        var s = 1 - k * 0.24;
        g.beginPath();
        for (var p = 0; p < pool.pts.length; p++) {
          var px = pool.cx + (pool.pts[p][0] - pool.cx) * s;
          var py = pool.cy + (pool.pts[p][1] - pool.cy) * s + k * 0.9;
          if (p === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.strokeStyle = pal.lineFaint;
        g.lineWidth = 0.8;
        g.stroke();
      }

      g.beginPath();
      g.arc(pool.cx - pool.rx * 0.28, pool.cy - 1, Math.max(2, pool.rx * 0.12), 2.4, 5.2);
      g.strokeStyle = pal.lineFaint;
      g.lineWidth = 0.8;
      g.stroke();
    }
  }

  /* ---- 玄武岩 ---- */

  function eraseUnderRock(g) {
    var rock = L.rock;
    g.save();
    if (typeof g.filter === 'string') g.filter = 'none';
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    g.lineWidth = 3.5;
    for (var i = 0; i < rock.columns.length; i++) {
      g.fill(rock.columns[i].path);
      g.stroke(rock.columns[i].path);
    }
    g.fill(rock.fallen.path);
    g.restore();
  }

  function paintRock(g, pal) {
    var rock = L.rock;
    for (var i = 0; i < rock.columns.length; i++) {
      paintColumn(g, pal, rock.columns[i]);
    }
    paintFallen(g, pal);

    /* 与沙的咬合：几粒沙压在石头脚上 */
    g.fillStyle = pal.lineFaint;
    for (var k = 0; k < 5; k++) {
      var gx = rock.cx + (rnd(k * 4.7) - 0.5) * rock.w * 0.7;
      var gy = Math.min(rock.base - 3, sandEdge(gx) + 21 + rnd(k * 9.1) * 12);
      g.beginPath();
      g.arc(gx, gy, 0.6 + rnd(k * 2.3) * 0.9, 0, TAU);
      g.fill();
    }
  }

  function paintColumn(g, pal, col) {
    /* 柱体 */
    tracePoly(g, col.body);
    g.fillStyle = col.main ? pal.fillStrong : pal.fill;
    g.fill();
    g.strokeStyle = col.main ? pal.lineStrong : pal.line;
    g.lineWidth = col.main ? 1.2 : 1.05;
    g.stroke();

    /* 体积：左侧与下半部用斜排线压暗，石面就有了背光面 */
    g.save();
    g.clip(col.path);
    var shadeGrad = g.createLinearGradient(col.cx - col.w * 0.58, 0, col.cx + col.w * 0.58, 0);
    shadeGrad.addColorStop(0, 'rgba(' + pal.rgb + ',' + (col.main ? 0.36 : 0.16) + ')');
    shadeGrad.addColorStop(0.48, 'rgba(' + pal.rgb + ',0.11)');
    shadeGrad.addColorStop(0.82, 'rgba(' + pal.rgb + ',0.018)');
    shadeGrad.addColorStop(1, 'rgba(' + pal.rgb + ',0)');
    g.strokeStyle = shadeGrad;
    g.lineWidth = 0.9;
    var shadeTop = col.top + (col.base - col.top) * 0.26;
    var nShade = col.main ? 22 : 8;
    for (var sl = 0; sl < nShade; sl++) {
      var yy = shadeTop + (col.base - shadeTop) * (sl / nShade);
      g.beginPath();
      g.moveTo(col.cx - col.w * 0.60, yy);
      g.lineTo(col.cx + col.w * 0.60, yy + 48);
      g.stroke();
    }
    g.strokeStyle = 'rgba(' + pal.rgb + ',0.09)';
    g.lineWidth = 0.8;
    var nFlute = col.main ? 5 : 2;
    for (var fl = 0; fl < nFlute; fl++) {
      var fx = col.cx - col.w * 0.34 + col.w * 0.17 * fl;
      g.beginPath();
      g.moveTo(fx, col.top + col.w * 0.22);
      g.quadraticCurveTo(fx + Math.sin(fl) * 5, col.top + (col.base - col.top) * 0.52, fx + 4, col.top + (col.base - col.top) * 0.84);
      g.stroke();
    }
    g.restore();

    /* 柱顶断面：六 / 七边形 */
    tracePoly(g, col.topFace);
    g.fillStyle = pal.fillStrong;
    g.fill();
    g.strokeStyle = col.main ? pal.lineStrong : pal.line;
    g.lineWidth = 1.1;
    g.stroke();

    var inset = [];
    for (var i = 0; i < col.topFace.length; i++) {
      var p = col.topFace[i];
      inset.push([col.cx + (p[0] - col.cx) * 0.62, col.top + (p[1] - col.top) * 0.62]);
    }
    tracePoly(g, inset);
    g.strokeStyle = pal.lineFaint;
    g.lineWidth = 0.8;
    g.stroke();

    /* 顶面的斜排线，让断面也有石质 */
    g.save();
    tracePoly(g, col.topFace);
    g.clip();
    g.strokeStyle = 'rgba(' + pal.rgb + ',0.10)';
    g.lineWidth = 0.8;
    for (var tf = 0; tf < 11; tf++) {
      var ty = col.top - 14 + tf * 2.7;
      g.beginPath();
      g.moveTo(col.cx - col.w * 0.55, ty);
      g.lineTo(col.cx + col.w * 0.55, ty + 7);
      g.stroke();
    }
    g.restore();

    /* 柱面棱线 */
    g.strokeStyle = pal.lineFaint;
    g.lineWidth = 0.9;
    for (var f = 0; f < col.facets.length; f++) {
      var fp = col.facets[f];
      g.beginPath();
      g.moveTo(fp[0][0], fp[0][1]);
      g.quadraticCurveTo(fp[1][0], fp[1][1], fp[2][0], fp[2][1]);
      g.stroke();
    }

    /* 黑色体积：贴着两侧的暗部排线 */
    g.strokeStyle = pal.hatch;
    g.lineWidth = 0.8;
    for (var h = 0; h < col.hatches.length; h++) {
      var hp = col.hatches[h];
      g.beginPath();
      g.moveTo(hp[0][0], hp[0][1]);
      g.lineTo(hp[1][0], hp[1][1]);
      g.stroke();
    }
    /* 轮廓内侧压低一点 */
    var shade = [];
    for (var s = 1; s < col.left.length - 1; s++) {
      if (s % 2) continue;
      var l0 = col.left[s], l1 = col.left[s + 1];
      shade.push([[l0[0] + 3.5, l0[1] + 1], [l1[0] + 5, l1[1] - 1]]);
      var r0 = col.right[s], r1 = col.right[s + 1];
      shade.push([[r0[0] - 3.5, r0[1] + 1], [r1[0] - 5, r1[1] - 1]]);
    }
    g.strokeStyle = pal.hatch;
    g.lineWidth = 0.9;
    for (var sd = 0; sd < shade.length; sd++) {
      g.beginPath();
      g.moveTo(shade[sd][0][0], shade[sd][0][1]);
      g.lineTo(shade[sd][1][0], shade[sd][1][1]);
      g.stroke();
    }

    /* 节理横带 */
    for (var b = 0; b < col.bands.length; b++) {
      var band = col.bands[b];
      g.beginPath();
      g.moveTo(band[0][0], band[0][1]);
      for (var q = 1; q < band.length; q++) g.lineTo(band[q][0], band[q][1]);
      g.strokeStyle = b === 1 && col.main ? pal.lineSoft : pal.lineFaint;
      g.lineWidth = 1;
      g.stroke();
    }

    /* 崩掉的一角 */
    if (col.chip) {
      tracePoly(g, col.chip);
      g.fillStyle = pal.fillStrong;
      g.fill();
      g.strokeStyle = pal.lineSoft;
      g.lineWidth = 1;
      g.stroke();
      g.strokeStyle = 'rgba(' + pal.rgb + ',0.12)';
      g.lineWidth = 0.8;
      for (var ch = 0; ch < 4; ch++) {
        g.beginPath();
        g.moveTo(col.chip[0][0] + ch * 4, col.chip[0][1] + 3);
        g.lineTo(col.chip[3][0] + ch * 4 - 8, col.chip[3][1] - 3);
        g.stroke();
      }
    }

    /* 主石的大断裂 */
    if (col.main) {
      g.beginPath();
      g.moveTo(col.fracture[0][0], col.fracture[0][1]);
      for (var fr = 1; fr < col.fracture.length; fr++) g.lineTo(col.fracture[fr][0], col.fracture[fr][1]);
      g.strokeStyle = pal.line;
      g.lineWidth = 1.2;
      g.stroke();

      g.beginPath();
      g.moveTo(col.fracture[0][0] + 3, col.fracture[0][1] + 8);
      g.lineTo(col.fracture[1][0] + 3, col.fracture[1][1] + 9);
      g.strokeStyle = pal.lineFaint;
      g.lineWidth = 0.9;
      g.stroke();
    }

    /* 细石纹 */
    g.strokeStyle = pal.lineFaint;
    g.lineWidth = 0.9;
    for (var sc = 0; sc < col.scratches.length; sc++) {
      var sp = col.scratches[sc];
      g.beginPath();
      g.moveTo(sp[0][0], sp[0][1]);
      for (var ss = 1; ss < sp.length; ss++) g.lineTo(sp[ss][0], sp[ss][1]);
      g.stroke();
    }

    /* 气孔与矿物屑 */
    for (var v = 0; v < col.vesicles.length; v++) {
      var ve = col.vesicles[v];
      g.beginPath();
      g.arc(ve.x, ve.y, ve.r, 0, TAU);
      g.fillStyle = 'rgba(' + pal.rgb + ',' + (ve.a * (WET ? 0.5 : 1)) + ')';
      g.fill();
      if (ve.ring) {
        g.beginPath();
        g.arc(ve.x, ve.y, ve.r + 0.9, 0, TAU);
        g.strokeStyle = pal.lineFaint;
        g.lineWidth = 0.8;
        g.stroke();
      }
    }
    for (var m = 0; m < col.mineral.length; m++) {
      var mi = col.mineral[m];
      g.beginPath();
      g.moveTo(mi[0] - mi[2] * 0.5, mi[1] + mi[3] * 0.5);
      g.lineTo(mi[0] + mi[2] * 0.5, mi[1] - mi[3] * 0.5);
      g.strokeStyle = pal.lineSoft;
      g.lineWidth = 1;
      g.stroke();
    }

    /* 腰部更密的孔：石头下半部更黑 */
    for (var st = 0; st < col.stipple.length; st++) {
      var sp2 = col.stipple[st];
      g.fillStyle = 'rgba(' + pal.rgb + ',' + (sp2.a * (WET ? 0.42 : 1)) + ')';
      g.fillRect(sp2.x, sp2.y, sp2.r * 1.6 + 0.25, sp2.r * 1.6 + 0.25);
    }

    /* 潮间带藤壶：一圈小孔，退潮时先干 */
    for (var ba = 0; ba < col.barnacles.length; ba++) {
      var bn = col.barnacles[ba];
      g.beginPath();
      g.arc(bn.x, bn.y, bn.r, 0, TAU);
      g.fillStyle = 'rgba(' + pal.rgb + ',0.26)';
      g.fill();
      if (bn.ring) {
        g.beginPath();
        g.arc(bn.x, bn.y, bn.r + 1.2, 0, TAU);
        g.strokeStyle = 'rgba(' + pal.rgb + ',0.16)';
        g.lineWidth = 0.8;
        g.stroke();
      }
    }
  }

  function paintFallen(g, pal) {
    var f = L.rock.fallen;
    tracePoly(g, f.pts);
    g.fillStyle = pal.fill;
    g.fill();
    g.strokeStyle = pal.line;
    g.lineWidth = 1.05;
    g.stroke();

    g.beginPath();
    g.moveTo(f.pts[1][0], f.pts[1][1]);
    g.lineTo(f.pts[4][0] - 2, f.pts[4][1] - 3);
    g.moveTo(f.pts[2][0] - 2, f.pts[2][1] + 2);
    g.lineTo(f.pts[5][0] + 2, f.pts[5][1] - 1);
    g.strokeStyle = pal.lineFaint;
    g.lineWidth = 0.8;
    g.stroke();
  }

  /* ---- 竖排字 ---- */

  function paintType(g, pal) {
    var title = L.title;
    drawVertical(g, '玄武', title.x, title.top, title.fs, title.cell, '500', pal.text, SERIF);

    var kicker = L.kicker;
    drawVertical(g, kicker.text, kicker.x, kicker.top, kicker.fs, kicker.step, '400', pal.textSoft, SERIF);

    /* 移动端把「海口 · 石山」交给底部读数，画面上只留标题与题记 */
    if (!L.mob) {
      var meta = L.meta;
      drawVertical(g, meta.text, meta.x, meta.top, meta.fs, meta.step, '400', pal.label, SERIF);

      g.beginPath();
      g.moveTo(L.rule.x, L.rule.y0);
      g.lineTo(L.rule.x, L.rule.y1);
      g.strokeStyle = pal.lineFaint;
      g.lineWidth = 1;
      g.stroke();

      var sub = L.sub;
      drawVertical(g, sub.text, sub.x, sub.top, sub.fs, sub.step, '400', pal.textSoft, SERIF);
    }
  }

  /* ---- 图版标签 ---- */

  function paintLabels(g, pal) {
    g.save();
    g.textAlign = 'left';
    g.textBaseline = 'middle';

    for (var i = 0; i < L.labels.length; i++) {
      /* 移动端只留一块石头的标签，墙与沙交给文档 */
      if (L.mob && i !== 1) continue;
      var lb = L.labels[i];
      var dotR = L.mob ? 1.2 : 1.45;

      g.beginPath();
      g.arc(lb.x, lb.y, dotR, 0, TAU);
      g.fillStyle = pal.dot;
      g.fill();

      g.font = '400 ' + (L.mob ? 7.6 : 8.8) + 'px ' + SANS;
      g.fillStyle = pal.label;
      var end = drawSpaced(g, lb.cn, lb.x + (L.mob ? 6 : 7.8), lb.y, L.mob ? 1.1 : 1.4);

      if (!L.mob) {
        g.font = '400 6.8px ' + MONO;
        g.fillStyle = pal.labelFaint;
        drawSpaced(g, lb.en, end + 8, lb.y + 0.2, 1.0);
      }
    }
    g.restore();
  }

  /* ============================================================
     渲染
     ============================================================ */

  function clipAbove(g, line, t) {
    g.beginPath();
    g.moveTo(0, -2);
    g.lineTo(W, -2);
    for (var x = W; x >= 0; x -= 6) g.lineTo(x, line + waveAt(x, t));
    g.closePath();
  }

  function clipBelow(g, line, t) {
    g.beginPath();
    g.moveTo(0, line + waveAt(0, t));
    for (var x = 0; x <= W; x += 6) g.lineTo(x, line + waveAt(x, t));
    g.lineTo(W, H + 2);
    g.lineTo(0, H + 2);
    g.closePath();
  }

  function drawWetSlices(line, t) {
    var step = L.mob ? 6 : 5;
    var start = Math.max(0, line - 1);
    stats.slices = Math.ceil((H - start) / step);
    for (var y = start; y < H; y += step) {
      var d = y + step * 0.5 - line;
      var amp = Math.min(6.5, d * 0.022);
      var off = Math.sin(d * 0.05 + t * 0.95) * amp
        * (0.56 + 0.44 * Math.sin(t * 0.29 + y * 0.012));
      var hh = Math.min(step + 0.9, H - y);
      ctx.drawImage(
        boneLayer,
        0, Math.max(0, y) * DPR, W * DPR, hh * DPR,
        off, y, W, hh
      );
    }
  }

  function drawWetFilm(line, t) {
    var band = L.mob ? 16 : 22;
    var top = Math.max(0, line - band);
    var bh = Math.min(band, H - top);
    if (bh <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, bh);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.drawImage(boneLayer, 0, top * DPR, W * DPR, bh * DPR, 0, top, W, bh);
    ctx.restore();
  }

  function drawHeat(g, wet, line, t, heat, origin) {
    var alpha = Math.pow(clamp(heat, 0, 1), 1.05);
    if (alpha <= 0.003) return;

    var main = L.rock.main;
    var ox = origin ? clamp(origin.x, main.cx - main.w * 0.45, main.cx + main.w * 0.45) : L.defaultOrigin.x;
    var oy = origin ? clamp(origin.y, main.top + 16, main.base - 22) : L.defaultOrigin.y;
    var off = wet ? refractAt((main.top + main.base) * 0.5, line, t) : 0;

    /* 石肉里的珊瑚色 */
    g.save();
    if (wet) g.translate(off, 0);
    g.fillStyle = 'rgba(' + CORAL + ',' + (0.040 * alpha).toFixed(3) + ')';
    g.fill(main.path);
    g.restore();

    /* 热晕 */
    var r = Math.max(main.w * 1.55, L.rock.w * 0.68);
    var gr = g.createRadialGradient(ox, oy, 2, ox, oy, r);
    gr.addColorStop(0, 'rgba(' + CORAL + ',' + (0.26 * alpha).toFixed(3) + ')');
    gr.addColorStop(0.32, 'rgba(' + CORAL + ',' + (0.12 * alpha).toFixed(3) + ')');
    gr.addColorStop(0.68, 'rgba(' + CORAL + ',' + (0.04 * alpha).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(' + CORAL + ',0)');
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = gr;
    g.fillRect(ox - r, oy - r, r * 2, r * 2);

    var core = g.createRadialGradient(ox, oy, 1, ox, oy, main.w * 0.85);
    core.addColorStop(0, 'rgba(' + CORAL + ',' + (0.20 * alpha).toFixed(3) + ')');
    core.addColorStop(0.6, 'rgba(' + CORAL + ',' + (0.08 * alpha).toFixed(3) + ')');
    core.addColorStop(1, 'rgba(' + CORAL + ',0)');
    g.fillStyle = core;
    g.fillRect(ox - main.w, oy - main.w, main.w * 2, main.w * 2);
    g.restore();

    /* 裂纹只留在石肉里，不能爬到墙和纸上 */
    g.save();
    g.clip(main.path);

    /* 裂纹：从触点向外一段段亮起来 */
    var cracks = L.rock.cracks;
    for (var i = 0; i < cracks.length; i++) {
      var c = cracks[i];
      var reveal = clamp((heat - c.th) / 0.26, 0, 1);
      if (reveal <= 0.01) continue;
      g.beginPath();
      for (var p = 0; p < c.pts.length; p++) {
        var px = c.pts[p][0], py = c.pts[p][1];
        if (wet) px += refractAt(py, line, t);
        if (p === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokeStyle = 'rgba(' + CORAL + ',' + (0.12 * reveal).toFixed(3) + ')';
      g.lineWidth = c.width + 2.8;
      g.stroke();
      g.strokeStyle = 'rgba(' + CORAL + ',' + (0.78 * reveal * c.speed).toFixed(3) + ')';
      g.lineWidth = c.width;
      g.stroke();

      if (reveal > 0.92) {
        var tip = c.pts[c.pts.length - 1];
        var tx = tip[0] + (wet ? refractAt(tip[1], line, t) : 0);
        var tw = 0.55 + 0.45 * Math.sin(t * 2.1 + i * 1.3);
        g.beginPath();
        g.arc(tx, tip[1], 1.15, 0, TAU);
        g.fillStyle = 'rgba(' + CORAL + ',' + (0.45 * tw).toFixed(3) + ')';
        g.fill();
      }
    }
    g.restore();

    /* 轮廓也被烤暖 */
    g.save();
    if (wet) g.translate(off, 0);
    g.strokeStyle = 'rgba(' + CORAL + ',' + (0.09 * alpha).toFixed(3) + ')';
    g.lineWidth = 6;
    g.stroke(main.path);
    g.strokeStyle = 'rgba(' + CORAL + ',' + (0.55 * alpha).toFixed(3) + ')';
    g.lineWidth = 1.2;
    g.stroke(main.path);
    g.restore();

    /* 上升的热气：三条细线，只在干侧 */
    if (!wet && heat > 0.16) {
      g.save();
      g.strokeStyle = 'rgba(' + CORAL + ',' + (0.26 * alpha).toFixed(3) + ')';
      g.lineWidth = 1;
      for (var h = 0; h < 4; h++) {
        var rise = (t * 7 + h * 9) % 26;
        var baseX = main.cx - main.w * 0.22 + h * main.w * 0.18;
        var baseY = main.top - 6 - rise;
        g.beginPath();
        for (var xx = 0; xx <= 1; xx += 0.08) {
          var wx = baseX + xx * main.w * 0.34;
          var wy = baseY - Math.sin(xx * 7 + t * 1.2 + h) * 2.4 - xx * 4;
          if (xx === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
        }
        g.stroke();
      }
      g.restore();
    }

    /* 触点处极慢的环 */
    if (heat > 0.06) {
      var rx = ox + (wet ? refractAt(oy, line, t) : 0);
      g.save();
      for (var k = 0; k < 2; k++) {
        var rr = 8 + ((t * 16 + k * 23) % 58);
        var fade = clamp(1 - rr / 66, 0, 1) * heat * 0.30;
        g.beginPath();
        g.arc(rx, oy, rr, 0, TAU);
        g.strokeStyle = 'rgba(' + CORAL + ',' + fade.toFixed(3) + ')';
        g.lineWidth = 1;
        g.stroke();
      }
      g.restore();
    }
  }

  function drawHeatReflection(line, t, heat) {
    if (heat < 0.025) return;
    var rock = L.rock;
    var cx = rock.cx;
    var a = Math.pow(heat, 1.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    var gr = ctx.createRadialGradient(cx, line + 54, 4, cx, line + 54, rock.w * 0.85);
    gr.addColorStop(0, 'rgba(' + CORAL + ',' + (0.12 * a).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(' + CORAL + ',0)');
    ctx.fillStyle = gr;
    ctx.fillRect(cx - rock.w, line, rock.w * 2, Math.min(H - line, rock.w * 1.6));

    for (var i = 0; i < 7; i++) {
      var yy = line + 9 + i * 8 + Math.sin(t * 0.52 + i * 1.3) * 2;
      if (yy > H - 2) break;
      var ww = rock.w * (0.62 - i * 0.055) * (0.68 + 0.32 * Math.sin(t * 0.7 + i));
      var xx = cx + Math.sin(t * 0.35 + i * 1.2) * rock.w * 0.2;
      var alpha = a * 0.16 * (1 - i / 8);
      ctx.beginPath();
      ctx.moveTo(xx - ww * 0.5, yy);
      for (var u = 0.1; u <= 1; u += 0.1) {
        ctx.lineTo(xx - ww * 0.5 + ww * u, yy + Math.sin(u * 9 + t * 1.4 + i) * 1.1);
      }
      ctx.strokeStyle = 'rgba(' + CORAL + ',' + alpha.toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSurface(line, t) {
    if (line <= 0 || line >= H) return;
    ctx.save();
    ctx.beginPath();
    for (var x = 0; x <= W; x += 6) {
      var wy = line + waveAt(x, t);
      if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
    }
    ctx.strokeStyle = 'rgba(242,236,223,0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();

    var seed = Math.floor(line / 7);
    var n = L.mob ? 30 : 46;
    for (var i = 0; i < n; i++) {
      var r = rnd(i * 13 + seed);
      var xx = ((r + t * 0.004 * ((i % 3) + 1)) % 1) * W;
      var base = line + waveAt(xx, t);
      var yy = base + (rnd(i * 7.3 + seed) - 0.5) * 11;
      var a = (0.04 + rnd(i * 3.1 + seed) * 0.20) * Math.exp(-Math.abs(yy - base) / 8);
      ctx.fillStyle = 'rgba(242,236,223,' + a.toFixed(3) + ')';
      ctx.fillRect(xx, yy, 1.2 + rnd(i * 5.7) * 2.6, 0.8);
    }
    ctx.restore();
  }

  function render(s) {
    if (!built || !ctx) return;
    var line = s.lineY;
    var t = s.time;
    var heat = clamp(s.heat || 0, 0, 1);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* 干：只取干侧那一条，避免整幅图的像素搬运 */
    ctx.save();
    clipAbove(ctx, line, t);
    ctx.clip();
    var dryH = Math.min(H, Math.max(1, line + 8));
    ctx.drawImage(inkLayer, 0, 0, W * DPR, dryH * DPR, 0, 0, W, dryH);
    if (heat > 0.003) drawHeat(ctx, false, line, t, heat, s.origin);
    ctx.restore();

    /* 湿 */
    if (line < H - 0.5) {
      ctx.save();
      clipBelow(ctx, line, t);
      ctx.clip();
      drawWetSlices(line, t);
      if (heat > 0.003) {
        drawHeat(ctx, true, line, t, heat, s.origin);
        drawHeatReflection(line, t, heat);
      }
      ctx.restore();

      drawWetFilm(line, t);
    }

    if (s.waterline !== false) drawSurface(line, t);
  }

  /* ============================================================
     对外
     ============================================================ */

  function build(w, h, dpr) {
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    W = Math.max(1, w);
    H = Math.max(1, h);
    DPR = dpr || 1;

    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));

    L = makeLayout(W, H);
    inkLayer = makeLayer('ink');
    boneLayer = makeLayer('bone');

    built = true;
    stats.buildMs = ((window.performance && performance.now) ? performance.now() : Date.now()) - t0;
  }

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d', { alpha: true });
    canvas.width = 1;
    canvas.height = 1;
  }

  function hitRock(x, y) {
    if (!L) return false;
    var hit = L.hit;
    var nx = (x - hit.cx) / hit.rx;
    var ny = (y - hit.cy) / hit.ry;
    return nx * nx + ny * ny <= 1;
  }

  function getRockRect() {
    if (!L) return { x: 0, y: 0, w: 1, h: 1 };
    var hit = L.hit;
    var padX = L.mob ? 12 : 14;
    return {
      x: hit.cx - hit.rx - padX,
      y: hit.cy - hit.ry - 8,
      w: hit.rx * 2 + padX * 2,
      h: hit.ry * 2 + 18
    };
  }

  function getDefaultOrigin() {
    return L ? L.defaultOrigin : { x: 0, y: 0 };
  }

  function getBounds() {
    return { lineHigh: L ? L.lineHigh : 0, lineLow: L ? L.lineLow : H, rock: L ? L.rock : null };
  }

  window.StudyScene = {
    init: init,
    build: build,
    render: render,
    hitRock: hitRock,
    getRockRect: getRockRect,
    getDefaultOrigin: getDefaultOrigin,
    getBounds: getBounds,
    get stats() { return stats; }
  };
})();
