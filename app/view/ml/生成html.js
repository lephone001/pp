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
  randomImages:'/图片/美女.txt',
  // 是否开启随机文字 默认开启
  isRanDomWords:1,
  // 成功生成文章的目录 当前文件夹下的文件夹
  successFile:'/1/',
  mapFile:'/1/',
  // 标题里面是否携带城市 1携带 0 不带 默认 1   携带城市标题重复的可能性小
  titleCity:0,
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
  titleAfterText:'',
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
const mLName = '/ml'
const domainLinkFileName = mLName+config.successFile;
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
    FileName = files.length
  }
});
//获取句子
let RandomWords = []
// 随机图片 
let oneImage = []
const lasTodayZeroTime = moment(moment().format('YYYY/MM/DD'), 'YYYY/MM/DD').format('YYYY-MM-DD') + ' 00:00:00' //moment().format('YYYY-MM-DD hh:mm:ss')
const nowTateTime = moment().format('YYYY-MM-DD hh:mm:ss');
const randomOneW = function (arr) {
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
let start = async function () {
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
    if (item && item.indexOf('http') >= 0) {
      oneImage.push(item)
    }
  })

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
      const mapIndex = Math.round(Math.random() * (4 - 0)) + 0;
      const provinceIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'].length - 1)) + 0;
      const cityIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'][provinceIndex]['data'].length - 1)) + 0;
      const cityText = allCityList[mapIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['data'][cityIndex]['name']
      let articleTitle = item
      // if(articleTitle.indexOf('《')!==0){
      //   articleTitle = "《"+articleTitle+"》"
      // }
      if (config.isTitleDomain && config.myDomain) articleTitle = articleTitle + ' ' + config.myDomain
      if (config.titleCity) articleTitle = config.titleCity ? articleTitle + '-' + cityText : articleTitle;
      let jumpDom = ''
      if (config.titleAfterText) articleTitle += config.titleAfterText
      // if (config.titleBeforeText) articleTitle = config.titleBeforeText + articleTitle
      if (config.isJumpDomain && config.jumpDomain) jumpDom = `<p><a href="${config.jumpDomain}" target="_blank">${articleTitle}</a></p>`
      let time = moment(new Date(Date.now() - (Math.random().toString().slice(-10) - 0))).format('YYYY-MM-DD hh:mm:ss')
      // if (config.articleTime == 2) {
      //   time = moment(new Date(Date.now())).format('LLLL')
      // }
      let RandomNumberCC = RandomNumber(1000,300000)
      let articleHunXiao = ''
      let RanDomImage = function () {
        return oneImage[Math.round(Math.random() * (oneImage.length - 1)) + 0] || 'https://p1.ssl.qhimgs1.com/t01e7f7f09589e5c441.jpg';
      }
      if (config.isArticleHunXiao) articleHunXiao = ''
      let articleContent = `
      <!DOCTYPE html>
      <html lang="zh">
      <head>
        <title>${articleTitle}-{{domain.titleText}}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0, user-scalable=0">
        <meta name="description" content="${descone}${randomOneW(descriptionList)}">
        <meta name="shareaholic:image" content="${RanDomImage()}">
        <meta name="og:image" content="${RanDomImage()}">
        <meta http-equiv="Cache-Control" content="no-transform" />
        <meta property="og:locale" content="zh_CN" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="http://{{domain.fullDomain}}{{domain.muluRandomMulu}}" />
        <meta name="google" content="notranslate" />
        <link rel="icon" type="image/png" href="${RanDomImage()}">
        <link rel="stylesheet" type="text/css" href="/css/tz1.css">
      </head>
      <body>
        <div class="header">
            <div class="span">
                <a href="javascript:void(0)" onclick="window.history.back()">&larr;</a>
            </div>
            <div>
                <a href="${mLName}/index.html">首页</a>
            </div>
            <div class="span">
                <a href="http://{{domain.fullDomain}}{{domain.muluRandomMulu}}">福利</a>
            </div>
        </div>
        <h1 id="hide-keywords">${articleTitle}</h1>
        <div id="home" class="s-{{domain.linkID}}">
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
                    <div class="bannerList">
                        {% for i in range(${FileName%200}, ${FileName%200+6}) -%}
                        <img src="/images/article/mn/{{ i }}.jpg" alt="${articleTitle}"/>
                        {%- endfor %}
                    </div>
                    <div class="single-excerpt">
                      <p>${articleTitle} {{domain.link}} ${RandomFunction(RandomWords, 2 * config.articleLength, ',')}</p>
                      <p>${articleTitle} {{domain.link}} ${RandomFunction(RandomWords, 1 * config.articleLength, ',')}</p>
                      <p>${articleTitle} {{domain.link}} ${RandomFunction(RandomWords, 1 * config.articleLength, ',')}</p>
                    </div>
                </article>
            </main>
            <nav>
              <a href="${domainLinkFileName}${(FileName - 1) == -1 ? '0' : FileName - 1}.html">上一页</a>
              <a href="${domainLinkFileName}${FileName}.html">当前页</a>
              <a href="${domainLinkFileName}${FileName + 1}.html">下一页</a>
            </nav>
            <footer>
                <a href="${domainLinkFileName}index.html">首页</a> | 
                <a href="${domainLinkFileName}${articleType}_${parseInt(FileName / 100)}.html">站</a> 
                <a href="http://h5.{{domain.link}}">点</a> 
                <a href="http://wap.{{domain.link}}">地</a> 
                <a href="${mLName}${config.mapFile}sitemap.html">图</a> 
                <a href="${mLName}/m_${FileName}.xml">|</a> 
                <a href="http://m.{{domain.link}}">©2021-2022</a>
            </footer>
        </div>
        {{domain.agentLink.gajs | safe}}
       </body>
      </html>`;
      // 站点地图
      if (FileName % 100 == 0) {
        let forCont = ''
        let htmCont = ''
        for (let i = FileName; i < FileName + 100; i++) {
          forCont += `<url>
          <loc>http://{{domain.fullDomain}}${domainLinkFileName}${i}.html</loc>
          <lastmod>${time}</lastmod>
          <changefreq>daily</changefreq>
        </url>`
        htmCont+=`<a href='http://{{domain.fullDomain}}${domainLinkFileName}${i}.html'>{{domain.fullDomain}}${domainLinkFileName}${i}.html</a>
        <a href='http://m.{{domain.link}}${domainLinkFileName}${i}.html'>m.{{domain.link}}${domainLinkFileName}${i}.html</a>
        <a href='http://wap.{{domain.link}}${domainLinkFileName}${i}.html'>wap.{{domain.link}}${domainLinkFileName}${i}.html</a>
        <a href='http://h5.{{domain.link}}${domainLinkFileName}${i}.html'>wap.{{domain.link}}${domainLinkFileName}${i}.html</a>
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
            <link rel="canonical" href="http://{{domain.fullDomain}}}" />
            <meta name="mobile-agent" content="format=xhtml;url=http://m.{{domain.link}}}" />
            <meta name="mobile-agent" content="format=html5;url=http://wap.{{domain.link}}}" />
            <meta name="mobile-agent" content="format=xhtml;url=http://h5.{{domain.link}}}" />
            <link rel="next" href="http://{{domain.fullDomain}}}/article.html" />
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
        fs.appendFileSync(__dirname + config.mapFile+'sitemap.html', `<a href="http://www.{{domain.link}}${domainLinkFileName}${articleType}_${parseInt(FileName / 100)}.html">http://www.{{domain.link}}${domainLinkFileName}${articleType}_${parseInt(FileName / 100)}.html</a>
<a href="http://www.{{domain.link}}${domainLinkFileName}${articleType}_${parseInt(FileName / 100)}.xml">http://www.{{domain.link}}${domainLinkFileName}${articleType}_${parseInt(FileName / 100)}.xml</a>
        ` + os.EOL);
      }
      // html文件
      fs.writeFile(articleFilePath + FileName + '.html', articleContent, null, function (err) {
        if (err) {
          console.error(err);
        }
      });
      fs.appendFileSync(__dirname + config.mapFile+'html.html', domainLinkFileName + FileName + '.html' + os.EOL);
      // fs.appendFileSync(__dirname + config.mapFile+'htmla.html', `<a href="http://www.{{domain.link}}${domainLinkFileName}${FileName}.html">${FileName}</a>${os.EOL}`);
      console.log('文件>>>' + FileName + '>>>文章生成成功!');
      FileName++
    }
  });
}
// 等待读取数量
setTimeout(function(){
  start()
},20000)

