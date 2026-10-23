/* ============================================================
   声音 lab —— 水线驱动的声音原型。
   规则见 docs/sound-map.md：
   - 全局 wet / dry 两条滤波支路，由 tide 驱动；
   - 每幕 2–4 层，只有当前幕的 bus 打开；
   - 交互声是 one-shot，走 master 前的 fx 支路；
   - 默认静音；手势解锁；localStorage 记住。
   全部程序化合成，无音频文件；不碰 js/audio.js。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'tidebook.sound.lab.muted';

  window.addEventListener('error', function (e) {
    var el = $('status');
    if (el) el.textContent = 'JS ERROR: ' + e.message + '  @line ' + e.lineno;
  });

  var ACTS = [
    { id: '00', name: '满潮', range: [0, 0.07] },
    { id: '01', name: '玄武', range: [0.07, 0.24] },
    { id: '02', name: '潮间带', range: [0.24, 0.47] },
    { id: '03', name: '珊瑚', range: [0.47, 0.67] },
    { id: '04', name: '航线', range: [0.67, 0.86] },
    { id: '05', name: '归潮', range: [0.86, 1.0001] }
  ];

  var ctx = null;
  var master = null, limiter = null, analyser = null;
  var wet = null, dry = null, wetGain = null, dryGain = null;
  var noiseBrown = null, noiseWhite = null;
  var data = null;

  var actGains = {};
  var layers = {};
  var refs = {};

  var tide = 0.04;
  var actId = '00';
  var muted = true;
  var unlocked = false;
  var built = false;

  try {
    muted = localStorage.getItem(STORE) !== '0';
  } catch (e) { /* private mode */ }

  var raf = 0;
  var warmTimer = 0;
  var lightTimer = 0;

  /* ---------------- 工具 ---------------- */

  function status(msg) {
    var state = ctx ? ctx.state : 'no ctx';
    var lines = [
      'act ' + actId + '  ·  tide ' + tide.toFixed(3) + '  ·  ' + state +
        '  ·  ' + (muted ? 'muted' : 'on') + '  ·  ' + (unlocked ? 'unlocked' : 'locked'),
      'layers ' + layerCount() + '  ·  ' + (msg || 'idle')
    ];
    var el = $('status');
    if (el) el.textContent = lines.join('\n');
  }

  function layerCount() {
    var n = 0;
    for (var k in layers) n += layers[k].length;
    return n;
  }

  function noiseBuffer(seconds, brown) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.2;
      } else {
        d[i] = white * 0.55;
      }
    }
    return buf;
  }

  function ramp(param, value, time) {
    var now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, Math.max(0.02, time || 0.15));
  }

  /* ---------------- 建图 ---------------- */

  function build() {
    if (built) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;

    try { ctx = new AC(); } catch (e) { return false; }

    master = ctx.createGain();
    master.gain.value = 0;

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    master.connect(limiter);
    limiter.connect(ctx.destination);

    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    limiter.connect(analyser);
    data = new Uint8Array(analyser.fftSize);

    noiseBrown = noiseBuffer(4, true);
    noiseWhite = noiseBuffer(4, false);

    wet = ctx.createBiquadFilter();
    wet.type = 'lowpass';
    wet.frequency.value = 1200;
    wet.Q.value = 0.7;

    dry = ctx.createBiquadFilter();
    dry.type = 'highpass';
    dry.frequency.value = 300;
    dry.Q.value = 0.6;

    wetGain = ctx.createGain();
    wetGain.gain.value = 1;

    dryGain = ctx.createGain();
    dryGain.gain.value = 0;

    wet.connect(wetGain);
    wetGain.connect(master);

    dry.connect(dryGain);
    dryGain.connect(master);

    ACTS.forEach(function (a) {
      var g = ctx.createGain();
      g.gain.value = a.id === '00' ? 1 : 0;
      g.connect(wet);
      g.connect(dry);
      actGains[a.id] = g;
      layers[a.id] = [];
    });

    buildLayers();
    built = true;
    applyTide(true);
    return true;
  }

  function mk(act, opts) {
    var src;
    if (opts.noise) {
      src = ctx.createBufferSource();
      src.buffer = opts.noise === 'brown' ? noiseBrown : noiseWhite;
      src.loop = true;
    } else {
      src = ctx.createOscillator();
      src.type = opts.wave || 'sine';
      src.frequency.value = opts.freq || 220;
    }

    var head = src;
    var filter = null;

    if (opts.filter) {
      filter = ctx.createBiquadFilter();
      filter.type = opts.filter;
      filter.frequency.value = opts.fc || 800;
      filter.Q.value = opts.q || 0.7;
      head.connect(filter);
      head = filter;
    }

    var gain = ctx.createGain();
    gain.gain.value = opts.level || 0;
    head.connect(gain);

    var pan = null;
    if (ctx.createStereoPanner) {
      pan = ctx.createStereoPanner();
      pan.pan.value = opts.pan || 0;
      gain.connect(pan);
      pan.connect(actGains[act]);
    } else {
      gain.connect(actGains[act]);
    }

    if (opts.lfo) {
      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = opts.lfo;
      var lg = ctx.createGain();
      lg.gain.value = opts.lfoDepth || 0;
      lfo.connect(lg);
      if (opts.lfoTarget === 'filter' && filter) {
        lg.connect(filter.frequency);
      } else {
        lg.connect(gain.gain);
      }
      lfo.start();
    }

    src.start();

    var L = { src: src, gain: gain, filter: filter, pan: pan };
    layers[act].push(L);
    return L;
  }

  function buildLayers() {
    /* 00 满潮：M0 的简化版 */
    mk('00', { noise: 'brown', filter: 'lowpass', fc: 420, q: 0.8, level: 0.22 });
    mk('00', { noise: 'white', filter: 'highpass', fc: 1050, q: 0.6, level: 0.04 });
    mk('00', { wave: 'sine', freq: 48, level: 0.05 });
    mk('00', { wave: 'sine', freq: 72.5, level: 0.018 });

    /* 01 玄武：石、风、极低共鸣、热 */
    mk('01', { noise: 'white', filter: 'bandpass', fc: 260, q: 1.6, level: 0.05, lfo: 0.35, lfoDepth: 0.035 });
    mk('01', { noise: 'white', filter: 'bandpass', fc: 520, q: 2.0, level: 0.018, lfo: 0.9, lfoDepth: 0.012 });
    mk('01', { wave: 'sine', freq: 38, level: 0.05 });
    mk('01', { wave: 'sine', freq: 57, level: 0.03 });
    refs.wind = mk('01', { noise: 'white', filter: 'bandpass', fc: 700, q: 0.7, level: 0.012, lfo: 0.05, lfoDepth: 0.006, lfoTarget: 'gain' });
    refs.heat = mk('01', { noise: 'brown', filter: 'lowpass', fc: 700, q: 0.7, level: 0 });

    /* 02 潮间带：浪、沙、远山（远山是印象，不是录音） */
    mk('02', { noise: 'brown', filter: 'lowpass', fc: 900, q: 0.7, level: 0.10, lfo: 0.08, lfoDepth: 0.035, lfoTarget: 'gain' });
    mk('02', { noise: 'white', filter: 'bandpass', fc: 1800, q: 0.9, level: 0.02, lfo: 1.7, lfoDepth: 0.018, lfoTarget: 'gain' });
    mk('02', { noise: 'white', filter: 'highpass', fc: 2400, q: 0.6, level: 0.012 });
    refs.far = mk('02', { wave: 'triangle', freq: 420, filter: 'bandpass', fc: 900, q: 1.2, level: 0.012, lfo: 0.09, lfoDepth: 0.008, lfoTarget: 'gain' });

    /* 03 珊瑚：水下、涌、鼓虾、光 */
    mk('03', { noise: 'brown', filter: 'lowpass', fc: 280, q: 0.7, level: 0.12 });
    mk('03', { noise: 'white', filter: 'bandpass', fc: 180, q: 0.8, level: 0.03, lfo: 0.06, lfoDepth: 0.02, lfoTarget: 'gain' });
    mk('03', { noise: 'white', filter: 'bandpass', fc: 3200, q: 2.5, level: 0.018, lfo: 5.5, lfoDepth: 0.014, lfoTarget: 'gain' });
    refs.light = mk('03', { wave: 'sine', freq: 1600, level: 0.0001, lfo: 0.3, lfoDepth: 0.0001, lfoTarget: 'gain' });

    /* 04 航线：纸、铅笔、星图 */
    mk('04', { noise: 'white', filter: 'highpass', fc: 1200, q: 0.6, level: 0.014, lfo: 0.04, lfoDepth: 0.004, lfoTarget: 'gain' });
    refs.pencil = mk('04', { noise: 'white', filter: 'bandpass', fc: 2400, q: 0.8, level: 0 });
    mk('04', { wave: 'sine', freq: 55, level: 0.02 });
    mk('04', { wave: 'sine', freq: 82.5, level: 0.012 });

    /* 05 归潮：水回来、月、纸、石（石在事件里回响） */
    mk('05', { noise: 'brown', filter: 'lowpass', fc: 420, q: 0.7, level: 0.10 });
    mk('05', { wave: 'sine', freq: 1500, level: 0.004, lfo: 0.12, lfoDepth: 0.0015, lfoTarget: 'gain' });
  }

  /* ---------------- 水线 / 幕 ---------------- */

  function actForTide(t) {
    for (var i = 0; i < ACTS.length; i++) {
      if (t < ACTS[i].range[1] - 0.0001) return ACTS[i].id;
    }
    return '05';
  }

  function setAct(id, silent) {
    actId = id;
    if (built) {
      var now = ctx.currentTime;
      ACTS.forEach(function (a) {
        actGains[a.id].gain.setTargetAtTime(a.id === id ? 1 : 0, now, 0.12);
      });
    }
    renderActs();
    if (!silent) status('act ' + id);
  }

  function applyTide(force) {
    if (!built) return;
    var t = Math.max(0, Math.min(1, tide));
    var now = ctx.currentTime;
    var wetLevel = Math.max(0.02, Math.cos(t * Math.PI / 2));
    var dryLevel = Math.max(0.02, Math.sin(t * Math.PI / 2));

    wetGain.gain.setTargetAtTime(wetLevel, now, 0.08);
    dryGain.gain.setTargetAtTime(dryLevel, now, 0.08);
    wet.frequency.setTargetAtTime(350 + 850 * (1 - t), now, 0.1);
    dry.frequency.setTargetAtTime(300 + 700 * t, now, 0.1);

    var a = actForTide(t);
    if (a !== actId || force) setAct(a, true);
    status('waterline');
  }

  function setTide(t) {
    tide = Math.max(0, Math.min(1, t));
    var input = $('tide');
    if (input) input.value = String(Math.round(tide * 1000));
    var out = $('tideOut');
    if (out) out.textContent = tide.toFixed(3);
    if (built) applyTide();
    else status('tide');
  }

  /* ---------------- 解锁 / 静音 ---------------- */

  function unlock() {
    if (!ctx && !build()) {
      status('Web Audio unavailable');
      return;
    }

    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      var p = ctx.resume();
      if (p && p.catch) p.catch(function () { status('resume failed'); });
    }

    if (!unlocked) {
      unlocked = true;
      if (!muted) master.gain.setTargetAtTime(0.32, ctx.currentTime, 0.2);
      renderMute();
    }

    status('unlocked');
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(STORE, muted ? '1' : '0'); } catch (e) { /* noop */ }

    if (built && ctx) {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.32, now + (muted ? 0.3 : 0.4));

      if (!muted) {
        if (ctx.state === 'suspended') {
          var p = ctx.resume();
          if (p && p.catch) p.catch(function () { status('resume failed'); });
        }
        window.setTimeout(function () {
          if (!muted && built) applyTide();
        }, 60);
      } else {
        window.setTimeout(function () {
          if (muted && ctx && ctx.state === 'running') ctx.suspend();
        }, 420);
      }
    }

    renderMute();
    status(muted ? 'muted' : 'on');
  }

  function renderMute() {
    var btn = $('mute');
    var st = $('muteState');
    if (!btn || !st) return;
    btn.classList.toggle('on', !muted);
    btn.setAttribute('aria-pressed', String(!muted));
    btn.setAttribute('aria-label', muted ? '开启声音' : '关闭声音');
    st.textContent = muted ? 'OFF' : (unlocked ? 'ON' : 'ON·待解锁');
  }

  function renderActs() {
    var nodes = document.querySelectorAll('#acts button');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('on', nodes[i].getAttribute('data-act') === actId);
    }
  }

  /* ---------------- 一次性事件 ---------------- */

  function pick() {
    if (!built) return;
    var t = ctx.currentTime + 0.02;

    var src = ctx.createBufferSource();
    src.buffer = noiseWhite;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2800;
    f.Q.value = 1.2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.12);

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 293.66;
    var og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.06, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(og);
    og.connect(master);
    o.start(t);
    o.stop(t + 0.24);

    status('event pick · 拾');
  }

  function warm() {
    if (!built) return;
    var now = ctx.currentTime;
    refs.heat.gain.gain.cancelScheduledValues(now);
    refs.heat.gain.gain.setTargetAtTime(0.09, now, 0.8);
    if (refs.heat.filter) {
      refs.heat.filter.frequency.cancelScheduledValues(now);
      refs.heat.filter.frequency.setTargetAtTime(2200, now, 0.8);
    }
    window.clearTimeout(warmTimer);
    warmTimer = window.setTimeout(warmOff, 2800);
    status('event warm · heat 1');
  }

  function warmOff() {
    if (!built) return;
    window.clearTimeout(warmTimer);
    var now = ctx.currentTime;
    refs.heat.gain.gain.setTargetAtTime(0, now, 1.2);
    if (refs.heat.filter) refs.heat.filter.frequency.setTargetAtTime(700, now, 1.2);
    status('event warm · cooling');
  }

  function light() {
    if (!built) return;
    var now = ctx.currentTime;
    refs.light.gain.gain.cancelScheduledValues(now);
    refs.light.gain.gain.setTargetAtTime(0.02, now, 0.4);
    window.clearTimeout(lightTimer);
    lightTimer = window.setTimeout(function () {
      if (!built) return;
      spawn();
      refs.light.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
    }, 2000);
    status('event light · hold 2s');
  }

  function spawn() {
    if (!built) return;
    var t0 = ctx.currentTime + 0.05;

    for (var i = 0; i < 28; i++) {
      var t = t0 + i * 0.07;
      var src = ctx.createBufferSource();
      src.buffer = noiseWhite;
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700 + 1100 * (i / 28);
      f.Q.value = 2.2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 0.08);
    }

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 96;
    var og = ctx.createGain();
    og.gain.setValueAtTime(0, t0);
    og.gain.linearRampToValueAtTime(0.05, t0 + 1.2);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 5);
    o.connect(og);
    og.connect(master);
    o.start(t0);
    o.stop(t0 + 5.1);

    status('event spawn · 28 grains');
  }

  function trace() {
    if (!built) return;
    var now = ctx.currentTime;
    refs.pencil.gain.gain.cancelScheduledValues(now);
    refs.pencil.gain.gain.setValueAtTime(0, now);
    refs.pencil.gain.gain.linearRampToValueAtTime(0.04, now + 0.15);
    refs.pencil.gain.gain.linearRampToValueAtTime(0, now + 1.5);
    status('event trace');
  }

  function dryGate() {
    if (!built) return;
    var now = ctx.currentTime;
    var target = muted ? 0 : 0.32;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.005);
    master.gain.setValueAtTime(0.0001, now + 0.08);
    master.gain.linearRampToValueAtTime(target, now + 0.09);
  }

  function stamp() {
    if (!built) return;
    var t = ctx.currentTime + 0.01;

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 72;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.2);

    var src = ctx.createBufferSource();
    src.buffer = noiseWhite;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 1.0;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f);
    f.connect(ng);
    ng.connect(master);
    src.start(t);
    src.stop(t + 0.06);

    dryGate();
    status('event stamp · dry gate');
  }

  /* ---------------- 画水线 / 波形 ---------------- */

  function draw() {
    raf = requestAnimationFrame(draw);

    var c = $('scope');
    if (!c) return;
    var g = c.getContext('2d');
    var W = c.clientWidth;
    var H = c.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    var maxY = W < 720 ? 0.55 : 0.82;
    var y = H * 0.18 + (H * (maxY - 0.18)) * tide;

    g.fillStyle = '#F2ECDF';
    g.fillRect(0, 0, W, y);
    g.fillStyle = '#03100F';
    g.fillRect(0, y, W, H - y);

    g.strokeStyle = 'rgba(216,80,58,.75)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(W, y + 0.5);
    g.stroke();

    if (analyser && !muted && ctx && ctx.state === 'running') {
      analyser.getByteTimeDomainData(data);
      g.strokeStyle = '#D8503A';
      g.lineWidth = 1;
      g.beginPath();
      var amp = Math.min(56, H * 0.12);
      for (var i = 0; i < data.length; i++) {
        var x = (i / (data.length - 1)) * W;
        var v = (data[i] - 128) / 128;
        var yy = y + v * amp;
        if (i === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    } else {
      g.strokeStyle = 'rgba(17,19,16,.22)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    g.fillStyle = 'rgba(17,19,16,.42)';
    g.font = '8px Consolas, monospace';
    g.fillText('WATERLINE  ' + tide.toFixed(3), 14, Math.max(14, y - 10));
  }

  /* ---------------- UI ---------------- */

  function buildUI() {
    var actsEl = $('acts');
    ACTS.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-act', a.id);
      b.innerHTML = '<span class="num">' + a.id + '</span>' + a.name;
      b.addEventListener('click', function () {
        unlock();
        var mid = (a.range[0] + a.range[1]) / 2;
        setTide(mid);
        setAct(a.id);
      });
      actsEl.appendChild(b);
    });

    $('mute').addEventListener('click', function (e) {
      e.stopPropagation();
      unlock();
      setMuted(!muted);
    });

    var tideEl = $('tide');
    tideEl.addEventListener('input', function () {
      setTide(parseInt(this.value, 10) / 1000);
    });
    tideEl.addEventListener('pointerdown', function () { unlock(); });

    var warmBtn = $('warm');
    warmBtn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      unlock();
      warm();
    });
    warmBtn.addEventListener('pointerup', warmOff);
    warmBtn.addEventListener('pointerleave', warmOff);
    warmBtn.addEventListener('pointercancel', warmOff);

    var evButtons = document.querySelectorAll('[data-ev]');
    for (var i = 0; i < evButtons.length; i++) {
      (function (btn) {
        var ev = btn.getAttribute('data-ev');
        if (ev === 'warm') return;
        btn.addEventListener('click', function () {
          unlock();
          if (ev === 'pick') pick();
          else if (ev === 'light') light();
          else if (ev === 'trace') trace();
          else if (ev === 'stamp') stamp();
        });
      })(evButtons[i]);
    }

    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, function () {
        if (!unlocked) unlock();
      }, { passive: true });
    });

    document.addEventListener('visibilitychange', function () {
      if (!ctx || !built) return;
      if (document.hidden) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        window.setTimeout(function () {
          if (document.hidden && ctx.state === 'running') ctx.suspend();
        }, 300);
      } else {
        status('visible · gesture to resume');
      }
    });

    renderActs();
    renderMute();
  }

  function start() {
    buildUI();
    setTide(0.04);
    if (!muted) {
      /* 上次开着：不自动建 context，只显示待解锁 */
      status('stored on · gesture to unlock');
    } else {
      status('muted · gesture to unlock');
    }
    draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.SoundLab = {
    unlock: unlock,
    setTide: setTide,
    setMuted: setMuted,
    get state() {
      return built ? ctx.state : 'unbuilt';
    }
  };
})();
