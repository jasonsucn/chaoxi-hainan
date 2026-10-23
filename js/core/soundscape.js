/* 声音 —— 00 沿用 M0 的 Ambience；01–05 用这套程序化层。
   不加载音频文件；水线驱动 wet/dry；一次性事件走 fx。 */
window.Soundscape = (function () {
  'use strict';

  var ctx = null, built = false, on = false, muted = false;
  var master, wet, dry, fx, whiteBuf, brownBuf;
  var groups = {};
  var cur = '00';
  var getState = null;
  var heat = 0, light = 0, trace = 0;
  var tickT = 0, grainT = 0, farT = 0, starT = 0, lastT = 0;
  var KEY = 'tidebook.sound.muted';
  var layers = {};

  function init(fn) {
    getState = fn;
    try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { muted = false; }
  }

  function saveMute() {
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* noop */ }
  }

  function enable(want) {
    try {
      if (want) {
        if (!ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          ctx = new AC();
          build();
        }
        if (ctx.state === 'suspended') ctx.resume();
        on = true;
        master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.5);
      } else {
        on = false;
        if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
      return true;
    } catch (e) { return false; }
  }

  function setMuted(m) {
    muted = !!m;
    saveMute();
    if (master && on) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.3);
  }

  function noiseBuffer(brown) {
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else d[i] = w;
    }
    return buf;
  }

  function bed(buf, type, freq, q) {
    var src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q) f.Q.value = q;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g);
    src.start();
    return { src: src, f: f, g: g };
  }

  function build() {
    master = ctx.createGain(); master.gain.value = 0.0001;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12;
    lim.attack.value = 0.003; lim.release.value = 0.25;
    master.connect(lim); lim.connect(ctx.destination);

    wet = ctx.createGain(); wet.gain.value = 0.6;
    dry = ctx.createGain(); dry.gain.value = 0.4;
    fx = ctx.createGain(); fx.gain.value = 0.9;
    wet.connect(master); dry.connect(master); fx.connect(master);

    whiteBuf = noiseBuffer(false);
    brownBuf = noiseBuffer(true);

    ['00', '01', '02', '03', '04', '05'].forEach(function (id) {
      var g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      groups[id] = g;
    });

    /* 00：水 / 空气（M0 Ambience 之外的薄床） */
    layers.water = bed(brownBuf, 'lowpass', 420, 0.8);
    layers.water.g.connect(wet);
    layers.air = bed(whiteBuf, 'highpass', 1050, 0.6);
    layers.air.g.connect(dry);

    /* 01：石头低频 + 风，tick 在 update 里 */
    layers.stone = bed(brownBuf, 'lowpass', 120, 0.7);
    layers.stone.g.connect(groups['01']);
    layers.wind = bed(whiteBuf, 'bandpass', 700, 0.7);
    layers.wind.g.connect(groups['01']);

    /* 02：浪 + 远山 */
    layers.surf = bed(brownBuf, 'lowpass', 900, 0.7);
    layers.surf.g.connect(groups['02']);
    layers.far = bed(whiteBuf, 'bandpass', 1200, 0.6);
    layers.far.g.connect(groups['02']);

    /* 03：水下 + 涌 + 光 */
    layers.under = bed(brownBuf, 'lowpass', 280, 0.7);
    layers.under.g.connect(groups['03']);
    layers.surge = bed(whiteBuf, 'bandpass', 180, 0.8);
    layers.surge.g.connect(groups['03']);
    layers.light = bed(whiteBuf, 'highpass', 1600, 0.6);
    layers.light.g.connect(groups['03']);

    /* 04：纸 + 星图 */
    layers.paper = bed(whiteBuf, 'highpass', 1200, 0.6);
    layers.paper.g.connect(groups['04']);
    layers.star = bed(brownBuf, 'lowpass', 110, 0.7);
    layers.star.g.connect(groups['04']);

    /* 05：水回来 + 月 */
    layers.ret = bed(brownBuf, 'lowpass', 360, 0.7);
    layers.ret.g.connect(groups['05']);
    layers.moon = bed(whiteBuf, 'highpass', 1500, 0.6);
    layers.moon.g.connect(groups['05']);

    built = true;
  }

  function burst(buf, type, freq, q, dur, gain, dest) {
    if (!on || !built) return;
    var t0 = ctx.currentTime;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || fx);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  function tick() { burst(whiteBuf, 'bandpass', 260 + Math.random() * 260, 1.6, 0.08 + Math.random() * 0.06, 0.06, groups['01']); }
  function grain() { burst(whiteBuf, 'bandpass', 1800 + Math.random() * 2400, 0.9, 0.03, 0.035, groups['02']); }
  function paper(freq, dur, gain) { burst(whiteBuf, 'bandpass', freq || 2800, 1.2, dur || 0.18, gain || 0.06, fx); }
  function needle() { burst(whiteBuf, 'bandpass', 5500, 3, 0.02, 0.05, groups['04']); }
  function thud() {
    if (!on || !built) return;
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 72;
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g); g.connect(fx); o.start(t0); o.stop(t0 + 0.2);
    burst(whiteBuf, 'bandpass', 2400, 1.4, 0.03, 0.05, fx);
  }

  function spawn() {
    if (!on || !built) return;
    var n = 30;
    for (var i = 0; i < n; i++) {
      (function (k) {
        setTimeout(function () {
          burst(whiteBuf, 'bandpass', 1200 + Math.random() * 3300, 2.4, 0.006 + Math.random() * 0.012, 0.025, fx);
        }, k * 55 + Math.random() * 40);
      })(i);
    }
  }

  function setAct(id) {
    if (cur === id) return;
    cur = id;
    if (!built) return;
    var now = ctx.currentTime;
    Object.keys(groups).forEach(function (k) {
      groups[k].gain.setTargetAtTime(k === id ? 1 : 0, now, 0.3);
    });
  }

  function update(s) {
    if (!on || !built) return;
    var now = ctx.currentTime;
    var dt = Math.max(0.001, Math.min(0.05, (now - lastT) || 0.016));
    lastT = now;
    var tide = s.tide || 0;
    wet.gain.setTargetAtTime(0.85 * (1 - 0.9 * tide) + 0.02, now, 0.4);
    dry.gain.setTargetAtTime(0.02 + 0.8 * tide, now, 0.4);

    var down = s.pointer && s.pointer.down;
    heat = (s.act === '01' && down) ? Math.min(1, heat + dt / 2.2) : Math.max(0, heat - dt / 8.5);
    light = (s.act === '03') ? Math.min(1, light + dt * 0.8) : Math.max(0, light - dt * 0.8);
    trace = (s.act === '04' && down) ? Math.min(1, trace + dt * 2) : Math.max(0, trace - dt * 4);

    if (layers.water) layers.water.g.gain.setTargetAtTime(0.18 * (1 - tide) + 0.03, now, 0.5);
    if (layers.air) layers.air.g.gain.setTargetAtTime(0.03 + 0.12 * tide, now, 0.5);
    if (layers.stone) layers.stone.g.gain.setTargetAtTime(cur === '01' ? 0.12 + heat * 0.12 : 0.02, now, 0.3);
    if (layers.wind) layers.wind.g.gain.setTargetAtTime(cur === '01' && tide > 0.4 ? 0.04 : 0.005, now, 0.5);
    if (layers.surf) layers.surf.g.gain.setTargetAtTime(cur === '02' ? 0.16 : 0.015, now, 0.4);
    if (layers.far) layers.far.g.gain.setTargetAtTime(cur === '02' ? 0.02 : 0.006, now, 0.5);
    if (layers.under) layers.under.g.gain.setTargetAtTime(cur === '03' ? 0.2 : 0.01, now, 0.4);
    if (layers.surge) layers.surge.g.gain.setTargetAtTime(cur === '03' ? 0.06 : 0.005, now, 0.4);
    if (layers.light) layers.light.g.gain.setTargetAtTime(cur === '03' ? 0.015 * light : 0, now, 0.3);
    if (layers.paper) layers.paper.g.gain.setTargetAtTime(cur === '04' ? 0.05 : 0.01, now, 0.4);
    if (layers.star) layers.star.g.gain.setTargetAtTime((cur === '04' || cur === '05') ? 0.04 : 0.01, now, 0.4);
    if (layers.ret) layers.ret.g.gain.setTargetAtTime(cur === '05' ? 0.2 : 0.02, now, 0.5);
    if (layers.moon) layers.moon.g.gain.setTargetAtTime(cur === '05' ? 0.02 : 0, now, 0.5);

    if (layers.heat) { /* the heat is the stone LP; skip */ }

    tickT -= dt; grainT -= dt; farT -= dt; starT -= dt;
    if (cur === '01' && tickT <= 0) { tick(); tickT = 0.6 + Math.random() * 1.6; }
    if (cur === '02' && grainT <= 0) { grain(); grainT = 0.07 + Math.random() * 0.1; }
    if (cur === '04' && trace > 0.1 && Math.random() < 0.06) paper(2400, 0.03, 0.012);
    if (starT <= 0) { starT = 3 + Math.random() * 4; if (cur === '04' || cur === '05') paper(4400, 0.02, 0.008); }
    if (cur === '02' && farT <= 0) { farT = 35 + Math.random() * 30; }
  }

  function pause() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended' && on) ctx.resume(); }

  return {
    init: init,
    enable: enable,
    setMuted: setMuted,
    setAct: setAct,
    update: update,
    pause: pause,
    resume: resume,
    get on() { return on; },
    get muted() { return muted; },
    event: function (name) {
      if (name === 'spawn') spawn();
      else if (name === 'seal') thud();
      else if (name === 'card') paper(2600, 0.22, 0.07);
      else if (name === 'again') { paper(1200, 0.3, 0.05); }
      else if (name === 'needle') needle();
      else if (name === 'pick') paper(293.66, 0.2, 0.07);
    }
  };
})();
