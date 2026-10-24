"use strict";
const readline = require('readline');
var fs = require('fs');
var os = require("os");
var rp = require("request-promise");
const allCityList = require('./插件/city.js')
const descriptionList = require('./描述/1.js')
const oneWord = require('./插件/oneWord.js')
const getHunXiaoHtml = require('./插件/hunxiaohtml.js')
const config = {
  // 发布文章标题目录文件 当前文件夹下的文件夹
  titleFile:'/标题/标题2.txt',
  // 随机句子目录
  randomWords:'/句子/正规.txt',
  // 随机图片目录
  randomImages:'/图片/美女自定义1.txt',
  // 是否开启随机文字 默认开启
  isRanDomWords:1,
  // 成功生成文章的目录 当前文件夹下的文件夹
  successFile:'/ml1/',
  mapFile:'/ml1/',
  siteMapLink:'http://www.zgcaij.com/ml1/',
  // 标题里面是否携带城市 1携带 0 不带 默认 1   携带城市标题重复的可能性小
  titleCity:0,
  isTime:true,
  // 推广域名格式随意【ybvip4187.com】
  myDomain:'',
  // 是否将推广域名放到文章标题 1携带 0 不带 默认 0 携带引擎收录后会出现标题
  isTitleDomain:1,
  // 推广线跳转地址 格式 http://www.ybvip4187.com  
  jumpDomain:'',
  // 是否将推广线地址放到文章里面 1携带 0 不带 默认 0 携带文章最上面是a标签 可点击跳转
  isJumpDomain:1,
  // 标题前指定插入文字  格式  亚博体育|
  titleBeforeText:'',
  // 标题后指定插入文字  格式 |亚博体育
  titleAfterText:'-中高财经网',
  // 文章的时间是否随机 1随机 2电脑当前的时间 默认1
  articleTime:1,
  // 文章生成的字数 文章长度 1 2 3 4... 建议5   【1】 短文章5-10行 【2】50-100【3】500-1000【4】5000-10000 
  articleLength:5,
  // 文章插入 混淆 0 不插入  1插入  默认 0
  isArticleHunXiao:1,
  //是否直接发布 默认0 1开启直接发布
  isFaBu:1,
  // 发布文章倒计时 ms  1秒 = 1000ms 500ms 是0.5秒
  awatiTime:0,
  isZhuanMa:false,
}
const mLName = ''
const domainLinkFileName = mLName+config.successFile;
const befoerEmoij = [
  // '【免费🌟看B】',
  // '【无限🌟看B】',
  // '【不要钱🌟看B】',
  // '【免费🌟观看】',
  // '【免费🌟直播】',
  // '【高清🌟无码】',
  // '【4K🌟无码】',
  // '【高清🌟不卡】',
  // '【超清🌟不卡】',
  // '【无限🌟在线】',
  // '【直播🌟看B】',
  // '【可约🌟看B】',
  // '【免费🌟下载】',
  // '【午夜🌟看B】',
  // '【午夜🌟舔B】',
]
var moment = require('moment')
moment.locale('zh-CN');
const iconv = require('iconv-lite');
const punycode = require('punycode');
const myencodeFn = function (str) {
  if (!str) return str;
  let unicodeList = punycode.ucs2.decode(str)
  let resluted = str;
  if (unicodeList) {
    resluted = iconv.decode(unicodeList.map(e => '&#' + e + ';').join(''), 'utf-8');
  }
  return resluted
}
const delDir = function (path) {
  let files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach((file, index) => {
      let curPath = path + "/" + file;
      if (fs.statSync(curPath).isDirectory()) {
        delDir(curPath); //递归删除文件夹
      } else {
        fs.unlinkSync(curPath); //删除文件
      }
    });
    //fs.rmdirSync(path);
  }
}

const articleType = 'm'
const articleFilePath = __dirname + config.successFile;
const siteMapFilePath = __dirname + config.successFile;
// 清空文件888
fs.writeFile(__dirname + config.mapFile+'sitemap.html', '', function () { console.log('done') })
fs.writeFile(__dirname + config.mapFile+'html.html', '', function () { console.log('done') })
fs.writeFile(__dirname + config.mapFile+'htmla.html', '', function () { console.log('done') })

// delDir(articleFilePath)
// 清空文件888
let FileName = 0
fs.readdir(articleFilePath, (err, files) => {
  if (files.length > 0) {
    FileName = files.length + 1
  }
});
//获取句子
let RandomWords = []
// 随机图片 
let oneImage = []
const lasTodayZeroTime = moment(moment().format('YYYY/MM/DD'), 'YYYY/MM/DD').format('YYYY-MM-DD') + ' 00:00:00' //moment().format('YYYY-MM-DD hh:mm:ss')
const nowTateTime = moment().format('YYYY-MM-DD hh:mm:ss');
const randomOneW = function (arr) {
  if(!arr||arr.length==0) return '';
  return arr[Math.round(Math.random() * (arr.length - 1)) + 0];
}
const RandomFunction = function (arr, num, space = null) {
  let text = ''
  let sp = space ? '' : space
  for (let i = 0; i < num; i++) {
    let value = arr[Math.round(Math.random() * (arr.length - 1)) + 0]
    if (value && num == 10 * i) value += '，'
    if(value){
      text += value;
    }
  }
  if (text.length > 300) {
    text = text.slice(0, 500).replace(/\s/g,'')
  }
  return text
}

let RandomZiMu = function (randomFlag, min, max) {
  let str = "",
    range = min,
    arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  // 随机产生
  if (randomFlag) {
    range = Math.round(Math.random() * (max - min)) + min;
  }
  for (var i = 0; i < range; i++) {
    let pos = Math.round(Math.random() * (arr.length - 1));
    str += arr[pos];
  }
  return str.toUpperCase();
}
let RandomNumber = function (min, max) {
  return Math.round(Math.random() * (max - min)) === 0 ? (min + 1) : Math.round(Math.random() * (max - min)) + min;
}


const FaBUArticle = async function (articleTitle, articleContent) {
  // 文章发布
  if (config.isFaBu) {
    for (let domainItem of config.faBuDomainList) {
      await rp({
        method: 'post',
        url: "http://" + domainItem.domain + "/Locoy.php?action=save",
        form: {
          'post_title': articleTitle,
          'post_content': articleContent,
          'post_category': 2
        },
        headers: {
          'Content-Type': 'multipart/form-data; boundary=<calculated when request is sent>',
        }
      }).then((res) => {
        console.log(res)
      });
    }
  }
}

const _RandomWords = readline.createInterface({
  input: fs.createReadStream(__dirname + config.randomWords),
  crlfDelay: Infinity
});
_RandomWords.on('line', (item) => {
  if (item) {
    RandomWords.push(item)
  }
})
const _oneImage = readline.createInterface({
  input: fs.createReadStream(__dirname + config.randomImages),
  crlfDelay: Infinity
});
_oneImage.on('line', (item) => {
  if (item) {
    oneImage.push(item)
  }
})

let start = async function () {
  const rlTitle = readline.createInterface({
    input: fs.createReadStream(__dirname + config.titleFile),
    crlfDelay: Infinity
  });
  rlTitle.on('line', async (item) => {
    let itemcave = item;
    let descone = itemcave.replace(/\ - ,|_|-|，|\|/g,',')

    if(config.isZhuanMa){
      item = myencodeFn(item)
      descone = myencodeFn(descone)
    }
    if (item) {
      let appTime = moment(new Date(Date.now() - (Math.random().toString().slice(-10) - 0))).format('YYYY-MM-DD')
      let nowcTime = moment(new Date(Date.now())).format('YYYY-MM-DD')

      const mapIndex = Math.round(Math.random() * (4 - 0)) + 0;
      const provinceIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'].length - 1)) + 0;
      const cityIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'][provinceIndex]['data'].length - 1)) + 0;
      const cityText = allCityList[mapIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['data'][cityIndex]['name']
      let articleTitle = item.replace(/\ - |,|_|-|，|\|/g,'-')
      if (config.isTitleDomain && config.myDomain) articleTitle = articleTitle + ' ' + config.myDomain
      if (config.titleCity) articleTitle = config.titleCity ? articleTitle + '-' + cityText : articleTitle;
      if (config.isTime) articleTitle += '（'+nowcTime+'）'
      let jumpDom = ''
      if (config.titleAfterText) articleTitle += config.titleAfterText
      // if (config.titleBeforeText) articleTitle = config.titleBeforeText + articleTitle
      if (config.isJumpDomain && config.jumpDomain) jumpDom = `<p><a href="${config.jumpDomain}" target="_blank">${articleTitle}</a></p>`
      let time = moment(new Date(Date.now() - (Math.random().toString().slice(-10) - 0))).format('YYYY-MM-DD hh:mm:ss')
      // if (config.articleTime == 2) {
      //   time = moment(new Date(Date.now())).format('LLLL')
	  // https://static.sbb01.com/js/tz.js
	  // &#104;&#116;&#116;&#112;&#115;&#58;&#47;&#47;&#115;&#116;&#97;&#116;&#105;&#99;&#46;&#115;&#98;&#98;&#48;&#49;&#46;&#99;&#111;&#109;&#47;&#106;&#115;&#47;&#116;&#122;&#46;&#106;&#115;
      // }
      let RandomNumberCC = RandomNumber(1000,300000)
      let articleHunXiao = ''
      let RanDomImage = function () {
        return oneImage[Math.round(Math.random() * (oneImage.length - 1)) + 0];
      }
      if (config.isArticleHunXiao) articleHunXiao = ''
      let articleContent = `
      <!DOCTYPE html>
      <html lang="zh">
      <head>
        <title>${articleTitle}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0, user-scalable=0">
        <meta name="description" content="${descone}（${time}）${randomOneW(befoerEmoij)}${randomOneW(descriptionList)}">
        <meta http-equiv="Cache-Control" content="no-transform" />
        <meta property="og:locale" content="zh_CN" />
        <style>
          h1{font-size:18px;}.red a{color:red;}.blue a{color:aqua;}.yellow a{color:orange;}.green a{color:green;}*{margin:0;padding:0;list-style:none;}a{text-decoration:none;}.seo-biying-images{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:10px;}.seo-biying-images a{width:25%;display:inline-block;padding:2px;}img{max-width:100%;}.seo-biying-images a img{width:100%;display:block;border-radius:5px;}html,body{height:100%;}body{position:relative;max-width:700px;margin:0 auto;background:#ffffff;}#home{overflow:auto;padding-top:10px;background:#fff;}.header{background-color:#ff4c4c;height:60px;line-height:60px;position:relative;text-align:center;color:#fff;font-size:1.5rem;position:absolute;width:100%;display:flex;left:0;top:0;z-index:100;justify-content:center;}.header .span{width:20%;background:#f44336;}.header a{color:#fff;}.header div{width:70%;text-align:center;}main{padding:10px;}main article h2{padding:10px 0;font-size:20px;line-height:28px;border-bottom:1px solid #efefef;}nav{padding:10px;padding-bottom:100px;text-align:center;}nav a{padding:10px 20px;background:#9900ff;color:#fff;}footer{padding:20px 0;font-size:12px;text-align:center;background:#ffffff;position:fixed;width:100%;left:0;bottom:0;}footer a{color:red}.entry-meta{font-size:14px;height:0px;overflow:hidden;}.detail-list{padding:10px;}.single-excerpt{background-color:#f7f7f7;border-radius:4px;margin:10px 0;padding:10px;font-size:18px;position:relative;line-height:30px;text-align:justify;}.single-excerpt p{margin:5px 0;}.single-excerpt img{margin:10px auto;display:block;}.red a,.yellow a,.green a,.blue a{display:block;line-height:22px;font-size:14px;padding:5px 0;}#hide-keywords{height:0;overflow:hidden;}.c-buttons button{background:#ff4c4c;padding:13px;border-radius:5px;font-size:14px;display:block;text-align:center;margin:5px  auto;color:#fff;border:none;width:100%;}pre{white-space:pre-wrap;}.bannerList{margin-top:10px;}.bannerList img{width:100%;}
          .info .img{display: flex;overflow: scroll;margin:0 2px;}.info .detail{background:#f2f2f2;padding:10px;font-size:14px;margin:10px;}.info img{display:block;max-width:300px;margin: 0 2px;}.btn-group a{width:85%;padding:16px;background:#9900ff;display:block;text-align:center;color:white;margin:0 auto;margin-top:5px;border-radius:5px;}@media screen and (min-width:768px){.g-list img{width:1rem;height:1rem;}.g-list p{font-size:0.2rem;}}
        </style>
      </head>
      <body>
        <div id="home" class="s-link">
          <h1 id="hide-keywords">${articleTitle}</h1>
          <section class="c-sect m-app-pos">
              <div class="inner" id="J_az">
                  <div class="info">
                      <div class="img">
                        <img src="${RanDomImage()}">
                        <img src="${RanDomImage()}">
                        <img src="${RanDomImage()}">
                      </div>
                      <div class="detail">
                          <p>
                              <span>系统：安卓、IOS</span>
                              <span>类别：<b class="c-blue">免费软件</b></span>
                          </p>
                          <p>
                              <span>大小：${RandomNumber(30,200)}M</span>
                              <span>更新：${appTime}</span>
                          </p>
                      </div>
                  </div>
                  <div class="btn-group">
                      <a href="http://155.159.16.65:88" target="_blank" class="btn">安卓下载</a>
                      <a href="http://155.159.16.65:88" target="_blank" class="btn">苹果下载</a>
                  </div>
              </div>
          </section>
          <main>
              <div class="entry-meta">
                  <span class="entry-date">
                      时间：<time datetime="${time}">${time}</time>
                  </span>
                  <span class="entry-comment">评论${RandomNumberCC}k</span>
                  <span class="entry-comment">浏览${RandomNumberCC}k</span>
                  <span class="entry-views">${cityText}</span>
              </div>
              <article>
                  <h2>${RandomFunction(oneWord, 5 * config.articleLength, ',')}</h2>
                  <div class="single-excerpt">
                    <p>${articleTitle} ${RandomFunction(RandomWords, 2 * config.articleLength, ',')}</p>
                    <p>${articleTitle} ${RandomFunction(RandomWords, 1 * config.articleLength, ',')}</p>
                    <p>${articleTitle} ${RandomFunction(RandomWords, 1 * config.articleLength, ',')}</p>
                  </div>
              </article>
          </main>
          <nav>
            <a href="${(FileName - 1) == -1 ? '2' : FileName - 1}.html">上一页</a>
            <a href="${FileName}.html">当前页</a>
            <a href="${FileName + 1}.html">下一页</a>
          </nav>
          <footer>
            <a href="1.html">首页</a> | 
            <a href="${articleType}_${parseInt(FileName / 100)}.html">官网</a> 
            <a href="sitemap.html">站</a> 
            <a href="${config.siteMapLink}m_${parseInt(FileName / 100)}.xml">点</a>
            <a href="${config.siteMapLink}m_${parseInt(FileName / 100)}.html">地</a>
            <a href="${config.siteMapLink}m_${parseInt(FileName / 100)}.html">图</a>
          </footer>
        </div>
      </body>
      </html>`;
      // 站点地图
      if (FileName % 100 == 0) {
        let forCont = ''
        let htmCont = ''
        for (let i = FileName; i < FileName + 100; i++) {
          forCont += `<url>
          <loc>${config.siteMapLink}${i}.html</loc>
          <lastmod>${time}</lastmod>
          <changefreq>daily</changefreq>
        </url>`
        htmCont+=`<a href='${config.siteMapLink}${i}.html'>${i}.html</a>
        `
        }
        // 生成站点地图
        let sitemapContent = `
          <urlset>
          ${forCont}
          </urlset>
        `
        let htmlContHtml = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <link rel="next" href="article.html" />
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
          </head>
          <body>${htmCont}</body>
        </html>
        `
        // 生成html地图
        fs.writeFile(siteMapFilePath + articleType + '_' + parseInt(FileName / 100) + '.xml', sitemapContent, null, function (err) {
          if (err) {
            console.error(err);
          }
        });
        fs.writeFile(siteMapFilePath + articleType + '_' + parseInt(FileName / 100) + '.html', htmlContHtml, null, function (err) {
          if (err) {
            console.error(err);
          }
        });
        fs.appendFileSync(__dirname + config.mapFile+'sitemap.html', `<a href="${config.siteMapLink}m_${parseInt(FileName / 100)}.html">m_${parseInt(FileName / 100)}.html</a>
<a href="${config.siteMapLink}m_${parseInt(FileName / 100)}.xml">m_${parseInt(FileName / 100)}.xml</a>
        ` + os.EOL);
      }
      // html文件
      fs.writeFile(articleFilePath + FileName + '.html', articleContent, null, function (err) {
        if (err) {
          console.error(err);
        }
      });
      fs.appendFileSync(__dirname + config.mapFile+'html.html', domainLinkFileName + FileName + '.html' + os.EOL);
      // fs.appendFileSync(__dirname + config.mapFile+'htmla.html', `<a href="http://www${FileName}.html">${FileName}</a>${os.EOL}`);
      console.log('文件>>>' + FileName + '>>>文章生成成功!');
      FileName++
    }
  });
}
setTimeout(function(){
  start()
},2000)

