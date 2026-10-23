# 安全暂停 / PAUSE STATE

**暂停时间** 2026-10-23 12:03 +08:00  
**触发** 用户指令：安全暂停，等待「继续」后再开发。  
**执行** Lead 已停下开发；3 个运行中的 agent 已 interrupt → inactive；word-sound / plate-maker 已完成并 inactive。  
**Goal** 处于 `paused`，不会自动继续。  
**M0** 锁定未动；暂停时已复核：JS 语法 OK、页面在 `00 / 05` 正常加载。

---

## 1. 锁定 / 不可动

- **M0（已验收）**：`index.html`、`styles.css`、`js/app.js`、`js/sea.js`、`js/typewater.js`、`js/audio.js`、`js/coast.js`、`docs/m0-*.png`。
- **5 幕范围**：`00 满潮` + `01 玄武 / 02 潮间带 / 03 珊瑚 / 04 航线 / 05 归潮`。
- **决策**：雨林/盐折叠进 02 当证物；潮汐笺全做；大潮之门轻版（月亮门，不接潮汐 API）；3 张 AI 图版，其余程序化。
- **03 顺序**：停光 2 秒 → 开/产卵；移光 → 合上，卵留在水里。
- **04**：做满 **12 段**，第 12 段拾「更」。
- **图版**：`assets/plates/raw/`（9 张 1536×1024）+ `treated/`（3 张 1200×800，849KB）+ `contact-sheet.png` + `docs/plate-log.md`。**不要重生成**。

---

## 2. 已完成

| 块 | 文件 |
|---|---|
| R0 地基 | `docs/PLAN-5ACTS.md`、`docs/ART-DIRECTION.md`、`docs/ACT-INTERFACE.md`、`labs/act-template/`、`labs/preview.html` |
| 文案 / 声音 | `docs/copy-deck.md`、`docs/sound-map.md`、`labs/sound/`（可点原型） |
| 图版 | `assets/plates/treated/01-xuanwu.webp`、`03-coral.webp`、`04-route.webp`；`contact-sheet.png`；`docs/plate-log.md` |
| R1 任务 | task-6（01）、task-7（02 Lead）、task-8（03）、task-9（04）、task-10（05，blocked by 02）、task-11（shell Lead） |

---

## 3. 进行中 / partial（恢复后用）

| 任务 | owner | 状态 | 路径 | 注意 |
|---|---|---|---|---|
| task-4 · 01 材质研究 | basalt | interrupted mid-build | `labs/act01-study/` | 11:57 的 1280 截图是黑屏；12:01 仍有新编辑。恢复先跑 lab 验场景；索引改 `01 / 05`；`docs/act01-study.md` 未写 |
| task-5 · 03 材质研究 | coral | interrupted mid-write | `labs/act03-study/` | `act03-coral.js` 有 **20 个 U+FFFD**（PowerShell 写 UTF-8 损坏）；HTML/CSS 可复用，JS 必须重写；`docs/act03-study.md` 未写 |
| task-9 · 04 航线 | route | interrupted before work | `labs/act04/` 不存在 | task-9 仍 pending；12 段 brief 在 spawn prompt 里 |
| R1 shell / 02 | Lead | 未开始 | — | task-11 / task-7 ready |

> 这三个 partial lab 都是**隔离的探索**，不是最终交付；M0 / copy / plates 不受影响。恢复时不要直接搬 partial 进 R1，先跑、修、review。

---

## 4. 任务板状态

- **completed**：task-1（Lead R0）、task-2（word-sound）、task-3（plate-maker）。
- **in_progress**：task-4（basalt）、task-5（coral）。
- **pending / ready**：task-6（01）、task-7（02）、task-8（03）、task-9（04）、task-11（shell）。
- **pending / blocked**：task-10（05，blocked by task-7）。

任务板是恢复的第一入口：`team_task_list`。

---

## 5. 团队

| target | 状态 | 恢复方式 |
|---|---|---|
| word-sound | inactive（done） | 不需要；docs 已交 |
| plate-maker | inactive（done） | 不需要；plates/log 已交 |
| basalt | inactive（interrupted） | `send_message` → 继续 task-4；修场景；索引 01/05 |
| coral | inactive（interrupted） | `send_message` → 继续 task-5；**重写** `act03-coral.js`，用 edit/write/Node UTF-8，不要 PowerShell 写中文 |
| route | inactive（interrupted） | `send_message` → 开始 task-9；12 段；只写 `labs/act04/` |

agent 是 durable 的；inactive 不等于失败，pending inbox 保留。`send_message` 会重新启动它。

---

## 6. 文件清单 / 校验

- `docs/PAUSE-MANIFEST.txt`：**62 files**（精确 count/size 见 manifest 头部），sha256(16) + size + path。
- 含 9 张 raw 图版（大头）；treated 三张 849KB；M0 / docs / labs 全文。
- manifest 不含它自己（生成时尚未写入）。
- 恢复前可抽查：M0 的 `js/*.js`、`index.html`、`docs/copy-deck.md`、`assets/plates/treated/*` 的 hash 是否与 manifest 一致。

---

## 7. 预览

- **当前服务**：已停止 —— 用户在 2026-10-23 12:11 kill 了 `pwsh-fdb87bc0cc0c4f66`。暂停期间不重启；文件完好，需要看时用下面命令。
- M0：<http://127.0.0.1:4174/>（`00 / 05`）；`?p=0.55` 半潮，`?p=0.10` 树刚出水。
- lab 模板：<http://127.0.0.1:4174/labs/act-template/>
- 声音原型：<http://127.0.0.1:4174/labs/sound/>
- 双端：`/dual.html`、`/mobile.html`（M0 dev）。
- 若服务停了：
  ```bash
  cd hainan
  python -m http.server 4174 --bind 127.0.0.1
  ```

---

## 8. 已知风险 / 质量边界

- **act03-coral.js 损坏**：20 个 U+FFFD；不要使用；恢复时重写。根因是 PowerShell 写 UTF-8 中文；以后中文文本一律用 edit / write / Node `fs.writeFileSync(..., 'utf8')`。
- **basalt lab 黑屏**：11:57 截图；12:01 仍有编辑。恢复先跑，确认 canvas/scene init，再谈视觉。
- **route 未开始**：task-9 pending；不要假设有 lab。
- **图版 1200px**：1440 宽 + DPR2 + 50% 会放大 1.2×；用 **40–44% 宽** 或 DPR≤1.5。
- **声音**：结构/参数已写，未最终混音；恢复后要你戴耳机过一遍。
- **真机**：只做了视口/桌面验证；iPhone / Android 需补测，R3 做。
- **文案事实**：copy-deck §6 有来源与边界；大潮门不是潮汐预报。

---

## 9. 恢复协议（收到「继续」后）

1. 读本文件 + `docs/PAUSE-MANIFEST.txt`。
2. `list_agents` / `team_task_list`；确认 5 个 teammate 的 inactive / task 状态。
3. 恢复三个 partial：
   - `send_message basalt`：继续 task-4；修黑屏；索引 01/05；交 lab + 截图 + doc。
   - `send_message coral`：继续 task-5；**重写** `act03-coral.js`；03 顺序按本文件；交 lab + 截图 + doc。
   - `send_message route`：开始 task-9；12 段；只写 `labs/act04/`；交 lab + 截图 + doc。
4. Lead 领 task-11（多幕 shell）与 task-7（02 潮间带），先把 shell 跑起来，再收 01/03/04/05。
5. review 后：`act.js` 原样 → `js/acts/actNN.js`；02 的收集层 → `js/core/collection.js`；05 的卡 → `js/core/tidecard.js`；大潮门 → `js/core/gate.js`。
6. R2：潮汐笺 / 大潮门轻版 / 声音接入；R3：QA、性能、单文件、真机。
7. 不改 5 幕、不重生成 plates、不轻易动 M0；每次交付更新本文件与任务板。

---

## 10. Do not

- 不要改共享文件（`index.html` / `styles.css` / `js/app.js` / `js/core/*` / `js/typewater.js` / `js/sea.js` / `js/coast.js`）——只有 Lead 改。
- 不要用 PowerShell 写中文文本（mojibake 风险）；用 edit / write / Node UTF-8。
- 不要删除 `assets/plates/raw/`（9 张原图）。
- 不要把 partial lab 当最终交付。
- 不要改 5 幕范围 / 03 顺序 / 04 十二段 / 大潮门轻版这些已定决策。
- 不要重新生成图版。

---

*Pause 由 Lead 执行 · 2026-10-23 12:03 +08:00*
