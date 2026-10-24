"use strict";
const readline = require('readline');
var fs = require('fs');
var os = require("os");
var rp = require("request-promise");
const allCityList = require('./插件/city.js')
const descriptionList = require('./描述/1.js')
const oneWord = require('./插件/oneWord.js')
const config = {
  // 发布文章标题目录文件 当前文件夹下的文件夹
  titleFile:'/标题/标题1.txt',
  // 随机句子目录
  randomWords:'/句子/正规.txt',
  // 随机图片目录
  randomImages:'/图片/美女.txt',
  // 是否开启随机文字 默认开启
  isRanDomWords:1,
  // 成功生成文章的目录 当前文件夹下的文件夹
  successFile:'/2/',
  mapFile:'/2/',
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
}
const domainLinkFileName = '/'

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

const articleFilePath = __dirname + config.successFile;
const siteMapFilePath = __dirname +  config.successFile;
// 清空文件888
fs.writeFile(__dirname + config.mapFile+'sitemap.txt', '', function () { console.log('done') })
fs.writeFile(__dirname + config.mapFile+'html.txt', '', function () { console.log('done') })
fs.writeFile(__dirname + config.mapFile+'htmla.txt', '', function () { console.log('done') })

delDir(articleFilePath)
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
  return arr[Math.round(Math.random() * (arr.length - 1)) + 0];
}
let wordsarr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
let numbers = ['1','2','3','4','5','6','7','8','9']
let emojc = ["_","-,","/,","*,","^,","%","$","#","@","❢","¿","¡","ˉ", "ˇ", "~" ,"々" ,"～", "‖" ,"∶" ,"＇", "｀", "《" ,"》" ,"「" ,"」", "『" ,"』", "〖" ,"〗" ,"【" ,"】" ,"（", "）","€" ,"£","Ұ","₴","₰","¢","₤","¥","₳","₲","₪","₵","₣","₱","฿","¤","₡","₮","₭","₩",",ރ","円","₢","₥","₫","₦","z","ł","﷼₠","₧₯","₨","K","čर","ℂ","ℍ","ℕ","ℙ","ℚ","ℝ","ℤ","ℬ","ℰ","ℯ","ℱ","ℊ","ℋ","ℎ","ℐ","ℒ","ℓ","ℳ","ℴ","℘","ℛ","ℭ","℮","ℌ","ℑ","ℜ","ℨ","♔","♕","♖","♗","♘","♙","♚","♛","♜","♝","♞","♟" ]

const RandomFunction = function (arr, num, space = null) {
  let text = ''
  let sp = space ? space : ''
  for (let i = 0; i < num; i++) {
    let value = arr[Math.round(Math.random() * (arr.length - 1)) + 0]
    if (value && num == 10 * i) value += '，'
    text += value;
  }
  if (text.length > 300) {
    text = text.slice(0, 500).replace(/\s/g,'')
  }
  return text
}

let RandomZiMu = function (randomFlag, min, max,upperC) {
  let str = "",
    range = min,
    arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  // 随机产生
  if(upperC){
    arr.forEach((item)=>{
        arr.push(item.toUpperCase())
    })
  }
  if (randomFlag) {
    range = Math.round(Math.random() * (max - min)) + min;
  }
  for (var i = 0; i < range; i++) {
    let pos = Math.round(Math.random() * (arr.length - 1));
    str += arr[pos];
  }
  return str;
}
let RandomNumber = function (min, max) {
  return Math.round(Math.random() * (max - min)) === 0 ? (min + 1) : Math.round(Math.random() * (max - min)) + min;
}
let RandomEmoj = function(){

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
    item = myencodeFn(item)
    if (item&&item.length>2) {
      const mapIndex = Math.round(Math.random() * (4 - 0)) + 0;
      const provinceIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'].length - 1)) + 0;
      const cityIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'][provinceIndex]['data'].length - 1)) + 0;
      const cityText = allCityList[mapIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['data'][cityIndex]['name']
      let articleTitle = item
      if (config.isTitleDomain && config.myDomain) articleTitle = articleTitle + ' ' + config.myDomain
      if (config.titleCity) articleTitle = config.titleCity ? articleTitle + '-' + cityText : articleTitle;
      let jumpDom = ''
      if (config.titleAfterText) articleTitle += config.titleAfterText
      // if (config.titleBeforeText) articleTitle = config.titleBeforeText + articleTitle
      if (config.isJumpDomain && config.jumpDomain) jumpDom = `<p><a href="${config.jumpDomain}" target="_blank">${articleTitle}</a></p>`
      let time = moment(Date.now()-RandomNumber(10000000,10000000000)).format('MMMDo');
      // if (config.articleTime == 2) {
      //   time = moment(new Date(Date.now())).format('LLLL')
      // }
      let RandomNumberCC = RandomNumber(1000,300000);
      let articleHunXiao = ''
      let RanDomImage = function () {
        return oneImage[Math.round(Math.random() * (oneImage.length - 1)) + 0] || 'https://p1.ssl.qhimgs1.com/t01e7f7f09589e5c441.jpg';
      }
      if (config.isArticleHunXiao) articleHunXiao = ''
      let descone = itemcave //.split(/,|_|-|，|\|/)[0]
      descone = myencodeFn(descone)
      let getHunXiaoHtml = function(){
        let domv = '';
        for(let i=0;i<50;i++){
          domv+=`<div class="${RandomFunction(wordsarr,8)}" id="${RandomFunction(wordsarr,8)}"></div>`
        }
        return domv
      }
      let articleContent = `
      <!DOCTYPE html>
      <html lang="zh">
      <head>
        <title>${articleTitle}-{{domain.beiAnName|safe}}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0, user-scalable=0">
        <meta name="description" content="${time} ${descone}${RandomFunction(emojc,1)}${RandomZiMu(1,5,10,1)}${RandomFunction(emojc,1)}{{domain.urlNumber}}${randomOneW(descriptionList)}">
        <meta name="shareaholic:image" content="http://{{domain.fullDomain}}/images/article/{{domain.imgTypeName}}/{{domain.imageNums}}.jpg">
        <meta name="og:image" content="http://{{domain.fullDomain}}/images/article/{{domain.imgTypeName}}/{{domain.imageNums}}.jpg">  
        <link rel="icon" type="image/x-icon" href="{{ domain.favicon }}">
        <link rel="stylesheet" type="text/css" href="/css/link.css">
        <link rel="stylesheet" rev="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/Swiper/9.0.1/swiper-bundle.min.css" type="text/css" media="all" />
        <style>
            .bgThemColor{background-color:{{domain.themeColor}} !important;}
            #swiper1{max-width:700px;overflow:hidden;border-radius:10px;}
            #swiper1 a{display:block;height:365px;overflow:hidden;border-radius:10px;}
            #swiper1 a img{min-width: 100%;min-height: 100%;}
        </style>
      </head>
      <body>
      ${getHunXiaoHtml()}
        <div class="header bgThemColor">
            <div class="span icon">
                <a href="javascript:void(0)" onclick="window.history.back()">&larr;</a>
            </div>
            <div>
                <a href="http://{{domain.fullDomain}}{{domain.muluRandomMulu}}">首页</a>
            </div>
            <div class="span fuli">
                <a href="/gogogo?time={{domain.randomVersion}}&time={{domain.randomVersion}}">福利</a>
            </div>
        </div>
        <div id="home">
            <div class="inner" id="J_az">
                <div class="info">
                  <div class="detail">
                    <p>
                        <span>时间:${moment(Date.now()-RandomNumber(10000000,10000000000)).format('MMMDo')}</span>
                        <span>分类:视频直播</span>
                    </p>
                    <p>
                        <span>下载:${RandomNumber(1000,200000)}</span>
                        <span>系统:安卓/ios</span>
                    </p>
                    <p>
                        <span>版本:${RandomNumber(0,10)}.${RandomNumber(0,10)}</span>
                        <span>大小:${RandomNumber(10,100)}M</span>
                    </p>
                  </div>
                </div>
            </div>
            <main>
                <article>
                    <div id="swiper1" class="swiper slide">
                        <div class="swiper-wrapper">
                            {% if domain.imgTypeName %}
                            {% for i in range(imageNums-3, imageNums+3) -%}
                            <div class="swiper-slide">
                                <a href="./{{${FileName} + i}}.html">
                                    <img src="/images/article/{{domain.imgTypeName}}/{{ i }}.jpg" />
                                </a>
                            </div>
                            {%- endfor %}
                            {% endif %}
                        </div>
                    </div>
                    <h1>${RandomFunction(RandomWords,3, '')}</h1>
                    <div class="single-excerpt">
                      <p>{{domain.beiAnName|safe}} ${RandomFunction(RandomWords, 2 * config.articleLength, ',')}</p>
                      <p>{{domain.beiAnName|safe}} ${RandomFunction(RandomWords, 1 * config.articleLength, ',')}</p>
                      <p>{{domain.beiAnName|safe}} ${RandomFunction(RandomWords, 1 * config.articleLength, ',')}</p>
                    </div>
                </article>
            </main>
            <footer>
              <a href="./${(FileName - 1) == -1 ? '0' : FileName - 1}.html">上一页</a>
              <a href="./${FileName}.html">当前页</a>
              <a href="./${FileName + 1}.html">下一页</a>
            </nav>
            </footer>
            <center>
                <a href="http://{{domain.fullDomain}}">首页</a> | 
                <a href="./_${parseInt(FileName / 100)==0?1:parseInt(FileName / 100)}.html">站点地图</a> |
                <a href="./_${(parseInt(FileName / 100)+1)}.html">©2021-2023</a>
            </center>
            {% include "template/components/common.html" %}
        </div>
        <script src="https://cdn.bootcdn.net/ajax/libs/Swiper/9.0.1/swiper-bundle.min.js"></script>
        {{jumpHTML|safe}}
        ${getHunXiaoHtml()}
        <script type="text/javascript">
            var mySwiper = new Swiper('.swiper', {
                autoplay: {
                    delay: 1000
                },
                pagination: {
                    el: '.swiper-pagination',
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
            })
        </script>
      </body>
      </html>`;
      // 站点地图
      if (FileName % 100 == 0) {
        let forCont = ''
        let htmCont = `<a href='${'./_' + (parseInt(FileName / 100)>1?parseInt(FileName / 100)-1:1) + '.html'}'>map.html</a>`
        for (let i = FileName; i < FileName + 100; i++) {
          forCont += `<url>
          <loc>./${i}.html</loc>
          <lastmod>${time}</lastmod>
          <changefreq>daily</changefreq>
        </url>`
        htmCont+=`<a href='./${i}.html'>${i}.html</a>
        `
        }
         htmCont = htmCont+`<a href='${'./_' + (parseInt(FileName / 100)+1) + '.html'}'>map.html</a>`
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
        fs.writeFile(siteMapFilePath  + '_' + parseInt(FileName / 100) + '.xml', sitemapContent, null, function (err) {
          if (err) {
            console.error(err);
          }
        });
        fs.writeFile(siteMapFilePath  + '_' + parseInt(FileName / 100) + '.html', htmlContHtml, null, function (err) {
          if (err) {
            console.error(err);
          }
        });
        fs.appendFileSync(__dirname + config.mapFile+'sitemap.html', `<a href="./_${parseInt(FileName / 100)}.html">_${parseInt(FileName / 100)}.html</a>
<a href="./_${parseInt(FileName / 100)}.xml">_${parseInt(FileName / 100)}.xml</a>
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
start()

