/* 潮汐笺 —— 05 的卡已经画在 act canvas 上；这里只做：数据刷新、截图、保存、分享。
   依赖 05 的钩子：setCardData / getCardData / cardSpec / getCardState / onSealed / seal。 */
window.TideCard = (function () {
  'use strict';

  var rec = null, act = null, ui = null, img = null, mounted = false;

  function $(id) { return document.getElementById(id); }

  function bind(recRef, actRef) {
    rec = recRef; act = actRef;
    if (mounted || !act) return;
    mounted = true;

    ui = document.createElement('div');
    ui.className = 'tidecard-ui';
    ui.innerHTML =
      '<div class="tc-panel">' +
        '<div class="tc-paper"><img id="tcImg" alt="潮汐笺"></div>' +
        '<div class="tc-btns">' +
          '<button type="button" id="tcSeal">收好</button>' +
          '<button type="button" id="tcSave">收下图片</button>' +
          '<button type="button" id="tcShare">分享</button>' +
        '</div>' +
        '<button type="button" class="tc-again" id="tcAgain">再等一次潮</button>' +
      '</div>';
    document.body.appendChild(ui);
    img = $('tcImg');

    $('tcSeal').addEventListener('click', seal);
    $('tcSave').addEventListener('click', download);
    $('tcShare').addEventListener('click', share);
    $('tcAgain').addEventListener('click', again);

    act.onSealed = show;
    act.onCardShown = function () {
      document.dispatchEvent(new CustomEvent('tide:card-shown'));
    };
  }

  function refresh() {
    if (!act) return;
    var now = new Date();
    var mi = moonInfo(now);
    var words = [];
    if (window.Collection) words = window.Collection.all().map(function (w) { return w.char; });
    var all = words.length === 5;
    act.setCardData({
      date: ymd(now),
      moon: mi.name,
      moonEn: mi.en,
      tide: tideRange(now),
      words: words,
      closing: all ? '收好这一页。海会再来。' : '这一页是空的。海还会再写。'
    });
  }

  function capture() {
    if (!rec || !act || !act.cardSpec) return null;
    var spec = act.cardSpec();
    if (!spec || !spec.rect) return null;
    var r = spec.rect, dpr = rec.dpr || 1, src = rec.canvas;
    var pad = 1;
    var sx = Math.max(0, Math.round((r.x - pad) * dpr));
    var sy = Math.max(0, Math.round((r.y - pad) * dpr));
    var sw = Math.min(src.width - sx, Math.round((r.w + pad * 2) * dpr));
    var sh = Math.min(src.height - sy, Math.round((r.h + pad * 2) * dpr));
    if (sw <= 0 || sh <= 0) return null;

    var scale = Math.max(1, 1400 / Math.max(sw, sh));
    var c = document.createElement('canvas');
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  function show() {
    if (!ui) return;
    refresh();
    var c = capture();
    if (c && img) img.src = c.toDataURL('image/png');
    ui.classList.add('on');
    document.body.classList.add('tidecard-open');
    document.dispatchEvent(new CustomEvent('tide:card-open'));
  }

  function hide() {
    if (!ui) return;
    ui.classList.remove('on');
    document.body.classList.remove('tidecard-open');
  }

  function seal() {
    if (act && act.seal) act.seal();
    else show();
  }

  function download() {
    var c = capture();
    if (!c) return;
    var a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = '潮汐笺-' + ymd(new Date()).replace(/\./g, '') + '.png';
    a.click();
  }

  function shareText() {
    var d = act && act.getCardData ? act.getCardData() : null;
    var n = d && d.words ? d.words.length : 0;
    var ws = d && d.words && d.words.length ? d.words.join('、') : '—';
    if (!n) return '潮退了六小时十三分。海留下 0 个字。';
    return '我在《潮汐书·海南》退了一次潮，拾得 ' + n + ' 个字：' + ws + '。';
  }

  function share() {
    var c = capture();
    var text = shareText();
    if (navigator.share && c && typeof File !== 'undefined') {
      c.toBlob(function (blob) {
        var file = new File([blob], '潮汐笺.png', { type: 'image/png' });
        navigator.share({ title: '潮汐书 · 海南', text: text, files: [file] }).catch(function () {
          navigator.share({ title: '潮汐书 · 海南', text: text }).catch(function () {});
        });
      }, 'image/png');
    } else if (navigator.share) {
      navigator.share({ title: '潮汐书 · 海南', text: text }).catch(function () {});
    } else {
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      download();
    }
  }

  function again() {
    hide();
    document.dispatchEvent(new CustomEvent('tide:again'));
  }

  function ymd(d) {
    return d.getFullYear() + '.' +
      String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0');
  }

  function hhmm(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function tideRange(start) {
    var a = new Date(start.getTime());
    var b = new Date(start.getTime() + (6 * 60 + 13) * 60000);
    return hhmm(a) + ' → ' + hhmm(b);
  }

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

  return {
    bind: bind,
    refresh: refresh,
    show: show,
    hide: hide,
    seal: seal,
    download: download,
    share: share,
    capture: capture,
    shareText: shareText
  };
})();
