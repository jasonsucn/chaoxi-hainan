# ACT LAB 模板

每个幕都在这里开始，**只改 `act.js`**。

## 跑起来

本地服务（Lead 已开）：

```
http://127.0.0.1:4174/labs/act-template/
http://127.0.0.1:4174/labs/act-template/?p=0.55
http://127.0.0.1:4174/labs/act-template/?p=0.55&hud=0   // 干净截图
```

移动端：`http://127.0.0.1:4174/labs/preview.html?src=act-template&p=0.55`

## 复制

```bash
cp -r labs/act-template labs/act03
# 改 labs/act03/act.js 里的 id / title / en / accent 和场景
```

## 你必须保留的

```js
ACTS.register('03', {
  id, title, en, accent,
  mount(root, ctx),     // 建状态/离屏
  resize(w, h, dpr),    // 重算布局
  render(s)             // 每帧画
});
```

`s` 里有：`p`、`lineY`、`t`、`pointer{x,y,down}`、`tide`、`reduced`、`palette`。
`ctx` 里有：`g`、`W/H/dpr`、`palette`、`font()`、`waveAt()`、`clipAbove(line)`、`clipBelow(line)`、`root`。

## 规则

- 水线只有一条，用 `ctx.clipAbove/clipBelow(s.lineY)`；不要自己画第二条。
- 干 = 墨，湿 = 骨白 + 0.35px blur（可加 sin 横向位移）。
- 主轮廓 1.0–1.2px；填充 3–4%；只用 tokens + 一个强调色。
- 60fps；无外部图片/字体；`prefers-reduced-motion` 有静态版。
- 不改 `index.html` / `lab.js` / `lab.css`（除非在报告里说明）。

## 交付

- 390 / 1280 / 1440 截图；p=0.15 / 0.55 / 0.9 三个潮位；
- `docs/actNN-study.md`：做法、可复用点、性能、R1 建议；
- 报告给 Lead；Lead 会把 `act.js` 原样移到 `js/acts/actNN.js`。
