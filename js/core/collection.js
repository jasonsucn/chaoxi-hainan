/* 收集层：五个字只存在本机。火 · 拾 · 卵 · 更 · 汐 */
window.Collection = (function () {
  'use strict';
  var KEY = 'tidebook.words.v1';
  var words = [];

  try {
    var raw = localStorage.getItem(KEY);
    if (raw) words = JSON.parse(raw) || [];
  } catch (e) { words = []; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(words)); } catch (e) { /* private mode */ }
  }

  function has(ch) {
    for (var i = 0; i < words.length; i++) if (words[i].char === ch) return true;
    return false;
  }

  function add(ch, act) {
    if (!ch || has(ch)) return false;
    words.push({ char: ch, act: act || '', t: new Date().toISOString() });
    save();
    try {
      document.dispatchEvent(new CustomEvent('tide:collect', {
        detail: { char: ch, act: act || '', count: words.length }
      }));
    } catch (e) { /* noop */ }
    return true;
  }

  return {
    add: add,
    has: has,
    all: function () { return words.slice(); },
    count: function () { return words.length; },
    key: KEY
  };
})();
