/* ACT LAYER —— 这是你唯一要改的文件。
   模板画了一块「石头」：干时墨，湿时骨白；按住变热。
   换成你的证物/场景，保留 mount / resize / render 三件事。 */
(function () {
  'use strict';

  var S = {
    ctx: null, root: null,
    W: 0, H: 0,
    cx: 0, cy: 0, r: 0,
    heat: 0,
    pts: null
  };

  function stonePoints() {
    var pts = [];
    var n = 12;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var rr = S.r * (0.84 + 0.16 * Math.sin(i * 2.3 + 1.2) + 0.06 * Math.sin(i * 5.1));
      pts.push([S.cx + Math.cos(a) * rr, S.cy + Math.sin(a) * rr * 0.82]);
    }
    S.pts = pts;
  }

  function stonePath(g) {
    var p = S.pts;
    if (!p) return;
    g.beginPath();
    g.moveTo(p[0][0], p[0][1]);
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      g.quadraticCurveTo(a[0], a[1], mx, my);
    }
    var last = p[p.length - 1], first = p[0];
    g.quadraticCurveTo(last[0], last[1], (last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
    g.closePath();
  }

  function drawStone(g, mode) {
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';
    stonePath(g);
    g.fillStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.035 : 0.05) + ')';
    g.fill();
    g.strokeStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.62 : 0.55) + ')';
    g.lineWidth = 1.05;
    g.stroke();

    /* 几道细孔/裂纹 */
    g.beginPath();
    for (var k = 0; k < 6; k++) {
      var aa = 0.6 + k * 1.05;
      var x1 = S.cx + Math.cos(aa) * S.r * 0.16;
      var y1 = S.cy + Math.sin(aa) * S.r * 0.14;
      var x2 = S.cx + Math.cos(aa + 0.42) * S.r * 0.62;
      var y2 = S.cy + Math.sin(aa + 0.42) * S.r * 0.5;
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    }
    g.strokeStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.2 : 0.16) + ')';
    g.lineWidth = 0.6;
    g.stroke();
  }

  function drawTitle(g, mode) {
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';
    var fs = Math.min(S.W * 0.12, S.H * 0.155);
    g.fillStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.9 : 0.78) + ')';
    g.font = '500 ' + fs + 'px "Noto Serif SC","Songti SC",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var tx = S.W * 0.105;
    var ty = S.H * 0.255;
    g.fillText('模', tx, ty);
    g.fillText('板', tx, ty + fs * 1.04);
  }

  function drawMeta(g, mode) {
    var base = mode === 'ink' ? '17,19,16' : '242,236,223';
    g.fillStyle = 'rgba(' + base + ',' + (mode === 'ink' ? 0.42 : 0.5) + ')';
    g.font = '400 8px Consolas, monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    var x = S.cx + S.r * 1.08;
    var y = S.cy - S.r * 0.1;
    g.fillText('SPECIMEN / 01', x, y);
    g.fillRect(x, y + 9, Math.min(72, S.W - x - 12), 1);
  }

  var A = {
    id: 'template',
    title: '模板',
    en: 'TEMPLATE',
    accent: '#D8503A',

    mount: function (root, ctx) {
      S.root = root;
      S.ctx = ctx;
    },

    resize: function (w, h, dpr) {
      S.W = w;
      S.H = h;
      S.cx = w * 0.56;
      S.cy = h * 0.46;
      S.r = Math.min(w, h) * 0.18;
      stonePoints();
    },

    render: function (s) {
      if (!S.ctx) return;
      var g = S.ctx.g;
      var line = s.lineY;

      /* 干 */
      g.save();
      S.ctx.clipAbove(line);
      g.clip();
      drawTitle(g, 'ink');
      drawMeta(g, 'ink');
      drawStone(g, 'ink');
      g.restore();

      /* 湿 */
      g.save();
      S.ctx.clipBelow(line);
      g.clip();
      if (typeof g.filter === 'string') g.filter = 'blur(0.35px)';
      drawTitle(g, 'bone');
      drawMeta(g, 'bone');
      drawStone(g, 'bone');
      g.restore();
      if (typeof g.filter === 'string') g.filter = 'none';

      /* 热：按住，珊瑚色从石头里渗出来 */
      var target = s.pointer.down ? 1 : 0;
      S.heat += (target - S.heat) * 0.045;
      if (S.heat < 0.002) S.heat = 0;
      if (S.heat > 0.01) {
        g.save();
        stonePath(g);
        g.clip();
        var gr = g.createRadialGradient(S.cx, S.cy, S.r * 0.08, S.cx, S.cy, S.r * 1.35);
        gr.addColorStop(0, 'rgba(216,80,58,' + (0.26 * S.heat) + ')');
        gr.addColorStop(0.55, 'rgba(216,80,58,' + (0.10 * S.heat) + ')');
        gr.addColorStop(1, 'rgba(216,80,58,0)');
        g.fillStyle = gr;
        g.fillRect(S.cx - S.r * 1.4, S.cy - S.r * 1.4, S.r * 2.8, S.r * 2.8);
        g.restore();
      }
    }
  };

  window.ACTS.register('template', A);
})();
