# 《潮汐书 · 海南》5 幕计划（R0 锁定）

> 海南是一本被海反复擦掉的书。你滚动的不是页面，是退潮。

## 0. 已定的决策

- **5 幕**：`00 满潮`（M0，已锁）+ `01 玄武` / `02 潮间带` / `03 珊瑚` / `04 航线` / `05 归潮`。
- **折叠**：原 02 雨林、03 盐不做独立幕。黎锦线、盐晶、落叶、远山猿啼作为 `02 潮间带` 的「证物 / 边注」出现，声音里保留一层远山。
- **潮汐笺**：全做。**大潮之门**：轻版——朔/望前后才打开的隐藏页或隐藏卡 + 「下次大潮」倒计时，不新增一整幕。
- **AI 图版**：只做 3 张（01 玄武 / 03 珊瑚 / 04 航线），作为重调色的图鉴插页；其余全部程序化。
- 手机 + 桌面同权；最终单文件交付。

## 1. 幕表

| # | 幕 | 证物 / 材料 | 交互 | 强调色 | 声音 |
|---|---|---|---|---|---|
| 00 | 满潮 | 水线、字、岛、椰树 | 拉海 / 回潮 | 珊瑚朱 | 水下低通 → 空气 |
| 01 | 玄武 | 火山石、黑沙、珊瑚石灰墙 | 按住石头升温，松手变凉 | 锈红 + 热珊瑚 | 石头、风、极低的共鸣 |
| 02 | 潮间带 | 湿沙、贝壳、字；黎锦线、盐晶、落叶 | 拖水线、赶海捡词 | 盐白 + 黎锦靛（一线） | 浪、沙、远处猿啼 |
| 03 | 珊瑚 | 珊瑚、夜里的产卵 | 用光唤醒 | 珊瑚红 + 荧光青 | 水下、细碎的产卵声 |
| 04 | 航线 | 更路簿、旧岛名、星图 | 沿航线划一笔 | 星金 | 纸、铅笔、低频星图 |
| 05 | 归潮 | 月、潮汐笺 | 收下 / 保存 | 月银 | 潮水回来、纸、收束 |

## 2. 结构

一条连续的 **tide journey**（0..1），不是 6 个独立页面：

- `00` 是开场：满潮 → 拉海 → 水线切字 → 岛与椰树露出来。
- `01–05` 是退潮到归潮之间的五个「证物层」；每一幕有局部 `p`，但共享同一个全局 `lineY`、同一个 `tide`、同一套字体和 palette。
- **水线是唯一转场**。幕与幕之间不允许淡入淡出；上一幕被水擦掉，下一幕被水露出来。
- 右侧潮位尺、底部 readout、右上声音 / 章节索引贯穿全篇；索引从 `00 / 05` 开始。
- 章节导航：右侧细刻度 + 章节名，可点击跳转；`?act=03&p=0.4` 深链。

## 3. 系统

| 系统 | 说明 | 归属 |
|---|---|---|
| 多幕 journey | `00–05` 的进度、局部 `p`、转场、导航、深链、reduced motion | Lead（R1） |
| 收集 / 记忆层 | 每幕一个词；`localStorage`；决定潮汐笺内容 | Lead（R1） |
| 大潮之门（轻版） | 真实月相（已有 `moonInfo`）；朔望 ±1 天解锁隐藏页/卡；下次大潮倒计时 | Lead（R2） |
| 潮汐笺 | canvas 生成；日期 / 月相 / 潮时 / 捡到的词；PNG 保存；本机记忆 | Lead（R2） |
| 声音全篇 | 5 层 + 交叉淡化；移动端解锁；静音记忆 | word-sound（R1/R2） |
| 单文件构建 | 内联 JS/CSS；字体子集；体积控制 | Lead（R3） |
| QA | 390 / 1280 / 1440；干湿 × 3 潮位；无 WebGL / reduced motion；真机 | Lead + QA（R3） |

## 4. 轮次与队伍

| 轮 | 周期 | 内容 | 人 |
|---|---|---|---|
| R0 | 1–2 天 | 地基：`docs/ART-DIRECTION.md`、`docs/ACT-INTERFACE.md`、`labs/act-template/`、5 幕映射；文案/声音、3 张 AI 图版、01/03 材质研究并行 | Lead + word-sound + plate-maker + basalt + coral |
| R1 | 3–4 天 | 多幕 shell；`01`（basalt）、`03`（coral）、`04`（route）三个 act 并行；Lead 做 `02 潮间带` | Lead + 3 场景 agent |
| R2 | 3–4 天 | `05 归潮` + 潮汐笺；大潮之门轻版；声音接入；第一次总装 | Lead + route/finale + word-sound |
| R3 | 2–3 天 | QA、移动端性能、降级、单文件、最终评审 | Lead + QA |

## 5. R0 交付

- `docs/ART-DIRECTION.md`：tokens、线宽/填充、字体、动效、每幕材质、AI 图版规范、性能预算。
- `docs/ACT-INTERFACE.md`：act 注册、`state`/`ctx`、lab 规范、R1 集成、review checklist。
- `labs/act-template/`：可跑的水线 lab（mock act + 滑杆 + 390/1280）。
- `docs/copy-deck.md` + `docs/sound-map.md`（word-sound）。
- `assets/plates/` + `docs/plate-log.md`（plate-maker）。
- `docs/act01-study.md` + `labs/act01-study/`（basalt）。
- `docs/act03-study.md` + `labs/act03-study/`（coral）。

## 6. R1 入口

每个场景 agent：

1. 读 `docs/ACT-INTERFACE.md` 与 `docs/ART-DIRECTION.md`；
2. `cp -r labs/act-template labs/actNN`；
3. 只改 `labs/actNN/act.js`（场景、交互、类型）；
4. 交 390 / 1280 / 1440 截图 + 3 个潮位；
5. Lead review 后，把 `act.js` 原样移到 `js/acts/actNN.js`，由 shell 载入。

共享文件（`index.html`、`styles.css`、`js/app.js`、`js/core/*`、`js/typewater.js`、`js/sea.js`）只有 Lead 能改。
