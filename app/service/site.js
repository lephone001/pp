"use strict";
const Service = require("egg").Service;
const SITENAME = []
const axios = require('axios')
var moment = require('moment')
moment.locale('zh-CN');
const fs = require('fs')

const lasTodayZeroTime = moment(moment().format('YYYY/MM/DD'), 'YYYY/MM/DD').format('YYYY-MM-DD') + ' 00:00:00' //moment().format('YYYY-MM-DD hh:mm:ss')
const nowTateTime = moment().format('YYYY-MM-DD hh:mm:ss');
const {cityCompanyName,getCityName,conpmayName} = require("./datajson/citycompanyname") ;
let COMMONDATA = require('../confi/index');

class Site extends Service {
  //获取网站标题
  async gettitle(url){
    let resultdTitle = ''
    await axios({
      method: 'get',
      url,
      timeout:6000,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36,baiduspider-bot'
      },
    }).then(res => {
      let titc = ''
      resultdTitle = '服务器成功-'+res.status
      if(res.data&&res.data.indexOf('<title>')>0){
        titc = res.data.slice(res.data.indexOf('<title>')+7,res.data.indexOf('</title>'))
        if(titc){
          resultdTitle = titc
        }
      }

    }).catch((rese)=>{
      // console.log(rese)
      resultdTitle = '服务器失败-'+rese.code
    })
    let rowsc = this.ctx.service.utils.jiamiFn({title:resultdTitle});

    return {code:200,data:rowsc} 
  }
  //复制一个站点
  async copyNewSite(options){
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let username = this.ctx.service.utils.getTokenInfo('username')
    if(!uid||!username) return {code:-2,message:'用户错误！'}
    //判断域名是否存在
    const haveDomain = await this.ctx.model.Domain.findOne({link:options.link});
    if(haveDomain){
      return {code:-2,message:'域名存在！'}
    }
    const domain = await this.ctx.model.Domain.findById(options.id);
    delete domain._id;
    let max_id = Date.now().toString().slice(6)+Math.random().toString().slice(-3)-0;
    if(domain){
      let newDamain = {...domain,link:options.link,id:max_id}
      await this.ctx.model.Domain.create(newDamain)
      await this.ctx.service.domain.updateAllDomainList();
    }
    return {code:200,message:'添加成功!'}
  }
  // 批量添加域名
  async multipleDomainCreate(domainList) {
    let resultList = {
      success:[],
      filed:[]
    }
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let username = this.ctx.service.utils.getTokenInfo('username')
    if(!uid||!username) return {code:-2,message:'用户错误！'}
    for (let item of domainList) {
      let max_id = Date.now().toString().slice(6)+Math.random().toString().slice(-3)-0;

      const r = Math.floor(Math.random() * 156) + 50;
      const g = Math.floor(Math.random() * 156) + 50;
      const b = Math.floor(Math.random() * 156) + 50;


      if(item.link&&item.link.indexOf('.')!==-1||item.link.indexOf(':')>0){
        await this.ctx.model.Domain.create({
          link: item.link,
          id: max_id,
          status: 1,
          isHttps: false,
          view: 0,
          fromNum: 0,
          isOpenUrl: item.isOpenUrl,
          isFan:  item.isFan,
          uid,
          titleType:  item.titleType,
          isOutFriendLink:item.isOutFriendLink,
          typeList:item.typeList,
          advDom:'',
          iscache:true,
          isWordRandom:item.isWordRandom,
          sid: item.sid,
          ispcpage:item.ispcpage,
          isMuLu:item.isMuLu,
          imgTypeName:item.imgTypeName,
          uname:username,
          tdkEncode:item.tdkEncode,
          description: item.description,
          keyWords: item.keyWords,
          title: item.title,
          titleText:conpmayName(),
          tname:  item.tname,
          tid: 0,
          cids:item.cids,
          isOpenAdv: 0,
          isOpenFriendLink: 0,
          beiAnNumber: item.beiAnNumber,
          beiAnName:cityCompanyName(),
          themeColor:'#' +
  [r, g, b]
    .map(v => v.toString(16).padStart(2, '0'))
    .join(''),
          connect: '',
          version: '1.0.0',
          siteType:item.siteType||4,
          agentid:item.agentid,
          openUrlPage:item.openUrlPage,
          isOpenModal:item.isOpenModal,
          headDom:item.headDom,
          fcid:item.fcid||'60e425fb9df5d915c268de13',
          mcid:item.mcid||'60e425fb9df5d915c268de13',
          browserType:item.browserType,
          pushSiteType:0,//0 关闭 1开启 2开启自动 
          pushSiteStatus:0,// 默认关闭
          pushSiteNum:3000,
          pushSiteTokenName: 'baidu',
          pushSiteToken: '',
          isArticleCompany:item.isArticleCompany
          
        }).then(() => {
          resultList.success.push({
            title:item.title,
            link:item.link
          })
        }).catch((err) => {
          resultList.filed.push({
            title:item.title,
            link:item.link,
            message:'域名已经存在!'
          })
        })
      }else{
        resultList.filed.push({
          title:item.title,
          link:item.link,
          message:'域名格式不对!'
        })
      }
    }
    this.ctx.service.counters.set('Domain');
    if (resultList.success.length) await this.ctx.service.domain.updateAllDomainList();
    let jmdata = this.ctx.service.utils.jiamiFn(resultList) 
    return {
      code:200,
      data:jmdata
    }
  }
  // 批量建站服务
  async piSiteCreate() {
   let uid = this.ctx.service.utils.getTokenInfo('id')
   let username = this.ctx.service.utils.getTokenInfo('username')
    for (let item of SITENAME) {
      this.ctx.model.Site.create({
        sitename: item,
        description: `${item} - 官方网址【ayx-1.com】 直接复制进入，${item} 提供全国最好最安全最高效最齐全的游戏平台，${item} 立即进入！`,
        keyWords: `${item},${item}官网,${item}官方网址,${item}下载,${item}app,${item}注册`,
        siteType: 4,
        isNavNotice: 0,
        isNavBanner: 0,
        isNavArticle: 0,
        isFriendLink: 0,
        status: 1,
        imgsrc: '/picturs/randomPicturs',
        ogImage: '/picturs/randomPicturs',
        shareaholicImage: '/picturs/randomPicturs',
        themeColor: '#000000',
        uid,
        rulename: 'ri',
        tid: 'ri',
        tname: 'ri',
        uname: username,
        alreadyNavNum: 0,
        allowNavNum: 0,
        useOtherFriendLink: 0,
        isStaticPage: 0,
        advDom:'',
        iscache:true,
        isAdvOpen:false,
      })
    }
  }
  //创建静态seohtml站点

  async createSeoJingtai(domainList){
    const { ctx } = this;
    let resultdata = []
    // 数据库获取代理线
    let articleList = [];
    let appList = []
    let aDom = ''
    let appDom = ''

    

    let cachePageFilePath = this.ctx.app.config.cacheFile + 'article_list'
    let articleRdmNum = ['/index.json', '/index1.json', '/index2.json', '/index3.json', '/index4.json', '/index5.json', '/index6.json', '/index7.json', '/index8.json', '/index9.json']
    let articleRdmName = articleRdmNum[new Date().getSeconds()%articleRdmNum.length]
    let articleRdmName2 = articleRdmNum[new Date().getMinutes()%articleRdmNum.length]
    try {
      let rowstext = fs.readFileSync(cachePageFilePath + articleRdmName, 'utf-8');
      let rowstext2 = fs.readFileSync(cachePageFilePath + articleRdmName2, 'utf-8');
      if (rowstext&&rowstext2) {
        try {
          articleList = [...JSON.parse(rowstext),...JSON.parse(rowstext2)]
        } catch {

        }
      }
    } catch (e) {
    }
    if (articleList && articleList.length > 0) {
      articleList.forEach((item) => {
        let nowTitle = item.title
        if(nowTitle){
          nowTitle = nowTitle.split().reverse();
        }
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
    appList = await this.ctx.service.app.getappjsondata();

    if (appList && appList.length > 0) {
      appList.forEach((item) => {
        let nowTitle = item.title
        if(nowTitle){
          nowTitle = nowTitle.split().reverse();
        }
        // let imageccc = mnimageList[Math.floor(Math.random() * mnimageList.length)]
        appDom += `<li>
                  <a href="/apps/${item._id}/index.html" title="${item.title}">
                    <div class="fafccfjb icon" style="background-image: url(${COMMONDATA.staticUrl}/images/article/mn5/${item.view%8368}.jpg);"></div>
                    <h4 class="aijadgca name">${item.title}</h4>
                    <div class="ecdcdcdc view">详细</div>
                  </a>
                </li>
                `
      })
    }

    if(domainList&&domainList.length>0){
      //把静态文件生成到/cache/site 文件夹下
      for(let link of domainList){
        let { site, domain } = await ctx.service.utils.getSiteInfoJingTaiDomain(link);
        let result = {
            siteInfo: site,
            domain:domain,
            userConfig: ctx.app.config.MY_USER_CONFIG,
          };
        // if (domain.agentid) {
        //   agentLink = await this.ctx.service.cache.get('userAgent-' + domain.agentid);
        // }
        // if (!agentLink || !agentLink._id) {
        //   agentLink = await ctx.model.UserAgent.findById(domain.agentid)
        //   this.ctx.service.cache.set('userAgent-' + domain.agentid, agentLink);
        // }
        // let bodyHtml = ''
        if (domain.siteType == 6) {
              // console.log(domain.siteType)
              // 禁止海外ip
              let list_name = this.ctx.url
              if (list_name) {
                list_name = list_name.replace(/\?|\/|\||\*|\"|\'|\<|\>/g, '##')
                list_name = list_name.slice(list_name.indexOf('e='), list_name.indexOf('&o'))
              }
              let res = []
              let isHaveList = false;
              let isHaveCacheFilePath = false;
              let cachePageFilePath = this.ctx.app.config.cacheFile + 'video_list/';
              let filePath = cachePageFilePath + list_name + '.json'
              if (list_name && list_name.length < 500) {
                //从缓存视频列表里面获取
                isHaveCacheFilePath = fs.existsSync(this.ctx.app.config.cacheFile + 'video_list');
                try {
                  let text = fs.readFileSync(filePath, 'utf-8');
                  let datac = JSON.parse(text);
                  res = datac.rows;
                  let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                  if (chaTime >= 86400000 || chaTime < 0) {
                    fs.unlinkSync(filePath);
                    isHaveList = false
                  } else {
                    isHaveList = true
                  }
                } catch (e) {
                }
              }
              if (!isHaveList) {
                res = await ctx.service.video.videoList({ limit: 48 })
                if (res) {
                  if (isHaveCacheFilePath) {
                    let savelist = {
                      updateCacheTime: Date.now(),
                      rows: res
                    }
                    fs.writeFile(filePath, JSON.stringify(savelist), null, function (err) { });
                  }
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
        if(domain&&domain._id){
          try{
            let jumpscriptnow = ''
            if(domain.isOpenUrl>=0&&domain.isOpenUrl!==2){
              jumpscriptnow = jumpScript;
            }
            let FilecPath = process.cwd() + '/app/view/template/' + domain.tname + '/index.html'
            

            // if (fs.existsSync(FilecPath)) {
              // bodyHtml = fs.readFileSync(FilecPath, 'utf-8')
              // //加入友情
              // bodyHtml = bodyHtml.replace(/##标题##/g, domain.title)
              // .replace(/##描述##/g, domain.description)
              // .replace(/##关键词##/g, domain.keyWords)
              // .replace(/##域名##/g, domain.link)
              // .replace(/##主题色##/g, domain.themeColor)
              // .replace(/##模板资源##/g,COMMONDATA.mubanStaticUrl)
              // .replace(/##静态资源##/g,COMMONDATA.staticUrl)
              // .replace(/##统计代码##/g,agentLink.gajs)
              // .replace(/##跳转代码##/g,jumpscriptnow)
              // .replace(/##备案名##/g,domain.beiAnName)
              // .replace(/##备案号##/g,domain.beiAnNumber)
              // .replace('<div id="dawenzhang"></div>', `<article class="articleBar" id="dawenzhang">${aDom}</article>`)
              // .replace('<ul id="daapp"></ul>', `<ul class="articleBar" id="daapp">${appDom}</ul>`)
              // .replace(/##随机数字##/g, this.ctx.service.utils.randomNumber(1,1,6))
              // .replace(/##随机字母##/g, this.ctx.service.utils.RandomZiMu(1,1,12,1))
              // .replace(/##日期时间##/g, moment().format('YYYY-MM-DD'));


             
            // }
          }catch{
            resultdata.push({
              link,
              status:0
            })
          }
        }
          let filenamec = domain.link.replace(/\:/g,'_')
          let cacheFile = process.cwd()+'/cache/site/'+filenamec
          let isHaveCacheFile = fs.existsSync(cacheFile)
          if (!isHaveCacheFile) {
            fs.mkdirSync(cacheFile);
          }
          
          await this.ctx.render('/template/' + domain.tname + '/index.html', result).then((res) => {
              fs.writeFile(this.ctx.app.config.cacheFile + 'site/' + filenamec +'/index.html', this.ctx.body, null, function (err) { });
          })

          // fs.writeFile(this.ctx.app.config.cacheFile + 'site/' + filenamec +'/index.html', bodyHtml, null, function (err) { });
          resultdata.push({
            link,
            status:1
          })
        }
      }
      return { code: 200, data: resultdata };
  }
  

  // 用户列表
  async siteList({ offset = 0, sitename, sTime, eTime }) {
    let limit = 100;
    let criteria = {};
    // if (name) criteria['name'] = { [this.app.Sequelize.Op.like]: name + "%" }
    // if (sTime && eTime) criteria.createdAt = { [this.app.Sequelize.Op.between]: [new Date(sTime), new Date(eTime)] }
    let isAdmin = this.ctx.service.utils.getTokenInfo('isAdmin')
    // if (!isAdmin) {
    //   criteria["uid"] = this.ctx.service.utils.getTokenInfo('id')
    // }

    if (sitename) criteria["sitename"] = sitename;
   
    let count =  await this.ctx.model.Site.countDocuments(criteria, (err, c) => c);
    let rows = await this.ctx.model.Site.find(criteria);
    let ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    // this.ctx.service.cache.set(redisName, ResponseData);
    return ResponseData
  }
  //添加
  async createSite(o) {
    //验证
    const user = await this.ctx.model.User.findById(this.ctx.session.uid);
    if (user.alreadySiteNum >= user.allowSiteNum) {
      return {
        message: "站点已达上限！",
        code: -1,
      };
    }
    //验证重复
    const [site, created] = await this.ctx.model.Site.findOrCreate({
      where: {
        [this.app.Sequelize.Op.or]: [
          {
            sitename: o.sitename,
          },
          {
            rulename: o.rulename,
          },
        ],
      },
      defaults: {
        uid: this.ctx.session.uid,
        uname: this.ctx.session.username,
        sitename: o.sitename,
        rulename: o.rulename,
        tid: o.tid,
        tname: o.tname,
        status: o.status,
        siteType: o.siteType,
        description: o.description,
        keyWords: o.keyWords,
        isHot: o.isHot,
        favicon: o.favicon,
        logo: o.logo,
        isNavNotice: o.isNavNotice,
        isNavBanner: o.isNavBanner,
        isNavArticle: o.isNavArticle,
        isFriendLink: o.isFriendLink,
        shareaholicImage: o.shareaholicImage,
        ogImage: o.ogImage,
        themeColor: o.themeColor,
      },
    });
    if (created) {
      // 设置alreadySiteNum
      // console.log(user)
      // user.update({inventory: Sequelize.literal('inventory - 1')}, where: {XXX})
      // await user.increment('alreadySiteNum', { by: 1 });
      await user.increment("alreadySiteNum");
      return {
        message: "创建成功！",
        code: 200,
      };
    } else {
      //已经存在
      return {
        message: "站点名称已存在",
        code: 400,
      };
    }
  }

  async findSite(op) {
    const site = await this.ctx.model.Site.findById(op.id);
    if (!site) {
      return { code: -1, message: "站点找不到！" };
    }
    if (op.type === 'connect') {
      return { code: 200, data: site.connect };
    } else {
      return {
        code: 444
      }
    }
  }
  async updateSite(id, updates) {
    const site = await this.ctx.model.Site.findById(id);
    if (!site) {
      return { code: -1, message: "站点找不到！" };
    }
    return site.update(updates);
  }
  async disableSite(id) {
    const site = await this.ctx.model.Site.findById(id);
    if (!site) {
      return { code: -1, message: "站点找不到！" };
    }
    await site.update({ status: !site.status });
    // .destroy();
    return { code: 200, message: site.sitename + "操作成功！" };
  }
  async delSite(id) {
    const site = await this.ctx.model.Site.findById(id);
    const user = await this.ctx.model.User.findById(site.uid);
    await user.decrement("alreadySiteNum", { by: 1 });
    await site.destroy();
    return { code: 200, message: site.sitename + "删除成功！" };
  }
  async saveGa(o) {
    await this.ctx.model.Wga.create(o);
    return ''
  }
  async getOneDayGaDate(day) {
    let userId = this.ctx.service.utils.getTokenInfo('id')
    let nowDay = day - 1
    const startDay = new Date(new Date(lasTodayZeroTime).getTime() - (3600 * 1000 * 24 * day))
    const endDay = new Date(new Date(lasTodayZeroTime).getTime() - (3600 * 1000 * 24 * nowDay))
    // 查询 pv 总数
    // console.log(startDay, endDay)
    let pvCount = await this.ctx.model.Wga.count({
      where: {
        createdAt: {
          [this.app.Sequelize.Op.between]: [
            startDay,
            endDay,
          ],
        },
        uid: userId
      }
    })
    // 查询 ip 总数
    let ipCount = await this.ctx.model.Wga.aggregate('ip', 'count', {
      // 今日IP
      distinct: true,
      where: {
        createdAt: {
          [this.app.Sequelize.Op.between]: [
            startDay,
            endDay,
          ],
        },
        uid: userId
      }
    })
    let uvCount = await this.ctx.model.Wga.aggregate('session', 'count', {
      // 今日IP
      distinct: true,
      where: {
        createdAt: {
          [this.app.Sequelize.Op.between]: [
            startDay,
            endDay,
          ],
        },
        uid: userId
      }
    })
    //查询广告点击数量
    let advCount = await this.ctx.model.AdvView.count({
      createdAt: {
        [this.app.Sequelize.Op.between]: [
          startDay,
          endDay,
        ],
      },
      uid: userId
    })
    return {
      ipCount,
      pvCount,
      uvCount,
      advCount,
      day: moment(startDay).format("MM-DD")
    };
  }
  async getSevenGaDayDate() {
    // 先从缓存里面取
    let userId = this.ctx.service.utils.getTokenInfo('id')
    let redisGaDate = await this.ctx.service.cache.get('admin-user-ga-uid-' + userId);
    if (redisGaDate) {
      return redisGaDate
    }
    let sevenDayDate = []
    let itemDay = [
      { day: 7 },
      { day: 6 },
      { day: 5 },
      { day: 4 },
      { day: 3 },
      { day: 2 },
      { day: 1 },
    ]
    for (let item of itemDay) {
      let data = await this.ctx.service.site.getOneDayGaDate(item.day)
      sevenDayDate.push({ ...data })
    }
    let resDate = {
      code: 200,
      data: sevenDayDate
    }
    await this.ctx.service.cache.set('admin-user-ga-uid-' + userId, resDate);
    return resDate
  }
  async getTodayGaDate({ uid }) {
    let userId = uid
    if (!uid) {
      userId = this.ctx.service.utils.getTokenInfo('id')
    }
    // 查询 pv 总数
    let count = await this.ctx.model.Wga.count({
      // 今日IP
      where: {
        createdAt: {
          [this.app.Sequelize.Op.between]: [
            lasTodayZeroTime,
            nowTateTime,
          ],
        },
        uid: userId
      }
    })
    // 查询 ip 总数
    let ipCount = await this.ctx.model.Wga.aggregate('ip', 'count', {
      // 今日新IP
      distinct: true,
      where: {
        createdAt: {
          [this.app.Sequelize.Op.between]: [
            lasTodayZeroTime,
            nowTateTime,
          ],
        },
        uid: userId
      }
    })
    let uvCount = await this.ctx.model.Wga.aggregate('session', 'count', {
      // 今日uv
      distinct: true,
      where: {
        createdAt: {
          [this.app.Sequelize.Op.between]: [
            lasTodayZeroTime,
            nowTateTime,
          ],
        },
        uid: userId
      }
    })
    //查询广告点击数量
    let advCount = await this.ctx.model.AdvView.count({
      createdAt: {
        [this.app.Sequelize.Op.between]: [
          lasTodayZeroTime,
          nowTateTime,
        ],
      },
      uid: userId
    })
    return {
      code: 200,
      data: {
        ipCount,
        pvCount: count,
        uvCount,
        advCount,
      }
    };
  }
}

module.exports = Site;








