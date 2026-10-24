// 操他妈的自动生成文章 天下无敌
"use strict";
const Service = require("egg").Service;
const allCityList = require('./datajson/plugins/city.js')
// const oneWord = require('./datajson/plugins/oneWord.js')
const descList = require('./datajson/miaoshu.js')
const axios = require('axios')
var moment = require('moment')
moment.locale('zh-CN');
const {
    contenttp1,
    contenttp2,
    contenttp3
  } = require ('./datajson/desciku.js');
var fs = require('fs');
const articleJsonTP = `{"title":"色情大全软件黄片app-快手成人版-干B视频-污软件下载","content":"<p><img src='https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423851576.gif'><img src='https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423904834.gif'><img src='https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423855160.gif'></p>狗：再来一次！受宠若惊的小眼神各忙各的","time":"2025年1月25日","description":"无遮挡男女黄片app,快手成人版,污软件下载一选一出芭乐视频ios黄色视频免费观看羞羞视频APP大全,免费黄色下载,好色先生,四虎,糖心,爱情岛,91看片,xnxx,麻豆影视永久免费版下载,麻豆影视永久免费版安卓版下载。","keywords":"芭乐视频ios","image":"https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423851576.gif","articleCategory":"娱乐","view":145769,"tag":"娱乐","star":100,"bad":0,"uid":1,"sid":25,"isOpenUrl":false,"openUrlLink":"","cid":51,"status":1,"isHot":0,"sort":0,"copyid":"https://www.ali213.net/news/html/2024-5/839897.html"}`

// const OpenAI = require('openai')
// const openai = new OpenAI({
//   apiKey: '8cd396d6-9c03-49c4-b65b-e1d574121662',
//   baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
// });
// const completionc = openai.chat.completions.create({
//     messages: [
//       { role: 'system', content: '你是一个小说和作家' },
//       { role: 'user', content: '请以"【黄&色】软件下载3.0.3每天vivo版破解"为标题,视频影视或者app应用下载为相关内容主题,写一篇200字到500字的小说或者文章并且利于seo收录' },
//     ],
//     model: 'deepseek-r1-250120',
//   }).then((completion)=>{
//     console.log(completion.choices[0]?.message?.content);
//   });



// import OpenAI from "openai";
    
// const openai = new OpenAI({
//   apiKey: "xai-B7FkFaEmePAn7f5XyZlKddaldEYcdh9LSgmEvHyIShIwKlRDUgYzPMvIDp4EDzs1JXoXpQ4CPxDpy9oe",
//   baseURL: "https://api.x.ai/v1",
// });

// const completion = openai.chat.completions.create({
//   model: "grok-2-latest",
// messages: [
//     {
//       "role": "system",
//       "content": "You are a test assistant."
//     },
//     {
//       "role": "user",
//       "content": "Testing. Just say hi and hello world and nothing else."
//     }
//   ],
//   stream: false,
//   temperature: 0
// }).then((completion)=>{
//     console.log(completion.choices[0]?.message?.content);
// });

var moment = require('moment')
moment.locale('zh-CN');
const FilePath = __dirname + '/datajson';
const nameJsFile = '/app/public/html/article.js';
const nameJsFilePath = process.cwd() + nameJsFile  

const RandomFunction = function (arr, num, space = null) {
    let text = ''
    let sp = space ? '' : space
    for (let i = 0; i < num; i++) {
        let value = arr[Math.round(Math.random() * (arr.length - 1)) + 0]
        if (value && num == 10 * i) value += '，'
        text += value;
    }
    return text
}
const pianCiList = [
    "是夜晚最好的陪伴",
    "看黄软件app下载",
"黄软件下载",
"涉黄软件下载",
"黄色下载软件",
"黄色应用免费下载",
"免费看黄色的软件",
"黄色十大软件",
"看黄软件下载",
"十大禁用软件",
"黄黄的软件免费",
"黄软件大全",
"可以免费看黄的软件",
"黄色下载大全",
"黄APP下载",
"黄app成人软件成人app美女直播软件",
"黄色情污看片av软件app",
"美女直播软件",
"成人版抖音",
"污app",
"污视频软件",
"黄色直播",
"污应用",
"污片软件",
"美女软件",
"污污软件",
"黄片app",
"香蕉视频",
"黄色APP",
"香蕉app",
"污软件直播",
"污的软件",
"小电影网站",
"小视频app",
"羞羞视频动漫画APP",
"成人抖音网站污成人软件下载",
"日本无码做爱操逼视频",
"老司机软件成人直播影视软件",
"羞羞漫画动漫禁漫天堂",
"老司机网站网址你懂的抖音成人版",
"污污的三级视频网站软件",
"小视频软件污的app成人短视频",
"成人免费短视频网站",
"动漫网站短视频app污网站",
"成人抖音蜜桃视频软件软件",
"樱桃视频污片草莓软件",
"黄app成人软件成人app美女直播软件",
"福利直播福利软件av网站",
"黄色情污看片av软件app",
"动漫网址黄网站美女app",
]
let RandomNumber = function (min, max) {
    return Math.round(Math.random() * (max - min)) === 0 ? (min + 1) : Math.round(Math.random() * (max - min)) + min;
}
const randomOneW = function (arr) {
    return arr[Math.round(Math.random() * (arr.length - 1)) + 0];
  }
  const delay = function(num = 500) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        resolve();
      }, num);
    });
  }
class AutoArticle extends Service {
    // 批量生成文章的 直接生成文章到seo 的分类目录下面
    async piArticleCreate(articleList,isOpenUrl,contentTp,isPianCi) {
        let uid = '63dfe4b0f07ab14348f830ff';
        let juziarr = [1,2,3]
        let config = {
            // 发布文章标题目录文件 当前文件夹下的文件夹
            // 随机句子目录
            randomWords: '/词库/1.3.1.txt',
            // 随机图片目录
            randomImages: '/图片/美女.txt',
            // 是否开启随机文字 默认开启
            isRanDomWords: 0,
            // 成功生成文章的目录 当前文件夹下的文件夹
            successFile: '/生成文章/1/',
            // 标题里面是否携带城市 1携带 0 不带 默认 1   携带城市标题重复的可能性小
            titleCity: 0,
            // 推广域名格式随意【baidu.com】
            myDomain: '',
            // 是否将推广域名放到文章标题 1携带 0 不带 默认 0 携带引擎收录后会出现标题
            isTitleDomain: 0,
            // 推广线跳转地址 格式 http://www.baidu.com  
            jumpDomain: 'http://www.baidu.com',
            // 标题插入随机数字
            titleRandomWord: 0,
            isOpenUrl,
            fromNum:0,
            // 是否将推广线地址放到文章里面 1携带 0 不带 默认 0 携带文章最上面是a标签 可点击跳转
            isJumpDomain: 0,
            // 标题前指定插入文字  格式  亚博体育|
            titleBeforeText: '',
            // 标题后指定插入文字  格式 |亚博体育
            titleAfterText: '',
            // 文章的时间是否随机 1随机 2电脑当前的时间 默认1
            articleTime: 2,
            // 文章生成的字数 文章长度 1 2 3 4... 建议5   【1】 短文章5-10行 【2】50-100【3】500-1000【4】5000-10000 
            articleLength: 2,
            // 文章插入 混淆 0 不插入  1插入  默认 0
            isArticleHunXiao: 0,
            //是否直接发布 默认0 1开启直接发布
            isFaBu: 1,
            sid: 2,
            cidList: [139, 140, 141]
        }
        // 图片导入
        let IMAGELISTARRAY = []
        // read contents of the file
        const IMAGELIST = fs.readFileSync(FilePath + config.randomImages, 'UTF-8');
        // split the contents by new line
        const IMAGELISTLINE = IMAGELIST.split(/\r?\n/);
        // print all lines
        IMAGELISTLINE.forEach((line) => {
            IMAGELISTARRAY.push(line);
        });
        // 文章标题导入
        let ARTICLELISTC = articleList
        // // read contents of the file
        // const ARTICLELISTALL = fs.readFileSync(FilePath + config.titleFile, 'UTF-8');
        // // split the contents by new line
        // const ARTICLELISTLINE = ARTICLELISTALL.split(/\r?\n/);
        // // print all lines
        // ARTICLELISTLINE.forEach((line) => {
        //     ARTICLELIST.push(line);
        // });

        // 文章标题导入
        let RandomWords = [];
        // read contents of the file
        const RandomWordsLISTALL = fs.readFileSync(FilePath + config.randomWords, 'UTF-8');
        // split the contents by new line
        const RandomWordsLISTLINE = RandomWordsLISTALL.split(/\r?\n/);
        // print all lines
        RandomWordsLISTLINE.forEach((line) => {
            RandomWords.push(line);
        });
        let resultList = []
        for (let item of ARTICLELISTC) {
            const mapIndex = Math.round(Math.random() * (4 - 0)) + 0;
            const provinceIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'].length - 1)) + 0;
            const cityIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'][provinceIndex]['data'].length - 1)) + 0;
            const cityText = allCityList[mapIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['data'][cityIndex]['name']
            // let contNum = await this.ctx.service.utils.getNextSequence('articleid')
            // let max_id = await this.ctx.model.Article.aggregate([{ "$group": { "_id": {}, "id_max": { "$max": "$id" } } }])
            let time = moment(new Date(Date.now())).format('YYYY-MM-DD')
            // let image = RandomFunction(IMAGELISTARRAY,1);
            let pianciText = "";
            if(isPianCi){
                let ccpianci = RandomFunction(pianCiList,1)
                if(ccpianci){
                    pianciText = ':'+ccpianci
                }
            }
            let articleTitle = item.title+pianciText
            if (config.isTitleDomain && config.myDomain) articleTitle = articleTitle + ' ' + config.myDomain
            if (config.titleCity) articleTitle = config.titleCity ? articleTitle + '-' + cityText : articleTitle;
            if (config.titleRandomDate) articleTitle = ` ${time} ` + articleTitle
            if (config.titleRandomWord) articleTitle += ` ${'6' + Math.random().toString().slice(-5)} `
            let jumpDom = ''
            if (config.titleAfterText) articleTitle += config.titleAfterText
            if (config.titleBeforeText) articleTitle = config.titleBeforeText + articleTitle
            // if (config.isJumpDomain && config.jumpDomain) jumpDom = `<p><a style="font-size:20px;padding:10px 0;color:blue;" href="${config.jumpDomain}" target="_blank">👉 官方入口 ${item}</a> 点击进入...</p>`
            // if (config.articleTime == 2) {
            //     time = moment(new Date(Date.now())).format('YYYY-MM-DD')
            // }
            // <p>时间：<time>${time}</time></p>
            //     <p>地点：<b>${cityText}</b></p>
            //     <p>浏览：<b>${viewNum}</b></p>
            let articleHunXiao = ''
            const viewNum = Math.random().toString().slice(-6);
            if (config.isArticleHunXiao) articleHunXiao = ''
            let keywords = item.keywords||item.title
            let description = item.description||`${RandomFunction(RandomWords, 1, '')} ${item} ${cityText},`;

            if(description=='自动'){
                description = articleTitle+RandomFunction(descList,1, '')
            }

            let contentvv = `${jumpDom}
                <p>${description}</p>
                <p>${articleTitle},${RandomFunction(RandomWords, 2 * config.articleLength, ',')}${articleHunXiao}</p>
                <p><img src="${RandomFunction(IMAGELISTARRAY,1)}" alt="${articleTitle}"></p>
                <p>${RandomFunction(RandomWords, 2 * config.articleLength, ',')}${articleHunXiao}<p>
                `
            if(contentTp&&contentTp!=='随机'){
                let imgurl = RandomFunction(IMAGELISTARRAY,1)
                let contentTitle = articleTitle.slice(0,articleTitle.indexOf(':'))
                let numberc = this.ctx.service.utils.randomNumber(1,0,5)
                contentvv = contentTp.replace(/\#\#标题\#\#/g,contentTitle).replace(/\#\#图片\#\#/g,imgurl).replace(/\#\#数字\#\#/g,numberc)
            }
            if( contentTp == "随机"){
                let muluIndex = this.ctx.service.utils.randomNumber(1,0,5)
                let contentTitle = articleTitle.slice(0,articleTitle.indexOf(':'))
                let numberc = this.ctx.service.utils.randomNumber(1,0,5)
                let imgurl = RandomFunction(IMAGELISTARRAY,1)
                let pathxc = process.cwd() + `/app/service/datajson/tp/tp${muluIndex%4500}.txt`
                let contentcc = ''
                if (!fs.existsSync(pathxc)) {
                    pathxc = process.cwd() + `/app/service/datajson/tp/tp1.txt`
                }
                let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
                if(articleFileTxt){
                    contentcc = articleFileTxt;
                }else{
                    contentcc = contenttp1
                }

                contentcc = contentcc.replace(/\#\#标题\#\#/g,contentTitle).replace(/\#\#图片\#\#/g,imgurl).replace(/\#\#数字\#\#/g,numberc);
                contentvv = contentcc
            }
            // if(!contentTp||contentTp==''||contentTp==-1)
            if(!contentTp||contentTp==''){
                let articleinfo = {}
                let muluIndex = this.ctx.service.utils.randomNumber(1,0,5)
                let pathxc = process.cwd() + `/app/service/datajson/article/youxi/${muluIndex%18413}.json`
                if (fs.existsSync(pathxc)) {
                    let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
                    if(articleFileTxt){
                    try{
                        articleinfo = JSON.parse(articleFileTxt)
                    }catch{
                        articleinfo = JSON.parse(articleJsonTP)
                    }
                    }
                }
                if(articleinfo.title&&articleinfo.content){
                    contentvv = articleinfo.content;
                    // articleTitle = articleTitle+':'+articleinfo.title
                }
            }
            // console.log(item.cid)
            let saveData = {
                title: articleTitle, //标题
                content: contentvv,
                time,
                description,
                keywords,
                image: RandomFunction(IMAGELISTARRAY,1),
                articleCategory: item.articleCategory,
                view:viewNum,
                star: 100,
                bad: 0,
                uid,
                sid:-1,
                cid:item.cid,
                isOpenUrl,
                fromNum:0,
                status: 1,
                isHot: 0,
                sort: 0,
                copyid: '####'+parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6)),
                id: Date.now() + Math.random().toString().slice(-3),
            }
            // let article = await this.ctx.model.Article.findOne({ title: saveData.title })
            // if (!article) {
                await this.ctx.model.Article.create(saveData).then((datacc) => {
                    resultList.push({
                        title:saveData.title,
                        code:1,
                        _id:datacc._id,
                        message:'添加成功！',
                    })
                }).catch((err) => {
                    console.log(err)
                    resultList.push({
                        title:saveData.title,
                        code:-1,
                        _id:-1,
                        message:'数据库出错！',
                    })
                })
            // }else{
            //     resultList.push({
            //         title:saveData.title,
            //         code:-1,
            //         _id:-1,
            //         message:'标题重复!',
            //     })
            // }
        }
        this.ctx.service.article.updateArticleCacheList();
        return {
            code:200,
            data:this.ctx.service.utils.jiamiFn(resultList)
        }
    }
   async getArticlejthtml(){
    try {
    //获取服务器上的静态html 文件地址
    let artArr = []
    const downloads = [];
    const momentFile = moment().format('YYYYMMDD')
    let articleFilePath = process.cwd() + '/jingtai/article/'+momentFile
    let articleFilePathMap = process.cwd() + '/jingtai/article/'+momentFile+'map'

    // 递归创建父目录和当天目录，重复执行也不会抛出 EEXIST。
    await fs.promises.mkdir(articleFilePath, { recursive: true });
    await fs.promises.mkdir(articleFilePathMap, { recursive: true });

    await axios({
        method: 'post',
        url: `http://107.151.212.4:7001/api/getJingTaiTodayNum`,//http://107.151.212.4:7001
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'curl/7.12.1'
        },
        data: {password:'123123'}
      }).then(res => {
        const numIndex = Number(res && res.data && res.data.data && res.data.data.numIndex);
        if (!Number.isSafeInteger(numIndex) || numIndex < 0) {
            throw new Error('Invalid static article count');
        }
        for(let i=0;i<numIndex;i++) artArr.push(i);
      })
      if(artArr&&artArr.length>0){
        //获取html文件
        for(let iemc of artArr){
            downloads.push(axios({
                method: 'get',
                url: `http://107.151.212.4:7001/${momentFile}/${iemc}.html`,//http://107.151.212.4:7001
                headers: {
                  'Content-Type': 'text/html; charset=utf-8',
                  'User-Agent': 'botMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
                },
                data: {password:'123123'}
                }).then(res => {
                    if(res.status==200){
                        let articleContent = res.data;
                        return fs.promises.writeFile(articleFilePath + '/'+iemc + '.html', articleContent);
                    }
                }));
            }
        }
      //获取地图文件
      let mapArr = ['.txt','.xml','.html']
      for(let iemm of mapArr){
          downloads.push(axios({
              method: 'get',
              url: `http://107.151.212.4:7001/${momentFile}map/sitemap${iemm}`,//http://107.151.212.4:7001
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'User-Agent': 'botMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
              },
              data: {password:'123123'}
          }).then(res => {
              let articleContent = res.data;
              return fs.promises.writeFile(articleFilePathMap + '/sitemap'+iemm, articleContent);
          }));
      }
        // 下载和落盘均交给当前任务等待，避免脱离任务的 Promise 拒绝。
        const errors = await Promise.all(downloads.map(download => download.then(() => null, error => error)));
        const downloadError = errors.find(Boolean);
        if (downloadError) throw downloadError;
        return {
            code:200,
            message:'获取静态页面成功！'
        }
    } catch (error) {
        this.ctx.logger.error('[auto-article] getArticlejthtml failed: %s', error && error.stack || error);
        return { code: -1, message: '获取静态页面失败，请查看服务端日志' };
    }
    }
    async piArticlejtCreate(articleList,isOpenUrl,contentTp,isPianCi) {
        let uid = '63dfe4b0f07ab14348f830ff';
        let juziarr = [1,2,3]
        //读当天文件夹最大文件数量
        let numIndex = 0;
        const momentFile = moment().format('YYYYMMDD')
        let articleFilePath = process.cwd() + '/jingtai/article/'+momentFile
        let articleFilePathMap = process.cwd() + '/jingtai/article/'+momentFile+'map'

        await fs.promises.mkdir(articleFilePath, { recursive: true });
        await fs.promises.mkdir(articleFilePathMap, { recursive: true });
        fs.readdir(articleFilePath, (err, files) => {
          if (files.length > 0) {
            numIndex = files.length
          }
        });
       await this.ctx.service.utils.delay(200);
        let config = {
            // 发布文章标题目录文件 当前文件夹下的文件夹
            // 随机句子目录
            randomWords: '/词库/1.3.1.txt',
            // 随机图片目录
            randomImages: '/图片/美女.txt',
            // 是否开启随机文字 默认开启
            isRanDomWords: 0,
            // 成功生成文章的目录 当前文件夹下的文件夹
            successFile: '/生成文章/1/',
            // 标题里面是否携带城市 1携带 0 不带 默认 1   携带城市标题重复的可能性小
            titleCity: 0,
            // 推广域名格式随意【baidu.com】
            myDomain: '',
            // 是否将推广域名放到文章标题 1携带 0 不带 默认 0 携带引擎收录后会出现标题
            isTitleDomain: 0,
            // 推广线跳转地址 格式 http://www.baidu.com  
            jumpDomain: 'http://www.baidu.com',
            // 标题插入随机数字
            titleRandomWord: 0,
            isOpenUrl,
            fromNum:0,
            // 是否将推广线地址放到文章里面 1携带 0 不带 默认 0 携带文章最上面是a标签 可点击跳转
            isJumpDomain: 0,
            // 标题前指定插入文字  格式  亚博体育|
            titleBeforeText: '',
            // 标题后指定插入文字  格式 |亚博体育
            titleAfterText: '',
            // 文章的时间是否随机 1随机 2电脑当前的时间 默认1
            articleTime: 2,
            // 文章生成的字数 文章长度 1 2 3 4... 建议5   【1】 短文章5-10行 【2】50-100【3】500-1000【4】5000-10000 
            articleLength: 2,
            // 文章插入 混淆 0 不插入  1插入  默认 0
            isArticleHunXiao: 0,
            //是否直接发布 默认0 1开启直接发布
            isFaBu: 1,
            sid: 2,
            cidList: [139, 140, 141]
        }
        // 图片导入
        let IMAGELISTARRAY = []
        // read contents of the file
        const IMAGELIST = fs.readFileSync(FilePath + config.randomImages, 'UTF-8');
        // split the contents by new line
        const IMAGELISTLINE = IMAGELIST.split(/\r?\n/);
        // print all lines
        IMAGELISTLINE.forEach((line) => {
            IMAGELISTARRAY.push(line);
        });

        // 文章标题导入
        let ARTICLELISTC = articleList
        // // read contents of the file
        // const ARTICLELISTALL = fs.readFileSync(FilePath + config.titleFile, 'UTF-8');
        // // split the contents by new line
        // const ARTICLELISTLINE = ARTICLELISTALL.split(/\r?\n/);
        // // print all lines
        // ARTICLELISTLINE.forEach((line) => {
        //     ARTICLELIST.push(line);
        // });

        // 文章标题导入
        let RandomWords = [];
        // read contents of the file
        const RandomWordsLISTALL = fs.readFileSync(FilePath + config.randomWords, 'UTF-8');
        // split the contents by new line
        const RandomWordsLISTLINE = RandomWordsLISTALL.split(/\r?\n/);
        // print all lines
        RandomWordsLISTLINE.forEach((line) => {
            RandomWords.push(line);
        });
        let resultList = []
        for (let item of ARTICLELISTC) {
            const mapIndex = Math.round(Math.random() * (4 - 0)) + 0;
            const provinceIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'].length - 1)) + 0;
            const cityIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'][provinceIndex]['data'].length - 1)) + 0;
            const cityText = allCityList[mapIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['data'][cityIndex]['name']
            // let contNum = await this.ctx.service.utils.getNextSequence('articleid')
            // let max_id = await this.ctx.model.Article.aggregate([{ "$group": { "_id": {}, "id_max": { "$max": "$id" } } }])
            let time = moment(new Date(Date.now())).format('YYYY-MM-DD hh:mm:ss')
            // let image = RandomFunction(IMAGELISTARRAY,1);
            let pianciText = "";
            if(isPianCi){
                let ccpianci = RandomFunction(pianCiList,1)
                if(ccpianci){
                    pianciText = ':'+ccpianci
                }
            }
            let articleTitle = item.title+pianciText
            if (config.isTitleDomain && config.myDomain) articleTitle = articleTitle + ' ' + config.myDomain
            if (config.titleCity) articleTitle = config.titleCity ? articleTitle + '-' + cityText : articleTitle;
            if (config.titleRandomDate) articleTitle = ` ${time} ` + articleTitle
            if (config.titleRandomWord) articleTitle += ` ${'6' + Math.random().toString().slice(-5)} `
            let jumpDom = ''
            if (config.titleAfterText) articleTitle += config.titleAfterText
            if (config.titleBeforeText) articleTitle = config.titleBeforeText + articleTitle
            // if (config.isJumpDomain && config.jumpDomain) jumpDom = `<p><a style="font-size:20px;padding:10px 0;color:blue;" href="${config.jumpDomain}" target="_blank">👉 官方入口 ${item}</a> 点击进入...</p>`
            // if (config.articleTime == 2) {
            //     time = moment(new Date(Date.now())).format('YYYY-MM-DD')
            // }
            // <p>时间：<time>${time}</time></p>
            //     <p>地点：<b>${cityText}</b></p>
            //     <p>浏览：<b>${viewNum}</b></p>
            let articleHunXiao = ''
            const viewNum = Math.random().toString().slice(-6);
            if (config.isArticleHunXiao) articleHunXiao = ''
            let keywords = item.keywords||item.title
            let description = item.description||`${RandomFunction(RandomWords, 1, '')} ${item} ${cityText},`;
            if(description=='自动'){
                description = articleTitle+RandomFunction(descList,1, '')
            }
            let contentvv = `${jumpDom}
                <p>${description}</p>
                <p>${articleTitle},${RandomFunction(RandomWords, 2 * config.articleLength, ',')}${articleHunXiao}</p>
                <p><img src="${RandomFunction(IMAGELISTARRAY,1)}" alt="${articleTitle}"></p>
                <p>${RandomFunction(RandomWords, 2 * config.articleLength, ',')}${articleHunXiao}<p>
                `
            if(contentTp&&contentTp!=='随机'){
                let imgurl = RandomFunction(IMAGELISTARRAY,1)
                let contentTitle = articleTitle.slice(0,articleTitle.indexOf(':'))
                let numberc = this.ctx.service.utils.randomNumber(1,0,5)
                contentvv = contentTp.replace(/\#\#标题\#\#/g,contentTitle).replace(/\#\#图片\#\#/g,imgurl).replace(/\#\#数字\#\#/g,numberc)
            }
            if( contentTp == "随机"){
                let muluIndex = this.ctx.service.utils.randomNumber(1,0,5)
                let contentTitle = articleTitle.slice(0,articleTitle.indexOf(':'))
                let numberc = this.ctx.service.utils.randomNumber(1,0,5)
                let imgurl = RandomFunction(IMAGELISTARRAY,1)
                let pathxc = process.cwd() + `/app/service/datajson/tp/tp${muluIndex%4500}.txt`
                let contentcc = ''
                if (!fs.existsSync(pathxc)) {
                    pathxc = process.cwd() + `/app/service/datajson/tp/tp1.txt`
                }
                let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
                if(articleFileTxt){
                    contentcc = articleFileTxt;
                }else{
                    contentcc = contenttp1
                }

                contentcc = contentcc.replace(/\#\#标题\#\#/g,contentTitle).replace(/\#\#图片\#\#/g,imgurl).replace(/\#\#数字\#\#/g,numberc);
                contentvv = contentcc
            }
            if(!contentTp||contentTp==''||contentTp==-1){
                let articleinfo = {}
                let muluIndex = this.ctx.service.utils.randomNumber(1,0,5)
                let pathxc = process.cwd() + `/app/service/datajson/article/youxi/${muluIndex%18413}.json`
                if (fs.existsSync(pathxc)) {
                    let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
                    if(articleFileTxt){
                    try{
                        articleinfo = JSON.parse(articleFileTxt)
                    }catch{
                        articleinfo = JSON.parse(articleJsonTP)
                    }
                    }
                }
                if(articleinfo.title&&articleinfo.content){
                    contentvv = articleinfo.content;
                    // articleTitle = articleTitle+':'+articleinfo.title
                }
            }
            
            let saveData = {
                title: articleTitle, //标题
                content: contentvv,
                time,
                numIndex:momentFile+'/'+numIndex,
                description,
                keywords,
                image: RandomFunction(IMAGELISTARRAY,1),
                articleCategory: '最新',
                view:viewNum,
                star: 100,
                bad: 0,
                uid,
                sid:-1,
                cid:888,
                isOpenUrl,
                fromNum:0,
                status: 1,
                isHot: 0,
                sort: 0,
                copyid: '####'+parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6)),
                id: Date.now() + Math.random().toString().slice(-3),
            }
            // let article = await this.ctx.model.Article.findOne({ title: saveData.title })
            // if (!article) {
                await this.ctx.model.Articlejt.create(saveData).then((datacc) => {
                    resultList.push({
                        title:saveData.title,
                        code:1,
                        _id:datacc._id,
                        message:'添加成功！',
                    })
                }).catch((err) => {
                    console.log(err)
                    resultList.push({
                        title:saveData.title,
                        code:-1,
                        _id:-1,
                        message:'数据库出错！',
                    })
                })

            //静态html 构建
            


            let conttext = contentvv
            let imagecontent = ''
            let numc = Math.floor(Math.random() * 10062);

            for(let ic = 0;ic<6;ic++){
            let iccc = numc-3+ic
            if(iccc<0) iccc = 1
            if(iccc>10062) iccc = 10000
            imagecontent+=`<img src="https://appimages.cyou.seboapp.top/images/article/mn6/${iccc}.jpg"/>`
            }
            let articleContent = `
<!DOCTYPE html>
<html lang="zh">
<head>
<title>${articleTitle}</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0, user-scalable=0">
<meta name="description" content="${description}">
<style type="text/css">*{margin:0;padding:0;}body {max-width: 1000px;margin:0 auto;padding:10px;}.bannerList{display: flex;width:100%;height: 278px;margin: 10px 0;overflow: hidden;overflow-x:auto;}img{display: block;    height: 100%;margin: 5px auto;}nav{text-align:center;}</style>
<script type="text/javascript" src="https://appimages.cyou.seboapp.top/js/jingtai1.js"></script>
<script type="text/javascript" src="https://appimages.cyou.seboapp.top/css/jingtai1.css"></script>
</head>
<body>
<div id="home">
    <main>
        <div class="entry-meta">
            <span class="entry-comment">浏览:${RandomNumber(2000,9000)}k</span>
            <span class="entry-comment">安装:${RandomNumber(500,2000)}k</span>
            <span class="entry-comment">好评:${RandomNumber(100,500)}k</span>
        </div>
        <h3><time datetime="${time}">${time}</time></h3>
        <h1 id="title">${articleTitle}</h1>
        <article>
            <div class="bannerList">
                ${imagecontent}
            </div>
            <div class="single-excerpt">
                ${conttext}
            </div>
        </article>
    </main>
    <nav>
        <a href="${numIndex - 1}.html">上一页</a>
        <a href="${numIndex}.html">当前页</a>
        <a href="${numIndex + 1}.html">下一页</a>
    </nav>
    <footer>
        <a href="/">首页</a> | 
        <a href="/index.html">分类</a>
        <a href="/${momentFile}map/sitemap.xml">站点地图XML</a> |
        <a href="/${momentFile}map/sitemap.html">站点地图HTML</a> |
        <a href="/${momentFile}map/sitemap.txt">站点地图TXT</a> |
        <a href="/">©2024-2025</a>
        <a href="https://beian.miit.gov.cn/" target="_blank">ICP备案号：10529876298-1</a>
    </footer>
</div>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TK64WG23N4"></script>
<script type="text/javascript">
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-TK64WG23N4');
</script>
</body>
</html>`;

            // html文件
            fs.writeFile(articleFilePath + '/'+numIndex + '.html', articleContent, null, function (err) {
                if (err) {
                console.error(err);
                }
            })
            await this.ctx.service.utils.delay(200);

            numIndex++

            // }else{
            //     resultList.push({
            //         title:saveData.title,
            //         code:-1,
            //         _id:-1,
            //         message:'标题重复!',
            //     })
            // }
        }
        // 站点地图
        let forCont = ''
        let sitemapHtmlContent = ''
        for (let i = 0; i < numIndex; i++) {
                forCont += `<url>
                <loc>/${momentFile}/${i}.html</loc>
                <lastmod>${moment(new Date(Date.now())).format('YYYY-MM-DD hh:mm:ss')}</lastmod>
                <changefreq>daily</changefreq>
            </url>`;
                sitemapHtmlContent+=`<a href="/${momentFile}/${i}.html">/${momentFile}/${i}.html</a>\n`;
        }
        // 生成站点地图
        let sitemapContent = `
            <urlset>
            ${forCont}
            </urlset>
        `
        let sitemapHtmlContentTp = `
        <!DOCTYPE html>
        <meta charset="UTF-8">
        <html>
            <head>站点地图${momentFile}</head>
            <body>
            ${sitemapHtmlContent}
            </body>
            <script>
                document.querySelectorAll('a').forEach(function(anchor) {
                    var newUrl = window.location.origin + anchor.textContent;
                    anchor.href = newUrl;
                });
            </script>
        </html>
        `
        fs.writeFile(articleFilePathMap  + '/sitemap.xml', sitemapContent, null, function (err) {
            if (err) {
            console.error(err);
            }
        });
        fs.writeFile(articleFilePathMap  + '/sitemap.html', sitemapHtmlContentTp, null, function (err) {
            if (err) {
            console.error(err);
            }
        });
        fs.writeFile(articleFilePathMap  + '/sitemap.txt', sitemapHtmlContent, null, function (err) {
            if (err) {
            console.error(err);
            }
        });
        // this.ctx.service.article.updateArticlejtCacheList();
        return {
            code:200,
            data:this.ctx.service.utils.jiamiFn(resultList)
        }
    }
    async piAppCreate(appList,isOpenUrl,contentTp,isPianCi) {
        let uid = '63dfe4b0f07ab14348f830ff';
        let juziarr = [1,2,3]
        let config = {
            // 发布文章标题目录文件 当前文件夹下的文件夹
            // 随机句子目录
            randomWords: '/词库/1.3.1.txt',
            // 随机图片目录
            randomImages: '/图片/美女.txt',
            // 是否开启随机文字 默认开启
            isRanDomWords: 0,
            // 成功生成文章的目录 当前文件夹下的文件夹
            successFile: '/生成文章/1/',
            // 标题里面是否携带城市 1携带 0 不带 默认 1   携带城市标题重复的可能性小
            titleCity: 0,
            // 推广域名格式随意【baidu.com】
            myDomain: '',
            // 是否将推广域名放到文章标题 1携带 0 不带 默认 0 携带引擎收录后会出现标题
            isTitleDomain: 0,
            // 推广线跳转地址 格式 http://www.baidu.com  
            jumpDomain: 'http://www.baidu.com',
            // 标题插入随机数字
            titleRandomWord: 0,
            isOpenUrl,
            fromNum:0,
            // 是否将推广线地址放到文章里面 1携带 0 不带 默认 0 携带文章最上面是a标签 可点击跳转
            isJumpDomain: 0,
            // 标题前指定插入文字  格式  亚博体育|
            titleBeforeText: '',
            // 标题后指定插入文字  格式 |亚博体育
            titleAfterText: '',
            // 文章的时间是否随机 1随机 2电脑当前的时间 默认1
            articleTime: 2,
            // 文章生成的字数 文章长度 1 2 3 4... 建议5   【1】 短文章5-10行 【2】50-100【3】500-1000【4】5000-10000 
            articleLength: 2,
            // 文章插入 混淆 0 不插入  1插入  默认 0
            isArticleHunXiao: 0,
            //是否直接发布 默认0 1开启直接发布
            isFaBu: 1,
            sid: 2,
            cidList: [139, 140, 141]
        }
        // 图片导入
        let IMAGELISTARRAY = []
        // read contents of the file
        const IMAGELIST = fs.readFileSync(FilePath + config.randomImages, 'UTF-8');
        // split the contents by new line
        const IMAGELISTLINE = IMAGELIST.split(/\r?\n/);
        // print all lines
        IMAGELISTLINE.forEach((line) => {
            IMAGELISTARRAY.push(line);
        });

        // 文章标题导入
        let ARTICLELIST = appList
        // // read contents of the file
        // const ARTICLELISTALL = fs.readFileSync(FilePath + config.titleFile, 'UTF-8');
        // // split the contents by new line
        // const ARTICLELISTLINE = ARTICLELISTALL.split(/\r?\n/);
        // // print all lines
        // ARTICLELISTLINE.forEach((line) => {
        //     ARTICLELIST.push(line);
        // });

        // 文章标题导入
        let RandomWords = [];
        // read contents of the file
        const RandomWordsLISTALL = fs.readFileSync(FilePath + config.randomWords, 'UTF-8');
        // split the contents by new line
        const RandomWordsLISTLINE = RandomWordsLISTALL.split(/\r?\n/);
        // print all lines
        RandomWordsLISTLINE.forEach((line) => {
            RandomWords.push(line);
        });
        let resultList = []
        for (let item of ARTICLELIST) {
            const mapIndex = Math.round(Math.random() * (4 - 0)) + 0;
            const provinceIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'].length - 1)) + 0;
            const cityIndex = Math.round(Math.random() * (allCityList[mapIndex]['province'][provinceIndex]['data'].length - 1)) + 0;
            const cityText = allCityList[mapIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['name'] + '-' + allCityList[mapIndex]['province'][provinceIndex]['data'][cityIndex]['name']
            // let contNum = await this.ctx.service.utils.getNextSequence('articleid')
            // let max_id = await this.ctx.model.Article.aggregate([{ "$group": { "_id": {}, "id_max": { "$max": "$id" } } }])
            let time = moment(new Date(Date.now())).format('YYYY-MM-DD')
            // let image = RandomFunction(IMAGELISTARRAY,1);
            let pianciText = "";
            if(isPianCi){
                let ccpianci = RandomFunction(pianCiList,1)
                if(ccpianci){
                    pianciText = ':'+ccpianci
                }
            }
            let articleTitle = item.title+pianciText
            if (config.isTitleDomain && config.myDomain) articleTitle = articleTitle + ' ' + config.myDomain
            if (config.titleCity) articleTitle = config.titleCity ? articleTitle + '-' + cityText : articleTitle;
            if (config.titleRandomDate) articleTitle = ` ${time} ` + articleTitle
            if (config.titleRandomWord) articleTitle += ` ${'6' + Math.random().toString().slice(-5)} `
            let jumpDom = ''
            if (config.titleAfterText) articleTitle += config.titleAfterText
            if (config.titleBeforeText) articleTitle = config.titleBeforeText + articleTitle
            // if (config.isJumpDomain && config.jumpDomain) jumpDom = `<p><a style="font-size:20px;padding:10px 0;color:blue;" href="${config.jumpDomain}" target="_blank">👉 官方入口 ${item}</a> 点击进入...</p>`
            // if (config.articleTime == 2) {
            //     time = moment(new Date(Date.now())).format('YYYY-MM-DD')
            // }
            // <p>时间：<time>${time}</time></p>
            //     <p>地点：<b>${cityText}</b></p>
            //     <p>浏览：<b>${viewNum}</b></p>
            let articleHunXiao = ''
            const viewNum = Math.random().toString().slice(-6);
            if (config.isArticleHunXiao) articleHunXiao = ''
            let keywords = item.keywords||item.title
            let description = item.description||`${RandomFunction(RandomWords, 1, '')} ${item} ${cityText},`;
            if(description=='自动'){
                description = articleTitle+RandomFunction(descList,1, '')
            }
            let contentvv = `${jumpDom}
                <p>${description}</p>
                <p>${articleTitle},${RandomFunction(RandomWords, 2 * config.articleLength, ',')}${articleHunXiao}</p>
                <p><img src="${RandomFunction(IMAGELISTARRAY,1)}" alt="${articleTitle}"></p>
                <p>${RandomFunction(RandomWords, 2 * config.articleLength, ',')}${articleHunXiao}<p>
                `
            if(contentTp&&contentTp!=='随机'){
                let imgurl = RandomFunction(IMAGELISTARRAY,1)
                let contentTitle = articleTitle.slice(0,articleTitle.indexOf(':'))
                let numberc = this.ctx.service.utils.randomNumber(1,0,5)
                contentvv = contentTp.replace(/\#\#标题\#\#/g,contentTitle).replace(/\#\#图片\#\#/g,imgurl).replace(/\#\#数字\#\#/g,numberc)
            }
            if( contentTp == "随机"){
                let muluIndex = this.ctx.service.utils.randomNumber(1,0,5)
                let contentTitle = articleTitle.slice(0,articleTitle.indexOf(':'))
                let numberc = this.ctx.service.utils.randomNumber(1,0,5)
                let imgurl = RandomFunction(IMAGELISTARRAY,1)
                let pathxc = process.cwd() + `/app/service/datajson/tp/tp${muluIndex%4500}.txt`
                let contentcc = ''
                if (!fs.existsSync(pathxc)) {
                    pathxc = process.cwd() + `/app/service/datajson/tp/tp1.txt`
                }
                let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
                if(articleFileTxt){
                    contentcc = articleFileTxt;
                }else{
                    contentcc = contenttp1
                }

                contentcc = contentcc.replace(/\#\#标题\#\#/g,contentTitle).replace(/\#\#图片\#\#/g,imgurl).replace(/\#\#数字\#\#/g,numberc);
                contentvv = contentcc
            }
            //这里随机文章开始 另外把标题换成    xxxx:xxxx
            if(!contentTp||contentTp==''){
                let articleinfo = {}
                let muluIndex = this.ctx.service.utils.randomNumber(1,0,5)
                let pathxc = process.cwd() + `/app/service/datajson/article/youxi/${muluIndex%16203}.json`
                if (fs.existsSync(pathxc)) {
                    let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
                    if(articleFileTxt){
                        try{
                            articleinfo = JSON.parse(articleFileTxt)
                        }catch{
                            articleinfo = JSON.parse(articleJsonTP)
                        }
                    }
                }
                if(articleinfo.title&&articleinfo.content){
                    contentvv = articleinfo.content;
                    // articleTitle = articleTitle+':'+articleinfo.title
                }
            }
            
            let saveData = {
                id: Date.now() + Math.random().toString().slice(-3),
                title: articleTitle, //标题
                reltitle: '',
                status: 1,
                view: viewNum,
                tags:'站长添加',
                category:'最好APP',
                uname:'ali213',
                ncids:[],
                isProxy:false,
                isT:false,
                isH:false,
                isN:false,
                sort:0,
                image: RandomFunction(IMAGELISTARRAY,1),

                addIP:'',
                imageList:[],
                link: '',
                slink: '',
                h5: '',
                app: '',
                logo: '',
                h5logo: '',
                themeColor:'',
                applogo:'',
                keywords,
                isOpenUrl:isOpenUrl>-1?isOpenUrl:3,
                bad:0,
                star:0,
                time:moment(new Date()).format('LL'),
                description,
                copyid:'####'+parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6)),
                content: contentvv,
                content2:''
            }
            // let article = await this.ctx.model.Article.findOne({ title: saveData.title })
            // if (!article) {
                await this.ctx.model.App.create(saveData).then((datacc) => {
                    resultList.push({
                        title:saveData.title,
                        code:1,
                        _id:datacc._id,
                        message:'添加成功！',
                    })
                }).catch((err) => {
                    console.log(err)
                    resultList.push({
                        title:saveData.title,
                        code:-1,
                        _id:-1,
                        message:'数据库出错！',
                    })
                })
            // }else{
            //     resultList.push({
            //         title:saveData.title,
            //         code:-1,
            //         _id:-1,
            //         message:'标题重复!',
            //     })
            // }
        }
        this.ctx.service.app.updateAppCacheList();
        return {
            code:200,
            data:this.ctx.service.utils.jiamiFn(resultList)
        }
    }
    async uploadArticleCreate(itemcc){
        if(!itemcc||!itemcc.title||!itemcc.content) return '错误'
        // let article = await this.ctx.model.Article.findOne({ title: itemcc.title}).select('title')
        // if (article) {
        //     return {
        //         code:200,
        //         message:'标题重复---'+itemcc.title
        //     }
        // }
        if(itemcc.content.indexOf('违法内容')>=0)return '错误2'
        // if(itemcc.content.indexOf('根据相关法律法规和平台规定')>=0)return '错误2'
        // if(itemcc.content.indexOf('根据中国法律法规和平台政策')>=0)return '错误2'
        // if(itemcc.content.indexOf('为遵守法律法规及平台内容安全准则')>=0)return '错误2'
        if(itemcc.content.indexOf('法律法规')>=0)return '错误2'
        if(itemcc.content.indexOf('网络安全相关规定')>=0)return '错误2'
        if(itemcc.content.indexOf('我无法完成相关内容创作')>=0)return '错误2'

        if(itemcc.content.indexOf('传播非法内容')>=0)return '错误2'
        
       // 文章标题导入
       let RandomWords = [];
       // read contents of the file
       const RandomWordsLISTALL = fs.readFileSync(FilePath + '/词库/1.3.1.txt', 'UTF-8');
       // split the contents by new line
       const RandomWordsLISTLINE = RandomWordsLISTALL.split(/\r?\n/);
       // print all lines
       RandomWordsLISTLINE.forEach((line) => {
           RandomWords.push(line);
       });
      let titlec =  RandomFunction(RandomWords, 1 * 1, ',')
      let descc =  titlec+RandomFunction(RandomWords, 1 * 1, ',')+itemcc.title
      descc = descc.replace(/\-|\_/g,',')
      let content = itemcc.content.replace(/\n|\r/g,'')
        let saveData = {
            title:titlec+'|'+itemcc.title, //标题,
            content:content,
            time: moment(new Date()).format('LL'),
            description:descc,
            keywords: titlec,
            image: '',
            articleCategory: 'Deepseek',
            view: Number(Date.now().toString().slice(7)),
            tag: 'Deepseek',
            star: 100,
            bad: 0,
            uid: 1,
            sid: 25,
            isOpenUrl: 2,
            openUrlLink: '',
            cid:'',
            status: 1,
            isHot: 0,
            sort: 0,
            copyid: 'Deepseek'+Number(Date.now().toString().slice(7)),
            great: 0,
            otherContent:'',
            fromNum: 0,
            isTop: 0,
            id: parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6))
        }
        // console.log(content)
        await this.ctx.model.Article.create(saveData).then((res) => {
            console.log("成功-----" + saveData.title + '---' + saveData.articleCategory + '---' + saveData.copyid);
          }).catch((res) => {
            console.log(res)
            console.log('添加失败')
          })
        return {
            code:200,
            data:{
                message:'文章添加成功'
            }
        }
    }

    //把文章和app 数据保存成  article.js
    async createArticleJs(){
        //获取50条app 50条文章
        let applist = await this.ctx.model.App.find().sort({'_id':-1}).limit(30).select('title description view time').lean()
        let articlelist = await this.ctx.model.Article.find().sort({'_id':-1}).limit(30).select('title description view time').lean()
        let APPLISTCS = encodeURIComponent(JSON.stringify(applist));
        let ARTICLELISTCS = encodeURIComponent(JSON.stringify(articlelist));
        // console.log(applist,articlelist)
        
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var APPLISTCS = "${APPLISTCS}";window.mAppListc = JSON.parse(decodeURIComponent(APPLISTCS));var ARTICLELISTCS = "${ARTICLELISTCS}";window.mArticleListc = JSON.parse(decodeURIComponent(ARTICLELISTCS))`

        fs.writeFile(nameJsFilePath, strJsItem , null, function (err) { });
        return {
            code:200,
            message:"JS数据更新成功"
        }
    }
}

module.exports = AutoArticle;








