/* ============================================================
   05 归潮 / RETURN —— 《潮汐书 · 海南》
   月银、深靛；水线升回来，把 01–04 的字一件件收走；最后一张潮汐笺。

   · 场景只画：月 / 朔望 / 边注 / 四个字 / 空字位 / 水花 / 潮汐笺。
     背景、水线、HUD、章节文案、声音、收集全部由 shell 负责。
   · 干 = 墨，湿 = 骨白 + 0.35px blur；切分只认 s.lineY。
   · 四个字的位置 = 潮汐笺的五个字位；水线过到哪，字被擦到哪。
   · 卡在 05 局部 p≈0.90 时「晾干」出现：
       A.setCardData({ date, moon, moonEn, tide, words:[], closing })
       A.getCardData() / A.cardSpec() / A.getCardState()
       A.onCardShown / A.onSealed        （声音 / R2 用，可选）
       A.cardVisible / A.collected / A.sealed / A.progress
     卡的导出 / 保存是 R2 的 js/core/tidecard.js；这里只画视觉层。
   · 「汐」只在卡片出现时调一次 ctx.onCollect('汐')（或 s.onCollect）。
   · 交互：按住卡 → 收好（印涨起来）；水面上按住/拖动 → 推起一圈水。
   ============================================================ */
(function () {
  'use strict';

  var SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","STZhongsong",serif';
  var SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
  var MONO = 'Consolas,"JetBrains Mono","SFMono-Regular",monospace';

  var COPY = {
    id: '05',
    title: '归潮',
    en: 'RETURN',
    word: '汐',
    acts: [
      { id: '01', cn: '玄武', en: 'BASALT', char: '火' },
      { id: '02', cn: '潮间带', en: 'INTERTIDAL', char: '拾' },
      { id: '03', cn: '珊瑚', en: 'CORAL', char: '卵' },
      { id: '04', cn: '航线', en: 'ROUTE', char: '更' }
    ],
    card: {
      title: '潮汐笺',
      titleEn: 'TIDE CARD',
      date: ['日期', 'DATE'],
      moon: ['月相', 'MOON'],
      tide: ['潮时', 'TIDE'],
      words: ['拾得', 'WORDS'],
      closing: '收好这一页。海会再来。',
      empty: '这一页是空的。海还会再写。',
      footer: '潮汐书 · 海南 / 页内潮程 6h13m / XR LAB 2026',
      footerL: '潮汐书 · 海南',
      footerR: '页内潮程 6h13m · XR LAB 2026',
      seal: '潮',
      hold: '按住 · 收好',
      holdEn: 'HOLD TO KEEP',
      kept: '收好。',
      keptEn: 'KEPT'
    },
    labels: {
      syzygy: ['朔望', 'SYZYGY'],
      words: ['拾得', 'THE WORDS FOUND']
    },
    micro: {
      take: '海回来收字。',
      dry: '只剩这一张是干的。'
    },
    note: '盐是海退走以后，留在石头上的标点。'
  };

  var RGB = {
    ink: [17, 19, 16],
    bone: [242, 236, 223],
    sea: [3, 16, 15],
    teal: [22, 51, 47],
    moon: [200, 210, 212],
    coral: [216, 80, 58]
  };

  var CARD_RATIO = 0.644;           /* w / h，纸的竖长比例 */
  var SLOT_F = [0.245, 0.345, 0.445, 0.545, 0.645];  /* 五个字位（卡高的比例） */
  var REV_A = 0.840, REV_B = 0.895; /* 卡的晾干：05 局部 p */
  var ZI_FRONT = 0.700;             /* 晾干到 70% 时，汐写到纸上 */

  var S = {
    ctx: null, root: null, W: 0, H: 0, dpr: 1, narrow: false,
    card: null, slots: [], moon: null, syz: null, note: null,
    labels: [], header: null, grain: [],
    p: 0, rev: 0, revRaw: 0, zi: 0, granted: false, grantedAt: 0,
    sealed: false, hold: 0, held: false,
    lastT: 0, dt: 0, lastDown: false,
    ripples: [], lastRipT: -9, lastRipX: 0, lastRipY: 0,
    cardWet: false, shown: false,
    entered: null, cardData: null, takenAt: [0.68, 0.60, 0.53, 0.45],
    pointer: { x: 0.5, y: 0.5, down: false }, bound: false
  };

  /* ---------- util ---------- */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function ink(a) { return rgba(RGB.ink, a); }
  function bone(a) { return rgba(RGB.bone, a); }
  function moonC(a) { return rgba(RGB.moon, a); }
  function fontStr(weight, size, family) { return weight + ' ' + size + 'px ' + family; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function ymd(d) { return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()); }
  function hm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  function moonInfo(d) {
    var synodic = 29.530588853;
    var ref = Date.UTC(2000, 0, 6, 18, 14);
    var days = (d.getTime() - ref) / 86400000;
    var phase = ((days % synodic) + synodic) % synodic / synodic;
    var name, en;
    if (phase < 0.03 || phase >= 0.97) { name = '新月'; en = 'NEW MOON'; }
    else if (phase < 0.22) { name = '娥眉月'; en = 'WAXING CRESCENT'; }
    else if (phase < 0.28) { name = '上弦'; en = 'FIRST QUARTER'; }
    else if (phase < 0.47) { name = '盈凸'; en = 'WAXING GIBBOUS'; }
    else if (phase < 0.53) { name = '满月'; en = 'FULL MOON'; }
    else if (phase < 0.72) { name = '亏凸'; en = 'WANING GIBBOUS'; }
    else if (phase < 0.78) { name = '下弦'; en = 'LAST QUARTER'; }
    else { name = '残月'; en = 'WANING CRESCENT'; }
    return { phase: phase, name: name, en: en };
  }

  function trackedW(g, str, fs, weight, family, track) {
    g.font = fontStr(weight || 400, fs, family || SERIF);
    var w = 0;
    for (var i = 0; i < str.length; i++) w += g.measureText(str.charAt(i)).width + fs * track;
    return Math.max(0, w - fs * track);
  }

  function putTracked(g, str, x, y, fs, weight, family, color, track, align) {
    g.font = fontStr(weight || 400, fs, family || SERIF);
    g.fillStyle = color;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    var w = trackedW(g, str, fs, weight || 400, family || SERIF, track);
    var ox = align === 'center' ? -w / 2 : (align === 'right' ? -w : 0);
    for (var i = 0; i < str.length; i++) {
      g.fillText(str.charAt(i), x + ox, y);
      ox += g.measureText(str.charAt(i)).width + fs * track;
    }
  }

  function txt(g, str, x, y, fs, weight, family, color, align) {
    g.font = fontStr(weight || 400, fs, family || SANS);
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

  function rect(g, x, y, w, h, lw, color, fill) {
    g.beginPath();
    g.rect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    if (fill) { g.fillStyle = fill; g.fill(); }
    g.lineWidth = lw;
    g.strokeStyle = color;
    g.stroke();
  }

  /* ---------- layout ---------- */

  function rebuild() {
    var W = S.W, H = S.H;
    S.narrow = W < 820;

    var c;
    if (!S.narrow) {
      var ch = clamp(H * 0.56, 350, 540);
      var cw = ch * CARD_RATIO;
      var ccx = W * 0.665;
      c = { x: ccx - cw / 2, y: H * 0.5 - ch / 2, w: cw, h: ch };
    } else {
      var bottom = H - (H > 720 ? 128 : 104);
      var top = H * 0.375;
      var avail = Math.max(220, bottom - top);
      var wMax = Math.min(W * 0.625, 268);
      var h2 = Math.min(avail, wMax / CARD_RATIO);
      var w2 = h2 * CARD_RATIO;
      c = { x: (W - w2) / 2, y: top + (avail - h2) * 0.42, w: w2, h: h2 };
    }
    S.card = c;

    c.pad = Math.max(12, c.w * 0.078);
    c.titleFs = clamp(c.w * 0.095, 17, 28);
    c.wordFs = clamp(c.w * 0.115, 21, 38);
    c.wordX = c.x + c.w * 0.30;
    c.slots = [];
    for (var i = 0; i < SLOT_F.length; i++) c.slots.push(c.y + c.h * SLOT_F[i]);
    c.ruleY = c.y + c.h * 0.16;
    c.titleY = c.y + c.h * 0.101;
    c.sealSize = clamp(c.w * 0.072, 17, 24);
    c.sealX = c.x + c.w - c.pad - c.sealSize;
    c.sealY = c.y + c.h * 0.062;
    c.hintY = c.y + c.h + (S.narrow ? 17 : 22);

    /* 月 */
    var r = S.narrow ? Math.min(W * 0.078, 32) : Math.min(W * 0.048, H * 0.075);
    var mcx = S.narrow ? W * 0.715 : W * 0.700;
    var mcy = H * (S.narrow ? 0.135 : 0.108);
    S.moon = { x: mcx, y: mcy, r: r };

    var sy = { x: 0, y: 0, below: S.narrow };
    if (S.narrow) {
      sy.x = mcx - 24;
      sy.y = mcy + r + 16;
    } else {
      sy.x = mcx + r + 18;
      sy.y = mcy + r * 0.24;
    }
    S.syz = sy;

    /* 页边注（桌面才放） */
    if (!S.narrow) {
      S.note = {
        x: W * 0.902,
        y: H * 0.40,
        pitch: 10.4,
        fs: 7.6
      };
    } else {
      S.note = null;
    }

    /* 四个字 → 五个字位里的前四个；取字时机按 shell 水线算（journey.js 05 反转） */
    S.labels = [];
    S.takenAt = [];
    for (var a = 0; a < COPY.acts.length; a++) {
      var base = c.slots[a];
      var at = 1 - ((base / H) - 0.078) / 0.822;
      S.takenAt.push(clamp(at, 0.32, 0.82));
      S.labels.push({
        wordX: c.wordX,
        base: base,
        cn: COPY.acts[a].cn,
        en: COPY.acts[a].en,
        id: COPY.acts[a].id,
        char: COPY.acts[a].char,
        wipe: 0
      });
    }
    S.header = {
      x: c.wordX - c.wordFs * 0.95,
      y: c.slots[0] - c.wordFs * 1.30
    };

    /* 纸纹：只在卡内，resize 时播种 */
    var rnd = mulberry32(505);
    S.grain = [];
    for (var k = 0; k < 64; k++) {
      S.grain.push({
        x: c.x + c.pad + rnd() * (c.w - c.pad * 2),
        y: c.y + c.h * 0.17 + rnd() * c.h * 0.78,
        w: 0.5 + rnd() * 0.9,
        h: 0.5 + rnd() * 0.5,
        a: rnd() < 0.5 ? 0.034 : 0.020
      });
    }
  }

  /* ---------- 月 / 朔望 / 边注 ---------- */

  function drawMoon(g, mode) {
    var m = S.moon;
    if (!m) return;
    /* 月是 05 的材料强调色：纸上是一枚灰银的月，水里更亮 */
    var wet = mode !== 'ink';
    var col = wet ? moonC(0.88) : moonC(0.66);
    var fillC = wet ? moonC(0.06) : moonC(0.045);
    var termC = wet ? moonC(0.52) : moonC(0.40);
    var craterC = wet ? moonC(0.34) : moonC(0.24);

    g.beginPath();
    g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    g.lineWidth = 1.05;
    g.strokeStyle = col;
    g.stroke();

    /* 盈凸：亮面在右，明暗界线是向左鼓的一条圆弧 */
    g.beginPath();
    g.arc(m.x, m.y, m.r * 0.995, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(m.x, m.y, m.r * 0.56, m.r * 0.995, 0, Math.PI / 2, -Math.PI / 2, true);
    g.closePath();
    g.fillStyle = fillC;
    g.fill();

    g.beginPath();
    g.ellipse(m.x, m.y, m.r * 0.56, m.r * 0.995, 0, -Math.PI / 2, Math.PI / 2, false);
    g.lineWidth = 0.7;
    g.strokeStyle = termC;
    g.stroke();

    /* 三个小坑：0.6px，不画阴影 */
    var cr = [
      [m.x - m.r * 0.20, m.y - m.r * 0.26, m.r * 0.10],
      [m.x + m.r * 0.30, m.y + m.r * 0.06, m.r * 0.075],
      [m.x - m.r * 0.02, m.y + m.r * 0.42, m.r * 0.06]
    ];
    g.strokeStyle = craterC;
    g.lineWidth = 0.6;
    for (var i = 0; i < cr.length; i++) {
      g.beginPath();
      g.arc(cr[i][0], cr[i][1], cr[i][2], 0, Math.PI * 2);
      g.stroke();
    }
  }

  function drawSyzygy(g, mode) {
    var sy = S.syz;
    if (!sy) return;
    var col = mode === 'ink' ? ink(0.46) : moonC(0.62);
    var rr = 2.6;
    g.lineWidth = 0.8;
    g.strokeStyle = col;
    g.beginPath();
    g.arc(sy.x, sy.y - 3, rr, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(sy.x + 9, sy.y - 3, rr, 0, Math.PI * 2);
    g.fillStyle = mode === 'ink' ? ink(0.04) : moonC(0.07);
    g.fill();
    g.strokeStyle = col;
    g.stroke();

    txt(g, COPY.labels.syzygy[0], sy.x + 18, sy.y, 7.4, 400, SERIF,
      mode === 'ink' ? ink(0.52) : bone(0.62), 'left');
    txt(g, COPY.labels.syzygy[1], sy.x + 18, sy.y + 8.4, 5.2, 400, MONO,
      mode === 'ink' ? ink(0.34) : bone(0.42), 'left');
  }

  function drawNote(g, mode) {
    var n = S.note;
    if (!n) return;
    var str = COPY.note;
    var col = mode === 'ink' ? ink(0.42) : bone(0.50);
    for (var i = 0; i < str.length; i++) {
      txt(g, str.charAt(i), n.x, n.y + i * n.pitch, n.fs, 400, SERIF, col, 'left');
    }
    line(g, n.x - 9, n.y - 8, n.x - 9, n.y + (str.length - 1) * n.pitch + 4, 0.6,
      mode === 'ink' ? ink(0.14) : bone(0.16));
  }

  /* ---------- 01–04 的四个字 ---------- */

  function markStone(g, cx, cy, r, mode) {
    var col = mode === 'ink' ? ink(0.24) : bone(0.28);
    g.beginPath();
    for (var i = 0; i < 7; i++) {
      var a = i / 7 * Math.PI * 2 - 0.5;
      var rr = r * (0.82 + 0.14 * Math.sin(i * 2.7 + 1.1));
      var x = cx + Math.cos(a) * rr;
      var y = cy + Math.sin(a) * rr * 0.74;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = mode === 'ink' ? ink(0.03) : bone(0.035);
    g.fill();
    g.lineWidth = 0.8;
    g.strokeStyle = col;
    g.stroke();
    g.fillStyle = mode === 'ink' ? ink(0.28) : bone(0.32);
    for (var k = 0; k < 4; k++) {
      var aa = k * 1.7 + 0.6;
      g.beginPath();
      g.arc(cx + Math.cos(aa) * r * 0.34, cy + Math.sin(aa) * r * 0.24, 0.9, 0, Math.PI * 2);
      g.fill();
    }
  }

  function markShell(g, cx, cy, r, mode) {
    var col = mode === 'ink' ? ink(0.24) : bone(0.28);
    g.strokeStyle = col;
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(cx, cy + r * 0.36, r * 0.86, Math.PI * 1.10, Math.PI * 1.90, false);
    g.stroke();
    for (var i = 0; i < 4; i++) {
      var a = Math.PI * (1.14 + i * 0.20);
      line(g, cx, cy + r * 0.36, cx + Math.cos(a) * r * 0.82,
        cy + r * 0.36 + Math.sin(a) * r * 0.82, 0.6, col);
    }
    g.beginPath();
    g.arc(cx, cy + r * 0.36, r * 0.15, 0, Math.PI * 2);
    g.stroke();
  }

  function markCoral(g, cx, cy, r, mode) {
    var col = mode === 'ink' ? ink(0.24) : bone(0.28);
    g.strokeStyle = col;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(cx, cy + r * 0.55);
    g.lineTo(cx - r * 0.10, cy + r * 0.05);
    g.lineTo(cx - r * 0.42, cy - r * 0.28);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - r * 0.10, cy + r * 0.05);
    g.lineTo(cx + r * 0.30, cy - r * 0.18);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - r * 0.13, cy + r * 0.22);
    g.lineTo(cx - r * 0.46, cy - r * 0.02);
    g.stroke();
    g.fillStyle = col;
    for (var i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(cx - r * 0.46 + i * r * 0.40, cy - r * 0.30 - (i % 2) * r * 0.10, 1.0, 0, Math.PI * 2);
      g.fill();
    }
  }

  function markCompass(g, cx, cy, r, mode) {
    var col = mode === 'ink' ? ink(0.24) : bone(0.28);
    g.strokeStyle = col;
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(cx, cy - r * 0.95);
    g.lineTo(cx + r * 0.14, cy);
    g.lineTo(cx, cy + r * 0.95);
    g.lineTo(cx - r * 0.14, cy);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(cx - r * 0.95, cy);
    g.lineTo(cx, cy - r * 0.12);
    g.lineTo(cx + r * 0.95, cy);
    g.lineTo(cx, cy + r * 0.12);
    g.closePath();
    g.stroke();
  }

  function drawMark(g, i, cx, cy, r, mode) {
    if (i === 0) markStone(g, cx, cy, r, mode);
    else if (i === 1) markShell(g, cx, cy, r, mode);
    else if (i === 2) markCoral(g, cx, cy, r, mode);
    else markCompass(g, cx, cy, r, mode);
  }

  function drawColumn(g, mode, s) {
    var fs = S.card.wordFs;
    var px = S.card.wordX;
    for (var i = 0; i < 4; i++) {
      var it = S.labels[i];
      if (!it) continue;
      var wipe = smooth((S.p - (S.takenAt[i] - 0.018)) / 0.036);
      it.wipe = wipe;
      var base = it.base;
      var top = base - fs * 0.98;
      var bot = base + fs * 0.16;
      var markR = fs * 0.62;
      var mcx = px + fs * 0.47;
      var mcy = base - fs * 0.38;

      if (wipe < 1) {
        var cut = bot - wipe * (bot - top);
        g.save();
        g.beginPath();
        g.rect(0, 0, S.W, Math.max(0, cut));
        g.clip();

        drawMark(g, i, mcx, mcy, markR, mode);

        var wordCol = mode === 'ink' ? ink(0.82) : bone(0.86);
        txt(g, it.char, px, base, fs, 500, SERIF, wordCol, 'left');

        var lx = px - fs * 0.95;
        txt(g, it.id + '  ' + it.cn, lx, base - fs * 0.14, S.narrow ? 7.4 : 8.0,
          400, SERIF, mode === 'ink' ? ink(0.55) : bone(0.62), 'right');
        txt(g, it.en, lx, base - fs * 0.14 + (S.narrow ? 7.8 : 8.4),
          S.narrow ? 5.3 : 5.8, 400, MONO,
          mode === 'ink' ? ink(0.34) : bone(0.40), 'right');
        g.restore();

        if (wipe > 0.02 && wipe < 0.98) {
          /* 褪下去的一层墨/盐：三条横丝 + 两点 */
          var fr = mode === 'ink' ? ink(0.28) : bone(0.32);
          for (var k = 0; k < 3; k++) {
            var yy = cut - 3 - k * 4;
            if (yy < top) continue;
            line(g, px - fs * 0.06, yy, px + fs * (0.88 - k * 0.10), yy, 0.55, fr);
          }
          g.fillStyle = mode === 'ink' ? ink(0.20) : bone(0.24);
          g.fillRect(px + fs * 0.22, cut + 4, 1, 1);
          g.fillRect(px + fs * 0.62, cut + 8, 1, 1);
        }
      } else {
        /* 空字位：一条 8px 横线；幕名留在页边，像收据上的一行 */
        line(g, px + fs * 0.30, base - fs * 0.34, px + fs * 0.30 + 8, base - fs * 0.34,
          0.8, mode === 'ink' ? ink(0.42) : bone(0.46));
        txt(g, it.id + '  ' + it.cn, px - fs * 0.95, base - fs * 0.10,
          S.narrow ? 7.0 : 7.4, 400, SERIF,
          mode === 'ink' ? ink(0.30) : bone(0.34), 'right');
      }
    }

    /* 第五个字位：汐；卡出现前只是一条空横线 */
    var pb = S.card.slots[4];
    line(g, px + fs * 0.30, pb - fs * 0.34, px + fs * 0.30 + 8, pb - fs * 0.34,
      0.8, mode === 'ink' ? ink(0.36) : bone(0.40));

    /* 拾得 / 表头 */
    var hx = S.header.x;
    var hy = S.header.y;
    txt(g, COPY.labels.words[0], hx, hy, S.narrow ? 7.6 : 8.0, 500, SERIF,
      mode === 'ink' ? ink(0.55) : bone(0.60), 'right');
    txt(g, COPY.labels.words[1], hx, hy + 9, S.narrow ? 5.4 : 5.8, 400, MONO,
      mode === 'ink' ? ink(0.36) : bone(0.40), 'right');
    line(g, hx - 64, hy + 13, hx, hy + 13, 0.6,
      mode === 'ink' ? ink(0.20) : bone(0.22));

    /* 「海回来收字。」只在第一次收字前后出现 */
    if (S.p > 0.42 && S.p < 0.60) {
      txt(g, COPY.micro.take, hx, hy - 26, S.narrow ? 7.2 : 7.6, 400, SERIF,
        mode === 'ink' ? ink(0.44) : bone(0.50), 'right');
    }
  }

  /* ---------- 水面 ---------- */

  function drawReflection(g, s) {
    var m = S.moon;
    if (!m) return;
    if (s.lineY < m.y + m.r + 6) return;
    var top = s.lineY + 10;
    var wob = s.reduced ? 0 : Math.sin(s.t * 0.8) * 1.2;
    for (var i = 0; i < 6; i++) {
      var y = top + i * 12;
      var w = m.r * (1.15 - i * 0.13);
      var a = 0.16 - i * 0.022;
      if (a <= 0.01) break;
      var off = s.reduced ? 0 : Math.sin((i + 1) * 1.9 + s.t * 0.55) * 2.2 + wob;
      line(g, m.x - w / 2 + off, y, m.x + w / 2 + off, y, 0.6, moonC(a));
    }
  }

  function drawRipples(g, s) {
    for (var i = 0; i < S.ripples.length; i++) {
      var r = S.ripples[i];
      var age = s.t - r.t;
      if (age < 0 || age > 1.15) continue;
      var e = age / 1.15;
      for (var k = 0; k < 3; k++) {
        var rad = 5 + e * 24 + k * 7;
        var a = (0.22 - k * 0.05) * (1 - e) * (1 - e * 0.35);
        g.beginPath();
        g.arc(r.x, r.y, rad, Math.PI * 0.55, Math.PI * 2.45, false);
        g.lineWidth = 0.55;
        g.strokeStyle = moonC(a);
        g.stroke();
      }
      g.fillStyle = moonC(0.22 * (1 - e));
      g.fillRect(r.x - 6 - e * 8, r.y - 1, 1.6, 0.8);
      g.fillRect(r.x + 6 + e * 8, r.y + 2, 1.2, 0.8);
    }
  }

  /* ---------- 潮汐笺 ---------- */

  function wordSet() {
    var set = {};
    var arr = (S.cardData && S.cardData.words) || [];
    for (var i = 0; i < arr.length; i++) set[arr[i]] = true;
    if (S.granted) set[COPY.word] = true;
    return set;
  }

  function cardFilled() {
    var set = wordSet();
    var n = 0;
    var order = [];
    for (var i = 0; i < COPY.acts.length; i++) {
      if (set[COPY.acts[i].char]) n++;
      order.push(COPY.acts[i].char);
    }
    if (set[COPY.word]) n++;
    order.push(COPY.word);
    return { n: n, order: order, set: set };
  }

  function cardClip(g, rev) {
    var c = S.card;
    var front = c.y + c.h * rev;
    g.beginPath();
    g.moveTo(c.x, c.y);
    g.lineTo(c.x + c.w, c.y);
    g.lineTo(c.x + c.w, front + S.ctx.waveAt(c.x + c.w) * 1.1);
    for (var x = c.x + c.w - 12; x > c.x; x -= 12) {
      g.lineTo(x, front + S.ctx.waveAt(x) * 1.1);
    }
    g.lineTo(c.x, front + S.ctx.waveAt(c.x) * 1.1);
    g.closePath();
  }

  function drawSeal(g) {
    var c = S.card;
    var ss = c.sealSize;
    var x = c.sealX, y = c.sealY;
    var h = S.hold;
    rect(g, x, y, ss, ss, 1, rgba(RGB.coral, S.sealed ? 0.92 : 0.52),
      S.sealed ? rgba(RGB.coral, 0.90) : null);

    if (!S.sealed && h > 0.02) {
      g.save();
      g.beginPath();
      g.rect(x + 2, y + ss - 2 - (ss - 4) * h, ss - 4, (ss - 4) * h + 2);
      g.clip();
      g.fillStyle = rgba(RGB.coral, 0.55);
      g.fillRect(x + 1, y + 1, ss - 2, ss - 2);
      g.restore();
    }

    txt(g, COPY.card.seal, x + ss / 2, y + ss * 0.70, ss * 0.52, 500, SERIF,
      S.sealed ? bone(0.94) : rgba(RGB.coral, 0.85), 'center');
  }

  function drawCardBody(g) {
    var c = S.card;
    var pad = c.pad;
    var filled = cardFilled();

    /* 纸 */
    g.fillStyle = 'rgba(242,236,223,0.952)';
    g.fillRect(c.x, c.y, c.w, c.h);

    /* 纸纹 */
    for (var i = 0; i < S.grain.length; i++) {
      var o = S.grain[i];
      g.fillStyle = ink(o.a);
      g.fillRect(o.x, o.y, o.w, o.h);
    }

    /* 框：1px 外框 + 5px 内细线；不画阴影/圆角 */
    rect(g, c.x, c.y, c.w, c.h, 1.05, ink(0.62));
    rect(g, c.x + 5, c.y + 5, c.w - 10, c.h - 10, 0.65, ink(0.16));

    /* 裁切角标：四个角各两笔 0.6px */
    var cm = 7;
    var cc = ink(0.30);
    var corners = [
      [c.x + 10, c.y + 10, 1, 1],
      [c.x + c.w - 10, c.y + 10, -1, 1],
      [c.x + 10, c.y + c.h - 10, 1, -1],
      [c.x + c.w - 10, c.y + c.h - 10, -1, -1]
    ];
    for (var q = 0; q < 4; q++) {
      var b = corners[q];
      line(g, b[0], b[1], b[0] + cm * b[2], b[1], 0.6, cc);
      line(g, b[0], b[1], b[0], b[1] + cm * b[3], 0.6, cc);
    }

    /* 标题 + 英文 micro + 印 */
    putTracked(g, COPY.card.title, c.x + pad, c.titleY, c.titleFs, 500, SERIF,
      ink(0.88), 0.16, 'left');
    putTracked(g, COPY.card.titleEn, c.x + pad,
      c.titleY + Math.max(13, c.titleFs * 0.62), S.narrow ? 5.4 : 6.0, 400, MONO,
      ink(0.46), 0.26, 'left');
    drawSeal(g);

    line(g, c.x + pad, c.ruleY, c.x + c.w - pad, c.ruleY, 0.8, ink(0.34));

    /* 五个字：竖排；空的是一条 8px 横线 */
    var fs = c.wordFs;
    var wx = c.wordX;
    var order = filled.order;
    for (var s = 0; s < order.length; s++) {
      var base = c.slots[s];
      var ch = order[s];
      var present = !!filled.set[ch];
      if (!present) {
        line(g, wx + fs * 0.30, base - fs * 0.34, wx + fs * 0.30 + 8, base - fs * 0.34,
          0.8, ink(0.42));
        continue;
      }
      var inkCol = ch === COPY.word ? ink(0.92) : ink(0.82);
      if (ch === COPY.word) {
        /* 最后一字：晾干到 70% 后，从上往下写出来 */
        g.save();
        g.beginPath();
        g.rect(wx - 2, base - fs * 1.0, fs * 1.2, fs * (0.18 + S.zi * 0.92));
        g.clip();
        txt(g, ch, wx, base, fs, 500, SERIF, inkCol, 'left');
        g.restore();
        line(g, wx + fs * 0.30, base + fs * 0.15, wx + fs * 0.30 + 8, base + fs * 0.15,
          0.6, rgba(RGB.moon, 0.62));
      } else {
        txt(g, ch, wx, base, fs, 500, SERIF, inkCol, 'left');
      }
    }

    /* 拾得 / WORDS：右上，和印同一列 */
    var lx = c.x + c.w - pad;
    var ly = c.slots[0] - fs * 0.38;
    txt(g, COPY.card.words[0], lx, ly, S.narrow ? 7.2 : 7.6, 500, SERIF, ink(0.55), 'right');
    txt(g, COPY.card.words[1], lx, ly + 8.5, S.narrow ? 5.0 : 5.4, 400, MONO, ink(0.38), 'right');

    /* 日期 / 月相 / 潮时：右下等宽小字 */
    var rx = c.x + c.w - pad;
    var f1 = c.y + c.h * 0.792;
    var f2 = c.y + c.h * 0.843;
    var f3 = c.y + c.h * 0.896;
    var lfs = S.narrow ? 5.9 : 6.4;
    var vfs = S.narrow ? 7.2 : 8.0;
    txt(g, COPY.card.date[0] + '  ' + COPY.card.date[1], c.x + pad, f1, lfs, 400, MONO, ink(0.55), 'left');
    txt(g, S.cardData.date, rx, f1, vfs, 400, MONO, ink(0.86), 'right');
    txt(g, COPY.card.moon[0] + '  ' + COPY.card.moon[1], c.x + pad, f2, lfs, 400, MONO, ink(0.55), 'left');
    txt(g, S.cardData.moon, rx, f2, vfs, 400, SANS, ink(0.86), 'right');
    txt(g, S.cardData.moonEn, rx, f2 + (S.narrow ? 7.6 : 8.2), S.narrow ? 4.8 : 5.2,
      400, MONO, ink(0.46), 'right');
    txt(g, COPY.card.tide[0] + '  ' + COPY.card.tide[1], c.x + pad, f3, lfs, 400, MONO, ink(0.55), 'left');
    txt(g, S.cardData.tide, rx, f3, S.narrow ? 6.8 : 7.4, 400, MONO, ink(0.86), 'right');

    /* 收束 / 空页 */
    var closing = (filled.n === 0) ? COPY.card.empty : (S.cardData.closing || COPY.card.closing);
    txt(g, closing, c.x + pad, c.y + c.h * 0.944, S.narrow ? 7.6 : 8.4, 400, SERIF, ink(0.72), 'left');

    /* 页脚 */
    if (S.narrow) {
      txt(g, COPY.card.footerL, c.x + pad, c.y + c.h * 0.978, 5.4, 400, MONO, ink(0.44), 'left');
      txt(g, COPY.card.footerR, c.x + c.w - pad, c.y + c.h * 0.978, 5.0, 400, MONO, ink(0.44), 'right');
    } else {
      txt(g, COPY.card.footer, c.x + pad, c.y + c.h * 0.978, 5.7, 400, MONO, ink(0.44), 'left');
    }
  }

  function drawCardLayer(g, s) {
    var c = S.card;
    if (S.rev <= 0.008) return;
    if (!S.cardData) return;

    /* 晾干：上干下湿，由 p 直接驱动；reduced 也是静态 */
    g.save();
    cardClip(g, S.rev);
    g.clip();
    drawCardBody(g);
    g.restore();

    /* 晾干的前沿：纸上一墨边，纸下一条骨白湿边；不在卡上画第二条水线 */
    if (S.rev > 0.02 && S.rev < 0.994) {
      var front = c.y + c.h * S.rev;
      g.beginPath();
      for (var x = c.x; x <= c.x + c.w; x += 10) {
        var y = front + S.ctx.waveAt(x) * 1.1;
        if (x === c.x) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineWidth = 0.8;
      g.strokeStyle = ink(0.30);
      g.stroke();

      g.beginPath();
      for (var x2 = c.x; x2 <= c.x + c.w; x2 += 10) {
        var y2 = front + 1.4 + S.ctx.waveAt(x2) * 1.1;
        if (x2 === c.x) g.moveTo(x2, y2); else g.lineTo(x2, y2);
      }
      g.lineWidth = S.cardWet ? 1 : 0.6;
      g.strokeStyle = S.cardWet ? bone(0.62) : ink(0.18);
      g.stroke();
      if (S.cardWet) {
        g.fillStyle = bone(0.26);
        for (var k = 0; k < 7; k++) {
          var xx = c.x + ((k + 0.5) / 7) * c.w;
          g.fillRect(xx, front + 3.4 + (k % 3) * 1.1, 1.4, 0.7);
        }
      }
    }

    /* 卡未干透：一句贴在纸的上沿 */
    if (S.rev < 0.994) {
      var capY = c.y - (S.narrow ? 10 : 12);
      var capWet = capY > s.lineY;
      txt(g, COPY.micro.dry, c.x, capY, S.narrow ? 7.2 : 7.6, 400, SERIF,
        capWet ? bone(0.64) : ink(0.54), 'left');
    } else {
      var hintWet = c.hintY > s.lineY;
      var hcol = hintWet ? bone(0.78) : ink(0.66);
      var hcol2 = hintWet ? bone(0.46) : ink(0.40);
      /* 收好 */
      if (S.sealed) {
        txt(g, COPY.card.kept, c.x + c.w / 2, c.hintY, S.narrow ? 8.6 : 9.2, 500, SERIF,
          hintWet ? bone(0.90) : ink(0.80), 'center');
        txt(g, COPY.card.keptEn, c.x + c.w / 2, c.hintY + 9, 5.4, 400, MONO, hcol2, 'center');
      } else {
        txt(g, COPY.card.hold, c.x + c.w / 2, c.hintY, S.narrow ? 8.0 : 8.6, 400, SERIF,
          hcol, 'center');
        txt(g, COPY.card.holdEn, c.x + c.w / 2, c.hintY + 9, 5.2, 400, MONO, hcol2, 'center');
      }
    }
  }

  /* ---------- 状态 ---------- */

  /* shell 的 s.pointer 没有 down；act 自己抓住根层上的按/放，和下层的拖拽不冲突 */
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    S.pointer.down = true;
    S.pointer.x = clamp(e.clientX / Math.max(1, S.W), 0, 1);
    S.pointer.y = clamp(e.clientY / Math.max(1, S.H), 0, 1);
    if (e.cancelable) e.preventDefault();
  }
  function onMove(e) {
    S.pointer.x = clamp(e.clientX / Math.max(1, S.W), 0, 1);
    S.pointer.y = clamp(e.clientY / Math.max(1, S.H), 0, 1);
  }
  function onUp() { S.pointer.down = false; }

  function bindPointer() {
    if (S.bound) return;
    var root = (S.ctx && S.ctx.root) || S.root;
    if (!root) return;
    S.bound = true;
    root.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
  }

  function unbindPointer() {
    if (!S.bound) return;
    S.bound = false;
    var root = (S.ctx && S.ctx.root) || S.root;
    if (root) root.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  function update(s) {
    var dt = s.t - S.lastT;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = clamp(dt, 0, 0.05);
    if (dt === 0 && s.reduced) dt = 0.016;
    S.lastT = s.t;
    S.dt = dt;
    S.p = clamp(s.p, 0, 1);

    var revRaw = (S.p - REV_A) / (REV_B - REV_A);
    S.revRaw = clamp(revRaw, 0, 1);
    S.rev = smooth(S.revRaw);

    /* 汐：卡晾到 70% 时收下，一次 */
    if (!S.granted && S.rev >= ZI_FRONT) {
      S.granted = true;
      S.grantedAt = S.p;
      if (typeof S.ctx.onCollect === 'function') {
        try { S.ctx.onCollect(COPY.word); } catch (e) { /* noop */ }
      } else if (typeof s.onCollect === 'function') {
        try { s.onCollect(COPY.word); } catch (e2) { /* noop */ }
      }
    }
    S.zi = S.granted ? smooth((S.rev - ZI_FRONT) / (1 - ZI_FRONT)) : 0;

    if (!S.shown && S.rev >= 0.5) {
      S.shown = true;
      if (typeof A.onCardShown === 'function') {
        try { A.onCardShown(); } catch (e3) { /* noop */ }
      }
    }

    S.cardWet = (S.card.y + S.card.h * 0.5) > s.lineY;

    /* 指：按住卡 = 收好；水里按住/拖 = 水花 */
    if (!S.bound && s.pointer) {
      S.pointer.x = s.pointer.x;
      S.pointer.y = s.pointer.y;
      S.pointer.down = !!s.pointer.down;
    }
    var px = S.pointer.x * S.W;
    var py = S.pointer.y * S.H;
    var down = !!S.pointer.down;
    var inCard = down && S.rev > 0.992 &&
      px > S.card.x && px < S.card.x + S.card.w &&
      py > S.card.y && py < S.card.y + S.card.h;

    if (inCard && !S.sealed) {
      S.hold = Math.min(1, S.hold + dt / 1.15);
      if (S.hold >= 1) {
        S.hold = 1;
        S.sealed = true;
        if (typeof A.onSealed === 'function') {
          try { A.onSealed(); } catch (e4) { /* noop */ }
        }
      }
    } else if (!inCard) {
      S.hold = Math.max(0, S.hold - dt / 0.9);
    }

    var overCard = S.rev > 0.1 && px > S.card.x && px < S.card.x + S.card.w && py > S.card.y && py < S.card.y + S.card.h;
    if (!s.reduced) {
      var inWater = py > s.lineY + 5 && py < S.H - 14 && !overCard;
      if (down && !S.lastDown && !inCard && inWater) spawnRipple(px, py, s.t);
      else if (down && inWater && !inCard) {
        var far = Math.abs(px - S.lastRipX) + Math.abs(py - S.lastRipY);
        if (far > 30 && s.t - S.lastRipT > 0.14) spawnRipple(px, py, s.t);
      }
    }
    S.lastDown = down;

    var live = [];
    for (var i = 0; i < S.ripples.length; i++) {
      var age = s.t - S.ripples[i].t;
      if (age >= 0 && age < 1.15) live.push(S.ripples[i]);
    }
    S.ripples = live;

    A.progress = S.rev;
    A.cardVisible = S.rev > 0.5;
    A.collected = S.granted;
    A.sealed = S.sealed;
  }

  function spawnRipple(x, y, t) {
    if (S.ripples.length >= 5) S.ripples.shift();
    S.ripples.push({ x: x, y: y, t: t });
    S.lastRipT = t;
    S.lastRipX = x;
    S.lastRipY = y;
  }

  /* ---------- 场景 ---------- */

  function drawScene(g, mode, s) {
    drawMoon(g, mode);
    drawSyzygy(g, mode);
    drawNote(g, mode);
    drawColumn(g, mode, s);
  }

  /* ---------- act ---------- */

  var A = {
    id: '05',
    title: COPY.title,
    en: COPY.en,
    accent: '#C8D2D4',

    mount: function (root, ctx) {
      S.root = root;
      S.ctx = ctx;
      S.lastT = 0;
      S.entered = new Date();
      var mi = moonInfo(S.entered);
      S.cardData = {
        date: ymd(S.entered),
        moon: mi.name,
        moonEn: mi.en,
        tide: hm(S.entered) + ' \u2192 ' + hm(new Date(S.entered.getTime() + (6 * 3600 + 13 * 60) * 1000)),
        words: ['火', '拾', '卵', '更'],
        closing: COPY.card.closing
      };
      S.granted = false;
      S.sealed = false;
      S.hold = 0;
      S.ripples = [];
      S.shown = false;
      S.rev = 0;
      S.zi = 0;
      S.pointer = { x: 0.5, y: 0.5, down: false };
      bindPointer();
    },

    resize: function (w, h, dpr) {
      S.W = w;
      S.H = h;
      S.dpr = dpr;
      rebuild();
    },

    render: function (s) {
      if (!S.ctx || !S.card) return;
      update(s);
      var g = S.ctx.g;
      var line = s.lineY;

      /* 干：墨 */
      g.save();
      S.ctx.clipAbove(line);
      g.clip();
      drawScene(g, 'ink', s);
      g.restore();

      /* 湿：骨白 + 0.35px blur */
      g.save();
      S.ctx.clipBelow(line);
      g.clip();
      if (typeof g.filter === 'string') g.filter = 'blur(0.35px)';
      drawScene(g, 'bone', s);
      drawReflection(g, s);
      drawRipples(g, s);
      g.restore();
      if (typeof g.filter === 'string') g.filter = 'none';

      /* 潮汐笺：唯一一样「干」的东西，画在两次裁剪之外 */
      drawCardLayer(g, s);
    },

    unmount: function () {
      S.ripples = [];
      S.lastT = 0;
      unbindPointer();
    },

    /* ---------- R2 hooks ---------- */

    setCardData: function (d) {
      if (!d || !S.cardData) return;
      if (typeof d.date === 'string') S.cardData.date = d.date;
      if (typeof d.moon === 'string') S.cardData.moon = d.moon;
      if (typeof d.moonEn === 'string') S.cardData.moonEn = d.moonEn;
      if (typeof d.tide === 'string') S.cardData.tide = d.tide;
      if (typeof d.closing === 'string') S.cardData.closing = d.closing;
      if (Object.prototype.toString.call(d.words) === '[object Array]') {
        S.cardData.words = d.words.slice(0);
      }
    },

    getCardData: function () {
      var filled = cardFilled();
      var words = [];
      var slots = [];
      for (var i = 0; i < filled.order.length; i++) {
        if (filled.set[filled.order[i]]) {
          words.push(filled.order[i]);
          slots.push(filled.order[i]);
        } else {
          slots.push(null);
        }
      }
      return {
        date: S.cardData.date,
        moon: S.cardData.moon,
        moonEn: S.cardData.moonEn,
        tide: S.cardData.tide,
        words: words,
        slots: slots,
        closing: S.cardData.closing
      };
    },

    cardSpec: function () {
      return {
        ratio: CARD_RATIO,
        slotFractions: SLOT_F.slice(0),
        wordsOrder: ['火', '拾', '卵', '更', '汐'],
        wordX: 0.30,
        titleFs: S.card ? S.card.titleFs : 0,
        wordFs: S.card ? S.card.wordFs : 0,
        pad: S.card ? S.card.pad : 0,
        rect: S.card ? { x: S.card.x, y: S.card.y, w: S.card.w, h: S.card.h } : null,
        labelFractions: {
          title: 0.101, rule: 0.16, date: 0.792, moon: 0.843,
          tide: 0.896, closing: 0.944, footer: 0.978
        },
        frame: { lineWidth: 1.05, inset: 5, lineWidth2: 0.65 },
        colors: { ink: '#111310', bone: '#F2ECDF', moon: '#C8D2D4', coral: '#D8503A' }
      };
    },

    getCardState: function () {
      return {
        rev: S.rev, visible: S.rev > 0.5, granted: S.granted,
        sealed: S.sealed, hold: S.hold, cardWet: S.cardWet
      };
    },

    seal: function () {
      if (S.sealed) return;
      S.hold = 1;
      S.sealed = true;
      if (typeof A.onSealed === 'function') {
        try { A.onSealed(); } catch (e) { /* noop */ }
      }
    },

    onCardShown: null,
    onSealed: null,
    progress: 0,
    cardVisible: false,
    collected: false,
    sealed: false
  };

  window.ACTS.register('05', A);
})();
