# 开发进度记录

> 最后更新：2026-04-20
> 分支：`claude/improve-video-player-nTe5B`
> 仓库：`chenatu188-wq/MoonTV`

---

## 一、已完成工作

### ✅ PWA 完善（commit `8067e28`）

让站点可以直接「加入主畫面」，手机无需下载 App。

**改动文件：**

- `scripts/generate-manifest.js` — 补全 `theme_color`、`id`、`orientation`、`maskable` 图标、`categories`，移除误放的 iOS 字段
- `src/app/layout.tsx` — 新增 `appleWebApp` metadata、`apple-touch-icon`、`viewport-fit: cover`
- `src/components/InstallPWA.tsx` — **新建**。一键安装按钮组件：
  - Android / 桌面 Chrome → 调 `beforeinstallprompt` 原生提示
  - iOS Safari → 弹窗教用户手动添加
  - 已安装 / 不支持环境 → 自动隐藏
- `src/components/MobileHeader.tsx` — 移动端 header 右侧接入
- `src/components/PageLayout.tsx` — 桌面端右上角工具栏接入

---

### ✅ 播放器首批优化（commit `cbf47f9`）

所有改动集中在 `src/app/play/page.tsx`，+203 / −14 行。

**4 项增强：**

1. **截图功能** — `screenshot: false` → `true`

   - Artplayer 设置面板出现「截图」按钮，点击下载当前帧

2. **画质切换** — HLS manifest 解析后动态注入菜单

   - 默认「自动」（HLS.js 自适应 ABR）
   - 列出所有 level（1080p / 720p / 480p…）
   - 单 level 源不显示，避免冗余

3. **致命错误重试浮层**

   - NETWORK_ERROR：自动恢复 3 次上限
   - MEDIA_ERROR：自动恢复 2 次上限
   - 超出后销毁 HLS、展示浮层：「⚠️ 网络异常 / 解码失败」
   - 「🔄 重试播放」按钮 → 通过 `retryNonce` state 触发播放器重建

4. **跳过片头 / 片尾**
   - 设置面板 3 个新条目：标记片头、标记片尾、清除跳过
   - localStorage key：`moontv_skip_{source}_{id}`，每部剧按源+ID 独立记忆
   - `timeupdate`：进度 < intro 自动跳；到达 outro 自动切下一集
   - `skippedIntroRef` 防止重复跳转

---

## 二、待办清单

### 🚧 部署到自有服务器（**用户已确认有服务器，但未提供信息**）

需要用户提供才能继续：

- [ ] 操作系统（Ubuntu / Debian / CentOS）
- [ ] 是否已装 Docker（`docker -v`）
- [ ] 是否已装 Nginx / Caddy 反代
- [ ] 域名（有没有？要不要 HTTPS？PWA 必须 HTTPS）
- [ ] 存储方式选型：
  - `localstorage` — 最简单，零依赖，单机用
  - `redis` — 多端同步收藏/播放记录（要多跑一个 Redis 容器）
  - `d1` — Cloudflare D1（仅 Cloudflare Pages 部署时）

拿到信息后将产出：

- `docker-compose.yml`（MoonTV + 可选 Redis）
- Caddyfile 或 Nginx 反代配置（自动 HTTPS）
- 一行行可以直接复制执行的部署命令

---

### 🚧 播放器第二批优化（未开工）

根据之前的调研，按性价比排序：

| 项目          | 工作量 | 说明                                                        |
| ------------- | ------ | ----------------------------------------------------------- |
| **字幕支持**  | 中     | 多数 HLS 源本身不带字幕轨。**先确认源有字幕再做**，否则空做 |
| **弹幕**      | 大     | 需要后端 WebSocket 服务，工程量大                           |
| **DASH 格式** | 中     | 目前 HLS 源覆盖足够，除非新增的源需要                       |

**建议：先部署看实际使用情况，再决定是否做第二批。**

---

## 三、项目「目录 / 分类」现状（用户上次问过）

桌面端的目录结构：

- **左侧 Sidebar**（`src/components/Sidebar.tsx`）：首页 / 搜索 / 电影 / 剧集 / 综艺
- **首页**（`/`）：继续观看 / 热门电影 / 热门剧集（豆瓣榜单）
- **豆瓣分类页**（`/douban?type=xxx`）：按类型筛选
- **搜索页**（`/search`）：多源聚合搜索

> ⚠️ 项目是**聚合搜索型站点**，不存储影片，所以没有「全站影片目录」一说。

可扩展方向（用户未决定要不要做）：

1. 更精细的分类树（年代/地区/类型）
2. 独立的收藏夹 / 观看历史管理页
3. 后台 `/admin` 功能增强

---

## 四、下次回来怎么接续

```bash
# 1. 切到工作分支
git checkout claude/improve-video-player-nTe5B
git pull origin claude/improve-video-player-nTe5B

# 2. 装依赖（如果换机器）
pnpm install

# 3. 生成运行时配置
node scripts/convert-config.js
node scripts/generate-manifest.js

# 4. 本地跑起来
pnpm dev
# 访问 http://localhost:3000

# 5. 验证
pnpm typecheck   # 应通过
pnpm lint        # 应无警告
```

---

## 五、分支提交历史

```
cbf47f9 feat(player): 首批优化 — 截图/画质切换/错误重试/跳过片头片尾
8067e28 feat: 完善 PWA 配置并新增安装按钮
e87544a feat: add two api sites     ← 分支起点（main 上游）
```

---

## 六、下次对话开场可以直接说

- **「继续做部署」** → 我会问你服务器信息，产出 docker-compose + Caddy 配置
- **「继续做播放器第二批优化」** → 我会先确认哪些源有字幕，再决定做字幕 / 弹幕 / DASH
- **「加某某功能」** → 直接说需求即可
