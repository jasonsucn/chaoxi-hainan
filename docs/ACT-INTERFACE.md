# ACT 接口 / INTERFACE

> 目标：每个场景 agent 只写 `labs/actNN/act.js`，不碰共享文件；Lead 原样移到 `js/acts/actNN.js`，由 shell 载入。

## 0. 注册

页面先提供注册表：

```html
<script>
window.ACTS = window.ACTS || { list: {}, register: function (id, mod) { this.list[id] = mod; } };
</script>
<script src="act.js"></script>
```

`act.js` 只做一件事：

```js
ACTS.register('03', {
  id: '03',
  title: '珊瑚',
  en: 'CORAL',
  accent: '#E2452F',
  mount: function (root, ctx) { /* 建自己的离屏 canvas / 状态 */ },
  resize: function (w, h, dpr) { /* 重算布局 */ },
  render: function (s) { /* 每帧画 */ },
  unmount: function () { /* 清理 */ }
});
```

`mount` / `resize` / `render` / `unmount` 都是可选的，但 `render` 必须有。

## 1. state（每帧传入）

```js
{
  p: 0.42,          // 本幕局部进度 0..1（滚动驱动）
  lineY: 356,       // 水线屏幕 y（CSS px，已含波）
  t: 12.34,         // 秒
  pointer: { x: 0.5, y: 0.5, down: false },
  tide: 0.58,       // 全局潮位 0..1
  reduced: false,
  palette: { ink:'#111310', bone:'#F2ECDF', sea:'#03100F', teal:'#16332F', coral:'#D8503A' }
}
```

`lineY` 是**唯一**的水线。不要自己算第二条。

## 2. ctx（mount 时传入）

```js
{
  g, W, H, dpr,      // 2D context + 画布尺寸（CSS px / DPR）
  palette,           // 同上
  font(weight, size, family),   // 返回 canvas font 字符串
  waveAt(x, t),      // 与全局水线完全一致的波（CSS px）
  clipAbove(line),   // 建 path（调用方自己 g.clip()）
  clipBelow(line),
  root               // 场景根元素（可放 DOM 标签）
}
```

`clipAbove/Below` 使用当前 `t`；它们只建 path，不 clip，方便调用方 save/restore。

## 3. lab

模板：`labs/act-template/`。复制：

```bash
cp -r labs/act-template labs/act01
```

只改 `labs/act01/act.js`；`index.html` / `lab.js` / `lab.css` 是 harness。
本地服务：`http://127.0.0.1:4174/labs/act01/`（root 是 `hainan/`）。
参数：`?p=0.55` 潮位；`?hud=0` 干净截图。

harness 负责：

- 画背景（上 bone / 下 teal）；
- 画水线、波、泡沫；
- 画 HUD、滑杆；
- 每帧清屏 → 背景 → `act.render(s)` → 水线覆盖；
- pointer down/move/up、resize、rAF、`prefers-reduced-motion`。

act 负责：

- 自己的证物/场景/排版/交互；
- 干（墨）/湿（骨白 + 折射）两遍；
- 不画水线本身，不画背景（除非该幕需要覆盖背景；可以，但要在 review 里说明）。

## 4. 干 / 湿的标准写法

```js
render(s) {
  var g = this.ctx.g, line = s.lineY;

  // 干
  g.save();
  this.ctx.clipAbove(line);
  g.clip();
  this.draw(g, 'ink');
  g.restore();

  // 湿
  g.save();
  this.ctx.clipBelow(line);
  g.clip();
  g.filter = 'blur(0.35px)';
  this.draw(g, 'bone');
  g.restore();
  g.filter = 'none';
}
```

`draw(g, mode)` 用 `mode==='ink'` 画墨版，`'bone'` 画骨白版；湿版可以加 1–3px 的 `sin` 横向位移（参考 `js/typewater.js` 的 `drawWet`）。

## 5. 共享文件 / 写入范围

每个 act 只允许写：

```
labs/actNN/index.html      （复制模板，一般不动）
labs/actNN/lab.css         （复制模板，一般不动）
labs/actNN/lab.js          （复制模板，一般不动）
labs/actNN/act.js          （你唯一要改的）
```

R1 由 Lead 原样移动到：

```
js/acts/actNN.js
```

**不许改**：`index.html`、`styles.css`、`js/app.js`、`js/core/*`、`js/typewater.js`、`js/sea.js`、`js/coast.js`、其他 agent 的 lab、M0 的 hero。

## 6. R1 集成

- shell 读 `js/core/chapters.js`（Lead 写）里的 5 幕范围；
- 每幕的 `root` 是 fixed 全屏层，shell 控制显示/隐藏和 `p`；
- 同一时间只渲染当前幕 + 相邻一幕（预加载）；
- 隐藏的幕暂停 rAF / 音频；
- 转场：水线扫过，上一幕被擦掉、下一幕被露出；不做 opacity 淡入。

## 7. Review checklist

- [ ] 只改 `act.js`（或明确说明为什么改了 harness）。
- [ ] 390 / 1280 / 1440；3 个潮位（p=0.15 / 0.55 / 0.9）。
- [ ] 干/湿两版都成立；水线和 `lineY` 完全对齐。
- [ ] 主轮廓 1.0–1.2px；填充 3–4%；只用该幕一个强调色。
- [ ] 60fps；无 console error；无外部图片/字体。
- [ ] 交互可键盘/触摸；reduced-motion 有静态版。
- [ ] 截图 + `docs/actNN-study.md`（做法/可复用/性能/建议）。
