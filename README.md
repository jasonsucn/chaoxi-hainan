# 潮汐书 · 海南 / THE TIDE BOOK

> 海南是一本被海反复擦掉的书。  
> 你滚动的不是页面，是退潮。

五幕 H5：**00 满潮 / 01 玄武 / 02 潮间带 / 03 珊瑚 / 04 航线 / 05 归潮**。  
收集五个字：**火 · 拾 · 卵 · 更 · 汐**，最后在 05 收进一张潮汐笺。

## 打开

| 入口 | 说明 |
|---|---|
| `journey.html` | 五幕 shell（开发入口，需静态服务） |
| `dist/chaoxi.html` | 单文件（CSS / JS / 5 个 act / 3 张图版全内联，可直接 `file://` 打开） |
| `index.html` | M0 00 满潮（锁定版，单章对照） |

```bash
python -m http.server 4174
# http://127.0.0.1:4174/journey.html
```

深链：`?act=01…05&p=0..1`；`?nowebgl=1`；`?reduced=1`。

## 五幕

| 幕 | 交互 | 收集 |
|---|---|---|
| 00 满潮 | 拖 / 滚把海拉下去 | — |
| 01 玄武 | 按住石头 2–4s 升温 | 火 |
| 02 潮间带 | 拖水线；点完整的字 | 拾 |
| 03 珊瑚 | 移光；停住 2s 产卵 | 卵 |
| 04 航线 | 顺着 12 段针路划 | 更 |
| 05 归潮 | 按住卡 1.15s 收好 | 汐 |

## 技术

- 原生 JS，无框架；classic script；`window.ACTS.register` 注册五幕。
- 00 是 WebGL 海 + Canvas2D 字 / 岛 / 椰子树；01–05 是 Canvas2D 场景。
- 一条水线：干侧墨 `#111310`，湿侧骨白 `#F2ECDF`；文案、场景、转场共用同一条线。
- 潮汐笺：05 的画面截图 → PNG；下载 / 分享 / 重来。
- 大潮之门：朔望 ±1 天，三态；不接潮汐 API。
- 声音：程序化 Web Audio；00 沿用 M0，01–05 分层；默认静音，手势解锁。
- 单文件：`tools/build-single.js` → `dist/chaoxi.html`。

## 文件

```
journey.html / journey.css      五幕 shell
styles.css                      M0 视觉系统
js/coast.js sea.js typewater.js audio.js   M0 模块
js/acts/act01..05.js            五幕
js/core/*.js                    收集 / 卡 / 门 / 声音 / journey
assets/plates/treated/*.webp    3 张 AI 图版（01 / 03 / 04）
docs/                           计划、美术、文案、声音、交付、研究
dist/chaoxi.html                单文件
labs/                           各幕 lab / 模板 / 预览
```

## 已知限制

- 04 的标题 / 正文 / 图版由 act 自己画，shell 在这一幕隐藏章节文案。
- 05 的 copy 只在 `local > 0.9` 出现。
- 大潮之门是叙事门，不是潮汐预报。
- 单文件里约 849 KB 是 3 张图版。
- iOS 100vh / safe-area / 真机性能未在设备上验。
- 声音是程序化「印象」，不是录音。

## 作者

概念 / 视觉 / 交互 / 开发：XR LAB  
2026
