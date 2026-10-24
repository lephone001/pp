'usestrict';
const egg = require('egg');
const fs = require('fs');
const { resolveTemplate } = require('../../utils/templateExistsCache');
var moment = require('moment')
moment.locale('zh-CN');
const axios = require('axios')
const iconv = require('iconv-lite');
iconv.skipDecodeWarning = true;
const punycode = require('punycode');
// const mnimageList = require('./imglist')
const myencodeFn = function (str) {
  if (!str) return str;
  let unicodeList = punycode.ucs2.decode(str)
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
module.exports = class AppController extends egg.Controller {
    async apps() {
        // 当请求页面过来之后先进行验证域名
        const { ctx } = this;
        let { site, domain } = await ctx.service.utils.getSiteInfo();
        // 如果非蜘蛛并且移动端直接跳转
        if (!domain) return;
        // 如果未开启pc端直接返回并且是pc端 并且非强制跳转 并且是是视频站点
        if (domain.ispcpage==0 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
          ctx.status = 403  // 500
          ctx.body='';
          return;
        }
        let referer = ctx.request.header['referer'];
         // 如果是首页无内页百度的话直接444-baidu01  内页访问--百度蜘蛛正常，用户访问状态502 广告页面
        if(domain.browserType == 'baidu01'&&!domain.isBaiduSpider){
          ctx.status = 201;
          let tdk = await ctx.service.utils.getMuluItemOne(Date.now(),domain.mcid)
          if(tdk&&tdk.title){
            tdk.description = tdk.description.replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
            tdk.description = tdk.description.replace(/\[数字\]|数字/g, domain.urlNumber)
            tdk.description = tdk.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
            tdk.description = tdk.description.replace(/\[关键字\]|关键字/g, tdk.keywords)
            tdk.description = tdk.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
            tdk.description = tdk.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
            tdk.description = tdk.description.replace(/\[关键字\]|关键字/g, tdk.keywords)
            tdk.title = tdk.title.replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
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
        // 针对搜狗开启301
        // let urlh5Agent = domain.agentLink.openUrlH5.replace(/##/g, '');
        // let gaDOm = ''
        // if (domain.agentLink.gajs) gaDOm = domain.agentLink.gajs;
        // if (domain.is301) return ctx.body = `
        // ${gaDOm}
        // <script language="javascript">  window.location= "${urlh5Agent}"; </script>
        // `
        // 如果是开启强制跳转 isOpenUrl = 3或者百度来路 并且不是蜘蛛 并且目录开启
    
        // 详情页面没有 id 或者id不是数字
        let app_id = ctx.params.id.replace(/.html/g, '')
        let isobjectId = /^[a-fA-F0-9]{24}$/.test(app_id)
        if (!app_id || !isobjectId) {
          return this.ctx.service.utils.allPage();
        }
        let result = {}
        let isError = false;
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'app/'
        let isHaveAppCache = false
        try {
          let text = fs.readFileSync(cachePageFilePath + '/' + app_id + '.json', 'utf-8');
          try{
            result = JSON.parse(text)
            isHaveAppCache = true
          }catch{
            isError = true
          }
        } catch (e) {
          if (!cachePageFilePath) {
          // 如果没有缓存目录就创建一个缓存域名文件夹
            fs.mkdirSync(cachePageFilePath);
          }
        }
        result.domain = domain
        let app = {}
        let f_item = null;
        let nowJump = false;
        if (!result || !result.detail) {
          // 文章详情
          app = await ctx.model.App.findById(app_id)
          if (!app || !app._id) {
            if (domain.isMuLu) {
              return await ctx.service.utils.allPage()
            } else {
              ctx.status = 404;
              return ctx.render('404.html');
            }
          }
         
         
          // 如果是蜘蛛 找到对应的fan 修改标题关键词描述
          // 站点文章分类
          let appCategoryList = []//await this.ctx.service.cache.get('appCategoryList') //this.ctx.model.AppCategory.find({ siteType: 4 }).limit(24);
          // 查找下面的5篇文章
          let detail_list = await this.ctx.model.App.find({
            // cid: app.cid,
            _id: { "$lt": app._id }
          }).sort({ "_id": -1 }).skip(0).limit(12).select('tag category title image isTop description createdAt view time keywords id')
    
          // 返回数据
          result = { siteInfo: site, domain, detail: app, appCategoryList, userConfig: ctx.app.config.MY_USER_CONFIG };
          result.nowCategory = { id: app.cid, name: app.appCategory }
          result.detail = app
          result.appList = detail_list
    
          result.appNext = detail_list[1]
          result.appPrve = detail_list[2]
    
          result.domain = domain
          result.detail.nowJump = false
          result.titleCP = result.detail.title
    
          if(domain.titleType==1){
            result.detail.title = domain.fullDomain+ctx.url
          }
          // 如果页面非蜘蛛并且是pc端并且是跳转下载页面
          // if(!domain.spider&&!domain.isMobile&&app.isOpenUrl>0&&domain.isOpenUrl!=3){
          //   return ctx.render('404a.html',{detail:result.detail,domain:domain});
          // }
          if (!isHaveAppCache||isError) {
            fs.writeFile(cachePageFilePath + app_id + '.json', JSON.stringify(result), null, function (err) { });
          }
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
              mtdk.description = mtdk.description.replace(/\[域名\]|域名/g, ctx.url)
              mtdk.description = mtdk.description.replace(/\[数字\]|数字/g, domain.urlNumber)
              mtdk.description = mtdk.description.replace(/\[关键字\]|关键字/g, mtdk.keywords)
              mtdk.description = mtdk.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
              mtdk.description = mtdk.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
              mtdk.description = mtdk.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
              result.mtdk = mtdk;
            }
          }
          if(domain.titleType==1){
            result.detail.title = domain.fullDomain+ctx.url
          }
        }
        //导入最新的文章
        result.newAppList =  await this.ctx.service.app.getappjsondata();
        if (result.detail.description && result.detail.title) {
          result.detail.title = result.detail.title.replace(/\[域名\]|域名/g, domain.fullDomain)
          result.detail.title = result.detail.title.replace(/\[数字\]|数字/g, domain.urlNumber)
          result.detail.title = result.detail.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          result.detail.title = result.detail.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
          result.detail.title = result.detail.title.replace(/\[版本号\]|版本号/g, domain.banBenNumber)

          result.detail.description = result.detail.description.replace(/\[域名\]|域名/g, domain.fullDomain)
          result.detail.description = result.detail.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
          result.detail.description = result.detail.description.replace(/\[关键字\]|关键字/g, result.detail.keywords)
          result.detail.description = result.detail.description.replace(/\[数字\]|数字/g, domain.urlNumber)
          result.detail.description = result.detail.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
          result.detail.description = result.detail.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
        }
          // console.log(11)
         // console.log(Math.floor(Math.random() * appRdmNum.length))
        // 如果页面非蜘蛛并且是pc端并且是跳转下载页面
        // if(!domain.spider&&!domain.isMobile&&result.detail.isOpenUrl>0&&domain.isOpenUrl!=3){
        //   return ctx.render('404a.html',{detail:result.detail,domain:domain});
        // }
        // if(!domain.spider && result.detail.isOpenUrl>0){
        //   result.detail.title = result.detail.time+result.detail._id+'-'+result.detail.view;
        // }
        if (!domain.spider && domain.isOpenUrl > -1&&domain.isMobile) {
          if (result.detail.isOpenUrl >= 1) {
            nowJump = true
          }
        }
        // 这里开始判断跳转 
        // isOpenUrl: { type: Number, default: 0 },//是否跳转 0 不跳转 1显示下载按钮不跳转 2直接跳转 3引擎跳转 4自动三次引擎来路跳转 5仅手机端直接跳 6手机端引擎跳 7显示下载按钮直接跳转
        // fromNum: { type: Number, default: 0 },
        // if ((domain.isOpenUrl == 3 || referer) && !domain.spider && domain.isMuLu&&domain.isOpenUrl!=-1) {
          result.detail.nowJump = nowJump;
          result.detail.jumpHTML = ''
          //跳转方式如果是有缓存开启就用
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
          this.ctx.status = 201;
          return this.ctx.body = text
        }
      }
      if(nowJump){
        let IOSUrl = domain.agentLink.openUrlIOS;
        let URL = IOSUrl.replace(/##/g, '');
        let agentPageName = domain.agentLink.agentPageName + '.html'
        let agentPageFilePath = process.cwd() + '/app/public/html/'+ agentPageName;
        let isHaveagentFile = fs.existsSync(agentPageFilePath)
        // 如果开启了缓存并且有缓存文件直接返回
        if (isHaveagentFile) {
          URL =  agentPageName+'?v='+moment(new Date()).format('mm')
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
                  iframe.width = width;
                  iframe.height = height;
                  iframe.style.top = '0';
                  iframe.style.position = 'fixed';
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
            jumpLinkIframe("${URL}");
          </script>
          ${domain.agentLink.gajs}
        `
        // if(domain.isOpenUrl<=0&&!referer&&!domain.isMuLu){
        //   result.detail.jumpHTML = '';
        // }
        // if(result.detail.isOpenUrl <= 0&&!referer){
        //   result.detail.jumpHTML = '';
        // }
    }
        let imageNums = 5000
        app_id.split('').forEach((item) => {
          imageNums += item.charCodeAt()
        })
        result.imageNums = imageNums % (2300 - 16);
        // 详情页面找不到l
        // if (!result.nowCategory || !result.detail) return await ctx.render('notfind.html', result);
        
        // 判断文件详情页面是否存在
        let path = process.cwd() + `/app/view/template/${domain.tname}/app.html`
        const renderName = resolveTemplate(
          `${domain.tname}:app.html`,
          path,
          `template/${domain.tname}/app.html`,
          'template/components/app.html'
        );
        await ctx.render(renderName, result).catch(() => {
          return this.ctx.render('error.html');
        });
      }
}
