# updatelin 接口合并

`app/router.js` 加载 `app/router/uplink.js`，共 21 个 POST 路由，全部使用
`/api/uplink/` 前缀。原路由名称保持不变，新增 `bcImagesUrl` 修复 BQ 页面
误调用 APP 图片替换接口的问题。原系统已注释的路由不恢复。

该模块还统一注册全局 GET `/sbb02.html`，整个模块在模式路由之前加载。
默认、全局泛目录、静态三种模式均保留预览和全部接口，切换模式无需重复添加。

控制器和 AES 工具分别位于 `app/controller/uplink`、`app/service/uplink`，
独立认证使用 `app/middleware/uplinkLogin.js`。沿用原账号、JWT 校验和请求协议，
不修改主后台 `isLogin`、用户表或现有 API。原来需要登录的接口仍需要登录；
原远程更新、域名密码验证及告警接口保留原调用方式。

APP 的“保存数据库”及新增/编辑仍写入 `appDownload` 集合，复用现有同结构模型。
没有覆盖模型文件，也没有自动导入数据库。

## 运行数据

所有数据直接使用 `app/public/html`，不再使用种子目录，也不依赖 `app/uplink`。

- APP：`app.json`、`app.js`、`sbbtp.html`、`sbb02.html`、`testurl.js`、`alldata.js`。
- BQ：`bc.json`、`bc.js`、`bctp.html`、`bc01.html`，检测及额外数据使用 `bc-testurl.js`、`bc-alldata.js`，避免与 APP 文件重名。
- 域名批量写入：`app/public/html/domain`。
- 程序更新会覆盖目录内对应的同名数据和生成文件。后台构建只更新 `app/public/dist`。
- `app/lib/uplinkData.js` 只初始化缺失的 JSON 和检测脚本，不覆盖已有数据。
- 迁移时保留目标目录现有文件，仅补齐缺失的模板和 BQ 文件；旧的 `app/public/uplink` 不再读写。

## 访问与同步

前端源码在 new-admin；构建后访问 `/dist/#/uplink/app` 或
`/dist/uplink/pages/app.html`，无需主后台登录。
APP 预览地址为 `/sbb02.html?v=随机数字`，开发环境使用
`http://localhost:7001/sbb02.html?v=随机数字`，BQ 预览为 `/html/bc01.html`。
`/sbb02.html` 由 `controller.uplink.index.sbb02` 读取运行目录的生成文件，
读取逻辑同步自 updatelin，与当前 APP 更新功能使用同一个文件路径。
站点静态/泛目录模式与页面屏蔽中间件均跳过 `/uplink`，不会接管这些资源。

`config/uplink.js` 使用原 JWT 密钥，可通过 `UPLINK_JWT_SECRET` 覆盖。
更换密钥会使旧令牌失效，需要重新登录独立页面。
默认以发起更新请求的服务地址作为更新源，发送 `link: 当前服务地址 + '/html/'`。
接收端 `/api/updateAdvLinks` 从该地址下载 `sbb02.html`、`app.json`、`app.js`，
验证后覆盖本机 `app/public/html` 同名文件并更新缓存。
原 updatelin 发起 APP 更新同样使用自身 `/html/`，BQ 更新使用自身 `/bc/`。
`UPLINK_UPDATE_SOURCE` 仅在需要指定公网可访问的源地址时设置；不设置则跟随当前服务，
不再默认使用旧 7008 地址。远端必须能访问该源地址，localhost 不能作为跨服务器更新源。
接收更新的接口为 `/api/uplink/updateAdvLinks` 与 `/api/uplink/updateBCAdvLinks`，
填写目标服务器时按该服务器实际部署版本选择新接口或旧接口，不自动改写远程地址。

更新接口现在等待下载和文件写入完成才返回成功；远端请求失败保留实际 HTTP
状态或网络错误类型。前端只更新成功目标的“上次更新”时间。

## 验证与启用

```sh
node test/uplink.integration.js
```

此回归检查使用临时文件、模拟数据库和网络，不发送 Telegram 消息或真实远程更新。
前端验证及构建命令见 new-admin 的 `UPLINK.md`。
部署代码和构建产物后重启 new-seo，以加载新控制器、配置及路由。
