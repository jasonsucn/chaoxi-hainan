/* ============================================================
   Ambience —— 程序化潮声。无音频文件。
   水下：低通棕噪 + 48/72.5Hz 正弦；水上：高通空气声。
   随潮位交叉淡化。默认关闭，必须在用户手势中开启。
   ============================================================ */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var uw = null;
  var air = null;
  var on = false;
  var built = false;

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

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    /* 水下 */
    var src1 = ctx.createBufferSource();
    src1.buffer = noiseBuffer(4, true);
    src1.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.8;
    uw = ctx.createGain();
    uw.gain.value = 0.6;
    src1.connect(lp);
    lp.connect(uw);
    uw.connect(master);
    src1.start();

    /* 水上 */
    var src2 = ctx.createBufferSource();
    src2.buffer = noiseBuffer(4, false);
    src2.loop = true;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1050;
    hp.Q.value = 0.6;
    var lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 4200;
    air = ctx.createGain();
    air.gain.value = 0;
    src2.connect(hp);
    hp.connect(lp2);
    lp2.connect(air);
    air.connect(master);
    src2.start();

    /* 极低的两个音 */
    var o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 48;
    var g1 = ctx.createGain();
    g1.gain.value = 0.05;
    o1.connect(g1);
    g1.connect(master);
    o1.start();

    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 72.5;
    var g2 = ctx.createGain();
    g2.gain.value = 0.018;
    o2.connect(g2);
    g2.connect(master);
    o2.start();

    /* 缓慢的滤波呼吸 */
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    var lg = ctx.createGain();
    lg.gain.value = 150;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lfo.start();

    built = true;
    return true;
  }

  function enable(yes) {
    if (yes && !built) {
      if (!build()) return false;
    }
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    on = !!yes;
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(on ? 0.30 : 0.0, now, 0.55);
    return true;
  }

  function update(pull) {
    if (!built || !on) return;
    var now = ctx.currentTime;
    uw.gain.setTargetAtTime(0.62 * (1 - 0.82 * pull), now, 0.7);
    air.gain.setTargetAtTime(0.08 + 0.30 * pull, now, 0.7);
  }

  window.Ambience = {
    enable: enable,
    update: update,
    get on() { return on; }
  };
})();
