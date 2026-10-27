# 安装到手机（iOS / Android）与使用说明

> 线上地址：<https://ahian-lee.github.io/agent-flashcards/>  
> 这是 PWA（渐进式 Web 应用），不需要应用商店、不需要签名安装包，用手机浏览器打开后「添加到主屏幕」即可。

---

## 0. 先决条件

- 手机能访问 GitHub Pages（国内网络若打不开，见 §4 的替代方案）。
- 建议用 **Safari（iOS）** 或 **Chrome（Android）**；微信内置浏览器不支持安装，需先「在浏览器打开」。

---

## 1. iPhone / iPad（Safari）

1. 打开 **Safari**，访问 <https://ahian-lee.github.io/agent-flashcards/>。
2. 点底部工具栏的 **分享** 按钮（方框向上箭头）。
3. 下滑选择 **「添加到主屏幕」**。
4. 名称默认「Agent闪卡」，点右上角 **「添加」**。
5. 回到主屏幕，会出现一个紫色 A 图标；点开即为独立全屏应用（无浏览器地址栏）。

> 注意：iOS 必须用 Safari 添加，Chrome for iOS 添加的主屏幕图标会跳回浏览器。
> 首次打开后建议进入「设置 → 导出」做一次备份，iOS 长期不打开可能回收本地数据。

---

## 2. Android（Chrome / Edge）

1. 打开 **Chrome**，访问 <https://ahian-lee.github.io/agent-flashcards/>。
2. 右上角 **⋮** 菜单 → 选择 **「安装应用」**（部分版本显示「添加到主屏幕」）。
3. 确认安装，桌面会生成「Agent闪卡」图标。
4. 从桌面图标启动，即 standalone 模式，可离线使用。

> 若菜单里没有「安装应用」，先正常浏览 10–20 秒等 Service Worker 注册完成，再刷新页面重试。

---

## 3. 安装后怎么用

- **首页**：今日进度、8 个 deck（Agent 3 卷 + 大模型面试 5 卷）、开始学习。
- **学习**：点卡片或按「空格」翻面；四档评分「忘了 / 困难 / 记得 / 太简单」，对应 FSRS 的 1/6/10 分钟/8 天。
- **选择题**：点选项后立即判对错并显示解析；**填空题**：点挖空处逐个揭晓。
- **离线**：首次打开后资源已缓存，断网仍可学；进度只存本机 IndexedDB。
- **换设备**：设置 → 导出 JSON → 在新设备设置 → 导入。
- **数据安全**：无账号、无上传；清除浏览器数据会丢进度，建议定期导出。

---

## 4. 网络打不开 GitHub Pages 时

GitHub Pages 在部分国内网络下不稳定。三种替代：

1. **本地/局域网自托管**（推荐给团队内用）：
   ```powershell
   cd app
   npm ci
   npm run build
   npm run preview -- --host 0.0.0.0
   ```
   手机与电脑连同一 Wi-Fi，手机访问 `http://<电脑局域网IP>:4173/`。
   注意：PWA 的 Service Worker 要求 `https` 或 `localhost`，用局域网 http 时能正常学，但**不能安装/离线**。
2. **换静态托管**：把 `app/dist/` 上传到 Vercel / Netlify / Cloudflare Pages（都支持 https，可安装）。
3. **国内对象存储 + CDN**：OSS/COS 静态网站 + 自有域名 https。

---

## 5. 自己重新部署（维护者）

- 仓库：<https://github.com/ahian-lee/agent-flashcards>
- 已配置 GitHub Actions：推 `main` 自动构建并部署到 Pages（`.github/workflows/deploy-pages.yml`）。
- 构建使用 `BASE_PATH=/agent-flashcards/`，与仓库名一致；若改仓库名，需同步改这个环境变量。
- 本地验证：
  ```powershell
  cd app
  npm ci
  npm test          # 83 tests
  npm run build
  npm run preview   # http://127.0.0.1:4173
  npm run smoke     # 51 项浏览器冒烟
  ```
- 内容更新：改 `content/decks/*.json` → `npm run build`（会自动 sync 到 app）→ 提交推送。

---

## 6. 常见问题

| 现象 | 原因/处理 |
| --- | --- |
| 没有「添加到主屏幕」 | 微信/QQ 内置浏览器不支持，改用 Safari/Chrome |
| 打开是空白/旧版本 | 强制刷新（下拉刷新或清站点数据）；SW 为 autoUpdate，下次加载会接管 |
| 进度突然没了 | 清过浏览器数据 / 无痕模式 / iOS 回收存储；用导出备份恢复 |
| 想换手机 | 旧机导出 JSON → 新机导入（设置页） |
| 图标不是紫色 A | 图标来自 `app/public/icons/`，若改图标需重新构建部署 |
