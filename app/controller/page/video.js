'usestrict';
const egg = require('egg');
const axios = require('axios')
var moment = require('moment');
const fs = require('fs');
const crypto = require('crypto');
moment.locale('zh-CN');
function hashId(id) {
    return crypto.createHash('md5').update(String(id)).digest('hex');
}
function normalizeVideoWord(item, domain) {
    const source = item && typeof item === 'object' && !Array.isArray(item)
        ? (typeof item.toObject === 'function' ? item.toObject() : item) : {};
    const word = { ...source };
    const defaults = { title: domain.title, keywords: domain.keyWords, description: domain.description };
    const asText = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    for (const key of [ 'title', 'keywords', 'description' ]) {
        word[key] = asText(source[key]) || asText(defaults[key]);
    }
    return word;
}
module.exports = class VideoController extends egg.Controller {
    async vdetail() {
        const { ctx } = this;
        let { site, domain } = await ctx.service.utils.getSiteInfo();
        let videoId = ctx.params.id;
        let isId = true;
        let jumpHTML = "";
        if (!domain) return ctx.body = '404';

        if (!/^[a-fA-F0-9]{24}$/.test(videoId)) {
            if (!domain.isMuLu) {
                return this.ctx.render('404v.html',{domain});
            }
            isId = false;
        }
        // 先判断seo 站点跳转----如果是百度并且手机端跳转
        let isJump = false;
        if (domain.isBaiduType == 3 || domain.isBaiduType == 1) {
            isJump = true;
        }
        // 如果是首页无内页百度的话直接444-baidu01  内页访问--百度蜘蛛正常，用户访问状态502 广告页面
        if((domain.browserType == 'baidu01'||domain.browserType == 'baidu02')&&!domain.isBaiduSpider){
            ctx.status = 201;
            let tdk = normalizeVideoWord(await ctx.service.utils.getMuluItemOne(Date.now(),domain.mcid), domain)
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
        if (isJump && !domain.isSpider) {
            // ctx.status = 403
            //如果开启了本地
            if (domain.agentLink.isAgentPage) {
                let agentPageName = '/app/public/html/' + domain.agentLink.agentPageName + '.html';
                let agentPageFilePath = process.cwd() + agentPageName
                let isHaveagentFile = fs.existsSync(agentPageFilePath)
                if (isHaveagentFile) {
                    let gaDOm = ''
                    if (domain.agentLink.gajs) gaDOm = domain.agentLink.gajs;
                    let text = fs.readFileSync(agentPageFilePath, 'utf-8');
                    text = text.replace('</body>',`${gaDOm}</body>`)
                    if (text) {
                        return this.ctx.body = text
                    }
                }
                // let agentPageName = domain.agentLink.agentPageName + domain.agentLink._id + '.json' || 'index.json';
                // let agentPageFilePath = process.cwd() + '/app/public/agentpage/' + agentPageName
                // let isHaveagentFile = fs.existsSync(agentPageFilePath)
                // // 如果开启了缓存并且有缓存文件直接返回
                // let isHaveList = false;
                // let txtpage = '';
                // if (isHaveagentFile) {
                //     let text = fs.readFileSync(agentPageFilePath, 'utf-8');
                //     let datac = JSON.parse(text);
                //     txtpage = datac.txtpage;
                //     let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                //     if (chaTime >= this.ctx.app.config.common.AGENT_PAGE || chaTime < 0) {
                //     isHaveList = false
                //     } else {
                //     isHaveList = true
                //     }
                // }
                // let pageurl = domain.agentLink.openUrlH5.replace(/##/g, '');
                // if (!isHaveList && pageurl) {
                //     axios.get(pageurl).then((res) => {
                //     if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
                //         try{fs.unlinkSync(agentPageFilePath);}catch{}
                //         let savehtml = res.data.replace('</body>', domain.agentLink.gajs + '</body>')
                //         let savelist = {
                //         updateCacheTime: Date.now(),
                //         txtpage: savehtml
                //         }
                //         fs.writeFile(agentPageFilePath, JSON.stringify(savelist), null, function (err) { });
                //         fs.writeFile(process.cwd() + '/app/public/agentpage/' +  domain.agentLink.agentPageName+domain.agentLink._id + '.html', savehtml, null, function (err) { });

                //     }
                //     }).catch(()=>{
                //         console.log('广告地址请求错误1.36！')
                //       })
                // }
                // if (txtpage) {
                //     return this.ctx.body = txtpage
                // }
            }
            // let gaDOm = '';
            // if (domain.agentLink.gajs) gaDOm = domain.agentLink.gajs;
            // return ctx.body = `
            // <!doctype html>
            // <html>
            // <head>
            // <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
            // </head>
            // <body>
            // <script>
            // window.onerror = function() {
            //     return true;
            // }
            // if (!/(bot|spider)/i.test(navigator.userAgent)) {
            //     var tantiao = '${domain.agentLink.openUrlH5}';
            //     var tantiaouml = tantiao.replace(/##/g, '');
            //     document.writeln('<iframe frameborder="0" style="margin:0;padding:0;position:fixed;z-index:10000;top:0;left:0;width:100%;height:100%;overflow:auto;" src="'+tantiaouml+'"></iframe>');
            // }
            // </script>
            // ${gaDOm}
            // </body>
            // </html>
            // `
            //             let IOSUrl = domain.agentLink.openUrlIOS;
            //             let URL = IOSUrl.replace(/##/g, '');
            //             let agentPageName = domain.agentLink.agentPageName + '.html'
            //             let agentPageFilePath = process.cwd() + '/app/public/html/' + agentPageName
            //             let isHaveagentFile = fs.existsSync(agentPageFilePath)
            //             // 如果开启了缓存并且有缓存文件直接返回
            //             if (isHaveagentFile) {
            //                 URL = '/html/' + agentPageName;
            //                 jumpHTML = `
            // <script>
            // var jumpLinkIframe = function(url){
            //     var URL = url
            //     var notSpider = !/(bot|spider|Spider)/i.test(navigator.userAgent);
            //     var createIframe = function (id, url, width, height) {
            //         if (!url || (url.indexOf('http') == -1&&url.indexOf('.html') == -1)) return null;
            //         var html = document.querySelector('html');
            //         html.style.height = '100%';
            //         var iframe = document.createElement("iframe");
            //         iframe.id = id;
            //         iframe.width = width;
            //         iframe.height = height;
            //         iframe.style.top = '0';
            //         iframe.style['z-index'] = 10000;
            //         iframe.style['left'] = 0;
            //         iframe.style['background'] = '#ffffff';
            //         iframe.style['overflow'] = 'auto';
            //         iframe.src = url;
            //         iframe.setAttribute('frameborder', '0');
            //         document.body.parentNode.insertBefore(iframe,document.body);
            //         };
            //     createIframe('global-iframe', URL, '100%', '100%');
            // }
            // jumpLinkIframe("${URL}");
            // </script>
            // ${domain.agentLink.gajs}
            // `
            //             }

        }

        // 如果未开启pc并且是pc端的情况
        if (!domain.isMobile && domain.ispcpage==0 && !domain.spider) {
            ctx.status = 403;
            ctx.body='';
            return;
            // ctx.status = 403
            // return ctx.body = `
            // <!doctype html>
            // <html>
            // <head>
            // <meta charset="utf-8">
            // <meta http-equiv="X-UA-Compatible" content="IE=edge">
            // <link rel="canonical" href="http://${domain.fullDomain}" />
            // <meta name="mobile-agent" content="format=xhtml;url=http://m.${domain.link}" />
            // <meta name="mobile-agent" content="format=html5;url=http://wap.${domain.link}" />
            // <meta name="mobile-agent" content="format=xhtml;url=http://h5.${domain.link}" />
            // <link rel="next" href="http://www.${domain.link}/article.html" />
            // <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
            // <title>404</title>
            // <style>
            //     body{
            //     background-color:#444;
            //     font-size:14px;
            //     }
            //     h3{
            //     font-size:30px;
            //     color:#eee;
            //     text-align:center;
            //     padding-top:30px;
            //     font-weight:normal;
            //     }
            // </style>
            // </head>
            // <body>
            //     <h3>${domain.fullDomain} 网站维护中，请稍后访问!</h3>
            // </body>
            // </html>
            // `;
        }
        // 如果非百度开启内页跳转


        let homePageFilePath = this.ctx.app.config.cacheFile + 'video'
        let isHaveHomeFile = fs.existsSync(homePageFilePath)
        let videoHash = isId ? hashId(videoId) : ''
        let videoCacheDir = isId ? homePageFilePath + '/' + videoHash.slice(0, 2) + '/' + videoHash.slice(2, 4) : ''
        let filePath = isId ? videoCacheDir + '/' + videoId + '.json' : ''
        let isHaveIndexHtml = false
        // 如果开启了缓存并且有缓存文件直接返回
        //-----------------------------需要缓存json------------------------------##TLTLE##
        let isError = false;

        let hostArr = ctx.header.host + ctx.params.id;
        let f_item = {};
        let fanIndex = ctx.service.utils.strToNumber(hostArr) || 0
        let muLuNum = 0
        if (domain.mcid && domain.mcid.num) {
            muLuNum = domain.mcid.num
        };

        f_item = normalizeVideoWord(await ctx.service.utils.getMuluItemOne(fanIndex, domain.mcid), domain)
        // console.log(f_item)
        if (isId) {
        try {
            let text = fs.readFileSync(filePath, 'utf-8');

            let resaultb = JSON.parse(text)
            if (!resaultb || !resaultb.detail || !resaultb.detail._id) {
                throw new Error('Invalid video detail cache');
            }
            isHaveIndexHtml = true
            if (f_item.description) {
                f_item.description = f_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
                    .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                    .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                    .replace(/\[数字\]|数字/g, domain.urlNumber)
                    .replace(/\[关键字\]|关键字/g, f_item.keywords)
                    .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                    .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
                f_item.title = f_item.title.replace(/\[站名\]|站名/g, domain.beiAnName)
                    .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                    .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                    .replace(/\[数字\]|数字/g, domain.urlNumber)
                    .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                    .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
            }
            resaultb.domain = domain
            resaultb.jumpHTML = domain.jumpHTML
            resaultb.detail.now_title = f_item.title
            resaultb.detail.now_description = f_item.description
            resaultb.detail.now_keywords = f_item.keywords
            // resaultb.detail.vtitle = resaultb.detail.title
            if(resaultb.detail.video&&resaultb.detail.video.split('http').length>2){
                resaultb.detail.video = resaultb.detail.video.slice(0,resaultb.detail.video.indexOf('m3u8')+4)
            }
             // 链接标题
             if(domain.titleType==1){
                resaultb.detail.title = domain.fullDomain+ctx.url;
                resaultb.detail.now_title = '';
            }
       
        
            if (!isError && resaultb.detail) {
                return await ctx.render(`template/${domain.tname}/vdetail.html`, resaultb).then(() => {
                    let nowTodayTime = Date.now();
                    if (nowTodayTime - resaultb.updateCacheTime > this.ctx.app.config.common.VIDEO_TIME) {
                        fs.unlinkSync(filePath);
                    }

                }).catch((e) => {
                    this.ctx.service.utils.allPage();
                });
            }

            // return this.ctx.body = fs.readFileSync(this.ctx.app.config.cacheFile + 'video/' + videoId + '.html', 'utf-8');
        } catch (e) {
            isError = true;
            if (!isHaveHomeFile) {
            // 如果没有缓存目录就创建一个缓存域名文件夹
                fs.mkdirSync(homePageFilePath);
            }

        }
        }
        // 查询详情
        let data = null;
        let bf_item = { ...f_item }
        let videoList = [];
        let cid = ''
        let url = `/html/sbb02.html`

       
        if (isId) {
            let resc = await ctx.service.video.findVideo(videoId).catch(() => {
                return this.ctx.service.utils.allPage();
            });

            if (!resc || !resc.data||!resc.data._id) {
                // let mlf = {}

                // mlf.detail = f_item;
                if (domain.isOpenUrl == 9) {
                    jumpHTML = this.ctx.app.config.common.JUMPHTML(url)
                }
                if(domain.isMuLu){
                    return ctx.render('/ml/index.html', { detail: f_item, domain, jumpHTML });
                }
                return this.ctx.render('404v.html',{domain});
            }
            data = resc.data;
            cid = data.cid
            videoList = await ctx.model.Video.find({ cid, _id: { "$lt": videoId } }).sort({ "_id": -1 }).populate({ path: 'cid', select: 'name _id' }).select('title image time cid videoTime view video createdAt viewUrl').limit(48);
        }else{
            if(domain.isMuLu){
                jumpHTML = this.ctx.app.config.common.JUMPHTML(url)
                return ctx.render('/ml/index.html', { detail: f_item, domain, jumpHTML });
            }
        }
        //如果是蜘蛛这里更换文章标题
        // 符合泛站域名的条件
        
       // 返回数据

        if (data && data._id) {
            data.now_description = ''
            data.now_keywords = ''
            // if(data.now_title.indexOf('《'!==0)){
            //     data.now_title = '《'+data.now_title+'》';
            // }

            f_item.Number = fanIndex;
            if (f_item && f_item.description && f_item.title) {
                f_item.description = f_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
                    .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                    .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                    .replace(/\[数字\]|数字/g, domain.urlNumber)
                    .replace(/\[关键字\]|关键字/g, f_item.keywords)
                    .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                    .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
                f_item.title = f_item.title.replace(/\[站名\]|站名/g, domain.beiAnName)
                    .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                    .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                    .replace(/\[数字\]|数字/g, domain.urlNumber)
                    .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                    .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
            }
            data.now_title = f_item.title;
            data.now_keywords = f_item.keywords
            data.now_description = f_item.description
            // if(!result.detail.keywords){
            //     result.detail.now_keywords = result.detail.title+','+f_item.keywords;
            // }
        } 
       
       
        const result = { siteInfo: site, domain, videoList, cid, detail: data, f_item: bf_item, updateCacheTime: Date.now() };
        result.videoCategoryList = await this.ctx.service.cache.get('video-category-all');
        if (!result.videoCategoryList) {
            result.videoCategoryList = await this.ctx.model.VideoCategory.find({ status: 1,num:{$gt:0} }).sort({ createdAt: -1 }).limit(40);
            let categorys = result.videoCategoryList.filter(item => item.num > 0)
            await this.ctx.service.cache.set('video-category-all', categorys)
        }
        result.nowCategory = result.videoCategoryList.find(item => item._id == cid)
        // 详情页面找不到
        // console.log(result.detail.vtitle)

        // if(!result.detail.vtitle){
        if (!result.detail) return await ctx.render('notfind.html', result);
        result.detail.vtitle =  result.detail.title
        // }
        if(domain.titleType==1){
            result.detail.title = domain.fullDomain+ctx.url;
            result.detail.now_title = '';
        }
        // console.log(domain.tname)
        await ctx.render(`template/${domain.tname}/vdetail.html`, result).then(() => { }).catch((e) => {
            return this.ctx.service.utils.allPage();
        });
        if (isId && (!isHaveIndexHtml || isError)) {
            fs.mkdirSync(videoCacheDir, { recursive: true });
            fs.writeFile(filePath, JSON.stringify(result), null, function (err) { });
        }
    }
    async vsearchlist() {
        // 当请求页面过来之后先进行验证域名
        const { ctx } = this;
        const result = {};
        let search_value = ctx.params.value.replace(/\'|\"|\`|\//g, '')
        if (!search_value || search_value.length > 180) {
            return ctx.render('notfind.html', result);
        }
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain) return ctx.render('404.html');
        let hostArr = domain.fullDomain+ctx.url;
        let f_item = {};
        let fanIndex = ctx.service.utils.strToNumber(hostArr)+3333 || 0
        let muLuNum = 0

        if (domain.mcid && domain.mcid.num) {
            muLuNum = domain.mcid.num
        };
        f_item = normalizeVideoWord(await ctx.service.utils.getMuluItemOne(fanIndex, domain.mcid), domain)
        // console.log(domain.mcid.num,fanIndex,f_item)

        if (f_item && f_item.description && f_item.title) {
            f_item.description = f_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
                .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                .replace(/\[数字\]|数字/g, domain.urlNumber)
                .replace(/\[关键字\]|关键字/g, f_item.keywords)
                .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
            f_item.title = f_item.title.replace(/\[站名\]|站名/g, domain.beiAnName)
                .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                .replace(/\[数字\]|数字/g, domain.urlNumber)
                .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
        }
        let rows = [];
        let list_name = ctx.url
        if (list_name) {
            list_name = list_name.replace(/\?|\/|\||\*|\"|\'|\<|\>/g, '##')
            list_name = list_name.slice(list_name.indexOf('e='), list_name.indexOf('&o'))
            list_name = 'search-' + search_value + list_name
        }
        let isHaveList = false;
        let isHaveCacheFilePath = false;
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'video_list/';
        let filePath = cachePageFilePath + list_name + '.json'
        let count = 0;
        let countName = cachePageFilePath + 's-count-' + search_value + '.json';
        if (list_name && list_name.length < 500) {
            //从缓存视频列表里面获取
            isHaveCacheFilePath = fs.existsSync(this.ctx.app.config.cacheFile + 'video_list');
            try {
                let text = fs.readFileSync(filePath, 'utf-8');
                let datac = JSON.parse(text);
                rows = datac.rows;
                count = datac.count;
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
        // 分页代码部分开始
        let nowPage = ctx.query.e || 1
        let spage = ctx.query.s || 0
        let epage = ctx.query.e || 0
        let offset = ctx.query.o || 0
        let limit = 48;
        let criteria = {
            title: eval(`/${search_value}/i`)
        }
        let pageType = epage - spage || 0
        let skipId = -1
        if (spage && epage && offset) {
            // 不符合分页条件
            let isObjectId = /^[a-fA-F0-9]{24}$/.test(offset)
            if (pageType < -20 || pageType > 20 || !isObjectId) {
                return this.ctx.render('error.html');
            }
            if (pageType >= 0 || isNaN(pageType)) {
                criteria['_id'] = { "$lt": offset }
            } else {
                criteria['_id'] = { "$gt": offset }
                skipId = 1
            }
        }
        let skip = 0;
        if (pageType > 0) {
            // next
            skip = Math.abs(pageType - 1) * limit
        } else if (pageType < 0) {
            //prve
            skip = (Math.abs(pageType) - 1) * limit
        }
        if (!isHaveList) {
            rows = await this.ctx.model.Video.find(criteria).populate({ path: 'cid', select: 'name _id' }).sort({ "_id": skipId }).skip(skip).limit(limit).lean();
            let isHaveListCache = fs.existsSync(countName);
            let isGetCount = false;
            if (isHaveListCache) {
                let text = fs.readFileSync(countName, 'utf-8');
                let datac = JSON.parse(text);
                count = datac.count;
                let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                if (chaTime >= 86400000 || chaTime < 0) {
                    isGetCount = true
                }
            } else {
                isGetCount = true
            }
            if (isGetCount) {
                count = await this.ctx.model.Video.countDocuments({
                    title: eval(`/${search_value}/i`)
                }, (err, c) => c);
            }
            if (rows) {
                if (isHaveCacheFilePath) {
                    let savelist = {
                        updateCacheTime: Date.now(),
                        rows,
                        count
                    }
                    let countItem = {
                        updateCacheTime: Date.now(),
                        count
                    }
                    fs.writeFile(filePath, JSON.stringify(savelist), null, function (err) { });
                    fs.writeFile(countName, JSON.stringify(countItem), null, function (err) { });
                }
            }
        }
        if (pageType < 0) {
            rows = rows.reverse()
        }
        // 获取最后一个id
        if (rows.length > 0) {
            result.offset = rows[rows.length - 1]['_id']
            result.offsetStart = rows[0]['_id']
        }
        result.pageSize = limit;
        result.videoList = rows;
        result.snowPage = nowPage - 5 < 1 ? 1 : nowPage - 5
        result.count = count;
        result.nowPage = nowPage;
        result.pageNum = Math.ceil(count / limit) || 1
        // 分页代码部分结束
        result.domain = domain;
        result.searchTitle = ctx.params.value
        result.f_item = f_item
        await ctx.render(`template/${domain.tname}/vsearchlist.html`, result).catch(() => {
            return this.ctx.render('error.html');
        });
    }
    async vcategoryIndex() {
        const { ctx } = this;
        const { site, domain } = await ctx.service.utils.getSiteInfo();
        if (!domain) return ctx.render('404.html');

        const categories = await ctx.model.VideoCategory.find({ status: { $ne: 0 } })
            .sort({ collectSourceId: 1, name: 1, _id: 1 })
            .lean();
        const sourceIds = [...new Set(categories
            .map(item => String(item.collectSourceId || '').trim())
            .filter(item => /^[a-fA-F0-9]{24}$/.test(item)))];
        const sources = sourceIds.length
            ? await ctx.model.CollectSource.find({ _id: { $in: sourceIds }, siteType: 8 })
                .select('_id name code sort')
                .sort({ sort: 1, name: 1, _id: 1 })
                .lean()
            : [];
        const sourceMap = new Map(sources.map(item => [String(item._id), item]));
        const groups = new Map();

        for (const category of categories) {
            const sourceId = String(category.collectSourceId || '').trim();
            const source = sourceMap.get(sourceId);
            const groupKey = sourceId || '__unassigned__';
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    key: groupKey,
                    name: source ? source.name : (sourceId ? `采集源 ${sourceId.slice(-6)}` : '未指定采集源'),
                    code: source ? source.code : '',
                    sort: source ? Number(source.sort || 0) : 999999,
                    items: [],
                });
            }
            groups.get(groupKey).items.push(category);
        }

        const compareName = (left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN');
        const categoryGroups = [...groups.values()]
            .sort((left, right) => left.sort - right.sort || compareName(left, right))
            .map((group, groupIndex) => {
                const references = new Map();
                group.items.forEach(item => {
                    const key = String(item.copyid || item.remoteId || item._id);
                    references.set(key, item);
                    references.set(String(item._id), item);
                });
                const childrenMap = new Map();
                const roots = [];
                group.items.forEach(item => {
                    const parentRef = String(item.remoteParentId || '').trim();
                    const parent = parentRef && parentRef !== '0' ? references.get(parentRef) : null;
                    if (parent && String(parent._id) !== String(item._id)) {
                        const parentKey = String(parent._id);
                        if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
                        childrenMap.get(parentKey).push(item);
                    } else {
                        roots.push(item);
                    }
                });
                const makeNode = item => ({
                    ...item,
                    children: (childrenMap.get(String(item._id)) || []).sort(compareName),
                });
                return {
                    key: group.key,
                    name: group.name,
                    code: group.code,
                    indexLabel: String(groupIndex + 1).padStart(2, '0'),
                    categoryCount: group.items.length,
                    resourceCount: group.items.reduce((total, item) => total + Number(item.num || 0), 0),
                    categories: roots.sort(compareName).map(makeNode),
                };
            });

        const templateDomain = domain.tname || 's04';
        const templatePath = `${process.cwd()}/app/view/template/${templateDomain}/vcategory.html`;
        const renderName = fs.existsSync(templatePath)
            ? `template/${templateDomain}/vcategory.html`
            : 'template/s04/vcategory.html';
        const f_item = {
            title: domain.title || '视频分类',
            description: domain.description || '',
            keywords: domain.keyWords || '',
        };
        return ctx.render(renderName, {
            siteInfo: site,
            domain,
            f_item,
            isCategoryIndex: true,
            categoryGroups,
        }).catch(() => ctx.render('error.html'));
    }
    async vcategory() {
        // 当请求页面过来之后先进行验证域名
        const { ctx } = this;
        const result = {};
        let cid = ctx.params.cid

        if (!/^[a-fA-F0-9]{24}$/.test(cid)) {
            return this.ctx.render('error.html');
        }
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain) return ctx.render('404.html');
        let hostArr = domain.fullDomain+ctx.url;
        let f_item = {};
        let fanIndex = ctx.service.utils.strToNumber(hostArr)+3333 || 0
        let muLuNum = 0
        if (domain.mcid && domain.mcid.num) {
            muLuNum = domain.mcid.num
        };
        f_item = normalizeVideoWord(await ctx.service.utils.getMuluItemOne(fanIndex, domain.mcid), domain)
        if (f_item && f_item.description && f_item.title) {
            f_item.description = f_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
                .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                .replace(/\[数字\]|数字/g, domain.urlNumber)
                .replace(/\[关键字\]|关键字/g, f_item.keywords)
                .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)

            f_item.title = f_item.title.replace(/\[站名\]|站名/g, domain.beiAnName)
                .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                .replace(/\[数字\]|数字/g, domain.urlNumber)
                .replace(/\[版本号\]|版本号/g, domain.banBenNumber)
                .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
        }
        let rows = [];
        let list_name = ctx.url
        if (list_name) {
            list_name = list_name.replace(/\?|\/|\||\*|\"|\'|\<|\>/g, '##')
            list_name = list_name.slice(list_name.indexOf('e='), list_name.indexOf('&o'))
            list_name = 'cate-' + cid + '-' + list_name
        }
        let isHaveList = false;
        let isHaveCacheFilePath = false;
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'video_list/';
        let filePath = cachePageFilePath + list_name + '.json'
        if (list_name && list_name.length < 500) {
            //从缓存视频列表里面获取
            isHaveCacheFilePath = fs.existsSync(this.ctx.app.config.cacheFile + 'video_list');
            try {
                let text = fs.readFileSync(filePath, 'utf-8');
                if(text){
                    let datac = JSON.parse(text);
                    rows = datac.rows;
                    let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                    if (chaTime >= 86400000 || chaTime < 0) {
                        fs.unlinkSync(filePath);
                        isHaveList = false
                    } else {
                        isHaveList = true
                    }
                }
            } catch (e) {
            }
        }
        // 分页代码部分开始
        let nowPage = ctx.query.e || 1
        let spage = ctx.query.s || 0
        let epage = ctx.query.e || 0
        let offset = ctx.query.o || 0
        let limit = 48;
        let criteria = {
            cid
        }
        let pageType = epage - spage || 0
        let skipId = -1
        if (spage && epage && offset) {
            // 不符合分页条件
            if (pageType >= 0 || isNaN(pageType)) {
                criteria['_id'] = { "$lt": offset }
            } else {
                criteria['_id'] = { "$gt": offset }
                skipId = 1
            }
        }
        let skip = 0;
        if (pageType > 0) {
            // next
            skip = Math.abs(pageType - 1) * limit
        } else if (pageType < 0) {
            //prve
            skip = (Math.abs(pageType) - 1) * limit
        }
        if (!isHaveList) {
            rows = await this.ctx.model.Video.find(criteria).populate({ path: 'cid', select: 'name _id' }).select('image videoTime title video tag time createdAt view').populate({ path: 'cid' }).sort({ "_id": skipId }).skip(skip).limit(limit).lean();
            if (rows) {
                if (isHaveCacheFilePath) {
                    let savelist = {
                        updateCacheTime: Date.now(),
                        rows
                    }
                    fs.writeFile(filePath, JSON.stringify(savelist), null, function (err) { });
                }
            }
        }
        result.videoCategoryList = await this.ctx.service.cache.get('video-category-all') || [];
        result.nowCategory = result.videoCategoryList.find(item => item._id == cid)
        let count = 0
        if (result.nowCategory) {
            count = result.nowCategory.num
        }
        if (pageType < 0) {
            rows = rows.reverse()
        }
        // 获取最后一个id
        if (rows.length > 0) {
            result.offset = rows[rows.length - 1]['_id']
            result.offsetStart = rows[0]['_id']
        }
        result.pageSize = limit;
        result.videoList = rows;
        result.snowPage = nowPage - 5 < 1 ? 1 : nowPage - 5
        result.count = count;
        result.nowPage = nowPage;
        result.pageNum = Math.ceil(count / limit) || 1
        // 分页代码部分结束
        result.domain = domain;
        result.f_item = f_item;
        result.searchTitle = ctx.params.value
        await ctx.render(`template/${domain.tname}/vcategory.html`, result).catch(() => {
            return this.ctx.render('error.html');
        });
    }
    async play() {
        const { ctx } = this;
        let { site, domain } = await ctx.service.utils.getSiteInfo();
        // const result = { siteInfo: site, domain, userConfig: ctx.app.config.MY_USER_CONFIG, playName: ctx.request.query.name, playID: ctx.request.query.id };
        // result.liveIsNowPlayList = await ctx.service.getSportLive.sportLive360IsPlayList()
        // await this.ctx.render('/template/' + domain.tname + '/play.html', result).catch(() => {
        //     return this.ctx.render('error.html');
        // });
    }

    async contentPage(contentType) {
        const { ctx } = this;
        const { site, domain } = await ctx.service.utils.getSiteInfo();
        if (!domain) return ctx.render('404.html');
        const type = contentType === 'image' ? 'image' : 'book';
        const templateName = type === 'image' ? 'video_image.html' : 'video_book.html';
        const templateDomain = domain.tname || 's04';
        const templatePath = `${process.cwd()}/app/view/template/${templateDomain}/${templateName}`;
        const renderName = fs.existsSync(templatePath)
            ? `template/${templateDomain}/${templateName}`
            : `template/s04/${templateName}`;
        const categoryId = String(ctx.query.cid || '').trim();
        const ContentModel = type === 'image' ? ctx.model.VideoImage : ctx.model.VideoBook;
        const usedCategoryIds = await ContentModel.distinct('categoryId', { status: 1, categoryId: { $ne: null } });
        const categoryList = usedCategoryIds.length
            ? await ctx.model.VideoCategory.find({ _id: { $in: usedCategoryIds }, status: 1 }).sort({ isHot: -1, num: -1, sort: 1, _id: 1 }).limit(80).lean()
            : [];
        const result = {
            siteInfo: site,
            domain,
            contentType: type,
            keyword: ctx.query.keyword || '',
            categoryList,
            nowCategory: null,
            detail: null,
            detailImages: [],
            contentList: [],
            pageData: { page: 1, pageNum: 1, count: 0, limit: 24, offset: 0 },
        };
        if (categoryId && /^[a-fA-F0-9]{24}$/.test(categoryId)) {
            result.nowCategory = result.categoryList.find(item => String(item._id) === categoryId) || null;
        }
        const id = String(ctx.query.id || '').trim();
        if (id) {
            const response = type === 'image'
                ? await ctx.service.video.findImageContent(id)
                : await ctx.service.video.findBookContent(id);
            if (!response || response.code !== 200) return ctx.render('404.html');
            result.detail = response.data;
            if (type === 'image') {
                result.detailImages = String(response.data.image_list || response.data.image || '')
                    .split(',').map(item => item.trim()).filter(Boolean);
            }
        } else {
            const response = await ctx.service.video.contentList(type, {
                categoryId,
                keyword: ctx.query.keyword || '',
                page: ctx.query.page,
                limit: 24,
            });
            result.contentList = response.data.data || [];
            result.pageData = { ...response.data, categoryId, keyword: ctx.query.keyword || '' };
        }
        return ctx.render(renderName, result).catch(() => ctx.render('error.html'));
    }

    async videoBookPage() {
        return this.contentPage('book');
    }

    async videoImagePage() {
        return this.contentPage('image');
    }
}

