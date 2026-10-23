# 图版记录 / PLATE LOG —— 01 玄武 · 03 珊瑚 · 04 航线

> 3 张 AI 图鉴插页，不是背景。按 `ART-DIRECTION.md` §6：30–50% 宽、带编号 / 标签 / 1px 线框，**图里不带任何字**，真实文字由页面叠加。

## 0. 交付一览

| 幕 | 成品 | 尺寸 | 体积 | 源候选 | 本幕配色 |
|---|---|---|---|---|---|
| 01 玄武 | `assets/plates/treated/01-xuanwu.webp` | 1200×800 | 286,168 B（279 KB） | `raw/01-b.png` | 墨 #111310 / 骨 #E8E2D4 / 锈红 #8C4A38 |
| 03 珊瑚 | `assets/plates/treated/03-coral.webp` | 1200×800 | 296,932 B（290 KB） | `raw/03-a.png` | 深青 #04110F–#16332F / 活珊瑚 #E2452F / 荧光青 #7FE3D4 |
| 04 航线 | `assets/plates/treated/04-route.webp` | 1200×800 | 286,778 B（280 KB） | `raw/04-a.png`（裁切） | 纸 #E9DFC9 / 墨 #111310 / 星金 #C9A96A |

- 合计 **869,878 B（849 KB）< 1 MB**；单张均 < 300 KB。WebP q80，`method=6`。
- `raw/` 原图保留：9 张，1536×1024 PNG，未处理。
- Contact sheet：`assets/plates/contact-sheet.png`（2400×1280，PNG，2.8 MB，**只作评审 / 归档，不上页面**）。上排 3 张成品；下排 9 张 raw 候选，● = 选用。
- 图内无文字、无人脸、无 logo；04 也确认没有 AI 乱码字。

## 1. 生成记录

- 模型：`gpt-image-2`（`gpt-image` skill → 词元无忧 relay），`size=1536x1024`、`quality=high`、`format=png`、`n=1`。
- 每幕 3 个不同 prompt 变体 = 3 次调用，共 **9 次调用 / 9 张图**；没有重试失败的调用。
- 生成脚本：`assets/plates/_work/gen.ps1`（prompt 全表在脚本里）；选择记录：`_work/picks.json`。

### 选用的 3 条 prompt（逐字）

**01 玄武 — `01-b`**

```
Macro photograph of volcanic basalt and pale coral limestone in direct contact, seen flat on like a geological specimen plate. Pitted black-grey basalt full of gas vesicles, ash-grey dust packed into the crevices, a chalky dead-coral crust growing across one corner, rust-red mineral stain along the seam. Harsh tropical midday sun from above, one hard shadow edge, almost monochrome with rust accents only. Extremely shallow focus, edges dissolving into soft grey. Analogue, matte, slightly underexposed, fine film grain, no gloss, no glare, no lens flare. No text, no letters, no numbers, no watermark, no people, no hands.
```

**03 珊瑚 — `03-a`**

```
Extreme macro photograph of a living stony coral colony spawning, seen in a dark field. A dense field of small translucent polyps with fine extended tentacles, polyp mouths rimmed coral red, a few pale egg bundles like tiny pearls drifting in the water. Deep teal and near-black background, one soft top light, thin water haze. Only a few polyps tack sharp, everything else dissolving into dark teal. Scientific specimen plate, matte, low-key, fine grain, no turquoise tourist reef color, no HDR glow, no bloom, no fish, no diver, no hands. No text, no letters, no numbers, no watermark.
```

**04 航线 — `04-a`**

```
Flat overhead scan of an aged hand-drawn sea route chart on old Chinese handmade paper, in the manner of a 19th century route book. Warm tea-stained fibre paper with foxing, fold creases and faint water rings. Thin hand-inked coastline and reef outlines, small open circles marking shoals, dotted and dashed sailing routes crossing the sheet, a small compass rosette, scattered cinnabar red waypoint dots and pale gold star flecks. Fine brush-pen linework with slightly uneven pressure. There is no writing of any kind: no characters, no letters, no numerals, no labels, no title, no captions, no modern map interface, no fake glyphs. Flat even light, matte aged surface, subtle fibre grain. No people.
```

### 9 张候选一览

| 文件 | 幕 | 变体意图 | 结论 |
|---|---|---|---|
| `raw/01-a.png` | 01 | 海蚀墙斜射硬光，白珊瑚壳 + 锈缝 | 备选；高光太炸、满构图 |
| `raw/01-b.png` | 01 | 平铺标本，火山孔 + 珊瑚化石 + 锈线 | **选用**：调子更稳，化石细节可读 |
| `raw/01-c.png` | 01 | 退潮「干」线：湿石 / 干灰 / 石灰脊 | 备选；主体偏散 |
| `raw/03-a.png` | 03 | 珊瑚虫群 + 产卵颗粒，满场 | **选用**：暗场 + 触手 + 卵粒最齐 |
| `raw/03-b.png` | 03 | 鹿角珊瑚枝 + 荧光青 + 粒子雪 | 备选；枝条褐黄，转双色后偏平 |
| `raw/03-c.png` | 03 | 脑珊瑚回纹俯拍 | 备选；图像性强，但像图案 |
| `raw/04-a.png` | 04 | 整张海图（罗盘 / 岛 / 航线） | **选用（裁局部）**：罗盘段最安静 |
| `raw/04-b.png` | 04 | 航线向中心汇聚的放射构图 | 备选；中心太满 |
| `raw/04-c.png` | 04 | 摊开的更路簿对页，折痕 + 罗盘 | 备选；书页边/光影抢戏 |

## 2. 处理配方（三张同一条流水线）

脚本：`assets/plates/_work/make_plates.py`（可重跑）。原始 1536×1024 → 成品 1200×800。

1. **裁切**（仅 04）：`(60, 300, 880, 847)`，只留罗盘 + 一段航线 + 空纸。
2. **缩放**：长边 1200，Lanczos。
3. **去数码锐边**：亮度通道 Gaussian soften（01 1.7 / 03 0.8 / 04 0.6 px）。
4. **压成印刷调子**：局部对比（radius 56/44/44, amount 0.10/0.14/0.10）→ 黑白场 + gamma + 弱 S 曲线 → 抬黑场 `floor`（0.08 / 0.10 / 0.16），**不留纯黑纯白**。
5. **双色调 LUT**：6–7 个色标，逐幕锁到 palette（见 §0）。01 已从中性灰压掉橄榄绿，只留墨 / 骨 / 锈。
6. **网点**：`pitch=3.2px`、`angle=27°`，圆点面积律 `r² = 4c/π`（典型点径 1.3–2.4px，即 2–3px 网点）；阈值上叠低频噪声（±0.14）模拟油墨不匀，再用 0.45px 高斯 + 阈值做「油墨扩张」的点边。
7. **叠合**：网点版（墨/纸两色）与双色调按 `screen` 比例叠合 —— 01 0.18 / 03 0.24 / 04 0.22，大调子不变，只有小尺度变成印刷网点。
8. **专色版 + 套准偏移**：
   - 01 锈红 #8C4A38 × 1.00，+2/−1 px；石灰白高光版 −1/+2 px（0.12）；第二墨版 −1/+2 px（0.34）
   - 03 活珊瑚 #E2452F × 0.60（normal，面积 < 2%），+2/−1 px；荧光青 #7FE3D4 × 0.34（screen），−2/+1 px；第二墨版 −1/+2 px（0.42）
   - 04 星金 #C9A96A × 0.55（multiply，只落在星点），−2/+1 px；第二墨版 +1/+2 px（0.24）。**04 无红版**。
   - 专色自身也过网点（`0.35 + 0.65 × dot`），避免数码渐变。
9. **颗粒 / 纸气**：高斯颗粒 0.012×g（g=0.13/0.90/0.85）、低频斑驳 0.014×g、纸纤维 0.010×g；版边微压 0.955–1.0。
10. **输出**：WebP `quality=80`, `method=6`；成品分别为 279 / 290 / 280 KB。

> 为什么 01 的网点叠合只有 0.18：岩石细节本身高频，叠到 0.32 时 1200px WebP 会顶到 370 KB，且画面过噪。降到 0.18 + 软化 1.7px 后既保住墨/骨调子，又压进 300 KB。03 / 04 没有为体积让步。

### 页面侧可选 CSS（不改变成品，只是干/湿状态再压一层）

```css
/* 04 航线：纸上的墨 —— 页面用 multiply 更像印在骨白纸上 */
.plate--04{background:var(--bone)}
.plate--04 img{filter:grayscale(1) contrast(1.04);mix-blend-mode:multiply;opacity:.92}

/* 01 / 03：深色图版，湿侧不要提亮，只压一点饱和度 */
.plate--01 img,.plate--03 img{filter:saturate(.92) contrast(1.02)}

/* 图版线框 / 编号由页面画（图上不烧） */
.plate{border:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}
```

## 3. 文件清单

```
assets/plates/
├─ raw/                     9 × PNG 1536×1024（gpt-image-2 原图，保留）
│  ├─ 01-a.png 01-b.png 01-c.png
│  ├─ 03-a.png 03-b.png 03-c.png
│  └─ 04-a.png 04-b.png 04-c.png
├─ treated/
│  ├─ 01-xuanwu.webp        1200×800  286,168 B
│  ├─ 03-coral.webp         1200×800  296,932 B
│  └─ 04-route.webp         1200×800  286,778 B
├─ contact-sheet.png        2400×1280  2.85 MB（评审用，不上页面）
└─ _work/                  生成 / 处理 / 拼版脚本（非交付，可重跑）
   └─ gen.ps1  picks.json  make_plates.py  make_contact.py
```

## 4. 放哪儿、怎么放

| 幕 | 用途 | 宽度 | 位置 | 裁切 / 对位 | 叠字区 |
|---|---|---|---|---|---|
| 01 玄武 | 图鉴插页（干） | 38–44% | 右侧，水线上方，与「玄武」正文相对 | `object-position: 65% 62%`（保留右下珊瑚化石亮块）；4:5 手机裁右下 | 左下角留给编号 / 中文名；右上留空给 8px 边注 |
| 03 珊瑚 | 熔在暗场里的插页 | 40–50% | 暗场偏右 55–62% ×，垂直 30–40% | `object-position: 35% 55%`（保留左侧珊瑚虫群）；4:5 裁左中 | 右侧 1/3 是空暗场，可直接叠 4–6 个标签；左侧不要压字 |
| 04 航线 | 摊开的海图 | 44–50% | 右侧偏下，可 −0.6° 微转，压在纸面上 | `object-position: 42% 50%`（罗盘在左，岛在右，中间空纸） | 中间空纸 + 右下空纸叠中英标签；罗盘与岛不要盖字 |

- 三张都**不要全屏铺**：最宽 50%。图版本身已是深/浅两个极端，页面背景不要再叠满色调。
- 线框 / 编号 / 中文标签一律页面画（§6：「图版必须能被页面上的真实文字 / 线覆盖」）。
- 1200px 在 1440 宽 + DPR2 + 50% 宽时会被放大 1.2×（1px 网点会略软）。**建议 40–44% 宽**，或 DPR ≤ 1.5；移动端 390 宽 × 50% × DPR3 = 585 device px，1200 足够。

## 5. 已知 / 未做

- **04 第一版翻车**：红色专色 mask 抓到了暖纸（纸的 r−g ≈ 0.13），整张变赤陶。按 Lead 意见**删掉红版**，只留 纸 / 墨 / 星金，并裁成罗盘局部；现版无红、无字。
- **01 从 `01-a` 换到 `01-b`**：`01-a` 高光过曝、构图满；`01-b` 有死珊瑚化石 + 火山孔 + 锈缝，更像标本图版。
- **03 珊瑚红**从 screen 发光改为 normal 叠印（0.60），否则深底上几乎看不见；面积仍 < 2%，符合「极少」。
- 图版按「印刷品」做：抬黑场、压白场、网点、颗粒、走版。没有 AI 光泽 / 塑料高光；raw 的浅景深 bokeh 被网点与软化吃掉了大半。
- 未做：4:5 移动专用裁切（建议 CSS `object-position` 裁，见 §4）；未做第二套深色底；未做 AVIF（q80 WebP 已满足体积）。
- raw 是 1536×1024（gpt-image-2 该比例上限），不是 2000；成品按要求长边 1200。

---

生成 / 处理 / 拼版：plate-maker · 2026-10-23
