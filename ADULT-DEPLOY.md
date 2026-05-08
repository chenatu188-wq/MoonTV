# 阿公專區（adult-edition 分支）

這個 branch 專為長輩私人觀看部署，**設密碼保護**避免外人誤入。

## Zeabur 部署步驟（5 分鐘）

### 1. 開新服務

在 [Zeabur Project](https://zeabur.com/projects/69e570fba87a596829fdd678) 點 **Create Service** → **Git** → 選 `chenatu188-wq/MoonTV` repo。

### 2. 選分支

部署設定 → **Branch** 改成 `adult-edition`（不是 main 也不是 claude/improve-video-player-nTe5B）。

### 3. 設環境變數

| Key | Value | 說明 |
|---|---|---|
| `PASSWORD` | `123`（阿公易輸入；安全靠 URL 不外流而非密碼長度）| 進站要密碼 |
| `SITE_NAME` | `阿公專區` | 顯示在站頭 |
| `ANNOUNCEMENT` | `本站僅供長輩私人觀看，未滿 18 歲禁止使用。` | 首頁公告 |

### 4. 等 build 完成

Zeabur 會自動 `pnpm install` + `next build`，約 2-3 分鐘。完成後拿到 URL（例如 `moon-grandpa-xxx.zeabur.app`）。

### 5. 給阿公的「**1 張卡片**」

```
網址：https://moon-grandpa-xxx.zeabur.app
密碼：<你設的那組>
```

---

## 加 18+ 片源（兩種辦法）

### 辦法 A：你找到 URL 給 Claude 加

把找到的苹果 CMS V10 API URL（格式 `https://xxx.com/api.php/provide/vod`）丟給 Claude，會：
1. 測 API 活著沒
2. 加進這個 branch 的 `config.json`
3. git push 觸發 Zeabur 自動 redeploy

### 辦法 B：你自己加

編輯 [config.json](config.json) 的 `api_site` section，照同格式加：

```json
"yourkey": {
  "api": "https://xxx.com/api.php/provide/vod",
  "name": "你的站名",
  "detail": "https://xxx.com"
}
```

git commit + push 即生效。

---

## 找 18+ 片源的方向

這類站壽命短（半年就換域名），**不要照網路上 1 年前的列表**，要找最新的：

| 來源 | 怎麼找 |
|---|---|
| **Telegram 頻道** | 搜「TVBox 配置」「影視倉接口」這類頻道，有人每月更新名單 |
| **GitHub** | search `tvbox 18+`、`苹果cms 成人 接口` |
| **PT 站論壇 / 老司機論壇** | sehuatang、芒果 TV 這類論壇分享區 |
| **奇珀網 / 木風軟件站** | 中文 IPTV 圈 TVBox 配置定期整理 |

注意：很多站會把片源寫在 PDF / 加密配置裡，要解。直接的 `api.php/provide/vod` 連結最容易塞 MoonTV。

---

## 安全提醒

- **不要把 URL 給孫子之外的人** — 站本身雖加密，URL 一旦傳出去就有人試破密碼
- **密碼至少 10 字元 + 數字 + 大小寫**
- **每 3 個月換一次密碼**（看的人少就懶得換沒關係）
- 影片本身是境外網站串流，看的事**他們的 IP 會被記錄**（一般使用者沒事，但敏感人物別碰）
