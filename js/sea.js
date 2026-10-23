/* ============================================================
   Sea —— 分水镜头：水上一半是过曝的盐白天空，水下一半是南海青。
   一条可移动的水平线。无纹理、无外部素材。
   ============================================================ */
(function () {
  'use strict';

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    '',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform float uLine;',
    'uniform float uPull;',
    'uniform float uDpr;',
    'uniform vec2  uPointer;',
    '',
    'float hash(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    '',
    'float noise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    '',
    'float fbm(vec2 p){',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += a * noise(p);',
    '    p = p * 2.03 + vec2(1.7, 9.2);',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'float caustic(vec2 p, float t){',
    '  vec2 q = p;',
    '  float v = 0.0;',
    '  for (int i = 0; i < 3; i++) {',
    '    q += vec2(sin(q.y * 1.7 + t * 0.5), cos(q.x * 1.5 - t * 0.4)) * 0.85;',
    '    v += 1.0 - abs(sin(q.x * 1.6 + q.y * 1.4 + t * 0.3));',
    '  }',
    '  v = max(v / 3.0, 0.0);',
    '  return pow(v, 4.5);',
    '}',
    '',
    'void main(){',
    '  vec2 st = vec2(gl_FragCoord.x / uRes.x, (uRes.y - gl_FragCoord.y) / uRes.y);',
    '  float l = uLine / uRes.y;',
    '  float wavePx = (sin(st.x * 23.0 + uTime * 0.7) * 1.4',
    '               + sin(st.x * 55.0 - uTime * 0.5) * 0.7) * uDpr;',
    '  float lw = l + wavePx / uRes.y;',
    '  vec2 p = vec2((gl_FragCoord.x - 0.5 * uRes.x) / uRes.y,',
    '                (uRes.y - gl_FragCoord.y) / uRes.y);',
    '  p.x += (uPointer.x - 0.5) * 0.06;',
    '  p.y += (uPointer.y - 0.5) * 0.03;',
    '',
    '  float d  = st.y - lw;  // >0 水下，<0 水上',
    '  float px = d * uRes.y; // 像素，正为水下',
    '',
    '  /* ---------- 过曝的天空 ---------- */',
    '  float h = max(-d, 0.0);',
    '  vec3 sky = mix(vec3(0.955, 0.940, 0.885), vec3(1.0, 0.995, 0.975),',
    '                 smoothstep(0.0, 0.42, h));',
    '  vec2 sp = (st - vec2(0.735, 0.20)) * vec2(1.25, 1.9);',
    '  float sun = exp(-dot(sp, sp) * 26.0);',
    '  sky += vec3(0.135, 0.096, 0.048) * sun;',
    '  sky += vec3(0.016, 0.012, 0.008) * exp(-h * 9.0);',
    '  sky += vec3(0.007, 0.005, 0.003) * sin(st.y * 190.0 + fbm(vec2(st.x * 4.0, st.y * 7.0 + uTime * 0.06)) * 7.0);',
    '  sky *= 0.982 + 0.036 * fbm(vec2(st.x * 1.6, st.y * 1.9) + 3.1);',
    '  sky += (fbm(vec2(st.x * 5.0, st.y * 4.0) + 9.0) - 0.5) * 0.012;',
    '  vec2 hp = gl_FragCoord.xy / 6.0;',
    '  float dotP = smoothstep(0.44, 0.52, length(fract(hp) - 0.5));',
    '  sky -= dotP * 0.0055;',
    '',
    '  /* ---------- 水 ---------- */',
    '  float dn = clamp(d / 0.86, 0.0, 1.0);',
    '  vec3 water = mix(vec3(0.030, 0.108, 0.122), vec3(0.003, 0.014, 0.021),',
    '                   smoothstep(0.0, 0.72, dn));',
    '  water += vec3(0.030, 0.070, 0.072) * exp(-d * 6.0);',
    '  water *= 0.92 + 0.18 * fbm(p * 1.25 + vec2(uTime * 0.012, 0.0));',
    '',
    '  /* 天光从右上方落下来 */',
    '  float pool = exp(-pow((st.x - 0.62) * 2.4, 2.0)) * exp(-d * 2.6);',
    '  water += vec3(0.035, 0.085, 0.080) * pool;',
    '',
    '  /* 光柱：竖向拉长的噪声 */',
    '  float shaft = fbm(vec2(p.x * 5.2 + p.y * 1.1 + uTime * 0.018,',
    '                         p.y * 0.32 - uTime * 0.012));',
    '  shaft = smoothstep(0.42, 0.86, shaft);',
    '  water += vec3(0.145, 0.295, 0.278) * shaft * exp(-d * 1.75) * 0.72;',
    '',
    '  /* 大面积微光 */',
    '  float glow = fbm(vec2(p.x * 1.3 + uTime * 0.008, p.y * 0.8));',
    '  water += vec3(0.018, 0.046, 0.044) * glow * 0.7;',
    '',
    '  /* 焦散 */',
    '  float ca = caustic(p * 12.0 + vec2(0.0, uTime * 0.05), uTime);',
    '  water += vec3(0.280, 0.575, 0.525) * ca * exp(-d * 4.4) * 1.15;',
    '',
    '  /* 紧贴水面的焦散网 */',
    '  float ca2 = caustic(vec2(p.x * 9.0, (st.y - lw) * 15.0 + uTime * 0.10), uTime * 0.8);',
    '  water += vec3(0.500, 0.860, 0.780) * ca2 * exp(-max(d, 0.0) * 12.0) * 0.85;',
    '',
    '  /* 贴近水面的细碎波光 */',
    '  float shim = sin(p.x * 17.0 + fbm(vec2(p.x * 3.0, p.y * 5.0 + uTime * 0.3)) * 7.0 + uTime * 0.8);',
    '  shim = pow(max(shim, 0.0), 14.0) * exp(-d * 16.0);',
    '  water += vec3(0.420, 0.680, 0.610) * shim * 0.40;',
    '',
    '  /* 水面带 */',
    '  float band = exp(-pow(px / 20.0, 2.0));',
    '  water = mix(water, vec3(0.560, 0.810, 0.740), band * 0.34);',
    '',
    '  /* 水面上的太阳碎光 */',
    '  float glit = pow(fbm(vec2(p.x * 42.0, uTime * 0.7)), 3.0);',
    '  glit *= exp(-abs(px) / 13.0) * smoothstep(0.15, 0.95, st.x);',
    '  water += vec3(0.700, 0.900, 0.840) * glit * 0.95;',
    '  float foamN = fbm(vec2(p.x * 26.0, uTime * 0.55));',
    '  float foam = smoothstep(0.52, 0.82, foamN) * exp(-abs(px) / 7.0);',
    '  water += vec3(0.550, 0.742, 0.670) * foam * 0.72;',
    '',
    '  /* 水面把天空压暗，形成一条湿的接缝 */',
    '  sky = mix(sky, vec3(0.845, 0.898, 0.855), exp(-h * 90.0) * 0.38);',
    '',
    '  vec3 col = mix(sky, water, smoothstep(-0.0012, 0.0012, d));',
    '',
    '  /* 水线本身 */',
    '  float lineGlow = exp(-pow(px / 1.7, 2.0));',
    '  col += vec3(0.540, 0.760, 0.690) * lineGlow * 0.20;',
    '',
    '  /* 暗角与颗粒 */',
    '  vec2 vc = (st - 0.5) * vec2(1.0, 1.15);',
    '  float vig = smoothstep(0.95, 0.24, length(vc));',
    '  col *= mix(0.82, 1.0, vig);',
    '  col += (hash(gl_FragCoord.xy + fract(uTime) * 31.0) - 0.5) * 0.020;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var gl = null, canvas = null;
  var program = null;
  var U = {};
  var ratio = 1;
  var ok = false;

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      console.error('[sea] shader', log);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function init(el) {
    canvas = el;
    var opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' };
    gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) {
      document.documentElement.classList.add('no-webgl');
      return false;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[sea] link', gl.getProgramInfoLog(program));
      return false;
    }
    gl.useProgram(program);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    U.res = gl.getUniformLocation(program, 'uRes');
    U.time = gl.getUniformLocation(program, 'uTime');
    U.line = gl.getUniformLocation(program, 'uLine');
    U.pull = gl.getUniformLocation(program, 'uPull');
    U.dpr = gl.getUniformLocation(program, 'uDpr');
    U.ptr = gl.getUniformLocation(program, 'uPointer');

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    ok = true;
    return true;
  }

  function resize(w, h, dpr) {
    if (!ok) return;
    ratio = dpr;
    var pw = Math.max(1, Math.round(w * dpr));
    var ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
  }

  function render(t, lineY, pull, pointer) {
    if (!ok) return;
    gl.useProgram(program);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, t);
    gl.uniform1f(U.line, lineY * ratio);
    gl.uniform1f(U.pull, pull);
    gl.uniform1f(U.dpr, ratio);
    gl.uniform2f(U.ptr, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  window.Sea = {
    init: init,
    resize: resize,
    render: render,
    get ok() { return ok; }
  };
})();
