/* 大潮之门（轻版）—— 05 归潮之后的一枚封条；不占独立一幕。
   月亮门：朔/望 ±1 天开；其余时间封着，显示下一次大潮与倒计时。
   文案：copy-deck §3。 */
window.Gate = (function () {
  'use strict';

  var SYN = 29.530588853;
  var ui = null, btn = null, body = null, kicker = null, micro = null, push = null, mounted = false;
  var state = null;

  function $(id) { return document.getElementById(id); }

  function bind() {
    if (mounted) return;
    mounted = true;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gate-btn';
    btn.id = 'gateBtn';
    btn.innerHTML = '<span class="gb-seal">潮</span><span class="gb-word">大潮之门</span>';
    document.body.appendChild(btn);

    ui = document.createElement('div');
    ui.className = 'gate-ui';
    ui.id = 'gateUI';
    ui.innerHTML =
      '<div class="gate-card">' +
        '<div class="gate-moon" id="gateMoon"></div>' +
        '<div class="gate-kicker" id="gateKicker"></div>' +
        '<div class="gate-title">大潮之门</div>' +
        '<div class="gate-sub">THE SPRING-TIDE DOOR</div>' +
        '<div class="gate-body" id="gateBody"></div>' +
        '<div class="gate-micro" id="gateMicro"></div>' +
        '<button type="button" class="gate-push" id="gatePush">推门</button>' +
        '<button type="button" class="gate-close" id="gateClose">合上</button>' +
      '</div>';
    document.body.appendChild(ui);

    body = $('gateBody');
    kicker = $('gateKicker');
    micro = $('gateMicro');
    push = $('gatePush');

    btn.addEventListener('click', open);
    $('gateClose').addEventListener('click', close);
    push.addEventListener('click', pushDoor);
    ui.addEventListener('click', function (e) {
      if (e.target === ui) close();
    });
  }

  function toggle(on) {
    if (!btn) return;
    btn.classList.toggle('show', !!on);
  }

  function phase(d) {
    var ref = Date.UTC(2000, 0, 6, 18, 14);
    var days = (d.getTime() - ref) / 86400000;
    return ((days % SYN) + SYN) % SYN / SYN;
  }

  function nextSyzygy(d) {
    var p = phase(d);
    var toNew = ((1 - p) % 1) * SYN;
    var toFull = ((0.5 - p + 1) % 1) * SYN;
    var isFull = toFull < toNew;
    var days = isFull ? toFull : toNew;
    var date = new Date(d.getTime() + days * 86400000);
    return {
      p: p, days: days, date: date,
      type: isFull ? '望' : '朔',
      en: isFull ? 'FULL MOON' : 'NEW MOON'
    };
  }

  function nearSyzygy(d) {
    var p = phase(d);
    var dNew = Math.min(p, 1 - p) * SYN;
    var dFull = Math.abs(p - 0.5) * SYN;
    var dist = Math.min(dNew, dFull);
    return { open: dist <= 1, dist: dist, which: dNew < dFull ? '朔' : '望' };
  }

  function md(d) {
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  function open() {
    if (!ui) return;
    var now = new Date();
    state = { next: nextSyzygy(now), near: nearSyzygy(now) };
    var n = state.next, near = state.near;

    if (near.open) {
      kicker.textContent = '门开着';
      body.innerHTML = '门开着。里面没有新的一章。<br>只有一句：<em>大潮不是浪大，是潮差大。</em>';
      micro.textContent = '朔望前后，水退得最远，也涨得最高。';
      push.style.display = '';
    } else if (near.dist <= 2.2) {
      kicker.textContent = '刚合上';
      body.textContent = '门合上了。下一次：' + md(n.date) + '（' + n.type + '）。';
      micro.textContent = '潮水会记得。';
      push.style.display = 'none';
    } else {
      var days = Math.max(1, Math.ceil(n.days));
      kicker.textContent = '朔望之后';
      body.textContent = '门在朔与望前后开。下一次：' + md(n.date) + '（' + n.type + '）。还有 ' + days + ' 天。';
      micro.textContent = '大潮那天，水会多退一步。';
      push.style.display = 'none';
    }

    ui.classList.add('on');
    document.body.classList.add('gate-open');
  }

  function pushDoor() {
    if (!state || !state.near.open) return;
    body.innerHTML = '<em>大潮不是浪大，是潮差大。</em>';
    micro.textContent = '剩下的，等下一次大潮。';
    push.style.display = 'none';
  }

  function close() {
    if (!ui) return;
    ui.classList.remove('on');
    document.body.classList.remove('gate-open');
  }

  return { bind: bind, toggle: toggle, open: open, close: close };
})();
