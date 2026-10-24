# 大型下载站模板

## 模板入口

- 泛目录详情：`app/common_data/Article/templates/download_portal.html`
- 配套首页：`app/common_data/Article/templates/home/home_download_portal.html`
- 默认站点模板：`app/view/template/fanmulu_article5`，根目录文件名称及数量与 `fanmulu_article2` 相同。
- 共用样式、交互、图片：`app/public/article_static/download_portal`。

## 启用

上传上述目录，以及 `app/utils/downloadPortal.js`、`app/common_data/Article/download_portal_media.json`、`app/common_data/Article/templates/download_portal_frame.html`、`download_portal_macros.html` 和修改后的 `app/service/fanmuluArticle.js`、`app/extend/helper.js`、两份模板列表 JSON，重启服务。

泛目录模板列表新增“大型应用下载站·绿色门户”（`download_portal`）。已有启用列表若未包含它，需要勾选后保存。全局泛目录模式下，仅启用此项即可使所有域名的 `/`、`/index.html` 和普通泛目录内容页使用该主题。多模板同时启用时，以域名哈希独立选出约四分之一的域名使用新主题，其余域名保留原有三套首页的选择结果。新主题的首页和内容页固定配套。

默认路由的站点模板列表（站点类型 4）新增 `fanmulu_article5`。其站内推荐链接采用 `/Article/download5/<哈希>-<序号>.html`，仍由原 `/Article/*` 路由匹配，无需新增 Nginx 规则。默认泛目录启用列表需包含 `fanmulu_article5`，这些链接才能固定使用同风格详情页。未开启相关模板时仍遵守已有启用列表，不强制绕过配置。

## 内容与资源

每个渲染入口有 1867 个基础链接，另加最多 10 条有效友情链接和 fan 词库生成的备用入口，以及 529 个图片位置（含顶部 Logo 和 12 张图集）。“更多应用与文章”的 771 条推荐链接全部保留并移入 `main-column`，位于更多应用下载后面；“友情链接”作为独立区块放在它的后面。锚点用于页内导航；安卓、iOS、电脑版三个下载按钮使用不同的 `/Article/download5/随机字符-序号.html` 链接，每次服务端渲染重新生成，不再使用 `detail.url` 或下载说明锚点。首页和内页共用这套逻辑。

顶部 Logo 图片为 `staticUrl + '/images/article/mn6/' + (urlNumber % 10063) + '.jpg'`。数字优先使用泛目录服务的 `urlNumber`，业务模板使用 `domain.urlNumber`；这两张主图优先使用独立的 `staticUrl` 参数，未提供时沿用 `domain.sfurl.staticUrl`，再回退 `app/confi/index.js` 配置。空静态前缀表示站内路径，不改变该配置文件或 Logo 的原点击地址。图片失败沿用现有本地占位图处理。

`site-header` 站点名称单独使用 `sitename` 内存词库，按 `urlNumber % 词条数量` 选择。下面的小字从 `mulu` 词库以相同索引起点连续取两条，用 ` · ` 分隔（不足两条时仅显示已有词条）。同一 URL 和相同词库下选择稳定；不改变网页 title、keywords、description、页脚或正文的站名取值。

友情链接使用 `Article/data/links/1.txt` 所属的 links 词库，与其他泛目录模板共用生成方法，支持站内、HTTP(S) 和协议相对地址，随机标签每次请求重新生成。链接文字为当前模板站名加序号。遵守现有 `friendLinksEnabled` 设置，关闭或没有有效链接时隐藏整个区块；预览服务开启此区块便于检查。数据仍从内存词库读取，不增加每次请求的文件读取。

“应用档案”上方的主图使用 `staticUrl + '/images/article/mn6/' + (urlNumber % 10063 - 1) + '.jpg'`，不再与应用图集共用中心图。严格按公式计算：余数为 0 时输出 `-1.jpg`。应用图集原有九张图片规则不变。

### 备用泛域名

`portal-layout` 后面的同级区块读取 `Article/data/fan` 词库，沿用多文件、去重和启动预加载机制。每条有效规则顺序展开 3 次，随机标签每次请求重新生成。当前三条前缀生成九个入口。

fan 文件只需填写前缀模板，不必填写主域名。例如当前主域名是 `a.com`，`h5-{随机数字5}`、`app{随机字符3}`、`av{随机数字5}` 分别生成类似 `h5-12345.a.com`、`appx7k.a.com`、`av67890.a.com` 的地址。每条前缀独立替换标签 3 次，链接文字仅显示生成的前缀，如 `h5-12345`，不附加域名、站名或序号。

链接继承访问协议和非默认端口并跳转首页。使用项目已有的 `psl` 识别主域名，支持 `.com.cn` 等公共后缀。仍兼容完整 HTTP(S)、协议相对地址及站内链接；危险协议、未解析标签和带登录信息的 URL 不输出。

IPv4 / localhost 预览同样直接输出前缀链接，不显示待绑定提示。例如 `http://127.0.0.1:17865/Article/xxx.html` 输出 `<a href="http://h5-12345.127.0.0.1:17865/">h5-12345</a>`。按用户要求保留这种字符串格式，不使用 URL() 重新解析它；数字结尾的混合主机名可能被浏览器 URL 解析器拒绝，不保证实际可访问。IPv6 地址不支持直接前置子域名前缀，此类前缀项跳过。真实域名需配置相应解析、站点接收规则及 HTTPS 证书。本区块独立于友情链接开关，词库为空时隐藏。

部署需包含新增 `app/utils/backupDomains.js`、`data/fan` 词库，以及修改后的 service、downloadPortal.js、frame 模板和 content.css；重启服务重新预加载词库。

参考图片共 452 个来源，下载成功 449 个，共约 8.6 MB；3 个无效或无法取得的来源使用本地占位图。正文讲解仍使用原有 3 张图片；教程优先使用 `zidingyi2` 词库的有效 HTTP(S) 或站内图片地址，无效内容回退本地图片。浏览器图片懒加载，服务器按需在内存中生成列表，不逐条访问词库文件、数据库或远程图片。标题、版本等为展示数据，以真实安装包信息为准。

“应用图集”使用 `domain.sfurl.staticUrl + '/images/article/' + domain.imgTypeName + '/' + (domain.imageNums + offset) + '.jpg'`，offset 按 -4 到 +4 排列，共 9 张，图集跳转链接不变。业务页沿用现有 domain 参数；独立泛目录和预览没有这些参数时默认使用 mn7，以 URL 数字模 70000 选中心并留出前后 4 张的空间。非 mn7 类型缺少中心值时使用 10，避免以 mn7 的图片总数推算其他图库。中心小于 4 时上调至 4，避免负数图片编号。

图集最前面新增 3 张：`staticUrl + '/images/article/mn6/' + (urlNumber % 10063 + delta) + '.jpg'`，delta 依次为 -2、+1、+2，静态前缀解析与 Logo 一致，严格按公式保留可能出现的负数。后接上述原有 9 张，总计 12 张，不删除或去重原图。

“相关应用”每 3 项替换 1 张图片（第 1、4、7……项，共 31/93 张），使用 `staticUrl + '/images/article/mn6/' + (随机数字 % 10063) + '.jpg'`，范围 0～10062。静态前缀与 Logo 一致，每次渲染批量生成随机数，无新增文件读取或远程请求。其余相关图片、标题、链接以及其他推荐区块不变，图片总数仍为 529。

“更多应用下载”（首页为“精选应用库”）同样每 3 项替换 1 张图片，第 1、4、7……项共 40/120 张使用上述随机 mn6 规则，每次渲染重新生成。其余 80 张图片与所有标题、链接保持不变；相关应用仍为 31/93 张替换。图片总数不变。

左侧“猜你喜欢”下方追加“更多推荐”60 条图文卡片，原有 30 条保留。三种链接 `/v-nl/list.html?随机数字.html`、`/x-app/随机数字.html`、`/v-nl/随机数字.html` 按顺序循环，各 20 条。图片全部使用随机 mn6 编号（0～10062），每次渲染重新生成；图文链接一致，标题沿用词库。共增加 120 个锚点和 60 张图片。第三种链接在全局泛目录模式由兜底路由处理，默认模式没有对应的专用路由，本次未修改路由。

### 正文词库组合

新模板的 `<title>`、关键词和描述直接使用泛目录服务已经生成的 `title / keywords / description`，与其他 Article 模板一致；首页和内页都不再附加站名、下载站标语或固定关键词，主标题同样使用组合后的 `title`。标题格式仍取自 `biaoti`、关键词格式取自 `guanjianci`、描述格式取自 `miaoshu`（其中 `{描述}` 取 `description`），不另建组合规则。

首页、泛目录详情与 `fanmulu_article5` 的所有入口共用 `download_portal_content.html`。数据由 `app/utils/downloadPortalContent.js` 组织，沿用 `fanmuluArticle.renderLibraryText` 的嵌套标签替换规则：固定关键词在同页保持一致，随机标签使用 URL 种子和段落序号分别抽取。

- `keyword`：正文主关键词；`keyword2`：每段小标签。
- `miaoshu`：描述格式，其中 `{描述}` 读取 `description`，不是直接把 `description` 当成格式库。
- `juzi`：介绍、特色、特点、相关介绍的句子；`banben`：版本号。
- `zidingyi`：6 条更新内容；`zidingyi2`：3 张讲解图片。
- `url`：解析 `{随机链接}` 后，只接受路径为 `/Article/*.html` 的安全站内或 HTTP(S) 链接。PHP 地址、未解析标签及 `/Article/?123.html` 这类仅查询参数带后缀的地址，回退为本主题的 `/Article/download5/*.html` 链接。

正文有 23 个链接、5 段介绍、9 段特色、6 段特点、1 段相关介绍，另有下载安装和 3 步图文讲解、6 条更新内容。推荐目录和友情链接均保留，全页通常为 1877 个链接再加备用入口、529 张图片。文章原段落不再限于 220 字，单段最多 8192 字、最多 18 段；词库正文按文本转义，不能执行其中的脚本。

本次补充部署还需包含 `app/utils/downloadPortalContent.js`、`app/common_data/Article/templates/download_portal_content.html` 和 `app/public/article_static/download_portal/content.css`，以及修改后的 helper、service、downloadPortal.js 和 frame 模板。词库沿用启动预加载及现有词库刷新机制；直接编辑磁盘文件后可重启服务加载，不在每次访问时重新读取。

仅导入了参考图片，没有引入参考页面的脚本、统计代码、外部 base 地址。文章内容以转义文本段落显示，防止正文中的链接改变模板链接数量。

## 检查与预览
全局泛目录首页（`/`、`/index.html`，包括带查询参数的首页）单独从 `Article/data/keyword_home/*.txt` 读取网页 `<title>` 和 H1。按完整 URL 的 SHA256 固定选词，同一 URL 每次结果一致；选中标题中的连续数字和英文字母会分别替换为固定生成的 1～7 位数字或 1～7 位小写字母，中文和其他符号不变。首页的 `keywords`、`description` 也执行同一套 URL 固定数字/字母替换，仍沿用各自原有的页面组合内容；首页以外的页面保持原逻辑。词库按现有机制启动预加载、合并去重。直接使用处理后的标题，不追加原标题格式。空词库回退原标题。更新程序后需重启服务加载新类别。


```text
node scripts/check-download-portal.js
node scripts/preview-download-portal.js
```

预览服务仅监听本机：`http://127.0.0.1:17865/`（首页），`http://127.0.0.1:17865/Article/download5/preview.html`（详情）。启动时预加载真实 `Article/data` 词库，每个 URL 直接调用正式的 `fanmuluArticle.buildPage` 组合标题、关键词、描述与正文，不再使用固定示例数据。不需要启动数据库，不修改正式模板配置或写入 URL 缓存；退出预览进程即可停止。修改词库或服务 JS 后需要重启预览进程，HTML 模板不缓存；浏览器响应为 `no-store`。

可选浏览器检查：`scripts/visual-check-download-portal.js` 使用本机 Chrome 和 `ws`，通过 `PORTAL_WS_PATH` 指定已有的 ws 模块路径。检查桌面/390px 手机布局、图片懒加载和搜索，并在系统临时目录输出截图。

此次通过全部 10 个入口渲染、首页域名配对、默认泛目录路径、资源存在性、业务下载地址检查；真实手机模拟无横向溢出，无 JavaScript 异常。生产接口与数据需要部署后验证。
