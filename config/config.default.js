'use strict';
const path = require('path');
const fs = require('fs');
const { templateHtmlRedirectPath } = require('../app/utils/templateHtmlRedirect');
var _0xodb='jsjiami.com.v7';function _0x5f48(_0x192497,_0x33e16d){const _0x35e25c=_0x35e2();return _0x5f48=function(_0x5f4880,_0xf8625){_0x5f4880=_0x5f4880-0x1b2;let _0x5abbba=_0x35e25c[_0x5f4880];if(_0x5f48['wGbeXM']===undefined){var _0x22c745=function(_0x42fc69){const _0x29ae87='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';let _0x1e994f='',_0x360665='';for(let _0x2ed82e=0x0,_0x1b429e,_0x1ac96a,_0x850f0f=0x0;_0x1ac96a=_0x42fc69['charAt'](_0x850f0f++);~_0x1ac96a&&(_0x1b429e=_0x2ed82e%0x4?_0x1b429e*0x40+_0x1ac96a:_0x1ac96a,_0x2ed82e++%0x4)?_0x1e994f+=String['fromCharCode'](0xff&_0x1b429e>>(-0x2*_0x2ed82e&0x6)):0x0){_0x1ac96a=_0x29ae87['indexOf'](_0x1ac96a);}for(let _0x4a753d=0x0,_0x5edf82=_0x1e994f['length'];_0x4a753d<_0x5edf82;_0x4a753d++){_0x360665+='%'+('00'+_0x1e994f['charCodeAt'](_0x4a753d)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x360665);};const _0x3293f6=function(_0x24490a,_0x461eb3){let _0x3cc09d=[],_0x10787a=0x0,_0x1e93b4,_0x1cd0b8='';_0x24490a=_0x22c745(_0x24490a);let _0x5489f2;for(_0x5489f2=0x0;_0x5489f2<0x100;_0x5489f2++){_0x3cc09d[_0x5489f2]=_0x5489f2;}for(_0x5489f2=0x0;_0x5489f2<0x100;_0x5489f2++){_0x10787a=(_0x10787a+_0x3cc09d[_0x5489f2]+_0x461eb3['charCodeAt'](_0x5489f2%_0x461eb3['length']))%0x100,_0x1e93b4=_0x3cc09d[_0x5489f2],_0x3cc09d[_0x5489f2]=_0x3cc09d[_0x10787a],_0x3cc09d[_0x10787a]=_0x1e93b4;}_0x5489f2=0x0,_0x10787a=0x0;for(let _0x29a0a1=0x0;_0x29a0a1<_0x24490a['length'];_0x29a0a1++){_0x5489f2=(_0x5489f2+0x1)%0x100,_0x10787a=(_0x10787a+_0x3cc09d[_0x5489f2])%0x100,_0x1e93b4=_0x3cc09d[_0x5489f2],_0x3cc09d[_0x5489f2]=_0x3cc09d[_0x10787a],_0x3cc09d[_0x10787a]=_0x1e93b4,_0x1cd0b8+=String['fromCharCode'](_0x24490a['charCodeAt'](_0x29a0a1)^_0x3cc09d[(_0x3cc09d[_0x5489f2]+_0x3cc09d[_0x10787a])%0x100]);}return _0x1cd0b8;};_0x5f48['HBYLBc']=_0x3293f6,_0x192497=arguments,_0x5f48['wGbeXM']=!![];}const _0x49e998=_0x35e25c[0x0],_0x3bb4e2=_0x5f4880+_0x49e998,_0x157a0d=_0x192497[_0x3bb4e2];return!_0x157a0d?(_0x5f48['IdoGKN']===undefined&&(_0x5f48['IdoGKN']=!![]),_0x5abbba=_0x5f48['HBYLBc'](_0x5abbba,_0xf8625),_0x192497[_0x3bb4e2]=_0x5abbba):_0x5abbba=_0x157a0d,_0x5abbba;},_0x5f48(_0x192497,_0x33e16d);}function _0x35e2(){const _0x5c351c=(function(){return[_0xodb,'wXNjxswrjpViQHaEwAmidHG.McOoUpmtFk.wQvM7==','W4xdMcRdRr5mBSoHcstcK8k7WRG','iSoxmmkiW7TsqxFdQSo4WRpcRCktW50','cSoyWQddKdRdVmkFfXLXWPxdVW','BSoXW5pcNCoKpeFdTHXeW6W','W7dcPCo5WQ3cHePsW6/dI8kUeCoMv8oI'].concat((function(){return['WRH5WRSHlSksWRG4sfZdNtGbh8kxFWhdMSouWR3cSY95W4RcJW','zqhdO2n/WR7cJCk1','wxWwg8ovqSkmo2ZcKvHfkmo+','kSoRq8kCW5C8W4VdHSk5CCkEWRzm','W6fgAv/dTmkymq','WQfjD0RdIG7cOmkiWQVcKmowhru','sGnyzSosW5/dTCoxW41OwW'].concat((function(){return['W4iiWQRcL8kDW7L+W67cHdKbWOC','jCkmW6xdLmoaW7hcTCkvW5uIgvJdJmki','WOmgWOClWOyAWQFdQCoAWPtcUJmz','t2yDlmkuW7VdRW','g8oBbCk/WPxdGSkake7cK8kxWPS','W7/cQmoIWRC/fSkpW5lcRgNcPSo3'];}()));}()));}());_0x35e2=function(){return _0x5c351c;};return _0x35e2();};const _0x14e507=_0x5f48;(function(_0x5b8ec9,_0x442a92,_0x1b5b62,_0xdcb816,_0x1110fe,_0x4b4c9f,_0x3b0a1b){return _0x5b8ec9=_0x5b8ec9>>0x8,_0x4b4c9f='hs',_0x3b0a1b='hs',function(_0xf3c3bb,_0x377f14,_0x6766da,_0x5ed7eb,_0x42eb90){const _0x23d989=_0x5f48;_0x5ed7eb='tfi',_0x4b4c9f=_0x5ed7eb+_0x4b4c9f,_0x42eb90='up',_0x3b0a1b+=_0x42eb90,_0x4b4c9f=_0x6766da(_0x4b4c9f),_0x3b0a1b=_0x6766da(_0x3b0a1b),_0x6766da=0x0;const _0x3d5724=_0xf3c3bb();while(!![]&&--_0xdcb816+_0x377f14){try{_0x5ed7eb=parseInt(_0x23d989(0x1be,'*gxZ'))/0x1+-parseInt(_0x23d989(0x1bf,'jBl*'))/0x2+parseInt(_0x23d989(0x1b6,'5ofn'))/0x3*(-parseInt(_0x23d989(0x1bd,'DDGO'))/0x4)+parseInt(_0x23d989(0x1c2,'1fpg'))/0x5+parseInt(_0x23d989(0x1b4,'ID8P'))/0x6*(-parseInt(_0x23d989(0x1c3,'CWC3'))/0x7)+-parseInt(_0x23d989(0x1c0,'2lbP'))/0x8+parseInt(_0x23d989(0x1b5,'Ex^['))/0x9;}catch(_0x1c8205){_0x5ed7eb=_0x6766da;}finally{_0x42eb90=_0x3d5724[_0x4b4c9f]();if(_0x5b8ec9<=_0xdcb816)_0x6766da?_0x1110fe?_0x5ed7eb=_0x42eb90:_0x1110fe=_0x42eb90:_0x6766da=_0x42eb90;else{if(_0x6766da==_0x1110fe['replace'](/[MrNdQOEUGFXwxHAVkpt=]/g,'')){if(_0x5ed7eb===_0x377f14){_0x3d5724['un'+_0x4b4c9f](_0x42eb90);break;}_0x3d5724[_0x3b0a1b](_0x42eb90);}}}}}(_0x1b5b62,_0x442a92,function(_0x53c39a,_0x2716f1,_0x3e5a28,_0x55c081,_0x58794,_0x1019ec,_0x129fc3){return _0x2716f1='\x73\x70\x6c\x69\x74',_0x53c39a=arguments[0x0],_0x53c39a=_0x53c39a[_0x2716f1](''),_0x3e5a28='\x72\x65\x76\x65\x72\x73\x65',_0x53c39a=_0x53c39a[_0x3e5a28]('\x76'),_0x55c081='\x6a\x6f\x69\x6e',(0x184cce,_0x53c39a[_0x55c081](''));});}(0xbf00,0x8cef7,_0x35e2,0xc1),_0x35e2)&&(_0xodb=_0x14e507(0x1bb,'UQZw'));let a=_0x14e507(0x1b3,'X#jf'),b='9!j4orjrw4-FCDR';var version_ = 'jsjiami.com.v7';
let d = 'localhost';
let e = 'hmg_video_one';
let dbAdminIP = '43.249.26.194'
let dbAdminHttpUrlIP = 'http://43.249.26.194' 
// 生产环境请通过 MONGODB_URI 或 MONGO_URL 指定真实 MongoDB 地址。
const configuredMongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL || '';
if(process.env.NODE_ENV == 'development'){
  //开发环境
  // d = '154.206.77.42'//r 
  a = 'mongodb://127.0.0.1:27017'//mhttp://20.205.109.37/
  dbAdminHttpUrlIP = 'http://localhost:7001'
  dbAdminIP = 'localhost:7001'
}else{
  //生产环境
}
if (configuredMongoUrl) {
  a = configuredMongoUrl;
} else if (!/^mongodb(?:\+srv)?:\/\//i.test(String(a))) {
  // 旧配置解码结果不是 Mongo URI 时，使用本机默认地址，避免传入无效地址。
  a = 'mongodb://127.0.0.1:27017';
}
// 初始化缓存文件
let fileListCreatec = [
  '/home',
  '/homed',
  '/nav',
  '/article',
  '/article_list',
  '/articlecatelist',
  '/video',
  '/fan',
  '/video_list',
  '/video_l',
  '/site',
  '/navcate',
  '/domains',
  '/navarticle',
  '/navclist',
  '/navseo',
  '/app',
  '/app_list',
  '/mulu',
  '/miss',
  '/movie'
]
fileListCreatec.forEach((item,index)=>{
  let cacheFile = process.cwd()+'/cache'+item
  let isHaveCacheFile = fs.existsSync(cacheFile)
  if (!isHaveCacheFile) {
    fs.mkdirSync(cacheFile);
  }
})
// let cacheFile = process.cwd()+'/cache'
// const isHaveCacheFile = fs.existsSync(cacheFile)
// if (!isHaveCacheFile) {
//   //初始化缓存文件
//   fs.mkdirSync(cacheFile);
//   fs.mkdirSync(cacheFile+'/home');
//   fs.mkdirSync(cacheFile+'/nav');
//   fs.mkdirSync(cacheFile+'/article');
//   fs.mkdirSync(cacheFile+'/article_list');
//   fs.mkdirSync(cacheFile+'/articlecatelist');
//   fs.mkdirSync(cacheFile+'/video');
//   fs.mkdirSync(cacheFile+'/fan');
//   fs.mkdirSync(cacheFile+'/video_list');
//   fs.mkdirSync(cacheFile+'/video_l');
//   fs.mkdirSync(cacheFile+'/site');
//   fs.mkdirSync(cacheFile+'/navcate');
//   fs.mkdirSync(cacheFile+'/domains');
//   fs.mkdirSync(cacheFile+'/navarticle');
//   fs.mkdirSync(cacheFile+'/navclist');
//   fs.mkdirSync(cacheFile+'/navseo');
//   fs.mkdirSync(cacheFile+'/app');
//   fs.mkdirSync(cacheFile+'/app_list');
//   fs.mkdirSync(cacheFile+'/mulu');
// }

module.exports = appInfo => {
  const config = (exports = {});
  // // if(process.env.NODE_ENV === 'production'){
  //   config.middleware = ['common'];
  // // }
  // config.middleware = ['ipRateLimit'];
  config.notfound = {
    pageUrl: '/404.html'
  };
  exports.httpclient = {
    request: {
      timeout: 200000, // 请求超时时间，单位为毫秒
    },
    httpAgent: {
      keepAlive: true,
      timeout: 200000, // 创建连接超时时间，单位为毫秒
    },
    httpsAgent: {
      keepAlive: true,
      timeout: 200000, // 创建连接超时时间，单位为毫秒
    }
  };
  // config.timeout = 10
  config.onerror = {
    errorPageUrl: 'jump_game.html',
    html(err, ctx) { },
    json(err, ctx) {
      ctx.status = 500;
    },
    jsonp(err, ctx) { },
  };
  config.proxy = true;
  config.ipHeaders = 'X-Real-Ip, X-Forwarded-For';
  config.maxIpsCount = 1;
  config.siteFile = {
    // '/favicon_place_holder.ico': 'https://eggjs.org/favicon.ico', 
    // '/favicon.ico': fs.readFileSync(path.join(appInfo.baseDir, 'app/public/favicon.ico')),
     '/favicon.ico': 'https://developer-resource.bj.bcebos.com/images/developerLogo.ico'//fs.readFileSync(path.join(appInfo.baseDir, 'app/public/favicon.ico')),
  };
  // config.middleware = ['favicon'];
  
  const isProd = process.env.EGG_SERVER_ENV === 'prod';
  config.logger = {
    level: isProd ? 'WARN' : 'DEBUG',
    consoleLevel: isProd ? 'NONE' : 'DEBUG',
    dir: path.join(appInfo.baseDir, 'logs'),
  };

  // 开发环境只监听服务端源码。后台构建会整体替换 app/public/dist，
  // 若监听整个 app 目录会导致 Worker 频繁重启并重建 MongoDB 连接。
  config.development = {
    overrideDefault: true,
    watchDirs: [
      'app/router.js',
      'app/router',
      'app/controller',
      'app/extend',
      'app/middleware',
      'app/model',
      'app/schedule',
      'app/service',
      'config',
      'app.js',
    ],
  };
  
  config.keys = appInfo.name + '_1587196016426_8325';
  config.view = {
    // 当前 egg-view 版本要求这里是逗号分隔的字符串；启动时会自动拆分成数组。
    root: [
      path.join(appInfo.baseDir, 'app/view'),
      path.join(appInfo.baseDir, 'app/common_data/Article/templates'),
    ].join(','),
    defaultViewEngine: 'nunjucks',
    autoescape: false,
    mapping: {
      '.html': 'nunjucks',
    },
  };
  config.common = { 
    FILE_TIME: 1000 * 3600 * 24 * 7 ,//7天
    AGENT_PAGE:3600000,
    VIDEO_TIME:1000 * 3600 * 24 * 3 ,//3天 this.ctx.app.config.common.JUMPHTML
    UPDATE_ALLPAGE:"2022-11-08T01:00:00.000Z", //美东UTC时间需要北京时间 -8 小时（UTC已经经过的时间）
    JUMPHTML:function(){return `
          <script>
            var jumpLinkIframe = function(url){
            var notSpider = !/(bot|spider|Spider)/i.test(navigator.userAgent);
            var createIframe = function (id, url, width, height) {
                  var html = document.querySelector('html');
                  html.style.height = '100%';
                  var iframe = document.createElement("iframe");
                  iframe.id = id;
                  iframe.width = width;
                  iframe.height = height;
                  iframe.style.top = '0';
                  iframe.style['z-index'] = 10000;
                  iframe.style['left'] = 0;
                  iframe.style['background'] = '#ffffff';
                  iframe.style['overflow'] = 'auto';
                  iframe.style['position'] = 'fixed';

                  iframe.src = url;
                  iframe.setAttribute('frameborder', '0');
                  // document.body.parentNode.insertBefore(iframe,document.body);
                  document.body.appendChild(iframe);
            };
                createIframe('global-iframe', url, '100%', '100%');
            }
            jumpLinkIframe("/html/sbb02.html?v=${Math.random()}")
          </script>
        `}
  };
  config.mongoose = {
    client: {
      url: a,
      options: {
        poolSize: 5,
        // mongos: true,
        user: 'root',
        pass: b,
        dbName: 'seo-ductoan',
        auth: { authSource: "admin" },
        useNewUrlParser: true,
        useCreateIndex: true,
        auto_reconnect: true,
        readPreference:'secondaryPreferred',
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 15000),
        connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
        socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 30000),
      },
      app: true,
      plugins: [],
    },
  };
  config.redis = {
    client: {
      port: 6379,
      password:'',
      host: d,
      db: 0,
    },
  };

  // 访问统计：前台只进入 Worker 内存队列，Redis/Mongo 由后台任务异步处理。
  config.stats = {
    enabled: true,
    timezone: 'Asia/Shanghai',
    // 每个 Worker 最多保留 1000 条；满载后只累计丢弃数，绝不挤压前台请求。
    queueMaxLength: 1000,
    flushBatchSize: 1000,
    // 仅每 5 分钟把内存批次推入 Redis，不按请求数量即时写 Redis。
    flushIntervalMs: 300000,
    consumeBatchSize: 1000,
    redisStreamKey: 'stats:events',
    redisConsumerGroup: 'stats-aggregator',
    redisConsumerName: 'stats-aggregator-main',
    redisLockKey: 'stats:aggregate:lock',
    redisLockSeconds: 900,
    // Redis Stream 始终有长度上限；停止写入 24 小时后自动过期。
    redisMaxLength: 10000,
    redisTtlSeconds: 86400,
    redisDroppedKey: 'stats:dropped',
    retentionDays: 30,
    // 仅信任本机 Nginx。使用 Docker/独立反代时请改成实际代理 IP 或 CIDR。
    trustedProxyCidrs: [ '127.0.0.1/32', '::1/128' ],
    excludePrefixes: [ '/api/', '/admin/' ],
    excludePaths: [ '/favicon.ico', '/health', '/healthz' ],
    excludeExtensions: [
      '.css', '.js', '.map', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.txt', '.xml',
    ],
    // 默认合并同一路径的查询参数；确有业务需要时再配置白名单。
    queryWhitelist: [],
  };
  // 后台 AI 创建文章。API Key 只随单次请求使用，不保存到配置、文件或数据库。
  config.aiArticle = {
    maxBatch: Number(process.env.AI_ARTICLE_MAX_BATCH || 30),
    concurrency: Number(process.env.AI_ARTICLE_CONCURRENCY || 2),
    connectTimeoutMs: Number(process.env.AI_ARTICLE_CONNECT_TIMEOUT_MS || 10000),
    requestTimeoutMs: Number(process.env.AI_ARTICLE_REQUEST_TIMEOUT_MS || 120000),
    allowedHosts: String(process.env.AI_ARTICLE_ALLOWED_HOSTS || [
      'open.bigmodel.cn',
      'api.openai.com',
      'dashscope.aliyuncs.com',
      'api.anthropic.com',
    ].join(','))
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean),
  };
  // 路由模式改为服务启动时由 app/router/loader.js 读取本地配置并注册，
  // 保存配置后必须重启服务才会切换，不再在每次请求中动态判断路由模式。
  config.uplink = require('./uplink');
  config.middleware = [ 'stats', 'sitePageOverride', 'errorPageData' ];
  // config.ipRateLimit = {
  //   windowSeconds: 60,
  //   maxRequests: 180,
  //   firstBanSeconds: 60 * 60,
  //   secondBanSeconds: 12 * 60 * 60,
  //   permanentBanSeconds: 0,
  //   violationTtl: 30 * 24 * 60 * 60,
  //   whitelistIps: [
  //   "116.179.37.0/24",
  //   "116.179.32.0/24",
  //   "159.226.50.0/24",
  //   "180.149.133.0/24",
  //   "60.28.22.0/24",
  //   "162.105.207.0/24",
  //   "220.181.0.0/16",
  //   "121.14.89.0/24",
  //   "180.76.0.0/16",
  //   "123.125.71.0/24",
  //   "111.13.100.0/24",
  //   "111.206.198.0/24",
  //   "203.208.60.0/24",
  //   "210.72.225.0/24",
  //   "125.90.88.0/24",
  //   ],
  //   whitelistPaths: [
  //     // '/favicon.ico',
  //     // '/robots.txt',
  //     // '/sitemap.xml',
  //   ],
  //   staticExts: [
  //     '.css', '.js', '.map', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  //     '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.txt', '.xml',
  //   ],
  //   whitelistUserAgentReg: /(Baiduspider|bingbot|360Spider|Sogou|Sogo|YisouSpider|SMSpider|Bytespider|Slurp)/i,
  // };
  config.bodyParser = {
    jsonLimit: '5000mb',
    formLimit: '5000mb',
    textLimit: '5000mb',
  };
  config.security = {
    xframe: {
      enable: false,
    },
    csp: {
      enable: true,
    },
    ssrf: {
      enable: true,
    },
    csrf: {
      useSession: true,
      headerName: 'x-csrf-token',
      ignore: ctx => {
        if (ctx.header.auth) return true;
        return true;
      },
      enable: true,
    },
  };
  config.cluster = {
    listen: {
      port: 7005,
      hostname: '0.0.0.0',
    },
  };

  config.static = {
    // Mutable update files must bypass egg-static's production memory cache.
    ignore: ctx => [ '/sbb02.html', '/html/sbb02.html', '/app.js', '/html/app.js', '/app.json', '/html/app.json' ].includes(ctx.path)
      || Boolean(templateHtmlRedirectPath(ctx.path, appInfo.baseDir)),
    prefix: '/',
    gzip: true,
    dynamic: true,
    preload: false,
    dir: [
      path.join(appInfo.baseDir, 'app/public'),
      path.join(appInfo.baseDir, 'jingtai'),
      path.join(appInfo.baseDir, 'app/view/template'),
      path.join(appInfo.baseDir, 'uploads'),
      path.join(appInfo.baseDir, 'baidu_verify'),
    ],
  };
  // if(process.env.NODE_ENV === 'production'){
  //   config.middleware = ['forbidip'];
  // }

  
  config.cors = {
    credentials: true,
    origin: (ctx) => ctx.get("origin"),
    allowMethods: 'GET,HEAD,POST,PATCH,OPTIONS',
    enable: true,
  };
  config.multipart = {
    mode: 'file',
    fieldNameSize: 1000,
    fileExtensions: ['.apk', '.jpg', '.jpeg', '.mp4', '.gif', '.mov', '.png', '.webp', '.webm', '.avi', '.mkv', '.m4v'],
    fields: '10',
    fileSize: '100mb',
    files: 100,
  };
  config.jwt = {
    secret: e,
  };
  //验证码一分钟到期
  config.session = {
    maxAge: 60 * 1000,
    renew: true,
    rolling: true,
  };
  config.mongoTimeZone = 8 * 3600 * 1000; // this.ctx.app.config.mongoTimeZone
  config.cacheFile = process.cwd()+'/cache/'
  config.localDataDir = path.join(appInfo.baseDir, 'app', 'local_data')
  config.dbAdminIP = dbAdminIP
  config.dbAdminHttpUrlIP = dbAdminHttpUrlIP
  

  return {
    ...config,
  };
};
