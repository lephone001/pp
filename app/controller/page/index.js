'usestrict';
const egg = require('egg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { templateExists, resolveTemplate } = require('../../utils/templateExistsCache');
var moment = require('moment')
moment.locale('zh-CN');
const { isIP } = require('net');
const cityPinYinList = ["shijiazhuang","tangshan","qinhuangdao","handan","xingtai","baoding","zhangjiakou","chengde","cangzhou","langfang","hengshui","taiyuan","datong","yangquan","changzhi","jincheng","shuozhou","jinzhong","yuncheng","xinzhou","linfen","lvliang","huhehaote","baotou","wuhai","chifeng","tongliao","eerduosi","hulunbeier","bayannaoer","wulanchabu","shenyang","dalian","anshan","fushun","benxi","dandong","jinzhou","yingkou","fuxin","liaoyang","panjin","tieling","chaoyang_ln","huludao","changchun","jilin","siping","liaoyuan","tonghua","baishan","songyuan","baicheng","haerbin","qiqihaer","jixi","hegang","shuangyashan","daqing","yichun_hlj","jiamusi","qitaihe","mudanjiang","heihe","suihua","nanjing","wuxi","xuzhou","changzhou","suzhou_js","nantong","lianyungang","huaian","yancheng","yangzhou","zhenjiang","taizhou_js","suqian","hangzhou","ningbo","wenzhou","jiaxing","huzhou","shaoxing","jinhua","quzhou","zhoushan","taizhou_zj","lishui","hefei","wuhu","bengbu","huainan","maanshan","huaibei","tongling","anqing","huangshan","fuyang_ah","suzhou_ah","chuzhou","liuan","xuancheng","chizhou","bozhou","fuzhou_fj","xiamen","putian","sanming","quanzhou","zhangzhou","nanping","longyan","ningde","nanchang","jingdezhen","pingxiang","jiujiang","fuzhou_jx","yingtan","ganzhou","jian","yichun_jx","xinyu","shangrao","jinan","qingdao","zibo","zaozhuang","dongying","yantai","weifang","jining","taian","weihai","rizhao","linyi","dezhou","liaocheng","binzhou","heze","zhengzhou","kaifeng","luoyang","pingdingshan","anyang","hebi","xinxiang","jiaozuo","puyang","xuchang","luohe","sanmenxia","nanyang","shangqiu","xinyang","zhoukou","zhumadian","wuhan","huangshi","shiyan","yichang","xiangyang","ezhou","jingmen","xiaogan","jingzhou","huanggang","xianning","suizhou","changsha","zhuzhou","xiangtan","hengyang","shaoyang","yueyang","changde","zhangjiajie","yiyang","chenzhou","yongzhou","huaihua","loudi","guangzhou","shaoguan","shenzhen","zhuhai","shantou","foshan","jiangmen","zhanjiang","maoming","zhaoqing","huizhou","meizhou","shanwei","heyuan","yangjiang","qingyuan","dongguan","zhongshan","chaozhou","jieyang","yunfu","nanning","liuzhou","guilin","wuzhou","beihai","fangchenggang","qinzhou","guigang","yulin_gx","baise","hezhou","hechi","laibin","chongzuo","haikou","sanya","sansha","danzhou","chengdu","zigong","panzhihua","luzhou","deyang","mianyang","guangyuan","suining","neijiang","leshan","nanchong","meishan","yibin","guangan","dazhou","yaan","bazhong","ziyang","guiyang","liupanshui","zunyi","anshun","bijie","tongren","kunming","qujing","yuxi","baoshan","zhaotong","lijiang","puer","lincang","lasa","rikaze","changdu","linzhi","shannan","naqu","xian","tongchuan","baoji","xianyang","weinan","yanan","hanzhong","yulin_sx","ankang","shangluo","lanzhou","jiayuguan","jinchang","baiyin","tianshui","wuwei","zhangye","pingliang","jiuquan","qingyang","dingxi","longnan","xining","haidong","yinchuan","shizuishan","wuzhong","guyuan","zhongwei","wulumuqi","kelamayi","tulufan","hami"];
const axios = require('axios')
const iconv = require('iconv-lite');
iconv.skipDecodeWarning = true;
const punycode = require('punycode');
const mnimageList = require('./imglist')
const hashId = function (id) {
  return crypto.createHash('md5').update(String(id)).digest('hex');
}
const myencodeFn = function (str) {
  if (!str) return str;
  let unicodeList = punycode.ucs2.decode(str)
  let resluted = ''
  if (unicodeList) {
    resluted = iconv.decode(unicodeList.map(e => '&#' + e + ';').join(''), 'utf-8');
  }
  return resluted
}
const recersed = function (str) {
  let endstr = ''
  if (str && typeof str == 'string') {
    endstr = str.split('').reverse().join('')
  }
  return endstr
}
const safeArticleCompanyDirName = function (name = '') {
  return String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);
}

const readTextFile = async filePath => {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (e) {
    return '';
  }
};

const HOME_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const writeTextFile = (filePath, text) => {
  fs.promises.writeFile(filePath, text).catch(() => {});
};

const readJsonFile = async filePath => {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
  } catch (e) {
    return null;
  }
};

const hydrateOldArticleDetailResult = async (result, { ctx, site, domain }) => {
  if (!result || !result.detail) return result;

  const detailList = Array.isArray(result.articleList) ? result.articleList : [];
  result.siteInfo = site;
  result.domain = domain;
  result.userConfig = ctx.app.config.MY_USER_CONFIG;
  result.articleCategoryList = [];
  result.nowCategory = {
    id: result.detail.cid,
    name: result.detail.articleCategory,
  };
  result.articleNext = detailList[1];
  result.articlePrve = detailList[2];
  result.detail.nowJump = false;
  result.titleCP = result.detail.title;

  if (domain.siteType == 8) {
    result.cateNavList = await ctx.service.nav.getNavCagegoryNavList(domain.navcids);
  }
  if (domain.titleType == 1) {
    result.detail.title = domain.fullDomain + ctx.url;
  }

  return result;
};

const fileExists = async filePath => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (e) {
    return false;
  }
};

module.exports = class IndexController extends egg.Controller {
  // async xnxx() {
  //   let bodyHtml = 'xxx';
  //   let endBodyHtml = ''
  //   await rp
  //     .get({
  //       url: 'https://xnxx.com',
  //       json: true,
  //       headers: {
  //         'Content-Type': 'text/html;charset=utf-8',
  //       },
  //       timeout: 25000,
  //       encoding: null, //设置encoding
  //       pool: {
  //         maxSockets: Infinity
  //       }
  //     })
  //     .then(res => {
  //       // let allString = res.data.list
  //       // let afterDate = JSON.parse(allString)
  //       bodyHtml = res + ''
  //       endBodyHtml = cheerio.load(res, {
  //         decodeEntities: false
  //       });
  //     });
  //   // console.log(bodyHtml)
  //   this.ctx.body = bodyHtml
  // }detail
  async robots() {
  const { ctx } = this;

  // 获取域名（去掉端口）
  const host = ctx.host;

  // 判断协议
  const protocol = ctx.protocol || 'http';

  ctx.type = 'text/plain; charset=utf-8';
  ctx.status = 200;

  ctx.body = `User-agent: *
  Allow: /

  Sitemap: ${protocol}://${host}/sitemap.xml`;
}
  async articleSitemap(){
    const { ctx } = this;
    if(ctx.request&&ctx.request.host&&/^(\d{1,3}\.){3}\d{1,3}$/.test(ctx.request.host)){
      ctx.status = 403; 
      ctx.body = '';
      return;
  }
    const geturl = ctx.request.url
    let host = ctx.request.header.host.toLowerCase();
    let { domain } = await ctx.service.utils.getSiteInfo();
    let linkArry = []
    let articleList = []
    articleList = await this.ctx.service.cache.get('siteMapArticleList');
    if (articleList) {
      articleList.forEach((item) => {
        linkArry.push('http://' + domain.fullDomain + '/detail/' + item._id + '.html')
      })
    }
    if (geturl && geturl.indexOf('.xml') > 0) {
      // xml格式
      ctx.set('content-type', "application/xml")
      return ctx.render('/sitemap/sitemap.xml', { data: linkArry });
    }
  }
  async sitemap() {
    const { ctx } = this;
    if(ctx.request&&ctx.request.host&&/^(\d{1,3}\.){3}\d{1,3}$/.test(ctx.request.host)){
        ctx.status = 403; 
        ctx.body = '';
        return;
    }
    const geturl = ctx.request.url
    let host = ctx.request.header.host.toLowerCase();
    let { domain } = await ctx.service.utils.getSiteInfo();

    //--------这里判断是否为https 站点 （强制不跳转下）
    if(domain.isHttps&&!ctx.secure&&ctx.protocol==="http"&&domain.isOpenUrl<0){
      ctx.status = 301;
      ctx.redirect('https://'+domain.fullDomain);
    }
    let httpsbo = "http://"
    if(domain.isHttps&&ctx.protocol==="https"){
      httpsbo = "https://"
    }
    let linkArry = []
    let articleList = []
    if (!domain) {
      return this.ctx.render('error.html');
    }

    articleList = await this.ctx.service.cache.get('articleList');
    linkArry.push(domain.httpFullDomain + '/v-nl/list.html')

    if (domain.isMuLu) {
     linkArry.push(httpsbo + domain.fullDomain + '/WenZhang/list.html')
     linkArry.push(httpsbo + domain.fullDomain + '/WenZhangMuLu/list.html')
     linkArry.push(domain.httpFullDomain + '/v-nl/list.html')
      if(domain.agentLink.muluUrlList&&domain.agentLink.muluUrlList.length>0){
        domain.agentLink.muluUrlList.forEach((itemmului,indexmului)=>{
            linkArry.push(domain.httpFullDomain + `/${itemmului}/`+ ctx.service.utils.randomNumber(1, 1, 5)+'.html')
        })
      }
      for (let i = 0; i < 5; i++) {
      linkArry.push(domain.httpFullDomain + '/Article/Movie/'+ctx.service.utils.RandomZiMu(1, 1, 10,1)+'.html')
      linkArry.push(domain.httpFullDomain + '/Article/'+ctx.service.utils.RandomZiMu(1, 1, 10,1))
      linkArry.push(domain.httpFullDomain + '/Article/'+ctx.service.utils.randomNumber(1, 1, 10))
      linkArry.push(domain.httpFullDomain + '/Article/'+ctx.service.utils.RandomZiMu(1, 1, 10,1)+'.html')
      linkArry.push(domain.httpFullDomain + '/Article/'+ctx.service.utils.randomNumber(1, 1, 10)+'.html')
      linkArry.push(domain.httpFullDomain + '/WenZhang/'+ctx.service.utils.RandomZiMu(1, 1, 10,1))
      linkArry.push(domain.httpFullDomain + '/WenZhang/'+ctx.service.utils.randomNumber(1, 1, 10))
      linkArry.push(domain.httpFullDomain + '/WenZhangMuLu/'+ctx.service.utils.RandomZiMu(1, 1, 10,1)+'.html')
      linkArry.push(domain.httpFullDomain + '/WenZhangMuLu/'+ctx.service.utils.randomNumber(1, 1, 10)+'.html')
      linkArry.push(domain.httpFullDomain + '/v-nd/'+ctx.service.utils.RandomZiMu(1, 1, 10,1))
      linkArry.push(domain.httpFullDomain + '/v-nd/'+ctx.service.utils.randomNumber(1, 1, 10))

      linkArry.push(domain.httpFullDomain + '/gogogo/'+ctx.service.utils.randomNumber(1, 1, 10))
      linkArry.push(domain.httpFullDomain + '/gogogo/'+ctx.service.utils.RandomZiMu(1, 1, 10,1))
      linkArry.push(domain.httpFullDomain + '/gogogo/'+ctx.service.utils.RandomZiMu(1, 1, 10,1)+'.html')
      linkArry.push(domain.httpFullDomain + '/'+ ctx.service.utils.randomNumber(1, 1, 5)+'.html')
      linkArry.push(domain.httpFullDomain + '/'+ctx.service.utils.RandomZiMu(1, 1, 10,1)+'/' + ctx.service.utils.randomWord(1, 1, 18) + '.html')
      linkArry.push(domain.httpFullDomain + '/' + ctx.service.utils.randomWord(1, 1, 18) + '.html')
      }
    }
    if (articleList&&articleList.length>0) {
      articleList.forEach((item) => {
        if (domain.isFan>0&&geturl.indexOf('.html') > 0) {
          linkArry.push(httpsbo+'m.' + domain.link + '/detail/' + item._id + '.html')
          linkArry.push(httpsbo+'app.' + domain.link + '/detail/' + item._id + '.html')
          if (domain.isFan>-1) {
            linkArry.push(httpsbo+'share.' + domain.link + '/detail/' + item._id + '.html')
            linkArry.push(httpsbo + ctx.service.utils.randomNumber(1, 1, 5) +'.'+ domain.link + '/detail/' + item._id + '.html')
          }
        }
        linkArry.push(domain.httpFullDomain + '/detail/' + item._id + '.html')
      })
      linkArry.push(domain.httpFullDomain+  '/article.html')
    }
    if (domain.isArticleCompany && domain.articleCompany && domain.articleCompany.fileName) {
      const dirName = safeArticleCompanyDirName(domain.articleCompany.fileName);
      const factoryId = domain.articleCompany._id || domain.articleCompany.id || '';
      const cacheKey = `articleCompany:${factoryId}:${dirName || 'root'}`;
      let articleCompanyTotal = Number(await ctx.service.cache.get(cacheKey));

      const total = Number.isFinite(articleCompanyTotal) && articleCompanyTotal > 0
        ? Math.floor(articleCompanyTotal)
        : 1000;
      const availableCount = Math.min(total, 10000000);
      const linkCount = Math.min(20, availableCount);
      const linkSet = new Set();
      while (linkSet.size < linkCount) {
        const num = Math.floor(Math.random() * availableCount);
        linkSet.add(num);
      }
      linkSet.forEach(num => {
        linkArry.push(domain.httpFullDomain+ `/v-n/${num}${num}.html`);
      });
    }
    let cityNpy = ctx.service.utils.randomOneW(cityPinYinList)
    
    if (domain.isFan>0 && geturl.indexOf('.html') > 0) {
      linkArry.push(httpsbo+'app.' + domain.link)
      linkArry.push(httpsbo+'h5.' + domain.link)
      linkArry.push(httpsbo+'m.' + domain.link)
      linkArry.push(httpsbo+'www.'+cityNpy +'.'+ domain.link)
      linkArry.push(httpsbo+cityNpy +'.'+ domain.link)
      linkArry.push(httpsbo+ctx.service.utils.randomWord(1, 1, 5)+'.'+cityNpy +'.'+ domain.link)
      linkArry.push(httpsbo+'www.share.' + domain.link)
      linkArry.push(httpsbo+'m.share.' + domain.link)
      linkArry.push(httpsbo+'map.' + domain.link)
      linkArry.push(httpsbo+'read.' + domain.link)
      linkArry.push(httpsbo+'share.' + domain.link)
      linkArry.push(httpsbo+'5g.' + domain.link)
      linkArry.push(httpsbo+'share.' + domain.link+'/'+ ctx.service.utils.randomWord(1, 1, 18))
      linkArry.push(httpsbo + domain.fullDomain+'/'+ ctx.service.utils.randomWord(1, 1, 18))
      linkArry.push(httpsbo+'www.' + domain.link+'/'+ ctx.service.utils.randomWord(1, 1, 18))
      linkArry.push(httpsbo+'h5.' + domain.link+'/'+ ctx.service.utils.randomWord(1, 1, 18))
      linkArry.push(httpsbo+'wap.' + domain.link+'/'+ ctx.service.utils.randomWord(1, 1, 18))
      linkArry.push(httpsbo+'m.' + domain.link+'/'+ ctx.service.utils.randomWord(1, 1, 18))
      for (let i = 0; i < 2; i++) {
        linkArry.push(httpsbo+'www.share.' + ctx.service.utils.randomNumber(1, 1, 2) + '.' + domain.link)
        linkArry.push(httpsbo + ctx.service.utils.randomWord(1, 1, 5) + '.' + domain.link)
        linkArry.push(httpsbo + ctx.service.utils.randomNumber(1, 1, 5) + '.' + domain.link)
        linkArry.push(httpsbo+'av-' + ctx.service.utils.randomNumber(1, 1, 2) + '.' + domain.link)
        linkArry.push(httpsbo+'xxx-' + ctx.service.utils.randomNumber(1, 1, 2) + '.' + domain.link)
        linkArry.push(httpsbo+'www.' + ctx.service.utils.randomWord(1, 1, 5) + '.' + domain.link)
        linkArry.push(httpsbo+'app.' + ctx.service.utils.randomWord(1, 1, 5) + '.' + domain.link)
        linkArry.push(httpsbo+'h5.' + ctx.service.utils.randomWord(1, 1, 5) + '.' + domain.link)
      }
      linkArry.push(httpsbo+'share.' + ctx.service.utils.randomNumber(1, 1, 2)+'.'+ domain.link+'/sitemap.html')
      linkArry.push(httpsbo + ctx.service.utils.randomNumber(1, 1, 5)+'.'+ domain.link+'/sitemap.html')
    }
    if (geturl && geturl.indexOf('.xml') > 0) {
      // xml格式
      linkArry.push(domain.httpFullDomain+'/sitemap.html')
      ctx.set('content-type', "application/xml")
      return ctx.render('/sitemap/sitemap.xml', { data: linkArry });
    } else if (geturl && geturl.indexOf('.html') > 0) {
      // txt格式
       if(domain.isOpenFriendLink&&domain.isOutFriendLink&&domain.outFriendLinks&&domain.outFriendLinks.length>0){
          domain.outFriendLinks.forEach((item,index)=>{
            linkArry.push(httpsbo+'www.' + item.link)
            linkArry.push(httpsbo + item.link)
          })
        }

      return ctx.render('/sitemap/sitemap.html', { data: linkArry,domain });
    } else if (geturl && geturl.indexOf('.txt') > 0) {
      // txt格式
      ctx.set('content-type', "text/plain")
      return ctx.render('/sitemap/sitemap.txt', { data: linkArry });
    }
    return ctx.render('/sitemap/sitemap.txt', { data: linkArry });
  }
  async indexPage() {
    // 当请求页面过来之后先进行验证域名
    const { ctx } = this;
    //判断ip访问直接禁止
    // if(ctx.request&&ctx.request.host&&/^(\d{1,3}\.){3}\d{1,3}$/.test(ctx.request.host)){
    //   ctx.status = 403; 
    //   ctx.body = '';
    //   return;
    // }

    if (isIP(ctx.hostname)) {ctx.status = 444;ctx.body = '';return;}

    let { site, domain } = await ctx.service.utils.getSiteInfo();
    let referer = ctx.request.header['referer'];

    // console.log(222222,domain)
    if (!domain || !domain._id) {
      //跳转 app 导航
      let agentPageName = '/app/public/html/sbb02.html';
      let agentPageFilePath = process.cwd() + agentPageName
      let text = '初始text'
      text = await readTextFile(agentPageFilePath) || "sbb文件找不到"
      if(text){
       let gaDOmc =` 
        <!-- Google tag (gtag.js) -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z3ME56L569"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-Z3ME56L569');
        </script>
        `
        text = text.replace('</body>',`${gaDOmc}</body>`).replace('<title>',`<title>看黄软件app下载-黄软件下载-免费看污黄APP-黄色下载软件-黄色应用免费下载-免费看黄色的软件-黄色十大软件`)
        .replace(`content="description"`,`content="黄软件色app大全,黄应用色版app下载,永久免费的看黄软件app下载,黄色应用app下载,黄色软件大全【无限🌟观看】黄色软件app免费下载,黄片软件下载,黄色软件大全,免费看黄软件,免费黄色软件,小黄片软件,黄色APP下载,看黄片软件,十大黄色软件。"`)
        ctx.status = 201;
        return this.ctx.body = text
      }
      return '站点未配置！'
      // if(domain.spider||!domain.isMobile){
      //   给一个导航页面
      //   let dr = domain.host;
      //   let links = [];
      //   let dPageFilePath = this.ctx.app.config.cacheFile + '/cache/domains/alldomain.json'
      //   let isHaveDeFile = fs.existsSync(dPageFilePath)
      //   if(isHaveDeFile){
      //     let domainsFileTxt = fs.readFileSync(process.cwd() + '/cache/domains/alldomain.json', 'utf-8');
      //     if(domainsFileTxt){
      //       links = JSON.parse(domainsFileTxt)
      //     }
      //   }else{
      //     links = await ctx.service.domain.refushDomainLinksc();
      //   }
      //   return this.ctx.render('/nav.html',{domain:domain.host,links});
      // }else{
      //   //跳转 app 导航
      //   let agentPageName = '/app/public/html/sbb02.html';
      //   let agentPageFilePath = process.cwd() + agentPageName
      //   let text = fs.readFileSync(agentPageFilePath, 'utf-8');
      //   if(text){
      //    let gaDOmc =` <!-- Google tag (gtag.js) -->
      //     <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z3ME56L569"></script>
      //     <script>
      //       window.dataLayer = window.dataLayer || [];
      //       function gtag(){dataLayer.push(arguments);}
      //       gtag('js', new Date());
      //       gtag('config', 'G-Z3ME56L569');
      //     </script>
      //     `
      //     text = text.replace('</body>',`${gaDOmc}</body>`).replace('<title>',`<title>黄色片软件下载-免费看的黄色-91黄视频-黄色app下载大全`)
      //     .replace(`content="description"`,`content="看黄软件大全${domain.host}羞羞视频APP大全,免费黄色下载,好色先生,四虎,糖心,爱情岛,91看片,xnxx,麻豆影视永久免费版下载,麻豆影视永久免费版安卓版下载"`)
      //     return this.ctx.body = text
      //   }
      // }
    };

    // 如果是首页无内页百度的话直接444-baidu01  &&!domain.isBaiduSpider
    

    if(domain.browserType == 'baidu01'){
      if(domain.isBaiduSpider||domain.spider){
        ctx.status = 200;
        let urlccc = `http://${domain.fullDomain}/Article/${domain.randomClass}/${domain.randomNumber}.shtml`
        ctx.body = `<!DOCTYPE html><html lang='en'><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no'><meta name='robots' content='noindex'><meta name="mobile-agent" content="format=xhtml;url=${urlccc}" /><link rel="canonical" href="${urlccc}" /><title>${domain.titleText2}</title></head><body><a href="${urlccc}">${urlccc}</a></body></html>`
        return;
      }
      ctx.status = 444; 
      ctx.body = null;
      return;
    }
    if(domain.browserType == 'baidu02'&&!domain.isBaiduSpider&&!domain.spider){
      //如果非蜘蛛和有reffer 并且是百度跳转
      if(referer&&referer.indexOf('baidu.com')>0&&domain.isMobile){
        ctx.status = 201;
        if(domain.openUrlStatusCode>0){ctx.status = domain.openUrlStatusCode}
        let tdk = await ctx.service.utils.getMuluItemOne(Date.now(),domain.mcid)
        if(tdk&&tdk.title){
          tdk.description = tdk.description.replace(/\[域名\]|域名/g, ctx.url)
          tdk.description = tdk.description.replace(/\[数字\]|数字/g, domain.urlNumber)
          tdk.description = tdk.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
          tdk.description = tdk.description.replace(/\[关键字\]|关键字/g, tdk.keywords)
          tdk.description = tdk.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          tdk.description = tdk.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
          tdk.description = tdk.description.replace(/\[关键字\]|关键字/g, tdk.keywords)
          tdk.title = tdk.title.replace(/\[域名\]|域名/g, ctx.url)
          tdk.title = tdk.title.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
          tdk.title = tdk.title.replace(/\[数字\]|数字/g, domain.urlNumber)
          tdk.title = tdk.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          tdk.title = tdk.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
        }
        //如果开启了本地
        if ((domain.agentLink.isAgentPage&&domain.fromNum!=300)||domain.fromNum==200) {
          let agentPageName = '/app/public/html/'+domain.agentLink.agentPageName + '.html';
          let agentPageFilePath = process.cwd() + agentPageName
          // let isHaveagentFile = fs.existsSync(agentPageFilePath)
          // if(isHaveagentFile){
          let text = ''
          text = await readTextFile(agentPageFilePath)
          if(text){
            text = text.replace('</body>',`${domain.agentLink.gajs}</body>`)
            .replace('<title>',`<title>${tdk.title}`)
            .replace(`content="description"`,`content="${tdk.description}"`)
            .replace('HDESC',tdk.keywords)
            .replace('SEODESCRIPTION',tdk.description)
            return this.ctx.body = text
          }
        }
        //这里应该是跳转
        ctx.body = `<!DOCTYPE html><html lang='en'><head><meta name="robots" content="noindex,nofollow"><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no'><meta name='robots' content='noindex'><title>${tdk.title}</title><meta name="description" content="${tdk.description}"></head><body></body>${domain.jumpIFrameHTML}</html>`
        return;
      }
      // ctx.status = 444; 
      // ctx.body = null;
      // return;
    }
    // 针对搜狗开启301
    let urlh5Agent = "/html/sbb02.html"
    if(domain.agentLink.openUrlH5){
      urlh5Agent = domain.agentLink.openUrlH5.replace(/##/g, '');
    }
    let gaDOm = ''
    let iframeDom = ''
    if (domain.agentLink.gajs) gaDOm = domain.agentLink.gajs;
    // 如果是搜狗并且是pc 端非蜘蛛 并且未开启pc 并且是pc状态
    if (domain.browserType == 'sogo' && domain.ispcpage<1 && !domain.spider && !domain.isMobile){
      // ctx.status = 403
      return ctx.body = ''
    }

    if (domain.is301) return ctx.body = `
<html>
<head>
<title>${domain.title}</title>
<meta name="description" content="${domain.description}">
<meta name="keywords" content="${domain.keyWords}">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
</head>
<body>
${gaDOm}
<script language="javascript">  
  function goPAGE() {
      if((navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i))) {
          window.location.href = "${urlh5Agent}";
      }
  }
  goPAGE();
</script>
</body>
</html>
    `
    // 如果 domain.tname == sbb0
    if (domain.tname.indexOf('sbb0') === 0&& domain.isMobile&&!domain.spider){
      return ctx.body = `<html>
        <head>
          <title>${domain.title}</title>
          <meta name="description" content="${domain.description}">
          <meta name="keywords" content="${domain.keyWords}">
          <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
        </head>
        <body>
        <iframe frameborder="0" style="margin:0;padding:0;position:fixed;z-index:10000;top:0;left:0;width:100%;height:100%;background:#1c2035;overflow:auto;" src="${urlh5Agent}?v=${Date.now()}"></iframe>
        ${gaDOm}
        </body>
      </html>
      `
    }
    // 如果是搜狗关闭pc并且不是蜘蛛
    if (domain.browserType == 'sogo' && !domain.spider && domain.isMobile) {
      // ctx.status = 200;
      // return ctx.redirect(urlh5Agent);
      return ctx.body = `<html>
  <head>
    <title>${domain.title}</title>
    <meta name="description" content="${domain.description}">
    <meta name="keywords" content="${domain.keyWords}">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
  </head>
  <body>
  ${gaDOm}
  <script language="javascript">  
    function goPAGE() {
        if((navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i))) {
            window.location.href = "${urlh5Agent}?v=${Date.now()}";
        }
    }
    goPAGE();
  </script>
  </body>
</html>
`
    }
    // console.log(domain.ispcpage)
   // 如果未开启pc端直接返回并且是pc端 并且非强制跳转 并且是是视频站点
   if (domain.ispcpage==0 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
      ctx.status = 403  // 500 s
      ctx.body='';
      return;
   }
  // 主域名关闭泛域名隐藏
  if (domain.ispcpage==15 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3&&domain.f_host=='') {
      ctx.status = 403  // 500
      ctx.body='';
      return;
  }

  if (domain.ispcpage==16 && !domain.spider && !domain.isMobile&&domain.fromNum<3) {
      ctx.status = 403  // 500
      ctx.body='';
      return;
  }

  if (domain.ispcpage==15 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
    return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
  }
   //如果主域名关闭泛域名开启
   if (domain.ispcpage==2 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3&&domain.f_host=='') {
        ctx.status = 403  // 500
        ctx.body='';
        return;
    }
    if (domain.ispcpage==2.1 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3&&(domain.f_host==''||domain.f_host=='www')) {
      ctx.status = 403;  // 500
      ctx.body='';
      return;
    }
    if (domain.ispcpage==2.1 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3&&domain.f_host!==''&&domain.f_host!=='www') {
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
    }
    if (domain.fromNum>=3&&domain.ispcpage==3 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
      ctx.status = 403;  // 500 s
      ctx.body='';
      return;
    }
    if(!referer&&domain.ispcpage==4&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      ctx.status = 403;  // 500 s
      ctx.body='';
      return;
    }
   
    if (domain.fromNum>=3&&domain.ispcpage==5 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
    }
    if(!referer&&domain.ispcpage==6&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
    }
    if(referer&&domain.ispcpage==7&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
    }
    if(!referer&&domain.ispcpage==7&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      ctx.status = 403  // 500 s
      ctx.body='';
      return;
    }
    if(referer&&domain.ispcpage==8&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
    }
    if(domain.fromNum>=3&&domain.ispcpage==8&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      ctx.status = 403  // 500 s
      ctx.body='';
      return;
    }

   

       
    //{ value: 2, label: "主关闭(403)泛开启" },
    //{ value: 2.1, label: "主403泛隐藏" },

    //{ value: 3, label: "自动403(3次来路)" },
    //{ value: 4, label: "半403(来路正常)" },
    //{ value: 5, label: "自动隐藏(3次来路)" },
    //{ value: 6, label: "半隐藏403(来路正常)" },
    //{ value: 7, label: "来路隐藏否则403" },
    //{ value: 8, label: "来路隐藏否则三次后403" },
   
    //{ value: 9, label: "来路正常否则三次后隐藏" },

    //{ value: 10, label: "自动h5+pc跳转" },

    if(domain.fromNum>=3&&domain.ispcpage==9&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
    }
    //{ value: 10, label: "来路正常否则三次后403" },
    if(domain.fromNum>=3&&domain.ispcpage==10&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      ctx.status = 403  // 500 s
      ctx.body='';
      return;
    }
    //{ value: 11, label: "来路正常否则隐藏" },
    if(!referer&&domain.ispcpage==11&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
    }
    //{ value: 12, label: "来路正常否则403" },
    if(!referer&&domain.ispcpage==12&& !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3){
      ctx.status = 403  // 500 s
      ctx.body='';
      return;
    }
    //如果是百度并且手机端跳转  或者 h5+ H5跳转的
    if (domain.isBaiduType == 1) {
      // ctx.status = 206
      if(domain.openUrlStatusCode>0){ctx.status = domain.openUrlStatusCode};
      //如果开启了本地
      if ((domain.agentLink.isAgentPage&&domain.fromNum!=300)||domain.fromNum==200) {
        //-------------------------暂时只启用iframe 测试
        let agentPageName = '/app/public/html/'+domain.agentLink.agentPageName + '.html';
        let agentPageFilePath = process.cwd() + agentPageName
        // let isHaveagentFile = fs.existsSync(agentPageFilePath)
        // if(isHaveagentFile){
        let text = ''
        text = await readTextFile(agentPageFilePath)
        if(text){
          text = text.replace('</body>',`${gaDOm}</body>`)
          .replace('<title>',`<title>${domain.title}`)
          .replace(`content="description"`,`content="${domain.description}"`)
          .replace('HDESC',domain.keyWords)
          .replace('SEODESCRIPTION',domain.description)
          return this.ctx.body = text
        }
        // }
        //-------------------------暂时只启用iframe 测试

        // let agentPageName = domain.agentLink.agentPageName + domain.agentLink._id + '.json' || 'index.json';
        // let agentPageFilePath = process.cwd() + '/app/public/agentpage/' + agentPageName
        // let isHaveagentFile = fs.existsSync(agentPageFilePath)
        // // 如果开启了缓存并且有缓存文件直接返回
        // let isHaveList = false;
        // let txtpage = '';
        // if (isHaveagentFile) {
        //   let text = fs.readFileSync(agentPageFilePath, 'utf-8');
        //   let datac = JSON.parse(text);
        //   txtpage = datac.txtpage;
        //   let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
        //   if (chaTime >= this.ctx.app.config.common.AGENT_PAGE || chaTime < 0) {
        //     isHaveList = false
        //   } else {
        //     isHaveList = true
        //   }
        // }
        // let pageurl = domain.agentLink.openUrlH5.replace(/##/g, '');
        // if (!isHaveList && pageurl) {
        //   try{
        //     axios.get(pageurl).then((res) => {
        //       if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
        //         try { fs.unlinkSync(agentPageFilePath); } catch { }
        //         let savehtml = res.data.replace('</body>', domain.agentLink.gajs + '</body>')
        //         let savelist = {
        //           updateCacheTime: Date.now(),
        //           txtpage: savehtml
        //         }
        //         fs.writeFile(agentPageFilePath, JSON.stringify(savelist), null, function (err) { });
        //         fs.writeFile(process.cwd() + '/app/public/agentpage/' +  domain.agentLink.agentPageName+domain.agentLink._id + '.html', savehtml, null, function (err) { });
        //       }
        //     }).catch(()=>{
        //       console.log('广告地址请求错误1.31！')
        //     })
        //   }catch{
        //     console.log('广告地址请求错误2.2！')
        //   }
        // }
        // if (txtpage) {
        //   return this.ctx.body = txtpage
        // }
      }
        // return ctx.body = `
        // <!DOCTYPE html>
        // <html lang="zh-CN">
        //   <head>
        //     <meta name='robots' content='noindex,nofollow' />
        //     <meta name='robots' content='noarchive' />
        //     <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
        //   </head>
        //   <body>
        //     <iframe frameborder="0" style="margin:0;padding:0;position:fixed;z-index:10000;top:0;left:0;width:100%;height:100%;overflow:auto;" src="${domain.jumpURL}?v=${domain.muluRandomMulu}"></iframe>
        //     ${gaDOm}
        //   </body>
        // </html>
        // `
        // console.log(domain)
        iframeDom =  `<style>body{overflow:hidden;height:100vh;}</style><iframe frameborder="0" style="margin:0;padding:0;position:fixed;z-index:10000;top:0;left:0;width:100%;height:100%;background:#1c2035;overflow:auto;" src="${domain.jumpURL}?${domain.urlString}=${Date.now()}"></iframe>`
    }
    // 如果百度 未开启pc并且是pc端的情况
    // (domain.siteType==6||domain.isBaiduType == 2 || domain.isBaiduType == 4 || domain.isBaiduType == 3) && 
    if (domain.ispcpage==-1 && !domain.isMobile) {
      return ctx.render('/template/n_yincang_01/index.html',{detail:domain,domain:domain});
      // // ctx.status = 403
      // return ctx.body = `
      // <!doctype html>
      //   <html>
      //   <head>
      //   <meta charset="utf-8">
      //   <meta http-equiv="X-UA-Compatible" content="IE=edge">
      //   <link rel="canonical" href="http://${domain.fullDomain}" />
      //   <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
      //   ${domain.headDom}
      //   <title>${domain.beiAnName}</title>
      //   <style>
      //       body,h1,h2,h3,h4,h5,h6,hr,p,dl,dt,dd,ul,ol,li,form,fieldset,legend,button,input,textarea,th,td{margin:0;padding:0;}
      //       body,button,input,select,textarea{font:12px}
      //       body{background-color:#fff;color:#666;}
      //       h1,h2,h3,h4,h5,h6{font-size:100%;font-weight: normal;}
      //       em,i,b{font-style:normal;font-weight:400;}
      //       fieldset,img{border:0;}
      //       ul,ol,li{list-style:none;}
      //       button,input,select,textarea{font-size:100%;outline:none}
      //       textarea{resize:none;}
      //       img {display:inline-block;}
      //       table{border-collapse:collapse;border-spacing:0;}
      //       a{color: #ff9900;}
      //       a:link, a:visited{text-decoration:none;outline:none;}
      //       a:hover{color:#39f;}
      //       .clearfix:after{content:".";display:block;height:0;clear:both;visibility:hidden;}
      //       .clearfix{zoom:1;}
      //       .clear{clear:both;display:block;height:0;overflow:hidden;font-size:0;}
      //       .hide{display:none;}
      //       .l{float:left;}
      //       .r{float:right;}
      //       .mt10{margin-top:10px!important;}
      //       .mb10{margin-bottom:10px!important;}
      //       .ml10{margin-left:10px!important;}
      //       .w1190{max-width:1190px;margin:0 auto 10px; }
      //       .w990{max-width:990px;margin:0 auto;}
      //       .w980{max-width:980px;margin:0 auto;}
      //       .logo {text-align:center;height: 120px; line-height: 130px; font-size: 28px; font-weight: bold; color: #333;}
      //       .bg { width: 100%; text-align: center; margin-top: 50px; margin-bottom: 36px;}
      //       .bg img { display: inline-block;max-width:621px;height:auto;}
      //       .tips { text-align: center; margin-bottom: 140px;}
      //       .tips h2 { font-size: 28px; font-weight: bold; color: #ff9900; margin-bottom: 10px;}
      //       .tips h3 { font-size: 20px; font-weight: normal; color: #666;}
      //       .copyright { text-align: center;}
      //       .copyright a:hover { color: #ff9900;}
      //   </style>
      //   </head>
      //   <body>
      //     <div class="w1190">
      //         <h1 class="logo">${domain.beiAnName}</h1>
      //         <div class="bg"><img src="" alt="${domain.beiAnName}"></div>
      //         <div class="tips">
      //             <h2>网站正在努力建设中...</h2>
      //             <h3>请您稍后访问</h3>
      //         </div>
      //         <div class="copyright">© 2022 ${domain.beiAnName}【${domain.fullDomain}】 - All Rights Reserved  ICP备案号：<a href="https://beian.miit.gov.cn/" target="_blank">${domain.beiAnNumber}</a></div>
      //     </div>
      //   </body>
      //   </html>
      // `;

    }
    // 针对百度站点重定向到主域名重定向 www
    
    //无论是否百度 h5 跳转的站点
    //--------这里判断是否为https 站点 （强制不跳转下）
    if(domain.isHttps&&!ctx.secure&&ctx.protocol=="http"&&domain.isOpenUrl<0){
      ctx.status = 301;
      ctx.redirect('https://'+domain.fullDomain+ctx.url);
      return;
    }
    
    // 如果是文章站点就返回10条数据
    let count = 0
    let nowPage = ctx.query.e || 1
    let spage = ctx.query.s || 0
    let epage = ctx.query.e || 0
    let offset = ctx.query.o || 0
    if (spage && epage && offset) {
      // 不符合分页条件
      let isObjectId = /^[a-fA-F0-9]{24}$/.test(offset)
      let num = epage - spage
      if (num < -20 || num > 20 || !isObjectId) {
        return this.ctx.render('error.html');
      }
    }
    if (!domain) {
      // 域名在域名列表里面找不到
      return this.ctx.render('error.html');
    }
    // 站点类型是4 就返回5条首页文章
    const currentSiteType = Number(domain.siteType);
    const homeTemplateName = String(domain.tname || '').trim();
    let articleList = [];
    let categoryList = [];
    let videoList = [];
    let appList = []
    let result = {
      siteInfo: site,
      domain,
      count,
      nowPage,
      snowPage: 1,
      offset,
      userConfig: ctx.app.config.MY_USER_CONFIG,
    };

    if (domain.siteType == 4) {
      categoryList = domain.cids
      let cachePageFilePath = this.ctx.app.config.cacheFile + 'article_list'
      let articleRdmNum = ['/index.json', '/index1.json', '/index2.json', '/index3.json', '/index4.json', '/index5.json', '/index6.json', '/index7.json', '/index8.json', '/index9.json']
      // let articleRdmName = articleRdmNum[Math.floor(Math.random() * articleRdmNum.length)]

      let articleRdmName = articleRdmNum[new Date().getSeconds()%articleRdmNum.length]
      let articleRdmName2 = articleRdmNum[new Date().getMinutes()%articleRdmNum.length]

      try {
        let [rowstext, rowstext2] = await Promise.all([
          readTextFile(cachePageFilePath + articleRdmName),
          readTextFile(cachePageFilePath + articleRdmName2)
        ]);
        if (rowstext&&rowstext2) {
          try {
            articleList = [...JSON.parse(rowstext),...JSON.parse(rowstext2)]
          } catch {

          }
        }
      } catch (e) {
      }
      if (!articleList || articleList.length == 0) {
        // this.ctx.service.article.updateArticleCacheList().catch(err => {
        //   ctx.logger.error('[indexPage] update article cache failed', err);
        // });
      }
      // console.log(domain.tname)
      if(domain.tname.indexOf('article_xiazai')==0||domain.tname.indexOf('npc_')==0){
        appList = await this.ctx.service.app.getappjsondata();
      } 
      result.articleList = articleList;
      result.appList = appList;
      result.articleCategoryList = [] // await ctx.service.cache.get('articleCategoryList')
    }
    // console.log(result.articleList)
    
    if (domain.siteType == 6) {
      let cachePageFilePath = this.ctx.app.config.cacheFile + 'video_l'
      try {
        let rowstext = await readTextFile(cachePageFilePath + '/index.json');
        if (!rowstext) throw new Error('video home cache not found')
        if (rowstext) {
          videoList = JSON.parse(rowstext)
        }
      } catch (e) {
        videoList = await this.ctx.service.cache.get('videoLList');
      }
    }
    //静态宝塔seo
    if (domain.siteType == 10){

    }
    

    // 如果是首页并且目录开启并且链接上有别的地址 而且不是 index.html
    let f_item = {
      keywords: '',
      title: '',
      description: ''
    }
    let fullDomainName = domain.fullDomain.replace(':', '##')//--------------------这里防止无限生成文件 暂时弃用
    let domainFileName = domain.link.replace(':', '##')
    let homePageFilePath = this.ctx.app.config.cacheFile + 'home/' + domainFileName
    // let isHaveHomeFile = fs.existsSync(homePageFilePath)
    let htmlname = '/index.html';
    let noQuerys = Object.keys(this.ctx.query).length == 0;
    let nowRrl = ctx.request.url;
    // console.log(nowRrl)
    if(nowRrl=='/index.html') nowRrl = '';
    if(nowRrl=='/index.htm') nowRrl = '';
    //----------------------这里和fan 保持一致
    const fanCategoryNum = Number(domain.fcid && domain.fcid.num) || 1;
    let fanIndex = fanCategoryNum + 10000
    let hostArr = domain.fullDomain.split('');
    let abdd = ['', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '.', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];//27
    hostArr.forEach((item) => {
      let nownum = abdd.findIndex(adbitem => adbitem === item)
      if (nownum != -1) {
        let nstr = nownum
        fanIndex += nstr
      }
    })
    if (domain.fullDomain != domain.link&&domain.fullDomain!='www.'+domain.link&&domain.isFan) {
      //-------------------------这里防止无限生成文件啊 需要把整个 fullDomainName 根据 fanNumber 生成一个数字
      let numName = fanIndex % fanCategoryNum
      htmlname = '/' + numName + '.html'
    }
    // console.log(domain.fcid.num)
    let homeCacheFilePath = homePageFilePath + htmlname
    // let isHaveIndexHtml = fs.existsSync(homeCacheFilePath)
    // 如果开启了缓存并且有缓存文件并且首页上没有参数直接返回
    
    const isDirectoryPath = nowRrl && nowRrl.length > 1;
    //泛站和目录同时开启 首页 /？abc=232 才会更换标题
    if (isDirectoryPath && domain.isMuLu && domain.isFan) {
      f_item = await ctx.service.utils.getMuluItemOne(fanIndex, domain.mcid)
      if (f_item.title) {
        domain.title = f_item.title;
        domain.description = f_item.description;
        domain.keyWords = f_item.keywords;
      }
    }
    if (domain.description) {
      domain.description = domain.description.replace(/\[域名\]|域名/g, domain.fullDomain)
      domain.description = domain.description.replace(/\[数字\]|数字/g, domain.imageNums)
      domain.description = domain.description.replace(/\[站名\]|站名/g, domain.beiAnName)
      domain.description = domain.description.replace(/\[关键字\]|关键字/g, domain.keyWords)
      domain.description = domain.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)

    }
    let refreshHomeCache = false;
    if (domain.iscache && domain.siteType !== 6) {
      let bodyHtml = null;
      try{
        const stats = await fs.promises.stat(homeCacheFilePath);
        const updateAllPageTime = new Date(ctx.app.config.common && ctx.app.config.common.UPDATE_ALLPAGE).getTime();
        // 覆盖写入会更新 mtime；birthtime 不会随缓存刷新而改变。
        refreshHomeCache = Date.now() - stats.mtimeMs > HOME_CACHE_MAX_AGE || stats.mtimeMs < updateAllPageTime;
        if (!refreshHomeCache) {
          bodyHtml = await readTextFile(homeCacheFilePath);
        }
      }catch{

      }

      // fanmulu_article5 旧缓存可能包含固定兜底 TDK，或缺少当前公共样式与公共组件。
      // 发现旧缓存后重新走模板渲染并覆盖缓存，使首页使用当前完整模板。
      if (
        homeTemplateName === 'fanmulu_article5' &&
        bodyHtml &&
        (
          bodyHtml.includes('<title>应用下载与使用指南</title>') ||
          bodyHtml.includes('content="发现实用应用，了解软件功能、平台兼容性与使用方法。"') ||
          !bodyHtml.includes('fanmulu-article5-common-v1')
        )
      ) {
        bodyHtml = null;
      }

      if(bodyHtml){
      // 首页缓存必须作为同一次模板渲染的完整结果原样返回，
      // 避免只替换 title/meta 而正文仍保留旧数据。
      // return this.ctx.body = bodyHtml
      // 导入文章
      if (domain.siteType == 4) {
        let aDom = ''
        let appDom = ''
        if (articleList && articleList.length > 0) {
          articleList.forEach((item) => {
            // let nowTitle = item.title
            // if(nowTitle){
            //   nowTitle = nowTitle.split().reverse();
            // }
          aDom += `<a href="/detail/${item._id}/index.html">
                        <div class="ln-info clearfix">
                            <div class="detailInfo">
                                <h1>${item.title}</h1>
                                <div class="info">
                                    <span class="time">时间: ${item.time}</span>
                                    <span class="view">浏览: ${item.view}</span>
                                    <span class="view">分类: 最新</span>
                                </div>
                            </div>
                        </div>
                    </a>`
          })
        }
        if (appList && appList.length > 0) {
          appList.forEach((item) => {
            // let nowTitle = item.title
            // if(nowTitle){
            //   nowTitle = nowTitle.split().reverse();
            // }
            // let imageccc = mnimageList[Math.floor(Math.random() * mnimageList.length)]
            appDom += `<li>
                      <a href="/apps/${item._id}/index.html" title="${item.title}">
                        <div class="fafccfjb icon" style="background-image: url(${domain.sfurl.staticUrl}/images/article/mn5/${item.view%8368}.jpg);"></div>
                        <h4 class="aijadgca name">${item.title}</h4>
                        <div class="ecdcdcdc view">详细</div>
                      </a>
                    </li>
                    `
          })
        }
        bodyHtml = bodyHtml.replace('<div id="dawenzhang"></div>', `<article class="articleBar" id="dawenzhang">${aDom}</article>`)
        .replace('<ul id="daapp"></ul>', `<ul class="articleBar" id="daapp">${appDom}</ul>`);
      }
      bodyHtml = bodyHtml.replace(/\[随机数字\]|随机数字/g, domain.randomNumber)
      .replace(/\[随机字母\]|随机字母/g, domain.randomClass)
      .replace(/\[日期时间\]|日期时间/g, moment().format('YYYY-MM-DD'));
      // 导入最新的视频 是百度seo 站点的时候
//       if (domain.siteType == 6 && domain.isBaiduType == 2) {
//         let aDom = ''
//         if (videoList && videoList.length > 0) {
//           videoList.forEach((item) => {
//             aDom += `
// <a class="hidden" href="/vdetail/${item._id}/index.html">
//     <div class="ln-info clearfix">
//         <div class="img-box">
//             <img src="${item.image}">
//         </div>
//         <div class="detailInfo">
//             <div class="info">
//                 <span class="time"><i class="icon iconfont">&#xe75b;</i> ${item.time}</span>
//                 <span class="view"><i class="icon iconfont">&#xe6fd;</i> ${item.view}</span>
//             </div>
//             <h1></h1>
//         </div>
//     </div>
// </a>
//             `
//           })
//         }
//         bodyHtml = bodyHtml.replace(`<div class="articleBar" id="listwrap">`, `<div class="articleBar" id="listwrap">${aDom}`).replace(/\[随机数字\]|随机数字/g, Date.now().toString().slice(7));
//       }

      // 导入泛
      if (domain.isFan == 1) {
        let aDom = ''
        let wordListFan = ["gov.cn.", "edu.cn.", "www.", "m.", "app.", "h5.", "wap."];
        for (let i = 0; i < 5; i++) {
          let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
          aDom += `<a href="http://${wordc}.${domain.link}">${wordc}</a>`
        }
        bodyHtml = bodyHtml.replace('<div id="dafanliebiao"></div>', `<div id="dafanliebiao">${aDom}</div>`);
      }
      // 导入目录
      if (domain.isMuLu) {
        let aDom = ''
        let wordListFan = ["a", "b", "n", "m", "a", "s", "d", "f", "g", "h", "j", "k", "l", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "ac", "ab", "dv", "er", "rt", "vg", "fd", "gf", "df", "se", "qs", "91", "df", "kj", "lk", "ui", "re", "er", "dc", "cs"];
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
        for (let i = 0; i < 10; i++) {
          let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
          let numberd = ctx.service.utils.randomNumber(1, 1, 10)
          aDom += `<a href="http://${domain.fullDomain}/${wordc}/${Date.now().toString().slice(6)}.html">${domain.beiAnName}${wordc}${nowDatec}</a>
<a href="http://${domain.fullDomain}/${wordc}/${numberd}.html">${domain.beiAnName}${wordc}${nowDatec}</a>
<a href="http://${domain.fullDomain}?article=${wordc}${numberd}.html">${domain.beiAnName}</a>
<a href="http://${domain.fullDomain}/gogogo?${wordc}=${wordc}${numberd}${numberd}">${domain.beiAnName}${wordc}${nowDatec}</a>
<a href="http://${domain.fullDomain}/ml/1/${ctx.service.utils.randomNumber(1, 1, 6)}.html">${domain.beiAnName}${wordc}${nowDatec}</a>
          `
        }

        bodyHtml = bodyHtml.replace('<div id="damululiebiao"></div>', `<div id="damululiebiao">${aDom}</div>`);
      }
      // 泛未开启的状态下可直接走缓存
      // if (domain.isFan == 0||domain.isFan == 2) {
      // }
      // 泛全开启半开启的情况下 因为缓存的标题和泛的标题不同(视频站点除外)
      // if (domain.isFan==0||domain.f_host=='www'||domain.f_host==''||domain.siteType==6)  {
      //   return this.ctx.body = bodyHtml
      // }else{
      //   return await this.ctx.render('/template/' + domain.tname + '/index.html', result)
      // }
      let strtitlebefore = bodyHtml.slice(bodyHtml.indexOf('<title>'), bodyHtml.indexOf('</title>') + 8);
      let strdescbefore = ''
      if(bodyHtml.indexOf('<meta name="share')>0){
        strdescbefore = bodyHtml.slice(bodyHtml.indexOf('<meta name="description"'), bodyHtml.indexOf('<meta name="share'));
      }
      let keydesc = `<meta name="description" content="${domain.description}">
      <meta name="keywords" content="${domain.keyWords}">
      `
      if (domain.isChangeTitle == 1) {
        // 这里换了标题需要把网页的状态码换成403
        // 不需要换状态码 仅跳转时候修改状态码
        // // ctx.status = 403
        bodyHtml = bodyHtml.replace(strtitlebefore, '<title>' + domain.beiAnName + '</title>')

      } else if (strtitlebefore !== '<title>' + domain.title + '</title>') {
        bodyHtml = bodyHtml.replace(strtitlebefore, '<title>' + domain.title + '</title>')
      }
      // console.log(iframeDom)
      if(iframeDom){
        bodyHtml = bodyHtml.replace('</head>','</head>'+iframeDom)
      }
      if(strdescbefore&&keydesc){
        bodyHtml = bodyHtml.replace(strdescbefore, keydesc)
      }
      
     
      return this.ctx.body = bodyHtml
      } 
   }
    
    // 首页过期时绕过列表 JSON，使用数据库中的最新数据重新渲染。
    if (refreshHomeCache && currentSiteType === 4) {
      result.articleList = await ctx.model.Article.find().sort({ _id: -1 }).limit(24)
        .select('title image cid description createdAt articleCategory time view');
      if (homeTemplateName.indexOf('article_xiazai') === 0 || homeTemplateName.indexOf('npc_') === 0) {
        result.appList = await ctx.model.App.find().sort({ _id: -1 }).limit(24)
          .select('title time status themeColor sort image isProxy isH isN isT logo h5logo app h5 description keywords view createdAt');
      }
    }

    // if (!isHaveHomeFile&&domain.iscache) {
    //   // 如果没有缓存目录就创建一个缓存域名文件夹
    //   let cacheFcile = process.cwd() + '/cache/home'
    //   if(!fs.existsSync(cacheFcile)){
    //     fs.mkdirSync(cacheFcile);
    //   }
    //   fs.mkdirSync(homePageFilePath);
    // }
    //百度换标题的操作 简称人蛛互换或者人机互换
    if (domain.isChangeTitle == 1) {
      // ctx.status = 403
      domain.title = domain.beiAnName;
    }
    // 站点分类
    // 站点是seo 导航站
    if (domain.siteType == 5){
      // 查询当前域名最新100条域名
      //从 /public/json/seonav.json 缓存导航文件里面获取

      let textJson = '';
      let textJsonResult = '';

      let isError = false;
      try {
        if (refreshHomeCache) {
          textJsonResult = await ctx.model.Domain.find({ status: 1 }).sort({ _id: -1 }).limit(30)
            .select('link title titleText beiAnName themeColor');
        } else {
          textJson = await readTextFile(process.cwd() + '/app/public/json/seonav.json');
          if (!textJson) throw new Error('seonav cache not found')
          try{
            textJsonResult = JSON.parse(textJson)
          }catch{
            isError = true
          }
        }
      } catch (e) {
        // 生成一个
        if (refreshHomeCache) throw e;
        ctx.service.domain.domainJSONListCerate();
      }
      if(textJsonResult&&textJsonResult.length>0){
        result.hotNavList = textJsonResult
        result.topNavList = textJsonResult
        result.homeNavCategory = textJsonResult
      }
    }

    // 站点类型是6---------------------------视频站
    if (domain.siteType == 6) {
      // console.log(domain.siteType)
      // 禁止海外ip
      let list_name = ctx.url
      if (list_name) {
        list_name = list_name.replace(/\?|\/|\||\*|\"|\'|\<|\>/g, '##')
        list_name = list_name.slice(list_name.indexOf('e='), list_name.indexOf('&o'))
      }
      let res = []
      let isHaveList = false;
      // let isHaveCacheFilePath = false;
      let cachePageFilePath = this.ctx.app.config.cacheFile + 'video_list/';
      const listIdMatch = String(list_name || '').match(/[a-fA-F0-9]{24}/);
      const listHash = listIdMatch ? hashId(listIdMatch[0]) : '';
      const listCacheDir = listHash ? cachePageFilePath + listHash.slice(0, 2) + '/' + listHash.slice(2, 4) + '/' : cachePageFilePath;
      let filePath = listCacheDir + list_name + '.json'
      if (list_name && list_name.length < 500) {
        //从缓存视频列表里面获取
        // isHaveCacheFilePath = fs.existsSync(this.ctx.app.config.cacheFile + 'video_list');
        try {
          let text = await readTextFile(filePath);
          if (!text) throw new Error('video list cache not found')
          let datac = JSON.parse(text);
          res = datac.rows;
          let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
          if (chaTime >= 86400000 || chaTime < 0) {
            isHaveList = false
          } else {
            isHaveList = true
          }
        } catch (e) {
        }
      }
      if (!isHaveList) {
        res = await ctx.service.video.videoList({ nowPage, spage, epage, offset, limit: 48 })
        if (res) {
            let savelist = {
              updateCacheTime: Date.now(),
              rows: res
            }
            await fs.promises.mkdir(listCacheDir, { recursive: true });
            writeTextFile(filePath, JSON.stringify(savelist));
        }
      }
      // console.log(res)
      result = { ...result, ...res }
      result.videoCategoryList = await this.ctx.service.cache.get('video-category-all');
      // console.log(result.videoCategoryList)

      if (!result.videoCategoryList || result.videoCategoryList.length == 0) {
        //更新一下视频分类
        result.videoCategoryList = await this.ctx.model.VideoCategory.find({ status: 1,num:{$gt:0} }).sort({ createdAt: -1 }).limit(40);
        let categorys = result.videoCategoryList.filter(item => item.num > 0)
        await this.ctx.service.cache.set('video-category-all', categorys)
      }
      result.todatUpdate = await this.ctx.service.video.getTodayCountVideo();
    }
    // 站点类型是 7 的话就是静态页面 
    // if (domain.siteType == 7) {

    // }

    // 站点类型是8导航站
    // console.log(domain.siteType)

    if (domain.siteType == 8) {
      // 查询分类 关联出分类里面的导航
      //先判断ncids 如果有就根据ncids获取 如果没有就 直接获取
      let ncidsList;
      if (refreshHomeCache) {
        const criteria = { status: 1, num: { $gt: 0 } };
        if (domain.navcids && domain.navcids.length > 0) criteria._id = { $in: domain.navcids };
        ncidsList = await ctx.model.NavCategory.find(criteria).sort({ isHot: -1, sort: -1, num: -1 }).limit(64)
          .populate({ path: 'details', options: { limit: 24 }, select: 'title themeColor description view link isN logo h5logo h5 app isH isT' })
          .populate({ path: 'childrens', select: 'name', options: { limit: 12 } });
      } else {
        ncidsList = await this.service.nav.getNavCagegoryNavList(domain.navcids);
      }

      // console.log(typeof ncidsList)
      // let [ncidsList] = await Promise.all([
      //   await this.ctx.model.NavCategory.find({ _id: { $in: ncids }, status: 1 }).sort({ 'isHot': -1, 'sort': -1, '_id': -1 }).populate({ path: 'details', select: 'title themeColor description view link isN logo h5logo h5 app isH isT' })
      //     .populate({ path: 'childrens', select: 'name' })
      // ])
      // result.articleList = await ctx.service.cache.get('articleList');
      result.navCategoryList = domain.navcids;
      result.cateNavList = ncidsList;
      // 过滤出 热门的分类 和 热门的导航
      if(ncidsList&&ncidsList.length>0){
        result.hotCateNavList = ncidsList.filter(item => item.isHot);
      }
      // 获取当天点击最多的
      // 全部的导航
      let navAllList = [];
      ncidsList.forEach((item, index) => {
        if (item && item.details.length > 0) {
          item.details.forEach((itemc) => {
            navAllList.push(itemc)
          })
        }
      })
      result.hotNavList = navAllList.filter(item => item.isH)
      result.topNavList = navAllList.filter(item => item.isT)
      result.homeNavCategory = []
    }

    // 站点类型是9单页导航站
    if (domain.siteType == 9) {
      let ncids = domain.cids.map(item => item._id);
      // 通过分类把导航里面的全部查询出来
      let navList = {}
      if (domain.cids.length > 0) {
        navList = await ctx.service.nav.navList({ status: 1, limit: 1000, ncids, sort: { 'isHot': -1, 'isTop': -1, 'sort': -1 } });
      }
      let navAllList = []
      if (navList && navList.data) {
        navAllList = navList.data.data;
      }
      let homeNavCategory = domain.cids.map(item => {
        return { ...item, details: [] }
      });
      navAllList.forEach((item) => {
        homeNavCategory.forEach(itemc => {
          item.ncids.forEach(itemcb => {
            if (itemcb._id == itemc._id) {
              itemc.details.push(item)
            }
          })
        })
      })
      result.hotNavList = navAllList.filter(item => item.isH)
      result.topNavList = navAllList.filter(item => item.isT)
      result.cateNavList = homeNavCategory
    }

    // siteType=11 使用独立 movie_01 首页，不进入原有文章/视频首页逻辑
    if (currentSiteType === 12) {
      const missData = await ctx.service.missPage.homeData();
      Object.assign(result, missData);
      result.missSiteType = 12;
    }
    if (currentSiteType === 11) {
      const movieData = await ctx.service.movie.homeData();
      Object.assign(result, movieData);
      result.movieSiteType = 11;
    }

    let h5Path = ''
    // 如果 host = m 并且目录文件存在m 文件夹
    // console.log(domain.fullDomain)
    if (domain.fullDomain.indexOf('m.') == 0||domain.fullDomain.indexOf('h5.') == 0||domain.fullDomain.indexOf('app.') == 0) {
      let h5FilePath = process.cwd() + '/app/view/template/' + homeTemplateName + '/m/index.html'
      let isH5FilePath = await fileExists(h5FilePath)
      if (isH5FilePath) {
        h5Path = '/m'
      }
    }
    // // 先判断模板里面有没有文件 如果没有文件直接返回 /sbb02.html
    // if(!fs.existsSync(process.cwd()+'/template/' + domain.tname + h5Path + '/index.html')){
    //   this.ctx.status = 201
    //   return this.ctx.render('/jump.html');
    // }
    // 默认网站是响应式的，如果页面是静态页面 ---针对部分落地页 目前有yabo01  ldy_ayx02
    const saveHomeCache = async () => {
      if (domain.iscache && noQuerys) {
        try {
          await fs.promises.mkdir(homePageFilePath, { recursive: true });
          await fs.promises.writeFile(homeCacheFilePath, this.ctx.body, 'utf-8');
        } catch (err) {
          ctx.logger.warn('[indexPage] 写入首页缓存失败', err);
        }
      }
    };
    if (domain.isStaticPage == 1) {
      // 判断 h5
      return await this.ctx.render('/template/' + homeTemplateName + h5Path + '/index.html', result).then(async () => {
        if (refreshHomeCache) await saveHomeCache();
      }).catch(() => {
        return this.ctx.render('error.html');
      });
    }
    await this.ctx.render('/template/' + homeTemplateName + h5Path + '/index.html', result).then(async (res) => {
      // console.log(isHaveIndexHtml)
      // 如果缓存文件没有并且首页没有参数 并且host 是 空或者www 创建一个/home/domain.link 缓存前先压缩空格
      // 能加载到这里说明 缓存文件没有拿到
      await saveHomeCache();
      //判断没有logo 生成一个logo
      // let logoImage = process.cwd()+'/app/public/' + domain.link+'.png'
      // let isLogoImage = await fileExists(logoImage)
      // let namec = domain.link
      // if(!isLogoImage){
      //   this.ctx.service.image.createLogoImage(domain.beiAnName,domain.link,domain.themeColor)
      // }

    }).catch((err) => {
      console.log('模板找不到！！！')
      // console.log(err)
      return this.ctx.render('404.html');
    });
  }
  async detail() {
    // 当请求页面过来之后先进行验证域名

    const { ctx } = this;
    let { site, domain } = await ctx.service.utils.getSiteInfo();
    // 如果非蜘蛛并且移动端直接跳转
    if (!domain) return;
    let referer = ctx.request.header['referer'];
    // 针对搜狗开启301
    // let urlh5Agent = domain.agentLink.openUrlH5.replace(/##/g, '');
    // let gaDOm = ''
    // if (domain.agentLink.gajs) gaDOm = domain.agentLink.gajs;
    // if (domain.is301) return ctx.body = `
    // ${gaDOm}
    // <script language="javascript">  window.location= "${urlh5Agent}"; </script>
    // `

    // 如果未开启pc端直接返回并且是pc端 并且非强制跳转 并且是是视频站点
    if (domain.ispcpage==0 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
      ctx.status = 403  //500
      ctx.body='';
      return;
    }
// console.log(domain.browserType)
    // 如果是首页无内页百度的话直接444-baidu01  内页访问--百度蜘蛛正常，用户访问状态502 广告页面
    if((domain.browserType == 'baidu01'||domain.browserType == 'baidu02')&&!domain.isBaiduSpider){
      ctx.status = 201;
      if(domain.openUrlStatusCode>0){ctx.status = domain.openUrlStatusCode}
      let tdk = await ctx.service.utils.getMuluItemOne(Date.now(),domain.mcid)
        if(tdk&&tdk.title){
          tdk.description = tdk.description.replace(/\[域名\]|域名/g, ctx.header.host +ctx.url)
          tdk.description = tdk.description.replace(/\[数字\]|数字/g, domain.urlNumber)
          tdk.description = tdk.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
          tdk.description = tdk.description.replace(/\[关键字\]|关键字/g, tdk.keywords)
          tdk.description = tdk.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          tdk.description = tdk.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
          tdk.description = tdk.description.replace(/\[关键字\]|关键字/g, tdk.keywords)
          tdk.title = tdk.title.replace(/\[域名\]|域名/g, ctx.header.host +ctx.url)
          tdk.title = tdk.title.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
          tdk.title = tdk.title.replace(/\[数字\]|数字/g, domain.urlNumber)
          tdk.title = tdk.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          tdk.title = tdk.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
        }
        //这里应该是跳转
        if ((domain.agentLink.isAgentPage&&domain.fromNum!=300)||domain.fromNum==200) {
            let agentPageName = '/app/public/html/'+domain.agentLink.agentPageName + '.html';
            let agentPageFilePath = process.cwd() + agentPageName
            // let isHaveagentFile = fs.existsSync(agentPageFilePath)
            // if(isHaveagentFile){
            let text = ''
            try{
                text = fs.readFileSync(agentPageFilePath, 'utf-8');
            }catch{

            }
            if(text){
                text = text.replace('</body>',`${domain.agentLink.gajs}</body>`)
                .replace('<title>',`<title>${tdk.title}`)
                .replace(`content="description"`,`content="${tdk.description}"`)
                .replace('HDESC',tdk.keywords)
                .replace('SEODESCRIPTION',tdk.description)
                return this.ctx.body = text
            }
        }
        ctx.body = `<!DOCTYPE html><html lang='en'><head><meta name="robots" content="noindex,nofollow"><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no'><meta name='robots' content='noindex'><title>${tdk.title}</title><meta name="description" content="${tdk.description}"></head><body></body>${domain.jumpIFrameHTML}</html>`
        return;
    }
    // if(domain.browserType == 'baidu02'&&!domain.isBaiduSpider&&!domain.spider){
    //   //如果非蜘蛛和有reffer 并且是百度跳转
    //   if(referer&&referer.indexOf('baidu.com')>0&&domain.isMobile){
    //     ctx.status = 201;
    //     //这里应该是跳转
    //     ctx.body = `<!DOCTYPE html><html lang='en'><head><meta name="robots" content="noindex,nofollow"><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no'><meta name='robots' content='noindex'><title>@</title></head><body></body>${domain.jumpIFrameHTML}</html>`
    //     return;
    //   }
    //   ctx.status = 444; 
    //   ctx.body = null;
    //   return;
    // }
    // 如果是开启强制跳转 isOpenUrl = 3或者百度来路 并且不是蜘蛛 并且目录开启
    //--------这里判断是否为https 站点 （强制不跳转下）
    if(domain.isHttps&&!ctx.secure&&ctx.protocol=="http"&&domain.isOpenUrl<0){
      ctx.status = 301;
      ctx.redirect('https://'+domain.fullDomain+ctx.url);
    }
    // 详情页面没有 id 或者id不是数字
    let article_id = ctx.params.id.replace(/.html/g, '')
    let isobjectId = /^[a-fA-F0-9]{24}$/.test(article_id)
    if (!article_id || !isobjectId) {
      return this.ctx.service.utils.allPage();
    }
    let result = {}
    let cachePageFilePath = this.ctx.app.config.cacheFile + 'article/'
    let articleHash = hashId(article_id)
    let articleCacheFilePath = cachePageFilePath + articleHash.slice(0, 2) + '/' + articleHash.slice(2, 4) + '/' + article_id + '.json'
    result = await readJsonFile(articleCacheFilePath) || {}
    if (result.detail) {
      result = await hydrateOldArticleDetailResult(result, { ctx, site, domain })
    }
    let f_item = null;
    let nowJump = false;
    if (!result || !result.detail) {
      const buildArticle = await ctx.model.Article
        .findById(article_id)
        .select('title description keywords keyWords content content2 html block image cid articleCategory tag isTop createdAt createdText updatedAt view time id isOpenUrl openUrlLink jumpHTML nowName prevName nextName status')
        .lean()
      if (!buildArticle || !buildArticle._id) {
        if (domain.isMuLu) {
          return await ctx.service.utils.allPage()
        } else {
          ctx.status = 404;
          return ctx.render('404.html');
        }
      }

      const detailList = await ctx.model.Article.find({
        _id: { "$lt": buildArticle._id }
      }).sort({ "_id": -1 }).skip(0).limit(12)
        .select('tag articleCategory title image isTop description createdAt view time keywords id')
        .lean()

      result = {
        detail: buildArticle,
        articleList: detailList,
      }

      try {
        await fs.promises.mkdir(path.dirname(articleCacheFilePath), { recursive: true })
        await fs.promises.writeFile(articleCacheFilePath, JSON.stringify(result), 'utf-8')
      } catch (err) {
        ctx.logger.warn(`[articleDetail] 写入缓存失败，articleId=${article_id}`, err)
      }

      result = await hydrateOldArticleDetailResult(result, { ctx, site, domain })
    } else {
      // 导入泛
      if (domain.isFan == 1) {
        let aDom = ''
        let wordListFan = ["ww.", "w.", "www.", "m.", "app.", "h5.", "wap."];
        for (let i = 0; i < 5; i++) {
          let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
          aDom += `<a href="http://${wordc}.${domain.link}">${domain.beiAnName}${wordc}</a>`
        }
        aDom = '<div class="add-daorufan">' + aDom + '</div>'
        result.detail.content = result.detail.content + aDom;
      }
      // 导入目录
      if (domain.isMuLu) {
        let aDom = ''
        let wordListFan = ["a", "b", "n", "m", "a", "s", "d", "f", "g", "h", "j", "k", "l", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "ac", "ab", "dv", "er", "rt", "vg", "fd", "gf", "df", "se", "qs", "91", "df", "kj", "lk", "ui", "re", "er", "dc", "cs"];
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
        for (let i = 0; i < 3; i++) {
          let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
          let numberd = ctx.service.utils.randomNumber(1, 1, 10)
          aDom += `<a href="http://${domain.fullDomain}/${wordc}/${Date.now().toString().slice(6)}.html">${domain.beiAnName}【${wordc}】</a>
                  <a href="http://${domain.fullDomain}/${wordc}/${numberd}.html">${domain.beiAnName}【${wordc}】</a>
                  <a href="http://${domain.fullDomain}/ml/1/${ctx.service.utils.randomNumber(1, 1, 6)}.html">${domain.beiAnName}【${wordc}】</a>
          `
        }
        aDom = '<div class="add-daorumulu">' + aDom + '</div>'
        result.detail.content = result.detail.content + aDom;
        let mtdk = {}
        let muluindex = ctx.service.utils.strToNumber(domain.fullDomain+ctx.url);
        mtdk = await ctx.service.utils.getMuluItemOne(muluindex,domain.mcid)
        
        if(mtdk&&mtdk.title){
          mtdk.description = mtdk.description.replace(/\[域名\]|域名/g, ctx.header.host +ctx.url)
          mtdk.description = mtdk.description.replace(/\[数字\]|数字/g, domain.urlNumber)
          mtdk.description = mtdk.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          mtdk.description = mtdk.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
          mtdk.description = mtdk.description.replace(/\[关键字\]|关键字/g, mtdk.keywords)
          mtdk.description = mtdk.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)



          mtdk.title = mtdk.title.replace(/\[域名\]|域名/g, ctx.header.host +ctx.url)
          mtdk.title = mtdk.title.replace(/\[数字\]|数字/g, domain.urlNumber)
          mtdk.title = mtdk.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          mtdk.title = mtdk.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
          mtdk.title = mtdk.title.replace(/\[版本号\]|版本号/g, domain.banBenNumber)


          result.mtdk = mtdk;
        }
      }
      if(domain.titleType==1){
        result.detail.title = domain.fullDomain+ctx.url
      }
    }
    //导入最新的文章
      result.newArticleList = [];
      let newArticleList = [];
      let cachePageFilePathK = this.ctx.app.config.cacheFile + 'article_list'
      let articleRdmNum = ['/index.json', '/index1.json', '/index2.json', '/index3.json', '/index4.json', '/index5.json', '/index6.json', '/index7.json', '/index8.json', '/index9.json']
      let articleRdmName = articleRdmNum[Math.floor(Math.random() * articleRdmNum.length)]
      try {
        let rowstext = fs.readFileSync(cachePageFilePathK + articleRdmName, 'utf-8');
        if (rowstext) {
            newArticleList = JSON.parse(rowstext)
        }
      } catch (e) {
      }
      result.newArticleList = newArticleList;
      // console.log(11)
     // console.log(Math.floor(Math.random() * articleRdmNum.length))
    // 如果页面非蜘蛛并且是pc端并且是跳转下载页面
    // if(!domain.spider&&!domain.isMobile&&result.detail.isOpenUrl>0&&domain.isOpenUrl!=3){
    //   return ctx.render('404a.html',{detail:result.detail,domain:domain});
    // }
    // if(!domain.spider && result.detail.isOpenUrl>0){
    //   result.detail.title = result.detail.time+result.detail._id+'-'+result.detail.view;
    // }
    //采取直接跳转方式
    if (!domain.spider && domain.isOpenUrl > -1&&domain.isMobile) {
      if (result.detail.isOpenUrl >= 1) {
        nowJump = true
      }
    }
    if (result.detail.description && result.detail.title) {
      result.detail.title = result.detail.title.replace(/\[域名\]|域名/g, domain.fullDomain)
      result.detail.title = result.detail.title.replace(/\[数字\]|数字/g, domain.urlNumber)
      result.detail.title = result.detail.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
      result.detail.title = result.detail.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
      result.detail.title = result.detail.title.replace(/\[版本号\]|版本号/g, domain.banBenNumber)


      result.detail.description = result.detail.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
      result.detail.description = result.detail.description.replace(/\[关键字\]|关键字/g, domain.keyWords)
      result.detail.description = result.detail.description.replace(/\[域名\]|域名/g, domain.fullDomain)
      result.detail.description = result.detail.description.replace(/\[数字\]|数字/g, domain.urlNumber)
      result.detail.description = result.detail.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
      result.detail.description = result.detail.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
    }
    if (nowJump&&domain.agentLink.isAgentPage) {
      let agentPageName = '/app/public/html/'+domain.agentLink.agentPageName + '.html';
      let agentPageFilePath = process.cwd() + agentPageName
      // let isHaveagentFile = fs.existsSync(agentPageFilePath)
      // if(isHaveagentFile){
      let text = fs.readFileSync(agentPageFilePath, 'utf-8');
      let gaDOm = domain.agentLink.gajs;
      if(text){
        text = text.replace('</body>',`${gaDOm}</body>`)
        .replace('<title>',`<title>${result.detail.title}`)
        .replace(`content="description"`,`content="${result.detail.description}"`)
        .replace('HDESC',result.detail.keywords)
        .replace('SEODESCRIPTION',result.detail.description)
        this.ctx.status = 201;
        if(domain.openUrlStatusCode>0){ctx.status = domain.openUrlStatusCode}
        return this.ctx.body = text
      }
    }
    // 这里开始判断跳转 
    // isOpenUrl: { type: Number, default: 0 },//是否跳转 0 不跳转 1显示下载按钮不跳转 2直接跳转 3引擎跳转 4自动三次引擎来路跳转 5仅手机端直接跳 6手机端引擎跳 7显示下载按钮直接跳转
    // fromNum: { type: Number, default: 0 },
    // if ((domain.isOpenUrl == 3 || referer) && !domain.spider && domain.isMuLu&&domain.isOpenUrl!=-1) {
      result.detail.nowJump = nowJump;
      result.detail.jumpHTML = ''
      //跳转方式如果是有缓存开启就用
      if(!domain.spider&&domain.isMobile){
        let IOSUrl = '/html/sbb02.html'+'?v='+Date.now();        
        let URL = '/html/sbb02.html'+'?v='+Date.now();
        let agentPageName = 'sbb02.html'+'?v='+Date.now();

        if(domain.agentLink&&domain.agentLink.openUrlIOS){
          IOSUrl = domain.agentLink.openUrlIOS.replace(/##/g,'')
          URL = IOSUrl+'?v='+Date.now();
          agentPageName = domain.agentLink.agentPageName + '.html'+'?v='+Date.now();
        }
        let agentPageFilePath = process.cwd() + '/app/public/html/'+ agentPageName;
        let isHaveagentFile = fs.existsSync(agentPageFilePath)
        // 如果开启了缓存并且有缓存文件直接返回
        if (isHaveagentFile) {
          URL =  agentPageName
        }
        result.detail.jumpHTML = `
          <script>
            var jumpLinkIframe = function(url){
            var URL = url
            var notSpider = !/(bot|spider|Spider)/i.test(navigator.userAgent);
            var createIframe = function (id, url, width, height) {
                  if (!url || (url.indexOf('http') == -1&&url.indexOf('.html') == -1)) return null;
                  var html = document.querySelector('html');
                  html.style.height = '100%';
                  var iframe = document.createElement("iframe");
                  iframe.id = id;
                  iframe.style.position = 'fixed';
                  iframe.width = width;
                  iframe.height = height;
                  iframe.style.top = '0';
                  iframe.style['z-index'] = 10000;
                  iframe.style['left'] = 0;
                  iframe.style['background'] = '#ffffff';
                  iframe.style['overflow'] = 'auto';
                  iframe.src = url;
                  iframe.setAttribute('frameborder', '0');
                  document.body.parentNode.insertBefore(iframe,document.body);
            };
                createIframe('global-iframe', URL, '100%', '100%');
            }
            jumpLinkIframe("${URL}")
          </script>
          ${domain.agentLink.gajs}
        `

        if(domain.isOpenUrl<=0&&!referer&&!domain.isMuLu){
          result.detail.jumpHTML = '';
        }
        if(result.detail.isOpenUrl <= 0&&!referer){
          result.detail.jumpHTML = '';
        }
        if(!nowJump){
          result.detail.jumpHTML = '';
        }
        // console.log(result.detail.jumpHTML)
    }
    //如果是蜘蛛 并且开启目录 并且强制跳转开启 这里更换文章标题 
    // if (domain.isMuLu && domain.spider && domain.fromNum >= 3 && domain.isOpenUrl == 3) {
    //   let hostArr = (ctx.header.host + ctx.url).split('');
    //   let abdd = ['', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '.', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];//27
    //   let fanIndex = ''
    //   hostArr.forEach((item) => {
    //     let nownum = abdd.findIndex(adbitem => adbitem === item)
    //     if (nownum != -1) {
    //       let nstr = nownum.toString()
    //       fanIndex += nstr
    //     }
    //   })
    //   let fanNum = 0
    //   if (domain.fcid && domain.fcid.num) {
    //     fanNum = domain.fcid.num
    //   };
    //   if (fanNum > 0) {
    //     let indexB = fanIndex % fanNum;
    //     //先去缓存fan文件里面查找泛的 分类id-泛索引indexB 命名的json 文件
    //     let fanFileName = domain.fcid._id + '-' + indexB
    //     let FanPageFilePath = this.ctx.app.config.cacheFile + 'fan/' + fanFileName
    //     let isHaveIndexHtml = fs.existsSync(FanPageFilePath + '.json')
    //     if (isHaveIndexHtml) {
    //       let f_item_text = fs.readFileSync(FanPageFilePath + '.json', 'utf-8');
    //       if (f_item_text) {
    //         f_item = JSON.parse(f_item_text)
    //       }
    //     } else {
    //       f_item = await ctx.model.Fan.findOne({
    //         index: indexB,
    //         fcid: domain.fcid._id
    //       })
    //       if (f_item) {
    //         fs.writeFile(FanPageFilePath + '.json', JSON.stringify(f_item), null, function (err) { });
    //       }
    //     }
    //   }
    //   // 符合泛站域名的条件
    //   // if (f_item && f_item.title) {
    //   //   article.title = f_item.title
    //   //   article.keyWords = f_item.keywords
    //   //   article.description = f_item.description
    //   // }
    //   // 判断是否转码 如果开启了转码
    //   if (domain.tdkEncode) {
    //     article.title = myencodeFn(article.title)
    //     article.description = myencodeFn(article.description)
    //     article.keywords = myencodeFn(article.keywords)
    //   }
    //   if (f_item && f_item.title && f_item.title.length > 0) {
    //     result.detail = article
    //   }
    // }
    

    let imageNums = 5000
    article_id.split('').forEach((item) => {
      imageNums += item.charCodeAt()
    })
    result.imageNums = imageNums % (2300 - 16);
    // 详情页面找不到l
    // if (!result.nowCategory || !result.detail) return await ctx.render('notfind.html', result);
    
    // 判断文件详情页面是否存在
    let detailTemplatePath = process.cwd() + `/app/view/template/${domain.tname}/detail.html`
    const renderName = resolveTemplate(
      `${domain.tname}:detail.html`,
      detailTemplatePath,
      `template/${domain.tname}/detail.html`,
      'template/components/detail.html'
    );
    await ctx.render(renderName, result).catch(() => {
      return this.ctx.render('error.html');
    });
  }
  async other() {
    //当请求页面过来之后先进行验证域名
    const { ctx } = this;
    let { domain } = await ctx.service.utils.getSiteInfo();
    const result = { domain };
    const file = this.config.baseDir + `/app/view/template/${domain.tname}/other/${ctx.params.name}.html`;
    // 检查文件是否存在于当前目录中。 
    try {
      if (!templateExists(`template:${domain.tname}:other:${ctx.params.name}.html`, file)) {
        throw new Error('template not found');
      }
      let name = ctx.params.name
      await ctx.render(`template/${domain.tname}/other/${name}.html`, result);
    } catch (error) {
      if (domain.isMuLu) {
        await ctx.service.utils.allPage()
      } else {
        await ctx.render('error.html');
      }
    }
  }
  async articleList() {
    // 文章分类 当请求页面过来之后先进行验证域名
    const { ctx } = this;
    let cate_id = ctx.params.id
    let isobjectId = /^[a-fA-F0-9]{24}$/.test(cate_id)
    if (!cate_id || !isobjectId) {
      return ctx.render('/404.html');
    }
    let { domain } = await ctx.service.utils.getSiteInfo();
    let result = {}
    result.domain = domain
    let rows = await ctx.model.Article.find({ cid: cate_id }).sort({ "_id": -1 }).skip(0).limit(10).select('tag articleCategory title image description createdAt view time')
    // let articleCategoryList = await ctx.model.ArticleCategory.find({ siteType: 4, status: 1 }).skip(0).limit(60).select('name num id image')
    result.articleList = rows
    // result.articleCategoryList = articleCategoryList
    result.nowcateid = cate_id
    // result.nowcatename = articleCategoryList.find(item => cate_id == item.id)
    await ctx.render(`template/${domain.tname}/category.html`, result).catch(() => {
      return this.ctx.render('error.html');
    });
  }
  async articleCategoryList() {
    const { ctx } = this;
    // 先获取站点 id 的
    // let linkText = ctx.request.header.host.toLowerCase();
    // let siteInfo = await ctx.service.domain.findDomain(linkText);
    let { site, domain } = await ctx.service.utils.getSiteInfo();
    let articleCategoryList = await ctx.service.article.articleCategoryList({ articleSiteId: site.id, domain })
    const result = { articleCategoryList, userConfig: ctx.app.config.MY_USER_CONFIG };
    await this.ctx.render('articleCategoryList', result);
  }
  async upload() {
    await this.ctx.render('upload');
  }
  async domain() {
    const { ctx } = this;
    let nowPage = ctx.query.page || 1
    let offset = nowPage * 50 - 50
    let allDomainList = await ctx.service.domain.domainList({
      offset
    });
    if (!allDomainList) allDomainList = []
    const result = {
      allDomainList: allDomainList.data
    }
    await ctx.render('domain.html', result);
  }

  async indexPageCache() {
    // 删除缓存的域名文件夹
    const { ctx } = this;
    let { domain } = await ctx.service.utils.getSiteInfo();
    if(!domain||!domain.link) return this.ctx.body = '';
    if (domain.siteType == 6 && ctx.query.type == '1') {
      // 如果是视频站点 //刷新视频总数
      // ctx.service.video.videoUpdateAll();
    } else {
      let link = domain.link;
      let domainFileName = link.replace(':', '##')
      let homePageFilePath = this.ctx.app.config.cacheFile + 'home/' + domainFileName
      let isHaveHomeFile = fs.existsSync(homePageFilePath)
      if (isHaveHomeFile) {
        ctx.service.utils.delDir(homePageFilePath)
      }
    }
    // ctx.service.video.videoUpdateAll();
    // ctx.service.article.updateArticleCacheList();
    this.ctx.body = '<div>刷新成功！</div><div><a href="/"><h1>返回首页</h1></a></div>'
  }
};
