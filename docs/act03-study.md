# ACT 03 · 珊瑚 / CORAL —— R0 材质研究

**版本** 2026-10-23 · R0  
**归属** coral  
**lab** `hainan/labs/act03-study/`  
**URL** <http://127.0.0.1:4174/labs/act03-study/>  
**范围** 只写 `labs/act03-study/` 与本文档；不碰 M0 / 共享文件 / 其他 lab。

---

## 0. 一句话

夜里，珊瑚下雪。光停住两秒，珊瑚虫一朵朵张开，卵囊从枝端升起；光移开，珊瑚合上，卵已经在水里。  
水线以上是墨，以下是骨白 + 折射；珊瑚朱只给被光唤醒的虫和卵，荧光青只给光本身。

---

## 1. 这个 lab 里有什么

| 文件 | 作用 |
|---|---|
| `index.html` | 语义骨架、HUD、ACTS 注册入口 |
| `lab.css` | palette、HUD、潮位尺、responsive、reduced-motion |
| `lab.js` | lab harness：水线、背景、潮位、输入、HUD、rAF、debug |
| `act03-coral.js` | **场景本体**。`ACTS.register('03', …)`，R1 取这个文件 |
| `preview-390.html` | 精确 390×844 预览壳（仅截图用） |
| `docs/act03-study-*.png` | 4 张实机截图 |

跑法：

```bash
cd hainan
python -m http.server 4174
# http://127.0.0.1:4174/labs/act03-study/
```

参数：`?p=0.55` 潮位；`?still=1` 定帧截图；`?x=0.66&y=0.615` 光的位置；`?hint=0` 隐藏提示；`?hud=0` 隐藏 HUD；`?debug=1` FPS / CPU / 粒子数。  
水线映射与 `labs/act-template/` 一致：`lineStart = 0.08H`，`lineEnd = 0.92H`，`lineY = lineStart + (lineEnd − lineStart) × p`。

---

## 2. 画面 / 材料

### 2.1 构图

- 暗场深青，水线横切整页；骨白纸在上，深青在下。
- 一株鹿角珊瑚从底部长出，横跨水线；珊瑚左侧是脑珊瑚，右侧是管状海绵与海扇，底部是礁岩基座。
- 左上竖排「珊瑚」与两列正文；右上月相、潮位尺；底部 readout / 提示 / 回潮。
- 390 竖屏：珊瑚收窄到 70% 宽、底部抬高，标题仍竖向，正文改两行横排；潮位尺保留，但隐去 stop 文字（M0 的移动端处理）。

### 2.2 线 / 填充 / 颜色

- 主轮廓 1.08px；次级 0.72–1.04；点/细线 0.5–0.8。端点、连接全部 round。
- 干侧填充 3.6%（墨）；湿侧 4.0–4.2%（骨白）。没有实心块。
- 干侧墨线 alpha 0.82；湿侧骨白 0.68；水下线另有一层 3.4px、alpha 0.03 的冷绿柔光。
- 只用 tokens：`#111310 / #F2ECDF / #03100F / #16332F / #D8503A`；材料强调是 copy-deck 的珊瑚红 `#E2452F` 与荧光青 `#7FE3D4`。朱红只落在被光唤醒的虫/卵与光的短弧上，青只在光斑与光弧里出现；面积远低于 5%。

### 2.3 干 / 湿

- 干：墨水层 `rgba(17,19,16)`；湿：骨白层 `rgba(242,236,223)`。
- 珊瑚、标题、正文、图版标签都走同一套 `clipAbove(lineY)` / `clipBelow(lineY)`；没有任何一条自己的水线。
- 湿侧按 4px 横条做 `sin` 横向位移（振幅 ≤4.6px），并保留水线以上 26px 的“湿膜”（骨白版 0.16–0.20 alpha）。
- 标题与正文单独预渲染成墨/骨白两层；湿侧再加 0.10–0.18 的青绿水色、焦散线和一层 8px 模糊自发光（M0 `typewater.js` 的简化版）。

### 2.4 文字（来自 copy-deck，未改字）

- kicker：`夜里，珊瑚下雪`
- title：`珊瑚`
- body1：`珊瑚把卵吐进水里，像一场很慢的雪。`
- body2：`把光停住两秒，它才开。别急着移开。`
- hint：`移光找珊瑚；停住两秒` / `MOVE THE LIGHT — HOLD STILL`
- 图版标签：`鹿角珊瑚 / STAGHORN CORAL`、`脑珊瑚 / BRAIN CORAL`
- 月相：运行时用与 `app.js` 相同的 `moonInfo` 算，只写「月相 · 盈凸」这类真实结果，不写日期。
- 图版注（可放 R1 图版，不放进正文）：`产卵多在农历二月到五月；满月前后不一定。`（来源见 copy-deck §6）

### 2.5 交互（已按 Lead 定的顺序实现）

1. 光（pointer）在水里移动，扫过的珊瑚虫 `wake` 渐亮，卵在光里偏珊瑚红。
2. 光停在珊瑚上 **2 秒**：`open` 升到 1，珊瑚虫张开（珊瑚红小环 + 5 根 0.55px 触手），并从附近的枝端/口部释放一批卵囊。
3. **光不撤**：卵继续上浮；这是“停住 → 开 → 下雪”的过程。
4. 光移开：珊瑚合上（`open` 衰减更快），**卵留在水里**，不会消失。
5. 没有点击爆炸：点击只会把光放在那里，必须停住两秒才产卵。

---

## 3. 技术做法

### 3.1 珊瑚几何

- 纯程序化，`mulberry32` 固定种子；resize 时重建。
- 每个主枝有**独立预算**（`share` 0.72–1.0 × 30 条），避免“第一根枝吃满全树、后面只剩光杆”的问题；每个主枝在枝端分 2–3 叉，并在枝身中段再分一次。
- 每根枝是 9 点贝塞尔脊线 + 两侧宽度包络，收成闭合轮廓；顶端加一个 1.1–1.8px 的珊瑚杯。
- 顶部枝端再补 88 个短芽（不挂虫点/产卵点），让枝冠像珊瑚而不是冬天的树。
- 脑珊瑚：半球轮廓 + 连续回沟线，clip 在轮廓内；海扇：10 根肋 + 4 条横弧；管海绵：3–5 根带口部的锥管；礁岩：闭合轮廓 + 层理 + 裂 + 卵石 + 两丛藻。
- 虫点、卵点、图版标签一起生成；虫点最终约 684 个（1280）。

### 3.2 离屏层

- resize 时把整株珊瑚画进两张离屏 canvas：`ink` / `bone`（含 10px padding），以及同样大小的标题墨/骨白层 + 标题模糊自发光层。
- 每帧只做：`clipAbove` → draw ink；`clipBelow` → 4px 横条 draw bone；湿膜带 → draw bone。珊瑚本身**不逐帧重画**。
- 湿侧折射条：4px 一条，而不是 3px；视觉几乎无差，drawImage 次数少 25%。
- 标题湿层每 2 帧重算一次（30fps），只重画小尺寸离屏，闪烁不可见。

### 3.3 光 / 虫 / 卵

- 光：`pointer.x/y` → 目标点；静止 7 秒后自动缓慢巡游（still/reduced 不巡游）。
- 光半径 `clamp(min(W,H)×0.235, 78, 195)`；径向渐变叠加、一圈被 `sin` 扰动的细弧、极短的青弧；只在水下生效。
- 虫：光半径内 `wake` 插值；张开时画珊瑚红环 + 5 根触手；dwell>2 时 `open→1`。光移开，`wake` 衰减，卵不受影响。
- 卵：初始化 70–88 颗（390 56 颗），从珊瑚枝端沿水柱分布；静止 2 秒停留的那一批额外在光附近种 20 颗。产卵 burst 一次释放约 18 颗（6 个口 × 3），卵以 5–20px/s 上浮，遇水线回收再释放；`still` 下定帧不跑。
- 海雪 34 颗、气泡 14 颗；都压低到“氛围”而不是主体。

### 3.4 标题 / 正文

- 桌面：竖排标题 fs=min(0.115W, 0.20H, 190)，kicker 竖排 10.2px，body1/body2 两列竖排 9.6px；一列 9.6px 宽的文字在 1440 也放得下。
- 390：标题 fs=min(0.26W, 0.115H)≈97px；kicker + 两行正文横排，标题竖排；文字仍由同一套 canvas 层绘制，水线照样切。
- 湿侧文字只在小 bbox 内做 4px 切片，tint 后再叠回主画布。

---

## 4. 可复用到 R1 的部分

`act03-coral.js` 是**自包含 act 模块**，文件末尾：

```js
window.Act03 = A;
window.__act03 = S;
if (window.ACTS && window.ACTS.register) window.ACTS.register('03', A);
```

接口与 `docs/ACT-INTERFACE.md` 对齐：

```js
ACTS.register('03', {
  id: '03', title: '珊瑚', en: 'CORAL', accent: '#E2452F',
  mount(root, ctx),     // 记录 ctx / moonInfo / 光
  resize(w, h, dpr),    // 重建珊瑚、标题、粒子
  render(s),            // s.p / s.lineY / s.t / s.pointer / s.reduced
  debug()               // lab 用：polyps / eggs / light
});
```

R1 建议：

- 把 `labs/act03-study/act03-coral.js` **原样**移到 `js/acts/act03.js`；不要搬 `lab.js`。
- shell 继续画 bone/teal 背景与水线；act 不画第二水线。act 内的 `drawAtmosphere`（光柱、焦散、海雪）如果 shell 已有，可删掉，二者颜色都是同一套 tokens。
- shell 的 HUD 用共享的潮位尺 / readout / 章节索引；lab 里的自定义 header、gauge、hint、replay 都不进 act。
- shell 传 `{ lineY, t, pointer, reduced, dt }`；`still` 只是 lab 参数，R1 不传即可。`p` 只用于粒子种子的确定性，可以传。
- 保留两秒 dwell、光不撤、卵留水里；不要加点击爆炸。
- 拾「卵」：建议 act 暴露一个回调或在 `L.open` 到 1 时由 shell 触发收集；当前 act 没有 DOM/回调节点，R1 加一个 `onSpawn` 最干净。
- 字体：act 会用 `document.fonts.ready` 自己重建标题层；shell 不需要额外处理。
- 潮痕装饰按 `0.08 + 0.84p` 算，与 template 的映射一致；如果 R1 shell 改了水线范围，要同步改这三条潮痕的 y。
- 移动端：M0 的惯例是隐藏潮位尺文字；本 lab 已这样做。R1 如果给潮位尺加章节导航，注意它在 390 右缘和珊瑚的距离（本 lab 把珊瑚右缘收到 370/390）。

---

## 5. 性能

实测（`?debug=1`，1280×800，DPR 1，共享 headless Chromium）：

- **单帧 CPU 约 6.0ms**（shell 背景 + act 全绘制 + HUD）。
- 页面自报 rAF 为 20–31fps，但同一时刻 CPU 只有 6ms；明显是共享浏览器/后台 tab 的帧调度限制，不是绘制预算爆掉。真机/前台仍需复测，不能把 60fps 写成已验收。
- 390 布局的粒子和虫点更少，预算更低；本次未单独测 CPU。

已做的优化：

- 背景/水线只画必要面积；没有全屏 `mix-blend-mode` 颗粒层（已删）。
- 珊瑚/标题预渲染到离屏层；湿侧 4px 条；标题湿层 30fps。
- HUD 的 marker/aria 只在 `p` 变化时写 DOM；静态时不再每帧触发样式计算。
- DPR 封顶 2；DPR 1 下单帧 6ms。
- 粒子上限：卵 ~120、海雪 34、气泡 14、虫点 684；`prefers-reduced-motion` 时全部静态，只保留潮位。
- 珊瑚几何在 resize 时重建（会一次性绘制 2 张 800×600 级别的离屏图），不在每帧。

未做：

- 真机 390 中端机 60fps 实测；低端机可把虫点减到 ~450、卵到 ~70、离屏层 DPR 降到 1.5。
- `OffscreenCanvas` / Worker；目前主线程足够。
- 音频（本 act 在 shell 里由 sound-map 接水下 + 细碎产卵声）。

---

## 6. 这次做对了什么 / 该丢掉什么

**保留**

- 珊瑚与标题共用一条水线的干/湿两遍；高水时标题整块沉入水里、变成骨白，低水时全干成墨；这是全篇最值得复用的行为。
- 珊瑚的“光停 → 开 → 卵升起 → 光移开合上、卵留着”的手感，方向明确，不靠进度条。
- 珊瑚朱的虫点 + 荧光青的光弧，面积很小但可读。
- 以枝端为产卵口、以水线为回收线；卵到了水面被剪掉/回收，和“水擦掉”一致。
- 桌面 3 个潮位 + 390 竖屏的版式都能成立。

**该丢 / R1 注意**

- lab 自己的 HUD（顶部 ACT LAB、右侧 gauge 文字、底部 hint）不要带进 shell；R1 用共享 UI。
- `still / debug / v=` 参数、`preview-390.html` 只是开发工具。
- 珊瑚目前仍是“向上分叉的树”偏多，R1 可以再增加横向枝和短芽，或者换成两丛更矮的鹿角珊瑚；不要为了更“像珊瑚”把线加粗到 1.2 以上。
- 图版注 / 月相文字只是研究层，不进入正文；copy-deck 的「用光唤醒」是交互隐喻，不是科学结论。
- 高水时正文（尤其两列湿侧的 9.6px）偏难读；R1 在高水状态可以减正文、只留 kicker + title，把 body 交给 shell 的章节页。

---

## 7. 实机截图

| 文件 | 尺寸 | 潮位 | 说明 |
|---|---|---|---|
| `docs/act03-study-01-1280-halftide.png` | 1280×800 | p=0.55 半潮 | 干/湿各半；标题全干；hint 可见；光在珊瑚中部，张开的虫点与卵 |
| `docs/act03-study-02-1280-lowtide.png` | 1280×800 | p=0.84 低潮 | 珊瑚几乎全干成墨；底栖湿带；潮痕线出现 |
| `docs/act03-study-03-1280-hightide.png` | 1280×800 | p=0.16 满潮 | 珊瑚全湿；标题沉入水里、墨/骨白被水线切开；产卵光斑 |
| `docs/act03-study-04-390-halftide.png` | 390×844 | p=0.55 半潮 | 移动端竖屏；潮位尺隐文字；珊瑚/标题/光斑 |

> 截图均为无外部图片的实机 canvas 渲染；`prefers-reduced-motion` 下显示静态图鉴版（不跑巡游、海雪、卵，潮位仍可拉）。

---

## 8. 已知边界

- **编码**：`act03-coral.js` 已重写并校验为 0 个 U+FFFD；后续所有中文文本用 edit / write / Node `fs.writeFileSync(…, 'utf8')` 写，不再用 PowerShell 直接改中文文件。
- 珊瑚轮廓是风格化图版，不是分类学写实；「鹿角珊瑚」标签是材料/图版语义，不声称物种鉴定。
- 产卵季节/月相的真实说明只在 docs / 图版注，不写进正文；「光唤醒」是交互，不是科学。
- 水线以上是干纸：月光、潮痕、图版标签都只在干侧；高水时它们全部被剪掉，没有例外。
- 390 的潮位尺只保留刻度/游标，不显示四个 stop 文字；R1 若需要更强的可访问性，应在 shell 里补可点击的章节/潮位列表。
- 本 lab 没有接声音、没有接「卵」的收集；这两件事留给 R1 shell / sound。

---

## 9. R1 段 · `labs/act03/`（scene-only）

**交付** `hainan/labs/act03/`（从 `labs/act-template/` 复制），场景唯一文件是 `act.js`；只注册 `03`，不碰共享文件。  
**URL** <http://127.0.0.1:4174/labs/act03/>  
**截图** `labs/act03/shots/`（9 张，见下）。

### 9.1 与 R0 研究的差异

- **标题 / 正文全部移出 act**：R0 lab 里的 `珊瑚` 竖排、kicker、两列正文、月相、潮痕、海雪、气泡、光柱、焦散都不再进 act。R1 的 act 只画珊瑚、极少量图版 label、光、卵。
- 背景、水线、HUD、章节文案、声音、收集全部归 shell；act 不画第二水线，不碰 DOM / HUD / gauge / hint / still / debug。
- 页面在 lab 里看起来“上半张纸是空的”是预期：shell 会把章节标题 / 正文放在水线以上。
- 珊瑚朱仍只给被光唤醒的虫与卵；荧光青只给光。`act.js` 的 accent 是 `#E2452F`。
- 珊瑚主轮廓 1.08px（≤1.2）；填充 3.6% 墨 / 4.1% 骨白；图版 label 7.8px / 5.8px，仅桌面。
- **横向枝**：桌面 4 根、390 3 根；低处还有 2–5 根侧枝。390 的横向枝更短，避免出画。
- 第一次 dwell 产卵时调用一次 `ctx.onCollect('卵')`（有 `ctx.onCollect` 才调；`S.collected` 只触发一次；resize 不重置）。
- 不改 `docs/PLAN-5ACTS.md` 的顺序：停光 2s → 开 + 卵升起；移光 → 合上，卵留水里；没有点击爆炸。
- 3 号图版**没有**放进 act（本 lab 全程序化）；如果 R1 要用，按 ART-DIRECTION：40–44% 宽内嵌、不加字、不铺满。

### 9.2 act 接口

```js
ACTS.register('03', {
  id: '03', title: '珊瑚', en: 'CORAL', accent: '#E2452F',
  mount(root, ctx),   // 记录 ctx；读 ctx.palette；不碰 HUD
  resize(w, h, dpr),  // 重建珊瑚/离屏/粒子
  render(s)           // s.lineY / s.t / s.pointer / s.reduced / s.p
});
```

- 只用 `ctx.g`、`ctx.clipAbove/Below`、`ctx.palette`、`ctx.onCollect`；不依赖 `lab.js`。
- `ctx.onCollect` 为可选；lab 模板没有，所以 lab 里不会弹收集。
- reduced-motion：静态虫点/光，卵不游；潮位照样可拉。
- 水线映射仍假设 `0.08 + 0.84p`（与 template 一致）；若 shell 改范围，横向枝 / 珊瑚位置不用改，但视觉重心要复看。

### 9.3 截图（labs/act03/shots/）

| 尺寸 | p=0.15 满潮 | p=0.55 半潮 | p=0.90 低潮 |
|---|---|---|---|
| 1280×800 | `act03-1280-p15.png` | `act03-1280-p55.png` | `act03-1280-p90.png` |
| 1440×900 | `act03-1440-p15.png` | `act03-1440-p55.png` | `act03-1440-p90.png` |
| 390×844 | `act03-390-p15.png` | `act03-390-p55.png` | `act03-390-p90.png` |

- 1280 用浏览器直开；390/1440 用临时 iframe shot harness（已删除，避免污染 `labs/act03/`）。
- 记法：p=0.15 珊瑚全湿、光在珊瑚中心；p=0.55 干湿各半；p=0.90 珊瑚近全干、光落在基部浅水。
- lab 模板的 HUD 只有 ACT LAB / 珊瑚 / 滑杆 / hint；不是最终 shell 的 UI。

### 9.4 性能（R1）

- scene-only 去掉了 R0 的标题层、正文层、月相/潮痕、海雪/气泡/光柱/焦散，单帧绘制量明显低于 R0。
- R0 的 headless 记录仍是 **20–31fps @1280 dpr1，单帧 CPU ≈6ms**；R1 的 headless rAF 仍受共享浏览器/后台 tab 限制，不能当 60fps 验收。真机 390 中端机 / 前台桌面需 Lead QA 复测。
- 保留的优化：珊瑚/标签离屏层、湿侧 4px 折射条、虫点约 600–700、卵 ≤118、DPR 封顶 2、无全屏 blend 颗粒。
- 低端机建议：横向枝和顶部短芽会带来更多轮廓，可把短芽从 88 降到 ~50，卵从 88 降到 ~64。

### 9.5 lab harness 的说明（非 act）

- `labs/act03/index.html` 把 hint 从模板的“按住 = 热”改成“移光停两秒 = 开”，并给 `act.js` 加了 cache-busting 版本；仅 lab 用，不进 act。
- `_shot.html` 是临时 390/1440 截图壳，已删除；`shots/` 保留 9 张证据图。
- 未改 `labs/act-template/`、共享 `js/*`、`index.html`、`styles.css`、M0。

### 9.6 已知边界 / review 提示

- lab 的上半张纸没有章节文案（scene-only 约束）；请按 R1 shell 的 chapter copy 叠上去再看构图。
- 390 的珊瑚横向枝已缩短；如果 shell 在 390 右侧加潮位尺/章节导航，需要再让出 20–30px。
- 珊瑚仍是风格化“枝状图版”，不是分类学写实；横向枝让冠幅更宽，但离“珊瑚丛”还有空间。
- 未接 3 号图版、未接声音、未接「卵」的 UI/潮汐笺；这些由 shell / R2 处理。
- 收集回调只调用一次；如果 shell 在回调里重排 DOM，注意不要在 act 的 render 中同步改 canvas 尺寸。

