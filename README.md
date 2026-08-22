# apis-sendafun

面向程序员的**公开 API 检索工具**。基于 [public-apis](https://github.com/public-apis/public-apis) 公开数据集（MIT License），提供搜索、多条件组合筛选、一键复制链接 / cURL 片段等能力。纯前端 SPA，无需注册登录。

- 在线地址：<https://apis.sendafun.com>
- 数据源：<https://github.com/public-apis/public-apis>（MIT License）

## 功能特性

- **实时全文搜索**：API 名称、描述、分类即时过滤
- **多条件组合筛选**：分类 / Auth / HTTPS / CORS 同时生效（竞品大多只支持单项）
- **卡片网格**：桌面 3 列 / 平板 2 列 / 移动端 1 列，点击卡片展开完整描述
- **复制按钮组**：一键复制 API 链接、一键复制 cURL 请求片段，Toast 反馈
- **分页**：避免大量数据一次性渲染造成的页面卡顿
- **主题切换**：浅色 / 深色（GitHub 风格），本地存储记忆用户选择
- **每日自动同步**：GitHub Actions 每天北京时间 00:00 拉取上游数据集，仅在有变更时提交，自动触发 Cloudflare Workers 部署

## 数据源与许可

本项目数据集来源于 [public-apis/public-apis](https://github.com/public-apis/public-apis)，遵循其 **MIT License**。

- 同步脚本：[scripts/update-dataset.js](scripts/update-dataset.js)
- 生成数据：[public/data/apis.json](public/data/apis.json)
- 上游更新机制：GitHub Actions 定时工作流 [.github/workflows/update-dataset.yml](.github/workflows/update-dataset.yml)，`cron: 0 16 * * *`（UTC 16:00 = 北京时间 00:00）

### 手动更新数据

```bash
node scripts/update-dataset.js            # 从网络拉取上游 README 并生成
node scripts/update-dataset.js --local ./upstream-readme.md   # 从本地文件解析
```

同步失败或解析结果为空时脚本以非零码退出，**保留旧数据，不破坏线上站点**。

## 本地开发

项目为纯静态 SPA，无构建步骤、无依赖安装。直接以根目录服务 `public/` 即可：

```bash
# 任选其一
npx serve public
python -m http.server 8080 -d public
```

打开 <http://localhost:8080> 预览。

## 部署（Cloudflare Workers）

1. 将仓库 `main` 分支连接到 Cloudflare Workers（Dashboard → Workers → 你的 Worker → Settings → Builds & deployments → Connect to GitHub）。
2. 构建配置使用根目录 [wrangler.toml](wrangler.toml)，静态目录为 `public/`，已启用 SPA 回退。
3. 如需自定义域名，在 Dashboard 添加 `apis.sendafun.com` 路由，或在 `wrangler.toml` 中配置 `routes`。

```bash
# 本地预览验证
npx wrangler dev
```

## 配置说明

- **GA4 埋点**：编辑 [public/assets/app.js](public/assets/app.js) 顶部 `GA4_ID`，填入你的 `G-XXXXXXXXXX`。留空则完全禁用 GA4。
- **亚马逊联盟文本链接**：编辑 `public/assets/app.js` 顶部 `AMAZON_TAG`，填入你的联盟 tag（如 `yourtag-20`）。仅文本链接，无图片卡片。
- 埋点事件：`page_view`、`search`、`copy_link`、`copy_curl`、`theme_toggle`、`pagination`。

## 相关链接

- <https://sendafun.com>
- <https://smartimgkit.com/>

## License

本项目代码 MIT License。API 数据集来源于 [public-apis](https://github.com/public-apis/public-apis)，MIT License。
