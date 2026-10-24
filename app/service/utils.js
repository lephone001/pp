const Service = require("egg").Service;
const fs = require("fs");
const path = require("path");
const { templateExists, resolveTemplate } = require('../utils/templateExistsCache');
const pump = require('mz-modules/pump');
const spawn = require('child_process').spawn;
const axios = require('axios');
const { isIP } = require('net');

const MULU_COUNT_CACHE_MS = 60 * 1000;
const muluWordCounts = new Map();

function normalizeMuluWord(item, defaults = {}) {
  const source = item && typeof item === 'object' && !Array.isArray(item)
    ? (typeof item.toObject === 'function' ? item.toObject() : item) : {};
  const result = { ...source };
  const asText = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  for (const key of [ 'title', 'keywords', 'description' ]) {
    result[key] = asText(source[key]) || asText(defaults[key]);
  }
  return result;
}

// var mongoose = require('mongoose');
// const uaParser = require('ua-parser-js');
const firameTpList = require('./datajson/iframe_url');
let COMMONDATA = require('../confi/index');
var moment = require('moment')
moment.locale('zh-CN');
const cheerio = require("cheerio");
const iconv = require('iconv-lite');
iconv.skipDecodeWarning = true;
const punycode = require('punycode');
const domain = require("../model/domain");
const CryptoJS = require("crypto-js");
const keycode = "jiamibijibenkey-123";
let articleJsonTP = `{"title":"黄色大全软件黄片app-快手成人版-干B视频-污软件下载:触发了狗狗身上的弹射装置 动图 治愈脑瘫只需一秒","content":"<p><img src='https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423851576.gif'><img src='https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423904834.gif'><img src='https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423855160.gif'></p>狗：再来一次！受宠若惊的小眼神各忙各的","time":"2025年1月25日","description":"无遮挡男女黄片app,快手成人版,污软件下载一选一出芭乐视频ios黄色视频免费观看羞羞视频APP大全,免费黄色下载,好色先生,四虎,糖心,爱情岛,91看片,xnxx,麻豆影视永久免费版下载,麻豆影视永久免费版安卓版下载。","keywords":"芭乐视频ios","image":"https://img2.ali213.net/picfile/News/2024/10/24/584_2024102423851576.gif","articleCategory":"娱乐","view":145769,"tag":"娱乐","star":100,"bad":0,"uid":1,"sid":25,"isOpenUrl":false,"openUrlLink":"","cid":51,"status":1,"isHot":0,"sort":0,"copyid":"https://www.ali213.net/news/html/2024-5/839897.html"}`
const myencodeFn = function (str) {
  if (!str) return str;
  let unicodeList = punycode.ucs2.decode(str)
  let resluted = '';
  if (unicodeList) {
    resluted = iconv.decode(unicodeList.map(e => '&#' + e + ';').join(''), 'utf-8');
  }
  return resluted
}

const ImgTypeNameList = [
  { nameval:"",value: 'bdzb-108', nums: "108" },
  { value: 'bdmn-151', nums: "151" },
  { value: 'bc-38', nums: "38" },
  { value: 'mn', nums: "200" },
  { value: 'mn2', nums: "200" },
  { value: 'mn3', nums: "200" },
  { value: 'mn4', nums: "200" },
  { value: 'mn5', nums: "8369" },
  { value: 'mn6', nums: "10062" },
  { value: 'mn7', nums: "70000" },
  { value: 'waji1', nums: "1258" },


]
const IMG_TYPE_NUM_MAP = new Map(ImgTypeNameList.map(item => [item.value, Number(item.nums)]));
const BAIDU_SPIDER_IP_PREFIXES = [
  '116.179.37.', '159.226.50.', '180.149.133.', '60.28.22.',
  '162.105.207.', '220.181.', '121.14.89.', '180.76.',
  '123.125.71.', '111.13.100.', '111.206.198.', '203.208.60.',
  '210.72.225.', '125.90.88.',
];
const MOBILE_UA_MARKERS = [ 'phone', 'android', 'mobile', 'pad', 'tablet', 'intelmacosx10' ];
const TEMPLATE_TOKEN_RE = /\[(域名|站名|标题|关键字|版本号|数字|字母|符号)\]|域名|站名|标题|关键字|版本号|数字|字母|符号/g;
const AGENT_LINK_KEYS = [
  'myOpenDomain', 'openUrlPc', 'openUrlH5', 'openUrlIOS',
  'openUrlAndroid', 'openUrlAPP', 'openUrlAgentPage',
];
const JUMP_IFRAME_PREFIX = `<script>
var jumpLinkIframe=function(url){
var html=document.querySelector('html');
html.style.height='100%';
var iframe=document.createElement('iframe');
iframe.id='global-iframe';
iframe.width='100%';
iframe.height='100%';
iframe.style.top='0';
iframe.style.zIndex=10000;
iframe.style.left=0;
iframe.style.background='#ffffff';
iframe.style.overflow='auto';
iframe.style.position='fixed';
iframe.src=url;
iframe.setAttribute('frameborder','0');
document.body.parentNode.insertBefore(iframe,document.body);
};
jumpLinkIframe(`;
const JUMP_IFRAME_SUFFIX = `);
</script>`;

function replaceTemplateTokens(value, replacements) {
  if (!value) return value;
  return String(value).replace(TEMPLATE_TOKEN_RE, (match, bracketToken) => {
    const token = bracketToken || match;
    const replacement = replacements[token];
    return replacement == null ? match : String(replacement);
  });
}

function formatLocalDateParts(now) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const pad = value => String(value).padStart(2, '0');
  const date = `${year}-${pad(month)}-${pad(day)}`;
  return {
    todayDay: `${year}年${month}月${day}日`,
    date,
    detailTime: `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}:28`,
  };
}

function encodeAgentLink(value) {
  if (!value) return value;
  return String(value).replace(/##/g, '').split('').join('##');
}

function prepareAgentLink(agentLink) {
  if (!agentLink) return {};
  const result = typeof agentLink.toObject === 'function'
    ? agentLink.toObject()
    : { ...agentLink };
  for (const key of AGENT_LINK_KEYS) {
    if (result[key]) result[key] = encodeAgentLink(result[key]);
  }
  return result;
}

async function getProcessedAgentLink(ctx, agentId) {
  if (!agentId) return {};
  const cacheKey = String(agentId);

  let agentLink = await ctx.service.cache.get('userAgent-' + cacheKey);
  if (!agentLink || !agentLink._id) {
    agentLink = await ctx.model.UserAgent.findById(agentId);
    if (agentLink) ctx.service.cache.set('userAgent-' + cacheKey, agentLink);
  }

  return prepareAgentLink(agentLink);
}

function buildJumpIframeHtml(url, gajs) {
  return JUMP_IFRAME_PREFIX + JSON.stringify(String(url || '')) +
    JUMP_IFRAME_SUFFIX + (gajs || '');
}

class utilsService extends Service {
  delDir(directory, type = 1) {
    const { ctx } = this;
    // type == 1 连带文件夹删除 type = 0  不删除文件夹
    let files;
    try {
      files = fs.readdirSync(directory);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const file of files) {
      const curPath = path.join(directory, file);
      try {
        // 不跟随目录链接，避免把链接指向的目录递归清空。
        if (fs.lstatSync(curPath).isDirectory()) {
          ctx.service.utils.delDir(curPath); //递归删除文件夹
        } else {
          fs.unlinkSync(curPath); //删除文件
        }
      } catch (error) {
        // 其他进程可能已删除该文件或目录，继续处理剩余缓存。
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (type == 1) {
      try {
        fs.rmdirSync(directory);
      } catch (error) {
        // 已被删除，或有并发写入的新文件时，不再删除该目录。
        if (![ 'ENOENT', 'ENOTEMPTY', 'EEXIST' ].includes(error.code)) throw error;
      }
    }
  }
  async testapi() {
    // 批量更新分类上添加字段

    await this.ctx.model.ArticleCategory.updateMany({}, { $set: { childrens: [] } })
    // 更新视频分类数量
    // let categorys = await this.ctx.model.VideoCategory.find();
    // for (let item of categorys) {
    //     let count = await this.ctx.model.VideoCategory.findOne({ num: item.num }).select('num');
    //     await this.ctx.model.Video.countDocuments({ cid: item.id }, async (err, c) => {
    //         await this.ctx.model.VideoCategory.findOneAndUpdate({
    //           _id:item._id
    //         }, { $set: { num: c } });
    //         console.log(count + '-' + c)
    //     });
    // }
    // await this.ctx.model.Video.countDocuments({ }, async (err, c) => {
    //   await this.ctx.model.VideoCategory.findOneAndUpdate({
    //     id:-1
    //   }, { $set: { num: c } });
    // })

    // let pcategorys = await this.ctx.model.VideoPlatform.find();
    // for (let item of pcategorys) {
    //   let count = await this.ctx.model.VideoPlatform.findOne({ num: item.num }).select('num');
    //   await this.ctx.model.Video.countDocuments({ pid: item.id }, async (err, c) => {
    //     await this.ctx.model.VideoPlatform.findOneAndUpdate({
    //       _id: item._id
    //     }, { $set: { num: c } });
    //     console.log(count + '-' + c)
    //   });
    // }
    // 删除重复的泛词库
    // let resw = await this.ctx.model.Fan.aggregate([
    //   { $group: { _id : {index:'$index',fcid:'$fcid'}, count: { $sum : 1 } ,dups:{$addToSet:'$_id'}}},
    //   { $match: { count: { $gt : 1}} },
    //   { $limit:100 },
    //   { $skip: 0 },
    // ])
    // console.log(resw)
    // resw.forEach((item)=>{
    //   item.dups.shift();
    //   console.log()
    //   this.ctx.model.Fan.remove({_id:{$in:item.dups}});
    // });
    // 更新模板
    // await this.ctx.model.Domain.updateMany({tname:'do_01',uname:'smart06'}, {$set:{tname:'qiye_13'}})
    //  更新泛词库索引
    // let fanCateGoryList = await this.ctx.model.Fancategory.find().sort({ "_id": -1 }).select('_id').lean();
    // for(let item of fanCateGoryList){
    //   let fcid = item._id
    //   let count = await this.ctx.model.Fan.countDocuments({
    //       fcid,
    //       index:null
    //   }, (err, c) => c);
    //   let indexcc = 0;
    //   let max_id = await this.ctx.model.Fan.aggregate([
    //     { $match: { fcid } },
    //     { $group: { _id: null, max_value: { $max: "$index" } } },
    //   ]);
    //   if(max_id&&max_id[0]){
    //     indexcc = max_id[0].max_value + 1
    //   }
    //   for(let i=0;i<count;i++){
    //       await this.ctx.model.Fan.findOneAndUpdate({
    //           index:null,
    //           fcid
    //       }, { $set: { index: indexcc } });
    //       indexcc++
    //       console.log(indexcc)
    //   }
    // }

    //  批量修改泛词库
    //  await this.ctx.model.Fan.updateMany({fcid:'612b58fa5602e26cc13f2a1c'}, {$set:{uid:'61271f5c398a652d4fb96208',uname:'smart02'}})


    // console.log('dfdf')
    // ----更新文章的分类数量
    // let categorys = await this.ctx.model.ArticleCategory.find({siteType:4});
    // for (let item of categorys) {
    //   if (item.siteType == 4) {
    //     const countName = 'article-list-' + item.id;
    //     let count = await this.ctx.model.Counters.findOne({ _id: countName }).select('seq').lean();
    //     await this.ctx.model.Article.countDocuments({ cid: item.id }, async (err, c) => {
    //       if (!count) {
    //         this.ctx.model.Counters.create({
    //           _id: countName,
    //           seq: c
    //         })
    //       } else {
    //         // 查询到的总数和当前的不一致更新总数
    //         if (!count || count.seq !== c) {
    //           await this.ctx.model.Counters.findOneAndUpdate({
    //             _id: countName,
    //           }, { $set: { seq: c } });
    //         }
    //       }
    //       console.log(countName + '-' + c)
    //     });
    //   }
    // }
    // ----更新文章每个分类下的总数
    // let categorys = await this.ctx.model.ArticleCategory.find({siteType:4,status:true});
    // for (let item of categorys) {
    //   let num = await this.ctx.model.Article.countDocuments({ cid: item.id }, async (err, c) =>c)
    //   await this.ctx.model.ArticleCategory.findOneAndUpdate({
    //     _id: item._id,
    //   }, { $set: { num } });
    //   console.log(item._id,num)
    // }
    // ----更新导航每个分类下的总数
    // let categorys = await this.ctx.model.ArticleCategory.find({siteType:8,status:true});
    // for (let item of categorys) {
    //   let num = await this.ctx.model.Nav.countDocuments({ ncids: {$in:item._id} }, async (err, c) =>c)
    //   await this.ctx.model.ArticleCategory.findOneAndUpdate({
    //     _id: item._id,
    //   }, { $set: { num } });
    //   console.log(item._id)
    // }

    // let sites = await this.ctx.model.Site.find()
    // for(let item of sites){
    //   const countName = 'article-list-all-' + item.id;
    //   let count = await this.ctx.model.Counters.findOne({ _id: countName }).select('seq').lean();
    //   await this.ctx.model.Article.countDocuments({ sid: item.id }, async (err, c) => {
    //     if (!count) {
    //       this.ctx.model.Counters.create({
    //         _id: countName,
    //         seq: c
    //       })
    //     } else {
    //       // 查询到的总数和当前的不一致更新总数
    //       if (!count || count.seq !== c) {
    //         await this.ctx.model.Counters.findOneAndUpdate({
    //           _id: countName,
    //         }, { $set: { seq: c } });
    //       }
    //     }
    //     console.log(countName+'-'+c)
    //   });
    // }

    // ----批量修改域名下的分类
    // let sites = await this.ctx.model.Site.find()
    // for(let item of sites){
    //   console.log(item.id)
    //   let ids = await this.ctx.model.ArticleCategory.find({sid:item.id})
    //   // console.log(ids)
    //   if(ids&&ids.length>0){
    //     await this.ctx.model.Domain.updateMany({sid:item.id}, {$set:{cids:ids.map(itemc=>itemc._id)}})
    //     console.log('成功@Q')
    //   }
    // }
    //--------
  }
  // 必应每日一图
  async biyingRandomImage() {
    const { ctx } = this;
    await axios({
      method: 'get',
      url: 'https://bing.com/HPImageArchive.aspx?format=js&idx=0&n=8',
      headers: {
        'accept-language': 'zh-CN',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
      }
    }).then(async (res) => {
      let images = []
      let redisImages = []
      if (res.data && res.data.images) {
        images = res.data.images
      }
      for (let item of images) {
        let options = {
          title: item.copyright,
          search: item.copyrightlink,
          image: item.url,
          quiz: item.quiz,
        }
        redisImages.push(options)
        let image = await ctx.model.Biyingimg.findOne({ image: options.image })
        if (!image) {
          await ctx.model.Biyingimg.create(options)
        }
      }
      ctx.service.cache.set('BingYingImages', redisImages);
    })
  }
  async commonController() {

  }
  async proxyip() {
    let arrlist = []
    await axios.get(`https://www.kuaidaili.com/free/inha/1/`).then((res) => {
      let body = res.data
      if (body) {
        body = body.replace(/\n/g, '')
        var $detail = cheerio.load(body, {
          decodeEntities: false
        });
        $detail('.table tbody tr').each((index, itemtr) => {
          console.log($detail(itemtr).find('td').eq(0).text() + ':' + $detail(itemtr).find('td').eq(1).text())
        })
      }
    })
    return arrlist;
  }
  async restartSetvice() {
    free = spawn('free', ['-m']);
    // 捕获标准输出并将其打印到控制台 
    free.stdout.on('data', function (data) {
      console.log('standard output:\n' + data);
    });

    // 捕获标准错误输出并将其打印到控制台 
    free.stderr.on('data', function (data) {
      console.log('standard error output:\n' + data);
    });

    // 注册子进程关闭事件 
    free.on('exit', function (code, signal) {
      console.log('child process eixt ,exit:' + code);
    });
  }
  async globalConfigUpdate({ id, updates }) {
    const { ctx } = this;
    // console.log(ctx.model)
    var ret = await ctx.model.GlobalConfig.updateOne();
    return ret;
  }
  async getNextSequence(name) {
    const { ctx } = this;
    // console.log(ctx.model)
    var ret = await ctx.model.Counters.findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      {
        new: true
      }
    );
    return ret.seq;
  }
  getTokenInfo(name) {
    const { ctx } = this;
    const stateUser = ctx.state && ctx.state.user
    if (stateUser) {
      return stateUser[name] === undefined ? '' : stateUser[name]
    }

    const clientToken = ctx.headers.authorization
    if (!clientToken) return ''

    try {
      const verifyRes = ctx.app.jwt.verify(clientToken, ctx.app.config.jwt.secret)
      return verifyRes && verifyRes[name] !== undefined ? verifyRes[name] : ''
    } catch (error) {
      return ''
    }
  }
  
  randomWord(randomFlag, min, max) {
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
  randomOneW(arr) {
    if (!arr || arr.length == 0) return "";
    return arr[Math.round(Math.random() * (arr.length - 1)) + 0];
  }

  RandomFunction(arr, num, space = null) {
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
  
  RandomZiMu(randomFlag, min, max,upperC) {
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

  randomNumber(randomFlag, min, max) {
    let str = "",
      range = min,
      arr = ['0', '1', '3', '4', '5', '6', '7', '8', '9'];
    // 随机产生
    if (randomFlag) {
      range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
      let pos = Math.round(Math.random() * (arr.length - 1));
      str += arr[pos];
    }
    str = str - 0
    return str;
  }
 
  randomEmojc(randomFlag, min, max){
    let str = "",
    range = min,
    arr = ["_","-,","/,","*,","^,","%","$","#","@","❢","¿","¡","ˉ", "ˇ", "~" ,"々" ,"～", "‖" ,"∶" ,"＇", "｀", "《" ,"》" ,"「" ,"」", "『" ,"』", "〖" ,"〗" ,"【" ,"】" ,"（", "）","€" ,"£","Ұ","₴","₰","¢","₤","¥","₳","₲","₪","₵","₣","₱","฿","¤","₡","₮","₭","₩",",ރ","円","₢","₥","₫","₦","z","ł","﷼₠","₧₯","₨","K","čर","ℂ","ℍ","ℕ","ℙ","ℚ","ℝ","ℤ","ℬ","ℰ","ℯ","ℱ","ℊ","ℋ","ℎ","ℐ","ℒ","ℓ","ℳ","ℴ","℘","ℛ","ℭ","℮","ℌ","ℑ","ℜ","ℨ","♔","♕","♖","♗","♘","♙","♚","♛","♜","♝","♞","♟" ]
    if (randomFlag) {
      range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
      let pos = Math.round(Math.random() * (arr.length - 1));
      str += arr[pos];
    }
    return str;
  }
  async delay(num = 500) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        resolve();
      }, num);
    });
  }
  sliceString(str, start, end) {
    //用来截取ID
    return str.slice(
      str.indexOf(start) + start.length,
      end ? str.indexOf(end) : str.length
    );
  }
  Mi(st, isAll) {
    //过滤首尾空格
    let afterStr = "";
    if (st) {
      //过滤全部空格
      if (isAll) {
        afterStr = st.replace(/\s|\n|\;|\'*/g, "");
      } else {
        afterStr = st.replace(/(^\s*)|(\s*$)/g, "");
      }
    }
    return afterStr;
  }
  jiamiFn(datac) {
    let casd = datac
    if (typeof casd !== 'string') {
      casd = JSON.stringify(casd)
    }
    let content = CryptoJS.AES.encrypt(
      casd,
      keycode
    ).toString();
    return content;
  }
  jiemiFn(datac) {
    let casd = datac
    let isString = 1
    if (typeof datac !== 'string') {
      casd = JSON.stringify(casd)
      isString = 0
    }
    let bytes = CryptoJS.AES.decrypt(casd, keycode);
    let originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (isString == 1) {
      originalText = JSON.parse(originalText)
    }
    return originalText
  }
  strToNumber(str) {
    if (!str) return 0;
    const hash = CryptoJS.MD5(String(str)).toString();
    const left = parseInt(hash.slice(0, 8), 16) || 0;
    const middle = parseInt(hash.slice(8, 16), 16) || 0;
    const right = parseInt(hash.slice(16, 24), 16) || 0;
    const end = parseInt(hash.slice(24, 32), 16) || 0;
    const result = (left ^ middle ^ right ^ end) >>> 0;
    return result || 1;
  }
  urlToemoj(str){
    if(!str) return '';
    let hostArr = str.split('');
    let arr = ["_","-,","/,","*,","^,","%","$","#","@","❢","¿","¡","ˉ", "ˇ", "~" ,"々" ,"～", "‖" ,"∶" ,"＇", "｀", "《" ,"》" ,"「" ,"」", "『" ,"』", "〖" ,"〗" ,"【" ,"】" ,"（", "）","€" ,"£","Ұ","₴","₰","¢","₤","¥","₳","₲","₪","₵","₣","₱","฿","¤","₡","₮","₭","₩",",ރ","円","₢","₥","₫","₦","z","ł","﷼₠","₧₯","₨","K","čर","ℂ","ℍ","ℕ","ℙ","ℚ","ℝ","ℤ","ℬ","ℰ","ℯ","ℱ","ℊ","ℋ","ℎ","ℐ","ℒ","ℓ","ℳ","ℴ","℘","ℛ","ℭ","℮","ℌ","ℑ","ℜ","ℨ","♔","♕","♖","♗","♘","♙","♚","♛","♜","♝","♞","♟" ]
    let abdd = [
      '!', '@', '$', '%', '^', '&', '*', '_', '+', '=', '`', '~', '}', '{', '(', ')', ']', '[', "'", '"', '/', '\\', '/', '#', '?', '',
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '.', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ];
    let fanStr = ''
    let fanIndex = 0
    hostArr.forEach((item) => {
      let nownum = abdd.findIndex(adbitem => adbitem === item)
      if (nownum != -1) {
        let nstr = Number(nownum * 2022)
        fanIndex += nstr
      }
    })
    fanStr = arr[fanIndex%arr.length]||'-'
    return fanStr
  }
  urlToStr(str,n=12){
    if(!str) return '';
    let hostArr = str.split('').reverse();
    let arr = ['Z','z','X','x','C','c','V','v','B','b','N','n','M','m','A','a','S','s','D','d','F','f','G','g','H','h','J','j','K','k','L','l','P','p','O','o','I','i','U','u','Y','y','T','t','R','r','E','e','W','w','Q','q'];
    let abdd = [
      '!', '@', '$', '%', '^', '&', '*', '_', '+', '=', '`', '~', '}', '{', '(', ')', ']', '[', "'", '"', '/', '\\', '/', '#', '?', '',
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '.', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ];
    let fanStr = ''
    let fanIndex = 0
    hostArr.forEach((item) => {
      let nownum = abdd.findIndex(adbitem => adbitem === item)
      if (nownum != -1) {
        let nstr = arr[nownum%arr.length]||'A'
        fanStr += nstr
        fanIndex++
      }
    })
    if(fanStr.length>n){
      fanStr = fanStr.slice(0,n)
    }
    return arr[fanIndex%arr.length]+fanStr
  }
  async getFanItemOne(fanIndex, fcid) {
    let f_item = {
      title: '',
      keywords: '',
      description: ''
    }
    if (!fanIndex >= 1) {
      fanIndex = 1;
    }
    if (fcid&&fcid.num > 0) {
      let indexB = fanIndex % fcid.num;
      //先去缓存fan文件里面查找泛的 分类id-泛索引indexB 命名的json 文件
      let fanFileName = fcid._id + '-' + indexB
      let FanPageFilePath = this.ctx.app.config.cacheFile + 'fan/' + fanFileName
      try {
        let f_item_text = fs.readFileSync(FanPageFilePath + '.json', 'utf-8');
        if (f_item_text) {
          f_item = JSON.parse(f_item_text)
        }
      } catch (e) {
        f_item = await this.ctx.model.Fan.findOne({
          index: indexB,
          fcid: fcid._id
        })
        if (f_item) {
          fs.writeFile(FanPageFilePath + '.json', JSON.stringify(f_item), null, function (err) { });
        }
      }
    }
    return f_item
  }

  async getMuluWordCount(criteria) {
    const key = String(criteria.mcid);
    let entry = muluWordCounts.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (muluWordCounts.size >= 256) muluWordCounts.delete(muluWordCounts.keys().next().value);
      // 同一进程内共享计数请求，避免缺失索引的并发访问反复扫描分类。
      entry = { count: Promise.resolve(this.ctx.model.Mulu.countDocuments(criteria)), expiresAt: Date.now() + MULU_COUNT_CACHE_MS };
      muluWordCounts.set(key, entry);
    }
    try {
      const count = Number(await entry.count);
      if (!Number.isSafeInteger(count) || count <= 0) {
        if (muluWordCounts.get(key) === entry) muluWordCounts.delete(key);
        return 0;
      }
      return count;
    } catch (error) {
      if (muluWordCounts.get(key) === entry) muluWordCounts.delete(key);
      throw error;
    }
  }

  async getMuluItemOne(muluIndex, mcid) {
    const categoryRef = mcid && (mcid._id
      || (typeof mcid === 'string' || typeof mcid.toHexString === 'function' ? mcid : null));
    if (!categoryRef) return normalizeMuluWord(null);
    const categoryId = String(categoryRef);
    const configuredCount = Number(mcid.num);
    const seed = Number(muluIndex);
    muluIndex = Number.isSafeInteger(seed) && seed >= 0 ? seed : 1;
    const writeCache = (word, index) => {
      if (!Number.isSafeInteger(index) || index < 0) return;
      const filename = this.ctx.app.config.cacheFile + 'mulu/' + categoryId + '-' + index + '.json';
      fs.writeFile(filename, JSON.stringify(word), null, function (err) { });
    };

    // 正常连续索引继续使用原来的缓存和精确查询。
    if (Number.isSafeInteger(configuredCount) && configuredCount > 0) {
      const index = muluIndex % configuredCount;
      const filename = this.ctx.app.config.cacheFile + 'mulu/' + categoryId + '-' + index + '.json';
      let cached;
      try { cached = JSON.parse(fs.readFileSync(filename, 'utf-8')); } catch (error) { /* 缓存未命中时查询数据库。 */ }
      const cachedWord = normalizeMuluWord(cached);
      if (cachedWord.title && (!cachedWord.mcid || String(cachedWord.mcid) === categoryId)
        && (cachedWord.index === undefined || Number(cachedWord.index) === index)) return cachedWord;
      const word = normalizeMuluWord(await this.ctx.model.Mulu.findOne({ index, mcid: categoryRef }));
      if (word.title) { writeCache(word, index); return word; }
    }

    // num 是词条数量，不代表 index 从 0 连续编号；断号或旧计数要按实际位置选词。
    const criteria = { mcid: categoryRef, title: { $regex: /\S/ } };
    const count = await this.getMuluWordCount(criteria);
    if (count > 0) {
      let item = await this.ctx.model.Mulu.findOne(criteria).sort({ index: 1, _id: 1 }).skip(muluIndex % count).lean();
      if (!normalizeMuluWord(item).title) {
        // 计数后有词条被删除时，重新取该分类仍存在的一条，下一次访问重新计数。
        muluWordCounts.delete(categoryId);
        item = await this.ctx.model.Mulu.findOne(criteria).sort({ index: 1, _id: 1 }).lean();
      }
      const word = normalizeMuluWord(item);
      if (word.title) {
        // 按词条实际 index 保存，不能把其他词写进缺失索引的缓存文件。
        writeCache(word, Number(word.index));
        return word;
      }
    }
    if (this.ctx.logger) {
      this.ctx.logger.warn('[muluword] empty library: mcid=%s path=%s', categoryId, this.ctx.path || '');
    }
    return normalizeMuluWord(null);
  }

  async getSiteInfo() {
    const { ctx } = this;
    // console.log(1)
    let h = ctx.request.header.host
    if (!h || h.length > 2000) return { domain: null }
    let host = h.toLowerCase();
    // hostname 不包含端口；识别为 IP 后保留原始 host 供数据库匹配，避免被误拆成泛域名。
    let isIpHost = isIP(ctx.hostname) !== 0
    let linkarr = host.split('')
    let isFanArr = linkarr.filter(item1 => item1 === '.')
    let domainEndList = ['.com.cn', '.org.cn', '.net.cn', '.cn.com', '.cn.net', '.yn.cn', '.gx.cn', '.hk.cn', 'ac.cn']
    let isHave = domainEndList.find(item => host.indexOf(item) >= 0)
    let f_host = ''
    let f_isget = false
    // 泛域名 截取方式 news.fasd.com  fasd.com  www.dd.fasd.com  sss.com.cn


    // 如果是蜘蛛强制不跳转
    let isSpider = false
    let userAgentA = ctx.request.header['user-agent']
    // let uaStr = ctx.get('user-agent');
    let referer = ctx.request.header['referer'];
    let isMobile = false;
    let isBaiduSpider = false;

    const sUserAgent = userAgentA ? userAgentA.toLowerCase() : '';
    if (sUserAgent) {
      isMobile = MOBILE_UA_MARKERS.some(marker => sUserAgent.includes(marker));
      isSpider = sUserAgent.includes('bot') || sUserAgent.includes('spider');
    }

    let f_item = {
      title: '',
      keywords: '',
      description: ''
    }

    if (!isIpHost && isFanArr.length >= 2) {
      // 如果.大于两个 从第一个截取 判断一定是泛
      if (isFanArr.length > 2 && isHave) {
        // 先删除最后两个点.
        let beforeHost = host.slice(0, host.lastIndexOf('.'))
        let lastHost = host.slice(host.indexOf(isHave))
        beforeHost = beforeHost.slice(0, beforeHost.lastIndexOf('.'))
        f_host = beforeHost.slice(0, beforeHost.lastIndexOf('.'))
        host = beforeHost.slice(beforeHost.lastIndexOf('.') + 1) + lastHost
        f_isget = true
      } else if (isFanArr.length == 2 && isHave) {
        //这里不是泛
        f_isget = false
        f_host = ''
      } else {
        let beforeHost = host.slice(0, host.lastIndexOf('.'))
        f_host = beforeHost.slice(0, beforeHost.lastIndexOf('.'))
        host = host.slice(beforeHost.lastIndexOf('.') + 1)
        f_isget = true
      }
    }
    const domainResult = await ctx.service.domain.findDomain(host);
    let { data } = domainResult;

    
    if (!data || !data.domain || !data.domain._id) {
      //h5页面直接加载导航站点 pc或者蜘蛛 直接加载导航链接
      return { domain:{spider:isSpider,isMobile,host,agentLink:{}}, site: null }
      // ctx.status = 501;
      // ctx.body ='';
      // return ctx.body = `<body style="padding:20px;text-align:center;"><h1>UTILS域名未绑定！</h1></body>`;
    }
    const domainData = data.domain;
    const requestUrl = h + ctx.url;
    const now = new Date();
    const nowTimestamp = now.getTime();
    // console.log(3333333,domainData.agentid)
    const agentLinkPromise = getProcessedAgentLink(ctx, domainData.agentid);
    // 随机生产泛域名前缀 
    domainData.fullDomain = (f_host ? f_host + '.' : '') + domainData.link;
    
    let httpsbo = "http://"
    if(ctx.secure&&ctx.protocol==="https"){
      httpsbo = "https://"
    }
    domainData.httpFullDomain = httpsbo + domainData.fullDomain;
    domainData.http = httpsbo;
    domainData.fullUrl = httpsbo + domainData.fullDomain + ctx.url;


    domainData.sfurl = COMMONDATA
    let domainTitle = domainData.title
    let imageNums = ctx.service.utils.strToNumber(requestUrl)||500 // 随机基数
    let imageFileNum = 200 // 文件夹里面图片的数量

    // if (data.domain.fullDomain) {
    //   data.domain.fullDomain.split('').forEach((item) => {
    //     imageNums += item.charCodeAt()
    //   })
    // }
    // console.log(data.domain.imgTypeName)
    if (domainData.imgTypeName) {
      imageFileNum = IMG_TYPE_NUM_MAP.get(domainData.imgTypeName) || imageFileNum;
    }
    domainData.imageNums = imageNums % imageFileNum;
    if(domainData.imageNums<10) domainData.imageNums = 10;
    if(domainData.imageNums>imageFileNum-10) domainData.imageNums = imageFileNum-10;
    //console.log(data.domain.imageNums)
    let isFanListType = false;

    if (
      domainData.isFan > 0 &&
      domainData.isFan < 3 &&
      f_host &&
      f_host !== 'www' &&
      domainData.fcid
    ) {
      // 如果是随机泛目录
          // data.domain.iscache = false;
      isFanListType = true;
    }

    //描述是动态标题固定
    if(domainData.isFan==4 && f_host && f_host !== 'www'){
      isFanListType = true;
    }

    if(isFanListType){
      if (domainData.isWordRandom) {
        f_host = f_host + ctx.service.utils.randomWord(1, 1, 10)
      }
      // console.log(f_host)
      if (f_isget) {
        let fanIndex = ctx.service.utils.strToNumber(domainData.fullDomain)
        f_item = await ctx.service.utils.getFanItemOne(fanIndex, domainData.fcid)
      }
      // data.domain.fullDomain = f_host+data.domain.link;
      // 符合泛站域名的条件
      if (f_item && f_host && f_item.title) {
        domainData.title = f_item.title
        domainData.keyWords = f_item.keywords
        domainData.description = f_item.description
        // data.domain.fullDomain = ctx.service.utils.randomWord(1, 1, 10) + '.' + host
      }
      if(domainData.isFan==4){
        domainData.title = domainTitle
      }
    }
    // ip 是百度蜘蛛或者搜狗蜘蛛的 ip
    // 116.179.32
    // 220.181.108
    // console.log(ctx.request.ip.indexOf('116.179.32'))
    const requestIp = ctx.request.ip || '';
    isBaiduSpider = BAIDU_SPIDER_IP_PREFIXES.some(prefix => requestIp.startsWith(prefix));
    // if(!isSpider&&ctx.request.ip){
    //   //百度ip 列表
    //   let baiduIpList = []
    //   // for(let ipc = 64;ipc<=83;ipc++){
    //   //   baiduIpList.push('66.249.'+ipc+'.')
    //   // }
    //   for(let ipc = 32;ipc<=38;ipc++){
    //     baiduIpList.push('220.181.'+ipc+'.')
    //   }
    //   for(let ipc = 145;ipc<=146;ipc++){
    //     baiduIpList.push('61.135.'+ipc+'.')
    //   }
    //   for(let ipc = 162;ipc<=169;ipc++){
    //     baiduIpList.push('61.135.'+ipc+'.')
    //   }
    //   for(let ipc = 186;ipc<=190;ipc++){
    //     baiduIpList.push('61.135.'+ipc+'.')
    //   }
    //   for(let ipc = 75;ipc<=123;ipc++){
    //     baiduIpList.push('220.181.108.'+ipc)
    //   }
    //   for(let ipc = 110;ipc<=115;ipc++){
    //     baiduIpList.push('220.181.'+ipc+'.')
    //   }
    //   for(let ipc = 249;ipc<=250;ipc++){
    //     baiduIpList.push('202.108.'+ipc+'.')
    //   }
    //   for(let ipc = 66;ipc<=71;ipc++){
    //     baiduIpList.push('123.125.'+ipc+'.')
    //   }
    //   for(let ipc = 13;ipc<=35;ipc++){
    //     baiduIpList.push('119.188.14.'+ipc)
    //   }
    //   baiduIpList.forEach(item=>{
    //     if(ctx.request.ip.indexOf(item)>=0){
    //       isSpider = true;
    //     }
    //   })
    // }
    if (isSpider) data.domain.isOpenUrl = -1;

    // 如果是镜像并且有镜像url
    // if (data.domain.isJingXiang == 1 && data.domain.jingXiangUrl) {
    //   data.domain['tname'] = 'n_iframe_1'
    // }
    // 如果是搜狗 非蜘蛛而且跳转的情况下 把标题描述关键词清了
    data.domain['is301'] = false;
    data.domain.isBaiduType = 0;
    data.domain['urlNumber'] = ctx.service.utils.strToNumber(requestUrl)||123
    data.domain['banBenNumber'] = '1.18.16'
    const numCurlNum = data.domain.urlNumber;
    if (numCurlNum > 1000) {
      const str = String(numCurlNum);
      data.domain.banBenNumber = 'V'+[
        str[0],
        str.slice(1, 3),
        str.slice(3, 4)
      ].join('.');
    }
    //console.log(data.domain['banBenNumber'])
    const domainUrl = data.domain.fullDomain + ctx.url;
    const templateValues = {
      '域名': data.domain.fullDomain,
      '站名': data.domain.beiAnName,
      '关键字': data.domain.keyWords,
      '版本号': data.domain.banBenNumber,
      '数字': data.domain.urlNumber,
      '字母': ctx.service.utils.urlToStr(domainUrl),
      '符号': ctx.service.utils.urlToemoj(domainUrl),
    };
    data.domain.title = replaceTemplateTokens(data.domain.title, templateValues);
    templateValues['标题'] = data.domain.title;
    data.domain.description = replaceTemplateTokens(data.domain.description, templateValues);
    // 判断是否转码 如果开启了转码
    if (data.domain.tdkEncode) {
      data.domain.title = myencodeFn(data.domain.title)
      data.domain.description = myencodeFn(data.domain.description)
      data.domain.keyWords = myencodeFn(data.domain.keyWords)
    }

    if (data.domain.browserType == 'sogo' && !isSpider && data.domain.isOpenUrl > -1) {
      // data.domain['is301'] = true;
      // data.domain.isBaiduType = 1;
      // data.domain.ispcpage = true
    }
    //如果是百度站 非蜘蛛 把标题描述关键词清了 并且如果是手机端直接跳转
    if (
      data.domain.browserType == 'baidu' &&
      !isSpider
    ) {
      let fromNum = data.domain.fromNum - 0 || 0
      //如果是百度站点并且是百度来路不是蜘蛛并且是首页 fromNum+1 主要用来判断未收录域名不跳转
      if (referer && referer.indexOf('baidu') > 0 && fromNum < 3 && (ctx.request.url == '/' ||ctx.request.path == '/' || ctx.request.path == '/index.html')) {
        fromNum++
        data.domain.fromNum = fromNum
        //更新数据库
        await ctx.model.Domain.findOneAndUpdate({ link: host }, { $set: { fromNum } }).then(() => { }).catch()
        //更新静态缓存
        await ctx.service.domain.refreshDomain(data.domain.link)
      }
      //h5跳转 pc关闭
      if (fromNum >= 3 && data.domain.isOpenUrl > -1&&data.domain.isOpenUrl<9) {
        if (isMobile) {
          data.domain.isBaiduType = 1
        } else {
          data.domain.isBaiduType = 2
        }
      } else if (data.domain.ispcpage==-1||data.domain.ispcpage ==0) {
        data.domain.isBaiduType = 2
      }
      // 强制不跳转也不显示页面
      if (data.domain.isOpenUrl <= -1 && data.domain.ispcpage==0) {
        data.domain.isBaiduType = 2
      }
      //全跳转
      if (data.domain.isOpenUrl == 3) {
        data.domain.isBaiduType = 1
      }
      //未开启403仅内页H5跳转
      if (data.domain.isOpenUrl == 2 && data.domain.ispcpage==0 && !isMobile) {
        data.domain.isBaiduType = 4
      }
    }
    // 仅内页H5跳转
    if (!isSpider && data.domain.isOpenUrl == 2 && isMobile) {
      data.domain.isBaiduType = 3
    }
     // 内页h5引擎跳转
    if (!isSpider && data.domain.isOpenUrl == 2.1 && isMobile) {
      data.domain.isBaiduType = 5
    }

    // 设置h5 跳转的
    if (data.domain.isOpenUrl == 5 && !isSpider && isMobile) {
      data.domain.isBaiduType = 1
    }
    if(data.domain.isOpenUrl==9){
      //目录以及五页面 go 跳转
      data.domain.isBaiduType = -1
    }

    //h5 引擎跳转
    if(data.domain.isOpenUrl==6){
      if(isMobile&&referer&&referer.indexOf('baidu')>=0){
        data.domain.isBaiduType = 1
      }else{
        data.domain.isBaiduType = 0
      }
    }
    //h5 pc 跳转
    if (data.domain.isOpenUrl == 10 && !isSpider) {
      data.domain.isBaiduType = 1
    }
    data.domain.spider = isSpider
    data.domain.isSpider = isSpider
    data.domain.isMobile = isMobile
    data.domain.isBaiduSpider = isBaiduSpider

    data.domain.isChangeTitle = -1;

    // 获取全局缓存文件


    // console.log(ctx.request.header)
    // 如果非蜘蛛、不跳转、pc开启、不是泛站的情况把标题改成备用标题
    // console.log(f_host)
    // 暂时先不改
    if (data.domain.beiAnName && data.domain.beiAnName !== data.domain.title) {
      if (data.domain.isOpenUrl==-1&&data.domain.browserType == 'baidu' && !data.domain.isSpider && !data.domain.isMobile && data.domain.ispcpage===1&&f_host=='') {
        data.domain.isChangeTitle = 1;
      }
    }

    // Agent 查询在域名加载后已启动，与中间计算和泛词读取并行。
    const agentLink = await agentLinkPromise;
    // console.log(agentLink)
    data.domain['agentLink'] = agentLink
    data.domain['linkID'] = data.domain.fullDomain.replace(/\./g, '')
    const dateParts = formatLocalDateParts(now);
    data.domain['todayDay'] = dateParts.todayDay
    data.domain['urlString'] = ctx.service.utils.urlToStr(requestUrl)||'aAbBcC'
    data.domain['urlEmoj'] = ctx.service.utils.urlToemoj(requestUrl)||''
    data.domain['allNUrl'] = requestUrl

    let jIOSUrl = agentLink.openUrlIOS || '';
    let jURL = jIOSUrl.replace(/##/g, '')+'?v='+nowTimestamp;
    data.domain['jumpHTML'] = '';
    let agentPageName = data.domain.agentLink.agentPageName + '.html'
    // let agentPageFilePath = process.cwd() + '/app/public/html/' + agentPageName
    // let isHaveagentFile = fs.existsSync(agentPageFilePath)
    // 如果开启了缓存并且有缓存文件直接返回
    if (agentLink.isAgentPage) {
      jURL = '/html/'+agentPageName+'?v='+nowTimestamp;
    }
    data.domain['jumpURL'] = jURL;
    // console.log(data.domain.isBaiduType)
    //符合静态页面跳转条件 有缓存走缓存 没有缓存直接跳
    data.domain.jumpIFrameHTML = buildJumpIframeHtml(jURL, agentLink.gajs);

    let setJumpStatus = false;
    if(isMobile&&!isSpider&&data.domain.isOpenUrl>-1&&(data.domain.isBaiduType == 3 || data.domain.isBaiduType == 1)){
      setJumpStatus = true
    }
    //内页H5引擎跳转
    if(isMobile&&!isSpider&&data.domain.isBaiduType == 5&&referer){
      setJumpStatus = true
    }
    //内页H5跳转
    if(isMobile&&!isSpider&&data.domain.isBaiduType == 4){
      setJumpStatus = true
    }
    if(setJumpStatus){
      data.domain['jumpHTML'] = data.domain.jumpIFrameHTML;
    }
    
    delete data.domain.agentid
    data.domain.randomVersion = ctx.service.utils.randomNumber(1,1,12)+nowTimestamp.toString().slice(2);
    data.domain.randomClass = ctx.service.utils.RandomZiMu(1,1,12,1)
    data.domain.randomNumber = ctx.service.utils.randomNumber(1,1,6)
    // data.domain.randomWord = ctx.service.utils.RandomZiMu(1,1,12,1)

    let cturlc = ctx.url.replace(/\?|\:\/|\.|\#|\%|/g,'')
    data.domain.allUrl = data.domain.fullDomain+cturlc+data.domain.randomVersion

    data.domain.detailNowTodayTime = dateParts.date
    data.domain.detailNowTime = dateParts.detailTime
    data.domain.muluRandomMulu = '';
    if (data.domain.isMuLu) {
      data.domain.muluRandomMulu = '/?post='+ctx.service.utils.RandomZiMu(1,1,12,1)+'&article=' + ctx.service.utils.randomWord(1, 1, 10) + nowTimestamp.toString().slice(4)+'.html'
    }
    data.domain.f_host = f_host
    if (data.domain.tname.indexOf('n_frame') == 0) {
      firameTpList.forEach(itemframe => {
        if (itemframe.value === data.domain.tname) {
          data.domain.iframeUrl = itemframe.url
          data.domain['tname'] = 'n_frame_1';
        }
      })
    }
    return { domain: data.domain, site: data.site }
  }
  async uploadImage({ fileType }) {
    const { ctx } = this;
    const files = ctx.request.files;
    // 上传基础目录
    const dirName = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
    const uplaodBasePath = 'uploads/' + fileType + '/' + dirName + '/';
    let resdata = []
    try {
      for (const file of files) {
        //验证文件大小
        const fileSize = fs.readFileSync(file.filepath).length / Math.pow(1024, 2)
        if (fileSize > 20) {
          return {
            message: '文件不能超过20M',
            code: 400
          }
        }
        // 生成文件名
        const filename = Date.now() + '' + Number.parseInt(Math.random() * 10000) + path.extname(file.filename);
        // 生成文件夹
        if (!fs.existsSync(path.join(this.config.baseDir, uplaodBasePath))) {
          fs.mkdirSync(path.resolve(this.config.baseDir, uplaodBasePath))
        }
        const targetPath = path.join(this.config.baseDir, uplaodBasePath, filename);
        const source = fs.createReadStream(file.filepath);
        const target = fs.createWriteStream(targetPath);

        resdata.push({
          index: file.field - 0,
          url: (uplaodBasePath + filename).slice(3)
        })
        const username = this.service.utils.getTokenInfo('username');
        const userId = this.service.utils.getTokenInfo('id');

        this.ctx.model.Upload.create({
          name: filename,
          username,
          sitename: '导航logo',
          path: (uplaodBasePath + filename).slice(3),
          uid: userId,
          size: Math.round(fileSize * 100) / 100,
          sid: 0,
        }); //记录存到数据库
        await pump(source, target);
      }
    } finally {
      // delete those request tmp files
      await ctx.cleanupRequestFiles();
    }
    return {
      code: 200,
      data: resdata
    }

  }
  //上传图片的
  async uploadFiles({ fileType }) {
    const { ctx } = this;
    const files = ctx.request.files;
    // 上传基础目录
    const dirName = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
    const uplaodBasePath = 'app/public/uploads/' + fileType + '/' + dirName + '/';
    let resdata = []
    try {
      for (const file of files) {
        // 验证文件大小
        const fileSize = fs.readFileSync(file.filepath).length / Math.pow(1024, 2)
        if (fileSize > 20) {
          return {
            message: '文件不能超过20M',
            code: 400
          }
        }
        // 生成文件名
        const filename = Date.now() + '' + Number.parseInt(Math.random() * 10000) + path.extname(file.filename);
        // 生成文件夹
        if (!fs.existsSync(path.join(this.config.baseDir, uplaodBasePath))) {
          fs.mkdirSync(path.resolve(this.config.baseDir, uplaodBasePath))
        }
        const targetPath = path.join(this.config.baseDir, uplaodBasePath, filename);
        const source = fs.createReadStream(file.filepath);
        const target = fs.createWriteStream(targetPath);

        resdata.push({
          index: file.field - 0,
          url: (uplaodBasePath + filename).slice(3)
        })
        const username = this.service.utils.getTokenInfo('username');
        const userId = this.service.utils.getTokenInfo('id');

        this.ctx.model.Upload.create({
          name: filename,
          username,
          sitename: '导航logo',
          path: (uplaodBasePath + filename).slice(3),
          uid: userId,
          size: Math.round(fileSize * 100) / 100,
          sid: 0,
        }); //记录存到数据库
        await pump(source, target);
      }
    } finally {
      // delete those request tmp files
      await ctx.cleanupRequestFiles();
    }

    return {
      code: 200,
      data: resdata
    }
  }
  //目录--------------------------------暂时放弃25-2.27
  async mulu() {
    const { ctx } = this;
    let url = ctx.url
    let curl = ctx.url
    if (!url || url.length > 500) return ctx.body = '<h1>无<h1>';
    let { domain } = await ctx.service.utils.getSiteInfo();
    if(!domain){
      ctx.status = 404;
      return ctx.body = `MuLu NO Domain - 404`
    }
    if (domain.ispcpage==0 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
      ctx.status = 403  // 500
      ctx.body='';
      return;
    }
    // 如果是首页无内页百度的话直接444-baidu01  内页访问--百度蜘蛛正常，用户访问状态502 广告页面
    if((domain.browserType == 'baidu01'||domain.browserType == 'baidu02')&&!domain.isBaiduSpider){
        ctx.status = 201;
        //这里应该是跳转
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

    url = domain.fullDomain+ctx.url
    if (domain && !domain.isMuLu){
      return ctx.body = `未开启MuLu NO Domain - 404`
      // return ctx.render('404c.html',{detail:domain,domain:domain});
    }

    let result = {
      domain,
    };
    result.imageNums = ctx.service.utils.strToNumber(domain.fullDomain+url)%2331
    //跳转条件
    if (domain.isOpenUrl > -1 && (domain.browserType == 'baidu' && domain.isMobile && !domain.spider) || domain.isBaiduType == 1 || domain.isBaiduType == 3|| domain.isBaiduType == -1) {
      let IOSUrl = domain.agentLink.openUrlIOS;
      let URL = IOSUrl.replace(/##/g, '')+'?v='+Date.now();
      let agentPageName = domain.agentLink.agentPageName + '.html'
      let agentPageFilePath = process.cwd() + '/app/public/html/' + agentPageName
      let isHaveagentFile = fs.existsSync(agentPageFilePath)
      let detailInfo = {}
      // 如果开启了缓存并且有缓存文件直接返回
      if (isHaveagentFile) {
        URL = '/html/' + agentPageName+'?v='+Date.now()
      }

      result.jumpHTML = `
      <script>
      var jumpLinkIframe = function(url){
          var URL = url
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
                document.body.parentNode.insertBefore(iframe,document.body);
              };
          createIframe('global-iframe', URL, '100%', '100%');
        }
        jumpLinkIframe("${URL}")
        </script>
        ${domain.agentLink.gajs}
      `
      // // ctx.status = 403
      // if (domain.agentLink.isAgentPage) {
      //   let agentPageName = domain.agentLink.agentPageName + domain.agentLink._id + '.json' || 'index.json';
      //   let agentPageFilePath = process.cwd() + '/app/public/agentpage/' + agentPageName
      //   let isHaveagentFile = fs.existsSync(agentPageFilePath)
      //   // 如果开启了缓存并且有缓存文件直接返回
      //   let isHaveList = false;
      //   let txtpage = '';
      //   if (isHaveagentFile) {
      //     let text = fs.readFileSync(agentPageFilePath, 'utf-8');
      //     let datac = JSON.parse(text);
      //     txtpage = datac.txtpage;
      //     let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
      //     if (chaTime >= this.ctx.app.config.common.AGENT_PAGE || chaTime < 0) {
      //       isHaveList = false
      //     } else {
      //       isHaveList = true
      //     }
      //   }
      //   let pageurl = domain.agentLink.openUrlH5.replace(/##/g, '');
      //   if (!isHaveList && pageurl) {
      //     axios.get(pageurl).then((res) => {
      //       if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
      //         try { fs.unlinkSync(agentPageFilePath); } catch { }
      //         let savehtml = res.data.replace('</body>', domain.agentLink.gajs + '</body>')
      //         let savelist = {
      //           updateCacheTime: Date.now(),
      //           txtpage: savehtml
      //         }
      //         fs.writeFile(agentPageFilePath, JSON.stringify(savelist), null, function (err) { });
      //       }
      //     })
      //   }
      //   if (txtpage) {
      //     return this.ctx.body = txtpage
      //   }
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
    // console.log(url)
    let fileFilenme = curl
    if (curl == '/ml/') {
      fileFilenme = url + 'index.html'
    }
    let homePageFilePath = process.cwd() + '/app/view' + fileFilenme
    let isHaveIndexHtml = fs.existsSync(homePageFilePath)
    let articleinfo = {}
    //如果有
    if (isHaveIndexHtml) {
      await this.ctx.render(fileFilenme, result).then((res) => { }).catch((err) => {
        return this.ctx.render('error.html');
      });
    } else {
      


      let hostArr = url.split('');
      let abdd = ['', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '.', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];//27
      let muluIndex = ''
      hostArr.forEach((item) => {
        let nownum = abdd.findIndex(adbitem => adbitem === item)
        if (nownum != -1) {
          let nstr = nownum * 2023
          muluIndex += nstr
        }
      })
      let indexB = muluIndex % result.domain.mcid.num;
      //先去缓存fan文件里面查找泛的 分类id-泛索引indexB 命名的json 文件
      let f_item = await ctx.service.utils.getMuluItemOne(indexB,domain.mcid)
      let pathxc = process.cwd() + `/app/service/datajson/article/youxi/${muluIndex%16203}.json`
      // console.log(pathxc)
          try{
              let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
              if(articleFileTxt){
                  articleinfo = JSON.parse(articleFileTxt)
              }
          }catch{
            articleinfo = JSON.parse(articleJsonTP)
          }

      if (f_item.description) {
        f_item.description = f_item.description.replace(/\[域名\]|域名/g, domain.fullDomain)
        f_item.description = f_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
        f_item.description = f_item.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
        f_item.description = f_item.description.replace(/\[关键字\]|关键字/g, f_item.keywords)
        f_item.description = f_item.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
        f_item.description = f_item.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
        f_item.description = f_item.description.replace(/\[数字\]|数字/g, domain.urlNumber)
        f_item.description = f_item.description.replace(/\《|\》/g, "")
      }
      if (f_item.title) {
        //   if (f_item.title.indexOf("《") !== 0) {
        //     f_item.title = "《" + f_item.title + "》"
        //   }
        f_item.title = f_item.title.replace(/\[域名\]|域名/g, domain.fullDomain)
        f_item.title = f_item.title.replace(/\[站名\]|站名/g, domain.beiAnName)
        f_item.title = f_item.title.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
        f_item.title = f_item.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
        f_item.title = f_item.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
        f_item.title = f_item.title.replace(/\[数字\]|数字/g, domain.urlNumber)
      }
      // 如果百度未开启pc并且是pc端的情况


      // titleType ---内页标题类型 
      if(domain.titleType==1){
        f_item.title = domain.fullDomain+ctx.url
      }

      if (
        domain &&
        !domain.spider &&
        !domain.isMobile &&
        domain.isOpenUrl!=3&&
        (domain.ispcpage==0)//||domain.ispcpage ==0
      ) {
        return ctx.render('404c.html',{detail:f_item,domain:domain});
      }
      result.articleinfo = articleinfo;
      result.detail = f_item
      // console.log(f_item)
      // 导入泛
      if (domain.isFan == 1) {
        let aDom = ''
        let wordListFan = ["gov.cn.", "edu.cn.", "www.", "m.", "app.", "h5.", "wap."];
        for (let i = 0; i < 2; i++) {
          let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
          aDom += `<a href="http://${wordc}.${domain.link}">${wordc}</a>`
        }
        aDom = '<div class="add-daorufan">' + aDom + '</div>'
        result.fanContent = aDom;
      }
      if(result.imageNums<2)result.imageNums = 10
      // 导入目录

      if (domain.isMuLu) {
        let aDom = ''
        let wordListFan = ["a", "b", "n", "m", "a", "s", "d", "f", "g", "h", "j", "k", "l", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "ac", "ab", "dv", "er", "rt", "vg", "fd", "gf", "df", "se", "qs", "91", "df", "kj", "lk", "ui", "re", "er", "dc", "cs"];
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
        for (let i = 0; i < 2; i++) {
          let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
          let numberd = ctx.service.utils.randomNumber(1, 1, 10)
          aDom += `<a href="http://${domain.fullDomain}/${wordc}/${Date.now().toString().slice(6)}.html">${domain.titleText}${wordc}${nowDatec}</a>
                  <a href="http://${domain.fullDomain}/${wordc}/${numberd}.html">${domain.titleText}${wordc}${nowDatec}</a>
                  <a href="http://${domain.fullDomain}/ml/1/${ctx.service.utils.randomNumber(1, 1, 6)}.html">${domain.titleText}${wordc}${nowDatec}</a>
          `
        }
        aDom = '<div class="add-daorumulu">' + aDom + '</div>'
        result.muluContent = aDom;
      }
      //导入最新的文章
      result.newArticleList = [];
      let newArticleList = [];
      let cachePageFilePath = this.ctx.app.config.cacheFile + 'article_list'
      let articleRdmNum = ['/index.json', '/index1.json', '/index2.json', '/index3.json', '/index4.json', '/index5.json', '/index6.json', '/index7.json', '/index8.json', '/index9.json']
      let articleRdmName = articleRdmNum[Math.floor(Math.random() * articleRdmNum.length)]
      try {
        let rowstext = fs.readFileSync(cachePageFilePath + articleRdmName, 'utf-8');
        if (rowstext) {
          newArticleList = JSON.parse(rowstext)
        }
      } catch (e) {
      }
      result.newArticleList = newArticleList;

      // 判断文件详情页面是否存在
      let path = process.cwd() + `/app/view/template/${domain.tname}/ml.html`
      const renderName = resolveTemplate(`${domain.tname}:ml.html`, path, `template/${domain.tname}/ml.html`, '/ml/index.html');
      await ctx.render(renderName, result).catch(() => {
        return this.ctx.render('error.html');
      });

      // await this.ctx.render('/ml/index.html', result).catch((err) => {
      //   return ctx.render('/so.html', result);
      // });
    }
  }
  async allPage() {
    const { ctx } = this;
    // let referer = ctx.request.header['referer'];
    // let fanIndex = 1
    let muluIndex = 1
    // let hostArr = []
    // let fileName = ctx.header.host + ctx.url
    // let is404 = false;
    if (isIP(ctx.hostname)) {ctx.status = 444;ctx.body = '';return;}
    if (!!ctx.url && ctx.url.length > 5000) {
      ctx.status = 403;
      return ctx.body = ''
    }
    // hostArr = fileName.split('');

    let requestPath = String(ctx.path || ctx.url || '/').split(/[?#]/, 1)[0];
    try {
      requestPath = decodeURIComponent(requestPath);
    } catch (error) {
      // 无法解码时保留原路径，继续原来的页面兜底。
    }
    const regFileNameList = ['.map', '.jpg', '.css', '.zip', '.xsl', '.svg', '.mp4', '.mp3', '.xml', '.txt', '.js', '.gif', '.webp', '.jpeg', '.png', '.wof', '.woff', '.woff2', '.ttf', '.ico'];
    const fileNameExt = path.posix.extname(requestPath.replace(/\\/g, '/')).toLowerCase();
    if (regFileNameList.includes(fileNameExt)) {
      ctx.status = 444;
      return ctx.body = ''
    }
    // console.log(11)

    // hostArr.forEach((item) => {
    //   fanIndex += (1 + item.charCodeAt(0))
    // })
    // let abdd = [':', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '.', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];//27
    // hostArr.forEach((item) => {
    //   let nownum = abdd.findIndex(adbitem => adbitem === item)
    //   if (nownum != -1) {
    //     let nstr = nownum * 2022
    //     fanIndex += nstr
    //     muluIndex += nstr
    //   }
    // })
    // console.log(fileName,fanIndex)
    let { domain } = await ctx.service.utils.getSiteInfo();

    if (!domain) {
      ctx.status = 404
      return ctx.body = '<h1>ALL PAGE 404 无DOMAI<h1>'
    }
    const agentLink = domain.agentLink && typeof domain.agentLink === 'object' ? domain.agentLink : {};
    const renderDefaultPage = () => ctx.app.controller.uplink.index.sbb02.call(ctx);
    const getJumpUrl = () => {
      const userAgent = String(ctx.request.header['user-agent'] || '');
      let value;
      if (/android|adr/i.test(userAgent)) {
        value = agentLink.openUrlAndroid || agentLink.openUrlH5 || agentLink.openUrlIOS;
      } else if (/iphone|ipad|ipod/i.test(userAgent)) {
        value = agentLink.openUrlIOS || agentLink.openUrlH5;
      } else {
        value = agentLink.openUrlH5 || agentLink.openUrlIOS;
      }
      if (typeof value !== 'string') return '';
      value = value.replace(/##/g, '').trim();
      if (!value || /[\u0000-\u0020\\]/.test(value)) return '';
      try {
        const parsed = new URL(value, 'https://localhost');
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        if (/^https?:\/\//i.test(value) || value.startsWith('//')) return parsed.href;
        if (value.startsWith('/')) return parsed.pathname + parsed.search + parsed.hash;
      } catch (error) {
        return '';
      }
      return '';
    };

    // 如果未开启pc端直接返回并且是pc端 并且非强制跳转 并且是是视频站点
    if (domain.ispcpage==0 && !domain.spider && !domain.isMobile&&domain.isOpenUrl!==3) {
      ctx.status = 403  // 500
      ctx.body='';
      return;
    }
    //--------这里判断是否为https 站点 （强制不跳转下）
    if(domain.isHttps&&!ctx.secure&&ctx.protocol=="http"&&domain.isOpenUrl<0){
      ctx.status = 301;
      return ctx.redirect('https://'+domain.fullDomain+ctx.url);
    }
    // 如果是首页无内页百度的话直接444-baidu01  内页访问--百度蜘蛛正常，用户访问状态502 广告页面
    if((domain.browserType == 'baidu01'||domain.browserType == 'baidu02')&&!domain.isBaiduSpider){
        ctx.status = 201;
        if(domain.openUrlStatusCode>0){ctx.status = domain.openUrlStatusCode}
        let tdk = normalizeMuluWord(await ctx.service.utils.getMuluItemOne(Date.now(),domain.mcid), {
          title: domain.title, keywords: domain.keyWords, description: domain.description,
        });
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
        //如果开启了本地
        if ((agentLink.isAgentPage&&domain.fromNum!=300)||domain.fromNum==200) {
          let agentPageName = '/app/public/html/'+agentLink.agentPageName + '.html';
          let agentPageFilePath = process.cwd() + agentPageName
          // let isHaveagentFile = fs.existsSync(agentPageFilePath)
          // if(isHaveagentFile){
          let text = ''
          try{
            text = fs.readFileSync(agentPageFilePath, 'utf-8');
          }catch{
            return renderDefaultPage();
          }
          if (!text) return renderDefaultPage();
          if(text){
            text = text.replace('</body>',`${agentLink.gajs || ''}</body>`)
            .replace('<title>',`<title>${tdk.title}`)
            .replace(`content="description"`,`content="${tdk.description}"`)
            .replace('HDESC',tdk.keywords)
            .replace('SEODESCRIPTION',tdk.description)
            return this.ctx.body = text
          }
        }
        //这里应该是跳转
        const jumpUrl = getJumpUrl();
        if (!jumpUrl) return renderDefaultPage();
        ctx.body = `<!DOCTYPE html><html lang='en'><head><meta name="robots" content="noindex,nofollow"><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no'><meta name='robots' content='noindex'><title>${tdk.title}</title><meta name="description" content="${tdk.description}"></head><body></body>${buildJumpIframeHtml(jumpUrl, agentLink.gajs)}</html>`
        return;
    }
    let result = {
      domain,
      detail: {},
      jumpHTML : ''
    };
    let isJump = false;
    let mtdk = {}
    muluIndex = ctx.service.utils.strToNumber(domain.fullDomain+ctx.url);
    //获取一个目录文章
    let articleinfo = {}
    
    // console.log(isJump)

    if(domain.isMuLu){
      mtdk = normalizeMuluWord(await ctx.service.utils.getMuluItemOne(muluIndex,domain.mcid), {
        title: domain.title, keywords: domain.keyWords, description: domain.description,
      });
      if(mtdk&&mtdk.title){
        mtdk.description = mtdk.description.replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
        mtdk.description = mtdk.description.replace(/\[数字\]|数字/g, domain.urlNumber)
        mtdk.description = mtdk.description.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
        mtdk.description = mtdk.description.replace(/\[关键字\]|关键字/g, mtdk.keywords)
        mtdk.description = mtdk.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
        mtdk.description = mtdk.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
        mtdk.description = mtdk.description.replace(/\[关键字\]|关键字/g, mtdk.keywords)

        mtdk.title = mtdk.title.replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
        mtdk.title = mtdk.title.replace(/\[版本号\]|版本号/g, domain.banBenNumber)
        mtdk.title = mtdk.title.replace(/\[数字\]|数字/g, domain.urlNumber)
        mtdk.title = mtdk.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain+ctx.url))
        mtdk.title = mtdk.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain+ctx.url))
        // mtdk.description = moment(mtdk.createdAt).format('MMMDo')+mtdk.description.replace(/\《|\》/g, "")
      }
    }
    // titleType ---内页标题类型
    // console.log(domain.titleType)
    if(domain.titleType==-1){ //隐藏标题
      mtdk.title = ''
      domain.urlString = ''
      domain.urlNumber = ''
      domain.urlEmoj = ''
      mtdk.description = ''
      mtdk.keywords = ''
    }
    // if(domain.titleType>0){
    //   mtdk.title = ''
    // }
    result.titlec = mtdk.title;
    if(domain.titleType==3){
      mtdk.title = ''
    }
    // console.log(domain.titleType)
    if(domain.titleType==1){
      mtdk.title = domain.fullDomain+ctx.url
    }
    result.mtdk = mtdk;
    result.mtdk2 = mtdk;
    // 查找目录里面有没有html
    let fileFilenme = requestPath;
    if (!/\.html?$/i.test(fileFilenme)) {
      fileFilenme += fileFilenme.endsWith('/') ? 'index.html' : '.html';
    }
    const templateRoot = path.resolve(process.cwd(), 'app/view/template');
    const homePageFilePath = path.resolve(templateRoot, String(domain.tname || ''));
    const templateFilePath = path.resolve(homePageFilePath, fileFilenme.replace(/^\/+/, ''));
    const isInside = (directory, filename) => {
      const relative = path.relative(directory, filename);
      return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    };
    let isHaveIndexHtml = false;
    if (isInside(templateRoot, homePageFilePath) && isInside(homePageFilePath, templateFilePath)
      && !/[\u0000\\]/.test(fileFilenme)) {
      try {
        isHaveIndexHtml = templateExists(`template:${domain.tname}:${fileFilenme}`, templateFilePath)
          && fs.statSync(templateFilePath).isFile();
        if (isHaveIndexHtml) fileFilenme = '/' + path.relative(homePageFilePath, templateFilePath).split(path.sep).join('/');
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      }
    }
    if(domain.titleType==1){
      mtdk.title = domain.fullDomain+ctx.url
    }
    // console.log(mtdk)
    // 跳转条件 console.log(referer)
    // console.log(domain.isMobile)

    

    if(!domain.isSpider&&domain.isMobile&&domain.isOpenUrl>=0&&domain.isMuLu&&!isHaveIndexHtml){
        isJump = true;
    }
    if (isJump&&agentLink.isAgentPage) {
      let agentPageName = '/app/public/html/'+agentLink.agentPageName + '.html';
      let agentPageFilePath = process.cwd() + agentPageName
      // let isHaveagentFile = fs.existsSync(agentPageFilePath)
      // if(isHaveagentFile){
      let text = ''
      try{
        text = fs.readFileSync(agentPageFilePath, 'utf-8');
      }catch{
        return renderDefaultPage();
      }

      if (!text) return renderDefaultPage();
      let gaDOm = agentLink.gajs || '';
      if(text){
        text = text.replace('</body>',`${gaDOm}</body>`)
        .replace('<title>',`<title>${mtdk.title}`)
        .replace(`content="description"`,`content="${mtdk.description}"`)
        .replace('HDESC',mtdk.keywords)
        this.ctx.status = 200;
        if(domain.openUrlStatusCode>0){ctx.status = domain.openUrlStatusCode}
        return this.ctx.body = text
      }
    }

    if(isJump){
        const jumpUrl = getJumpUrl();
        if (!jumpUrl) return renderDefaultPage();
        const parsedJumpUrl = new URL(jumpUrl, 'https://localhost');
        parsedJumpUrl.searchParams.set('v', String(Date.now()));
        let jumpTarget = jumpUrl.startsWith('/')
          ? parsedJumpUrl.pathname + parsedJumpUrl.search + parsedJumpUrl.hash : parsedJumpUrl.href;
        let agentPageName = agentLink.agentPageName + '.html'
        let agentPageFilePath = process.cwd() + '/app/public/html/' + agentPageName
        let isHaveagentFile = fs.existsSync(agentPageFilePath)
        // 如果开启了缓存并且有缓存文件直接返回
        if (isHaveagentFile) {
          jumpTarget = '/html/' + agentPageName+'?v='+Date.now()
        }
        result.jumpHTML = buildJumpIframeHtml(jumpTarget, agentLink.gajs);
    }
    // console.log(11)

    //如果有
    if (isHaveIndexHtml) {
      await this.ctx.render('/template/' + domain.tname + fileFilenme, result).then((res) => {
      }).catch((err) => {
        return this.ctx.render('error.html');
      });
    } else if (domain.isMuLu || domain.isOpenUrl != 3) {
      let pathxc = process.cwd() + `/app/service/datajson/article/youxi/${muluIndex%16203}.json`
      try{
        let articleFileTxt = fs.readFileSync(pathxc, 'utf-8');
        if(articleFileTxt){
          articleinfo = JSON.parse(articleFileTxt)
        }
      }catch{
        articleinfo = JSON.parse(articleJsonTP)
      }
      // let isjump = false;
      // if (domain.browserType == 'baidu' && domain.isMobile && !domain.spider) {
      //   isjump = true; 
      // }
      // if (domain.isOpenUrl == 3 || domain.isBaiduType == 1 || domain.isBaiduType == 3) {
      //   isjump = true;
      // }
      // //如果设置强制不开启的情况
      // if (domain.isOpenUrl < 0) {
      //   isjump = false;
      // }
      // if (isjump) {
      // let IOSUrl = domain.agentLink.openUrlIOS;
      // let URL = IOSUrl.replace(/##/g, '');
      // let agentPageName = domain.agentLink.agentPageName + '.html'
      // let agentPageFilePath = process.cwd() + '/app/public/html/' + agentPageName
      // let isHaveagentFile = fs.existsSync(agentPageFilePath)
      // // 如果开启了缓存并且有缓存文件直接返回
      // if (isHaveagentFile) {
      //   URL = '/html/' + agentPageName
      // }
      
        // // ctx.status = 403
        // if (domain.agentLink.isAgentPage) {
        //   let agentPageName = domain.agentLink.agentPageName + domain.agentLink._id + '.json' || 'index.json';
        //   let agentPageFilePath = process.cwd() + '/app/public/agentpage/' + agentPageName
        //   let isHaveagentFile = fs.existsSync(agentPageFilePath)
        //   // 如果开启了缓存并且有缓存文件直接返回
        //   let isHaveList = false;
        //   let txtpage = '';
        //   if (isHaveagentFile) {
        //     let text = fs.readFileSync(agentPageFilePath, 'utf-8');
        //     let datac = JSON.parse(text);
        //     txtpage = datac.txtpage;
        //     let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
        //     if (chaTime >= this.ctx.app.config.common.AGENT_PAGE || chaTime < 0) {
        //       isHaveList = false
        //     } else {
        //       isHaveList = true
        //     }
        //   }
        //   let pageurl = domain.agentLink.openUrlH5.replace(/##/g, '');
        //   if (!isHaveList && pageurl) {
        //     axios.get(pageurl).then((res) => {
        //       if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
        //         try { fs.unlinkSync(agentPageFilePath); } catch { }
        //         let savehtml = res.data.replace('</body>', domain.agentLink.gajs + '</body>')
        //         let savelist = {
        //           updateCacheTime: Date.now(),
        //           txtpage: savehtml
        //         }
        //         fs.writeFile(agentPageFilePath, JSON.stringify(savelist), null, function (err) { });
        //       }
        //     })
        //   }
        //   if (txtpage) {
        //     return this.ctx.body = txtpage
        //   }
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
      // }

      // let homePageFilePath = process.cwd() + '/app/view/ml/' + fanIndex + '.html'
      // let isHaveIndexHtml = fs.existsSync(homePageFilePath)
      // if (isHaveIndexHtml) {
      //   // 直接返回静态的目录文件
      //   await this.ctx.render(fileFilenme, result).then((res) => { }).catch((err) => {
      //     return this.ctx.render('error.html');
      //   });
      // } else {
        // let muluNum = 0;
        // let f_item = {}
        // if (domain.mcid && domain.mcid.num) {
        //   muluNum = domain.mcid.num
        // };
        // if (muluNum > 0) {
        //   let indexB = muluIndex % muluNum;
        //   //先去缓存mulu文件里面查找泛的 分类id-泛索引indexB 命名的json 文件
        //   let muluFileName = domain.mcid._id + '-' + indexB
        //   let FanPageFilePath = this.ctx.app.config.cacheFile + 'mulu/' + muluFileName
        //   // console.log(muluFileName)
        //   let isHaveIndexHtml = fs.existsSync(FanPageFilePath + '.json')
        //   if (isHaveIndexHtml) {
        //     let f_item_text = fs.readFileSync(FanPageFilePath + '.json', 'utf-8');
        //     if (f_item_text) {
        //       f_item = JSON.parse(f_item_text)
        //     }
        //   } else {
        //     f_item = await ctx.model.Mulu.findOne({
        //       index: indexB,
        //       mcid: domain.mcid._id
        //     })
        //     if (f_item) {
        //       fs.writeFile(FanPageFilePath + '.json', JSON.stringify(f_item), null, function (err) { });
        //     }
        //   }
        // }

        
        let imageNums = ctx.service.utils.strToNumber(domain.fullDomain+ctx.url)%2331
        result.imageNums = imageNums % (2300 - 16);
        // //描述上获取一个新标题
        // if (f_item && f_item.description) {
        //   f_item.description = f_item.description.replace(/\[域名\]|域名/g, fileName)
        //   f_item.description = f_item.description.replace(/\[数字\]|数字/g, domain.urlNumber)
        //   f_item.description = f_item.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(ctx.url))
        //   f_item.description = f_item.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(ctx.url))
        //   f_item.description = moment(f_item.createdAt).format('MMMDo')+f_item.description.replace(/\《|\》/g, "")
        // }
        // if (f_item && f_item.title) {
        //   f_item.title =  f_item.title 
        // }

        mtdk.Number = ctx.service.utils.strToNumber(ctx.header.host + ctx.url)
        result.detail = mtdk;

        
         // 如果百度未开启pc并且是pc端的情况
      if (
        domain &&
        !domain.spider &&
        !domain.isMobile&&
        domain.isOpenUrl!=3&&
        (domain.ispcpage == 0) //||domain.ispcpage ==-1
      ) {
        return ctx.render('404b.html',result);
      }

       

        // if(!domain.isSpider){
        //   result.detail.title = moment().format('MMMDo')+'-'+ctx.service.utils.randomWord(1,10,30)
        // }

        // 导入泛
        if (domain.isFan == 1) {
          let aDom = ''
          let wordListFan = ["gov.cn.", "edu.cn.", "www.", "m.", "app.", "h5.", "wap."];
          for (let i = 0; i < 2; i++) {
            let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
            aDom += `<a href="http://${wordc}.${domain.link}">${wordc}</a>`
          }
          aDom = '<div class="add-daorufan">' + aDom + '</div>'
          result.fanContent = aDom;
        }
        // 导入目录
        if (domain.isMuLu) {
          let aDom = ''
          let wordListFan = ["a", "b", "n", "m", "a", "s", "d", "f", "g", "h", "j", "k", "l", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "ac", "ab", "dv", "er", "rt", "vg", "fd", "gf", "df", "se", "qs", "91", "df", "kj", "lk", "ui", "re", "er", "dc", "cs"];
          let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
          for (let i = 0; i < 2; i++) {
            let wordc = wordListFan[Math.floor(Math.random() * wordListFan.length)] + ctx.service.utils.randomWord(1, 1, 6)
            let numberd = ctx.service.utils.randomNumber(1, 1, 10)
            aDom += `<a href="http://${domain.fullDomain}/${wordc}/${Date.now().toString().slice(6)}.html">${domain.beiAnName}${wordc}${nowDatec}</a>
                    <a href="http://${domain.fullDomain}/${wordc}/${numberd}.html">${domain.beiAnName}${wordc}${nowDatec}</a>
                    <a href="http://${domain.fullDomain}/ml/1/${ctx.service.utils.randomNumber(1, 1, 6)}.html">${domain.beiAnName}${wordc}${nowDatec}</a>
            `
          }
          aDom = '<div class="add-daorumulu">' + aDom + '</div>'
          result.muluContent = aDom;
        }
        //导入最新的文章
        result.newArticleList = [];
        let newArticleList = [];
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'article_list'
        let articleRdmNum = ['/index.json', '/index1.json', '/index2.json', '/index3.json', '/index4.json', '/index5.json', '/index6.json', '/index7.json', '/index8.json', '/index9.json']
        let articleRdmName = articleRdmNum[Math.floor(Math.random() * articleRdmNum.length)]
        try {
          let rowstext = fs.readFileSync(cachePageFilePath + articleRdmName, 'utf-8');
          if (rowstext) {
            newArticleList = JSON.parse(rowstext)
          }
        } catch (e) {
        }
        result.newArticleList = newArticleList;
        result.articleNext = newArticleList[1]
        result.articlePrve = newArticleList[2]
        result.articleinfo = articleinfo;///-----------------------------导入文章信息
         // 判断文件详情页面是否存在
        let path = process.cwd() + `/app/view/template/${domain.tname}/ml.html`
        // console.log(2)

        const renderName = resolveTemplate(`${domain.tname}:ml.html`, path, `template/${domain.tname}/ml.html`, '/ml/index.html');
        await ctx.render(renderName, result).catch(() => {
          return this.ctx.render('error.html');
        });
        // return ctx.render('/ml/index.html', result);
    } else {
      // 如果是强制跳转的时候 跳转条件
      if (domain.isOpenUrl == 3 && (domain.browserType == 'baidu' && domain.isMobile && !domain.spider)) {
        if (agentLink.isAgentPage) {
          let agentPageName = '/app/public/html/'+agentLink.agentPageName + '.html';
          let agentPageFilePath = process.cwd() + agentPageName
          let gaDOm = ''
          if (agentLink.gajs) gaDOm = agentLink.gajs;
          let text = '';
          try{
            text = fs.readFileSync(agentPageFilePath, 'utf-8');
            text = text.replace('</body>',`${gaDOm}</body>`)
          }catch{
            return renderDefaultPage();
          }
          if(text){
              return this.ctx.body = text
          }
          return renderDefaultPage();
        }

        const jumpUrl = getJumpUrl();
        if (!jumpUrl) return renderDefaultPage();
        ctx.body = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body>'
          + buildJumpIframeHtml(jumpUrl, agentLink.gajs) + '</body></html>';
        return;
      }
      ctx.status = 404;
      return ctx.render('404.html',{domain:domain});
    }
  }

  async pushSubmit({ isAuto = false, isMuLu = false, type = 5, token = null, link, urls, tijiaoNum = 2, siteType = 4 }) {
    // 前提条件百度每次最多只能提交2000条
    // type = 0 自定义推送条件 urls不能是空;
    // type = 1 只提交首页域名; 
    // type = 2 只提交10条文章; 
    // type = 3 10条文章+990条目录; ----常用
    // type = 4 提交10条视频地址; 
    // type = 5 文章+目录 3000条全部推送 ----首选常用
    // type = 6 1000条目录


    if (!link) {
      return {
        message: '推送无效1',
        code: -1
      }
    }

    let pushUrls = []
    if (urls && urls.length > 0) {
      pushUrls = urls
    }
    // 根据link获取当前域名的 pushSiteManager 信息
    let pushSiteType = type
    let pushSiteStatus = null
    let pushSiteNum = tijiaoNum
    let pushSiteTokenName = token
    let pushSiteToken = null

    let domainObj = await this.ctx.model.Domain.findOne({ link }).select('pushSiteToken pushSiteTokenName pushSiteType pushSiteStatus pushSiteNum')
    pushSiteType = domainObj.pushSiteType
    pushSiteStatus = domainObj.pushSiteStatus
    pushSiteNum = domainObj.pushSiteNum
    pushSiteTokenName = domainObj.pushSiteTokenName
    pushSiteToken = domainObj.pushSiteToken
    if (!pushSiteToken) {
      return {
        message: '推送无效2',
        code: -1
      }
    }
    // 链接格式自动智能生成
    const randomOneWord = function (arr) {
      if (!arr || arr.length == 0) return "";
      return arr[Math.round(Math.random() * (arr.length - 1)) + 0];
    }
    let typeFileList = ['video', 'movie', 'book', 'article', 's', 'news', 'm', 'tag', 'xz', 'app', 'ml/1']
    let typeFimeNameList = [0, 1, 2] //0 纯数字 1 纯字母 2数字字母组合 
    let numberList = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    let wordNativeList = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",]

    const randomWord = function (min = 1, max = 10) {
      let typeFimeName = randomOneWord(typeFimeNameList);
      let typeFile = randomOneWord(typeFileList);
      let str = "", range = Number(min), arr = [];
      if (typeFimeName == 0) {
        arr = numberList;
      } else if (typeFimeName == 1) {
        arr = wordNativeList;
      } else if (typeFimeName == 2) {
        arr = [...numberList, ...wordNativeList]
      }
      range = Math.round(Math.random() * (Number(max) - Number(min))) + Number(min);
      for (var i = 0; i < range; i++) {
        let pos = Math.round(Math.random() * (arr.length - 1));
        str += arr[pos];
      }
      return `/${typeFile}/${str}.html`;
    }

    let shengYuTuiSongNum = 0
    let linkThink = '';
    if (link.indexOf('www') >= 0) {
      linkThink = link
    } else {
      linkThink = 'www.' + link
    }
    pushUrls = '';
    let linkList = ['/']

    if (type == 2 || (siteType == 4 && isAuto)) {
      // let videoList = await this.ctx.service.cache.get('videoLList');
      let articleList = await this.ctx.service.cache.get('articleList');
      if (articleList && articleList.length > 0) {
        articleList.forEach((item, index) => {
          linkList.push('/detail/' + item._id + '.html?v=' + this.ctx.service.utils.randomNumber(1, 1, 10))
        })
      }
      linkList.push('/article.html?v=' + this.ctx.service.utils.randomNumber(1, 1, 10))
    }
    if (type == 3 || (siteType == 6 && isAuto)) {
      let videoList = await this.ctx.service.cache.get('videoLList');
      if (videoList && videoList.length > 0) {
        videoList.forEach((item, index) => {
          linkList.push('/vdetail/' + item._id + '/index.html?v=' + this.ctx.service.utils.randomNumber(1, 1, 10))
        })
      }
    }
    if (isMuLu && isAuto) {
      let nowForNum = 0
      if (tijiaoNum > linkList.length) {
        nowForNum = tijiaoNum - linkList.length
      }
      for (let i = 0; i < nowForNum; i++) {
        let str = randomWord(1, 10)
        linkList.push(str)
      }
    }
    // console.log(linkList.length)
    linkList.forEach((itemc, itemcindex) => {
      let linkccc = itemc;
      if (itemc == '/') {
        linkccc = '/index.html?v=' + this.ctx.service.utils.randomNumber(1, 1, 10);
      }
      let linknnn = '\n'
      if (itemcindex == linkList.length - 1) {
        linknnn = ''
      }
      if (itemcindex < tijiaoNum) {
        pushUrls += `http://${linkThink}${linkccc}${linknnn}`;
      }
    })

    let returnMessage = {}
    let isUpdateNum = 0;
    // console.log(pushSiteToken)
    await axios({
      method: 'post',
      url: `http://data.zz.baidu.com/urls?site=${linkThink}&token=${pushSiteToken}`,
      headers: {
        'Content-Type': ' text/plain',
        'User-Agent': 'curl/7.12.1'
      },
      data: pushUrls
    }).then(res => {

      if (res && res.data && res.data.remain) {
        shengYuTuiSongNum = res.data.remain - 0
        isUpdateNum = 1;
        if (shengYuTuiSongNum == 0) {
          isUpdateNum = 2
        }
      }

      // console.log(res.data)
      returnMessage = {
        code: 200,
        massage: '成功' + res.data.success + '剩余' + res.data.remain,
        data: res.data,
        link
      }

    }).catch(error => {
      let datacc = {}
      if (error && error.response && error.response.data) {
        datacc = (error && error.response.data && error.response.data.message) ? error.response.data.message : '无失败原因!'
      }
      if (datacc == 'site error') {
        // 提交错误
        isUpdateNum = 4
      }
      if (datacc == 'over quota') {
        isUpdateNum = 3
      }
      // console.log(datacc)
      returnMessage = {
        code: -1,
        massage: '失败' + datacc,
        data: datacc,
        link
      }
    })

    if (isUpdateNum == 1) {
      await this.ctx.model.Domain.findOneAndUpdate({
        link,
      }, { $set: { pushSiteNum: shengYuTuiSongNum, pushSiteDay: moment(new Date()).format('LL') } }, { new: true })
    }
    if (isUpdateNum == 3) {
      await this.ctx.model.Domain.findOneAndUpdate({
        link,
      }, { $set: { pushSiteNum: 1, pushSiteDay: moment(new Date()).format('LL') } }, { new: true })
    }
    if (isUpdateNum == 4) {
      await this.ctx.model.Domain.findOneAndUpdate({
        link,
      }, { $set: { pushSiteStatus: 2, pushSiteDay: moment(new Date()).format('LL') } }, { new: true })
    }
    if (isUpdateNum == 2 || (pushSiteNum == 1 && isUpdateNum == 3)) {
      //今日不在更新
      await this.ctx.model.Domain.findOneAndUpdate({
        link,
      }, { $set: { pushSiteNum: 0, pushSiteDay: moment(new Date()).format('LL') } }, { new: true })
    }

    return returnMessage
  }


  async getSiteInfoJingTaiDomain(link) {
    const { ctx } = this;
    // console.log(1)
    let h = link
    if (!h || h.length > 2000) return { domain: null }
    let host = h.toLowerCase().replace(/:\d+$/, '');
    let isIpHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
    let linkarr = host.split('')
    let isFanArr = linkarr.filter(item1 => item1 === '.')
    let domainEndList = ['.com.cn', '.org.cn', '.net.cn', '.cn.com', '.cn.net', '.yn.cn', '.gx.cn', '.hk.cn', 'ac.cn']
    let isHave = domainEndList.find(item => host.indexOf(item) >= 0)
    let f_host = ''
    let f_isget = false
    // 泛域名 截取方式 news.fasd.com  fasd.com  www.dd.fasd.com  sss.com.cn


    // 如果是蜘蛛强制不跳转
    let isSpider = false
    let userAgentA =''
    // let uaStr = ctx.get('user-agent');
    let referer = '';
    let isMobile = false;
    let sUserAgent = ''
    if (userAgentA) {
      sUserAgent = userAgentA.toLowerCase();
    }
    //console.log(sUserAgent)
    if (sUserAgent) {
      sUserAgent = sUserAgent.replace(/\s/g, '')
      if (sUserAgent.indexOf('phone') > -1 || sUserAgent.indexOf('android') > -1 || sUserAgent.indexOf('mobile') > -1|| sUserAgent.indexOf('pad') > -1|| sUserAgent.indexOf('tablet') > -1||sUserAgent.indexOf('intelmacosx10') > -1) {
        isMobile = true;
      }
      isSpider = (sUserAgent.indexOf('bot') >= 0 || sUserAgent.indexOf('spider') >= 0)
    }

    let f_item = {
      title: '',
      keywords: '',
      description: ''
    }
    if (!isIpHost && isFanArr.length >= 2) {
      // 如果.大于两个 从第一个截取 判断一定是泛
      if (isFanArr.length > 2 && isHave) {
        // 先删除最后两个点.
        let beforeHost = host.slice(0, host.lastIndexOf('.'))
        let lastHost = host.slice(host.indexOf(isHave))
        beforeHost = beforeHost.slice(0, beforeHost.lastIndexOf('.'))
        f_host = beforeHost.slice(0, beforeHost.lastIndexOf('.'))
        host = beforeHost.slice(beforeHost.lastIndexOf('.') + 1) + lastHost
        f_isget = true
      } else if (isFanArr.length == 2 && isHave) {
        //这里不是泛
        f_isget = false
        f_host = ''
      } else {
        let beforeHost = host.slice(0, host.lastIndexOf('.'))
        f_host = beforeHost.slice(0, beforeHost.lastIndexOf('.'))
        host = host.slice(beforeHost.lastIndexOf('.') + 1)
        f_isget = true
      }
    }
    const domainResult = await ctx.service.domain.findDomain(host);
    let { data } = domainResult;

    
    if (!data || !data.domain || !data.domain._id) {
      //h5页面直接加载导航站点 pc或者蜘蛛 直接加载导航链接
      return { domain:{spider:isSpider,isMobile,host}, site: null }
      // ctx.status = 501;
      // ctx.body ='';
      // return ctx.body = `<body style="padding:20px;text-align:center;"><h1>UTILS域名未绑定！</h1></body>`;
    }
    // 随机生产泛域名前缀 
    data.domain.fullDomain = (!!f_host ? f_host + '.' : f_host) + data.domain.link;
    
    data.domain.sfurl = COMMONDATA
    let domainTitle = data.domain.title
    let imageNums = ctx.service.utils.strToNumber(h+ctx.url)||500 // 随机基数
    let imageFileNum = 200 // 文件夹里面图片的数量

    // if (data.domain.fullDomain) {
    //   data.domain.fullDomain.split('').forEach((item) => {
    //     imageNums += item.charCodeAt()
    //   })
    // }
    // console.log(data.domain.imgTypeName)
    if (data.domain.imgTypeName) {
      let itemcc = ImgTypeNameList.find(ia=>ia.value===data.domain.imgTypeName)
      if(itemcc){
        imageFileNum = itemcc.nums
      }
    }
    data.domain.imageNums = imageNums % imageFileNum;
    // data.domain.imageAllNums = imageFileNum;
    if(data.domain.imageNums<10) data.domain.imageNums = 10;
    if(data.domain.imageNums>imageFileNum-10) data.domain.imageNums = imageFileNum-10;
    //console.log(data.domain.imageNums)
    let isFanListType = false;
    if (3>data.domain.isFan > 0 && f_host && f_host !== 'www' && data.domain.fcid) {
      // 如果是随机泛目录
      // data.domain.iscache = false;
      isFanListType = true;
    }
    //描述是动态标题固定
    if(data.domain.isFan==4){
      isFanListType = true;
    }

    if(isFanListType){
      if (data.domain.isWordRandom) {
        f_host = f_host + ctx.service.utils.randomWord(1, 1, 10)
      }
      // console.log(f_host)
      if (f_isget) {
        let hostArr = data.domain.fullDomain.split('');
        let abdd = ['', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '.', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];//27
        let fanIndex = data.domain.fcid.num + 10000
        hostArr.forEach((item) => {
          let nownum = abdd.findIndex(adbitem => adbitem === item)
          if (nownum != -1) {
            let nstr = nownum
            fanIndex += nstr
          }
        })
        f_item = await ctx.service.utils.getFanItemOne(fanIndex, data.domain.fcid)
      }
      // data.domain.fullDomain = f_host+data.domain.link;
      // 符合泛站域名的条件
      if (f_item && f_host && f_item.title) {
        data.domain.title = f_item.title
        data.domain.keyWords = f_item.keywords
        data.domain.description = f_item.description
        // data.domain.fullDomain = ctx.service.utils.randomWord(1, 1, 10) + '.' + host
      }
      if(data.domain.isFan==4){
        data.domain.title = domainTitle
      }
    }
    // ip 是百度蜘蛛或者搜狗蜘蛛的 ip
    // 116.179.32
    // 220.181.108
    // console.log(ctx.request.ip.indexOf('116.179.32'))

    
    

    // if (ctx.request.ip && 
    //   (
    //     ctx.request.ip.indexOf('116.179.37.') == 0 || 
    //     ctx.request.ip.indexOf('159.226.50.') == 0 || 
    //     ctx.request.ip.indexOf('180.149.133.') == 0||
    //     ctx.request.ip.indexOf('60.28.22.') == 0||
    //     ctx.request.ip.indexOf('162.105.207.') == 0||
    //     ctx.request.ip.indexOf('220.181.107.') == 0||
    //     ctx.request.ip.indexOf('220.181.7.') == 0||
    //     ctx.request.ip.indexOf('121.14.89.') == 0||
    //     ctx.request.ip.indexOf('203.208.60.') == 0||
    //     ctx.request.ip.indexOf('210.72.225.') == 0||
    //     ctx.request.ip.indexOf('125.90.88.') == 0
    //   )) {
    //   isSpider = true
    // }
    // if(!isSpider&&ctx.request.ip){
    //   //百度ip 列表
    //   let baiduIpList = []
    //   // for(let ipc = 64;ipc<=83;ipc++){
    //   //   baiduIpList.push('66.249.'+ipc+'.')
    //   // }
    //   for(let ipc = 32;ipc<=38;ipc++){
    //     baiduIpList.push('220.181.'+ipc+'.')
    //   }
    //   for(let ipc = 145;ipc<=146;ipc++){
    //     baiduIpList.push('61.135.'+ipc+'.')
    //   }
    //   for(let ipc = 162;ipc<=169;ipc++){
    //     baiduIpList.push('61.135.'+ipc+'.')
    //   }
    //   for(let ipc = 186;ipc<=190;ipc++){
    //     baiduIpList.push('61.135.'+ipc+'.')
    //   }
    //   for(let ipc = 75;ipc<=123;ipc++){
    //     baiduIpList.push('220.181.108.'+ipc)
    //   }
    //   for(let ipc = 110;ipc<=115;ipc++){
    //     baiduIpList.push('220.181.'+ipc+'.')
    //   }
    //   for(let ipc = 249;ipc<=250;ipc++){
    //     baiduIpList.push('202.108.'+ipc+'.')
    //   }
    //   for(let ipc = 66;ipc<=71;ipc++){
    //     baiduIpList.push('123.125.'+ipc+'.')
    //   }
    //   for(let ipc = 13;ipc<=35;ipc++){
    //     baiduIpList.push('119.188.14.'+ipc)
    //   }
    //   baiduIpList.forEach(item=>{
    //     if(ctx.request.ip.indexOf(item)>=0){
    //       isSpider = true;
    //     }
    //   })
    // }
    if (isSpider) data.domain.isOpenUrl = -1;

    // 如果是镜像并且有镜像url
    // if (data.domain.isJingXiang == 1 && data.domain.jingXiangUrl) {
    //   data.domain['tname'] = 'n_iframe_1'
    // }
    // 如果是搜狗 非蜘蛛而且跳转的情况下 把标题描述关键词清了
    data.domain['is301'] = false;
    data.domain.isBaiduType = 0;
    data.domain['urlNumber'] = ctx.service.utils.strToNumber(h+ctx.url)||123

    
    if (data.domain.title) {
      data.domain.title = data.domain.title.replace(/\[域名\]|域名/g, data.domain.fullDomain)
      data.domain.title = data.domain.title.replace(/\[站名\]|站名/g, data.domain.beiAnName)
      data.domain.title = data.domain.title.replace(/\[版本号\]|版本号/g, data.domain.banBenNumber)


      data.domain.title = data.domain.title.replace(/\[数字\]|数字/g, data.domain.urlNumber)
      data.domain.title = data.domain.title.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(data.domain.fullDomain+ctx.url))
      data.domain.title = data.domain.title.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(data.domain.fullDomain+ctx.url))
    }
    if (data.domain.description) {
      data.domain.description = data.domain.description.replace(/\[域名\]|域名/g, data.domain.fullDomain)
      data.domain.description = data.domain.description.replace(/\[站名\]|站名/g, data.domain.beiAnName)
      data.domain.description = data.domain.description.replace(/\[标题\]|标题/g, data.domain.title)
      data.domain.description = data.domain.description.replace(/\[版本号\]|版本号/g, data.domain.banBenNumber)
      data.domain.description = data.domain.description.replace(/\[数字\]|数字/g, data.domain.urlNumber)
      data.domain.description = data.domain.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(data.domain.fullDomain+ctx.url))
      data.domain.description = data.domain.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(data.domain.fullDomain+ctx.url))
    }
    // 判断是否转码 如果开启了转码
    if (data.domain.tdkEncode) {
      data.domain.title = myencodeFn(data.domain.title)
      data.domain.description = myencodeFn(data.domain.description)
      data.domain.keyWords = myencodeFn(data.domain.keyWords)
    }

    if (data.domain.browserType == 'sogo' && !isSpider && data.domain.isOpenUrl > -1) {
      // data.domain['is301'] = true;
      // data.domain.isBaiduType = 1;
      // data.domain.ispcpage = true
    }
    //如果是百度站 非蜘蛛 把标题描述关键词清了 并且如果是手机端直接跳转
    if (
      data.domain.browserType == 'baidu' &&
      !isSpider
    ) {
      let fromNum = data.domain.fromNum - 0 || 0
      //如果是百度站点并且是百度来路不是蜘蛛并且是首页 fromNum+1 主要用来判断未收录域名不跳转
      if (referer && referer.indexOf('baidu') > 0 && fromNum < 3 && (ctx.request.url == '/' || ctx.request.path == '/')) {
        // fromNum++
        // data.domain.fromNum++
        // //更新数据库
        // await ctx.model.Domain.findOneAndUpdate({ link: host }, { $set: { fromNum } }).then(() => { }).catch()
        // //更新静态缓存
        // await ctx.service.domain.refreshDomain(data.domain.link)
      }
      //h5跳转 pc关闭
      if (fromNum >= 3 && data.domain.isOpenUrl > -1&&data.domain.isOpenUrl<9) {
        if (isMobile) {
          data.domain.isBaiduType = 1
        } else {
          data.domain.isBaiduType = 2
        }
      } else if (domain.ispcpage==-1||domain.ispcpage ==0) {
        data.domain.isBaiduType = 2
      }
      // 强制不跳转也不显示页面
      if (data.domain.isOpenUrl <= -1 && data.domain.ispcpage==0) {
        data.domain.isBaiduType = 2
      }
      //全跳转
      if (data.domain.isOpenUrl == 3) {
        data.domain.isBaiduType = 1
      }
      if (data.domain.isOpenUrl == 2 && data.domain.ispcpage==0 && !isMobile) {
        data.domain.isBaiduType = 4
      }
    }
    // 内页h5跳转
    if (!isSpider && data.domain.isOpenUrl == 2 && isMobile) {
      data.domain.isBaiduType = 3
    }
    // 内页h5引擎跳转
    if (!isSpider && data.domain.isOpenUrl == 2.1 && isMobile) {
      data.domain.isBaiduType = 5
    }
    // 设置h5 跳转的
    if (data.domain.isOpenUrl == 5 && !isSpider && isMobile) {
      data.domain.isBaiduType = 1
    }
    if(data.domain.isOpenUrl==9){
      //目录以及五页面 go 跳转
      data.domain.isBaiduType = -1
    }

    //h5 引擎跳转
    if(data.domain.isOpenUrl==6){
      if(isMobile&&referer&&referer.indexOf('baidu')>=0){
        data.domain.isBaiduType = 1
      }else{
        data.domain.isBaiduType = 0
      }
    }
    //h5 pc 跳转
    if (data.domain.isOpenUrl == 10 && !isSpider) {
      data.domain.isBaiduType = 1
    }
    data.domain.spider = isSpider
    data.domain.isSpider = isSpider
    data.domain.isMobile = isMobile

    data.domain.isChangeTitle = -1;

    // 获取全局缓存文件


    // console.log(ctx.request.header)
    // 如果非蜘蛛、不跳转、pc开启、不是泛站的情况把标题改成备用标题
    // console.log(f_host)
    // 暂时先不改
    if (data.domain.beiAnName && data.domain.beiAnName !== data.domain.title) {
      if (data.domain.isOpenUrl==-1&&data.domain.browserType == 'baidu' && !data.domain.isSpider && !data.domain.isMobile && data.domain.ispcpage===1&&f_host=='') {
        data.domain.isChangeTitle = 1;
      }
    }

    // 数据库获取代理线
    let agentLink = {}
    if (data.domain.agentid) {
      agentLink = await this.ctx.service.cache.get('userAgent-' + data.domain.agentid);
    }
    if (!agentLink || !agentLink._id) {
      agentLink = await ctx.model.UserAgent.findById(data.domain.agentid)
      this.ctx.service.cache.set('userAgent-' + data.domain.agentid, agentLink);
    }
    // 需要分割的链接
    let linkArr = ['myOpenDomain', 'openUrlPc', 'openUrlH5', 'openUrlIOS', 'openUrlAndroid', 'openUrlAPP', 'openUrlAgentPage']
    for (let key of linkArr) {
      if (agentLink[key]) {
        agentLink[key] = agentLink[key].split('').join('##')
      }
    }
    // console.log(agentLink)
    data.domain['agentLink'] = agentLink
    data.domain['linkID'] = data.domain.fullDomain.replace(/\./g, '')
    data.domain['todayDay'] = moment(new Date()).format('LL')
    data.domain['urlString'] = ctx.service.utils.urlToStr(h+ctx.url)||'aAbBcC'
    data.domain['urlEmoj'] = ctx.service.utils.urlToemoj(h+ctx.url)||''
    data.domain['allNUrl'] = h+ctx.url

    let jIOSUrl = agentLink.openUrlIOS;
    let jURL = jIOSUrl.replace(/##/g, '')+'?v='+Date.now();
    data.domain['jumpHTML'] = '';
    let agentPageName = data.domain.agentLink.agentPageName + '.html'
    let agentPageFilePath = process.cwd() + '/app/public/html/' + agentPageName
    let isHaveagentFile = fs.existsSync(agentPageFilePath)
    // 如果开启了缓存并且有缓存文件直接返回
    if (isHaveagentFile&&agentLink.isAgentPage) {
      jURL = '/html/'+agentPageName+'?v='+Date.now();
    }
    data.domain['jumpURL'] = jURL;
    // console.log(data.domain.isBaiduType)
    //符合静态页面跳转条件 有缓存走缓存 没有缓存直接跳
    if(isMobile&&!isSpider&&data.domain.isOpenUrl>-1&&(data.domain.isBaiduType == 3 || data.domain.isBaiduType == 1)){
      data.domain['jumpHTML'] = `
      <script>
      var jumpLinkIframe = function(url){
        var URL = url
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
              document.body.parentNode.insertBefore(iframe,document.body);
        };
            createIframe('global-iframe', URL, '100%', '100%');
      }
      jumpLinkIframe("${jURL}");
      </script>
      ${data.domain.agentLink.gajs}
      `
    }

    delete data.domain.agentid
    data.domain.randomVersion = ctx.service.utils.randomNumber(1,1,12)+Date.now().toString().slice(2);
    data.domain.randomClass = ctx.service.utils.RandomZiMu(1,1,12,1)
    data.domain.randomNumber = ctx.service.utils.randomNumber(1,1,6)
    // data.domain.randomWord = ctx.service.utils.RandomZiMu(1,1,12,1)

    let cturlc = ctx.url.replace(/\?|\:\/|\.|\#|\%|/g,'')
    data.domain.allUrl = data.domain.fullDomain+cturlc+data.domain.randomVersion
    let nowDatec = moment().format('YYYY年MM月DD日 HH:mm:28')
    let nowTodayDatec = moment().format('YYYY年MM月DD日')
    data.domain.detailNowTodayTime = nowTodayDatec
    data.domain.detailNowTime = nowDatec
    data.domain.muluRandomMulu = '';
    if (data.domain.isMuLu) {
      data.domain.muluRandomMulu = '/?post='+ctx.service.utils.RandomZiMu(1,1,12,1)+'&article=' + ctx.service.utils.randomWord(1, 1, 10) + Date.now().toString().slice(4)+'.html'
    }
    data.domain.f_host = f_host
    if (data.domain.tname.indexOf('n_frame') == 0) {
      firameTpList.forEach(itemframe => {
        if (itemframe.value === data.domain.tname) {
          data.domain.iframeUrl = itemframe.url
          data.domain['tname'] = 'n_frame_1';
        }
      })
    }
    return { domain: data.domain, site: data.site }
  }
}
module.exports = utilsService;




