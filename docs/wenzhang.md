# 采集文章

## 入口与数据

- 后台「文章管理」：采集文章列表、采集文章分类、文章采集源（管理员）。
- 前台关键词模式：`/WenZhang/list.html`，`/WenZhang/<MongoDB文章ID>.html`。
- 前台目录词模式：`/WenZhangMuLu/list.html`，`/WenZhangMuLu/<MongoDB文章ID>.html`。两组路由共用数据库、分目录 JSON 缓存和 `wenzhang.html` 模板；列表、分类、上一页、下一页和详情链接保持当前路由前缀。普通模式从 Article 的 `keyword` 词库按完整 URL 稳定选词，目录词模式使用 `strToNumber(domain.fullDomain + ctx.url)` 计算索引，再调用 `getMuluItemOne(muluIndex, domain.mcid)`，取目录记录的 `keywords` 作为标题和描述前缀。
- 集合：`wenzhang`（文章）、`wenzhangCate`（分类）、`wenzhangSource`（独立采集配置及执行结果）。不使用原 Article、articleCbd 或视频采集表。
- 详情缓存：`cache/wenzhang/<MD5前2位>/<MD5第3至4位>/<ID>.json`，与视频缓存相同，按文章 ID 的 MD5 分两层目录。旧根目录 JSON 在读取时自动迁移，不需要全量扫描；采集、编辑、隐藏、删除和远程同步均使用新路径并清除对应旧文件。两种路径都无缓存时才读取数据库。删除记录保留 tombstone，防止下一次采集重新发布。
- 分类被文章或采集源使用时不能删除；先重新分配分类。

## 模板

优先 `app/view/template/<domain.tname>/wenzhang.html`，不存在时使用 `app/view/template/components/wenzhang.html`。

可用变量：`domain`、`siteInfo`、`title`、`isList`、`detail`（同 `article`）、`articleList`、`categories`、`page`、`total`、`prevUrl`、`nextUrl`。

`detail` 有 `title`、`description`、`content`、`image`、`sourceName`、`sourceUrl`、`publishedAt`、`categoryId` 等字段。`content` 在采集和后台编辑时清理危险 HTML，模板可用 `{{detail.content | safe}}`；标题等仍自动转义。文章内容来自订阅正文或摘要，不额外抓取原文页面。

正文清理同时移除外部 CSS、内联样式、JS、iframe 等嵌入内容。正文超链接统一转换为当前站点根相对地址，保留路径、查询参数和锚点，不检测目标是否存在；例如 `https://other.example/posts/1.html` 转为 `/posts/1.html`。图片资源继续保留原地址。来源元数据及模板的「查看原文」链接不属于正文，仍保留；历史文章不批量重写，重新编辑保存或远程同步覆盖时应用新规则。验证命令：`node test/wenzhang-content.js`。

## 采集

1. 新建分类。
2. 采集源页点击预置源或新增 RSS/Atom 地址，选择分类、保存。
3. 点击采集，查看最近结果；失败详情会在弹框显示。
4. 按需开启自动采集，默认关闭。每天北京时间 04:20 调度，关闭或未启用的源不会采集；无可用数据库连接时跳过。修改 schedule 文件需重启。

默认提供 8 个中文源：IT之家、少数派、小众软件、爱范儿、超能网、机核、触乐、美团技术团队。预置配置统一维护在 `app/lib/wenzhangSources.js`。订阅源能提供全文还是摘要由发布者决定，文章保留原文链接。

手动和每日自动采集入库前，统一调用 `app/lib/wenzhangPolicy.js`：识别中文标题，并检查标题和正文中的政治、民生、社会新闻关键词；命中则跳过，最近采集结果显示「内容过滤」数量。关键词规则可能误判或漏判，可在该文件调整。已有数据库采集源和历史文章不自动删除；已保存的英文源请在后台停用或删除，其后续英文文章也会被过滤。远程同步及人工编辑不套用此采集规则。

每个源最多读取 50 条；源响应限制 5MB，请求总超时 30 秒，逐条入库，无全库内存列表。原文 URL 唯一索引防重复，同一源的原子执行租约避免重复运行。重复记录不会覆盖人工编辑。单轮入库处理限制两分钟；异常退出的源租约十分钟后释放。前台旧的域名屏蔽策略保持生效。

若后台报告文件写入失败，检查运行用户对 `cache/wenzhang` 的写入权限。文章锁使用本地共享文件，多 Egg worker 共用；进程在写入中被强制终止时，确认没有对应任务后清理 `cache/wenzhang/.locks/<ID>/.adv-update.lock`。

## 远程同步

采集文章列表点击「远程同步」，填写来源服务器地址、同步密码，选择数量或全部，使用与其他内容相同的后台分批推送流程。两端均需部署支持 `wenzhang` 的版本并配置相同的 `DOMAIN_SYNC_KEY`；来源服务器必须能访问接收后台所在域名的 `/api/tongbuContentReceive`。

同步文章及分类，按原文链接去重并覆盖已有文章，包含显示/隐藏/删除状态；同名分类合并。采集源设置和自动采集开关不随文章复制。同步后刷新本地 ID 对应的分目录 JSON 缓存，失败批次返回失败，详细结果见服务端 `[content-push]` 日志；界面提交成功仅代表后台任务已启动。

`node test/wenzhang-sync.js`：远程同步去重、分类映射、页面缓存及失败反馈验证。

## 验证与部署

`node test/wenzhang.js`：离线功能验证。

`node test/wenzhang-policy.js`：中文识别和排除主题验证。

`node test/wenzhang-feeds.js`：只读验证当前预置中文订阅源，不写数据库。

部署 new-seo 并重启；构建部署 new-admin。首次创建采集源与分类时 MongoDB 建立新集合，确保唯一索引创建成功。没有主动导入线上文章或自动开启采集。
