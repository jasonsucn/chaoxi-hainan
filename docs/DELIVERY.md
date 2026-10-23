# 交付 / DELIVERY —— 潮汐书 · 海南

**日期** 2026-10-23  
**状态** R1 五幕已接进 shell；R2 潮汐笺 / 大潮门 / 声音 / 文案湿层已接；R3 单文件已构建，真机与声音需用户验收。

---

## 1. 打开

| 入口 | 说明 |
|---|---|
| `/journey.html` | 五幕 shell（开发入口，便于改） |
| `/dist/chaoxi.html` | 单文件（1.21 MB；CSS/JS/3 张图版全内联） |
| `/` | M0 00 满潮（锁定，保留作对照） |
| `/labs/act01…05/` | 各幕独立 lab |
| `/labs/shell-preview.html?w=390&h=844&src=../journey.html%3Fact%3D02%26p%3D0.6` | 390 / 1440 预览框 |

深链：`?act=01…05&p=0..1`；`?nowebgl=1`；`?reduced=1`。

---

## 2. 五幕

| 幕 | act | 交互 | 收集 |
|---|---|---|---|
| 00 满潮 | M0（锁定） | 拖动 / 滚轮把海拉下去 | — |
| 01 玄武 | `js/acts/act01.js` | 按住石头 2–4s 升温 | 火 |
| 02 潮间带 | `js/acts/act02.js` | 拖水线；点完整的字 | 拾 |
| 03 珊瑚 | `js/acts/act03.js` | 移光；停住 2s 产卵 | 卵 |
| 04 航线 | `js/acts/act04.js` | 顺着 12 段针路划 | 更 |
| 05 归潮 | `js/acts/act05.js` | 按住卡 1.15s 收好 | 汐 |

---

## 3. R2 / R3 已做

- **潮汐笺** `js/core/tidecard.js`：05 的卡截图 → PNG；「收好 / 收下图片 / 分享 / 再等一次潮」；数据来自 `Collection` + 日期 + 月相 + 6h13m 潮时。
- **大潮之门** `js/core/gate.js`：朔望 ±1 天开；封着 / 开着 / 刚合上；下一次与倒计时；「推门」后只留一句。
- **声音** `js/core/soundscape.js`：00 沿用 M0 `Ambience`；01–05 程序化层 + wet/dry + 事件；静音记忆；手势解锁。
- **文案湿层**：`#chapterCopy` 拆 ink / wet 两层，同一条水线 `clip-path`。
- **单文件** `tools/build-single.js` → `dist/chaoxi.html`。
- **降级**：`no-webgl`（`#sea` 隐藏，00 的 2D 字/岛/椰子树仍成立）；`reduced`（时间冻结、转场直切）。
- **QA**：1280 / 1440 / 390 的 shell 版式；潮汐笺与大潮门实测；单文件起页。

---

## 4. 还需要用户验收

1. **真机**：iPhone Safari / Android Chrome，各 1 张首屏 + 02 + 05；机型 / 系统 / 是否 WebGL。手机无法直接开 127.0.0.1，需要在同一局域网用电脑的 LAN IP，或直接开 `dist/chaoxi.html`。
2. **声音**：戴耳机过一遍——01 石头 tick、02 浪/沙/远山、03 产卵、04 划笔、05 盖章后 1.2s 静默；低音/音量是否合适。
3. **05 长按**：「按住·收好」1.15s 的 sealed 视觉；自动浏览器没有 hold API，需要手按一次。
4. **04 的「更」**：划满 12 段后才给；是否一次给、是否能重来。
5. **大潮之门**：只有朔望 ±1 天才开；目前日期 10 月 26 日（望）前，看到的是「封着」。

---

## 5. 已知限制 / 待修

- 04 的 act 自带标题/正文/图版，shell 的 chapter-copy 在这一幕隐藏；这是有意的去重。
- 05 的 chapter-copy 只在 `p>0.9` 显示，top 22%；因为整幕大部分在骨白干侧。
- 大潮门是叙事门，不是潮汐预报；实际大潮常滞后 1–3 天。
- 声音是程序化「印象」，不是录音；远山猿啼只做低频。
- 单文件 1.21 MB 里约 849 KB 是 3 张图版；若要更小，可把 01/03 图版改为按需加载（但会破坏单文件）。
- 真机性能、iOS 100vh、safe-area 还没在设备上验。

---

## 6. 文件

- `docs/PLAN-5ACTS.md` / `ART-DIRECTION.md` / `ACT-INTERFACE.md`
- `docs/copy-deck.md` / `sound-map.md` / `plate-log.md`
- `docs/act01-study.md` … `act05-study.md`
- `assets/plates/treated/*.webp`（3 张，849 KB）
- `js/acts/*.js`、`js/core/*.js`、`journey.html`、`journey.css`、`styles.css`
- `dist/chaoxi.html`
