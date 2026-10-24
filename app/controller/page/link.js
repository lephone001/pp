'usestrict';
const egg = require('egg');
const axios = require('axios')
const fs = require('fs');
const path = require('path');
const { withUpdateQueue, publish } = require('../../lib/advFileStore');
const { download: downloadAdvFiles } = require('../../lib/advUpdateSource');
const { templateExists, resolveTemplate } = require('../../utils/templateExistsCache');
var moment = require('moment')
moment.locale('zh-CN');
module.exports = class SoController extends egg.Controller {
    getAppJsCacheKey() {
        return 'html:app.js';
    }

    getAppJsFilePath() {
        return path.join(this.ctx.app.baseDir, 'app', 'public', 'html', 'app.js');
    }

    async getAppJsCache() {
        try {
            const text = await this.ctx.service.cache.get(this.getAppJsCacheKey());
            return typeof text === 'string' ? text : '';
        } catch (e) {
            return '';
        }
    }

    async setAppJsCache(text = '') {
        if (!text) return;
        try {
            await this.ctx.service.cache.set(this.getAppJsCacheKey(), text);
        } catch (e) {
        }
    }

    getAppDownloadPayload(item = {}) {
        const toNumber = (val, def = 0) => {
            const num = Number(val);
            return Number.isFinite(num) ? num : def;
        };
        return {
            index: item.index === undefined || item.index === null ? '' : String(item.index),
            name: item.name || '',
            view: toNumber(item.view),
            star: toNumber(item.star),
            url: item.url || '',
            image: item.image || '',
            iosUrl: item.iosUrl || '',
            desc: item.desc || '',
            isBt: toNumber(item.isBt),
            type: toNumber(item.type, 1),
            isHot: toNumber(item.isHot),
            isNew: toNumber(item.isNew),
            isTop: toNumber(item.isTop),
            sort: toNumber(item.sort),
            user: item.user || '',
            status: toNumber(item.status, 1),
            createTime: item.createTime || '',
            updateTime: item.updateTime || '',
            id: item.id ? toNumber(item.id) : 0,
            keywords: item.keywords || '',
            description: item.description || '',
            content: item.content || '',
            title: item.title || '',
        };
    }

    async syncAppDownloadList(appList = []) {
        const AppDownloadModel = this.ctx.model.AppDownload || this.ctx.model.Appdownload || this.ctx.model.appDownload;
        if (!AppDownloadModel || !Array.isArray(appList)) return { success: 0, fail: 0, total: 0 };
        let success = 0;
        let fail = 0;
        for (const item of appList) {
            const data = this.getAppDownloadPayload(item);
            if (!data.id && !data.index && !data.name) continue;
            const query = item.id ? { id: data.id } : { index: data.index };
            try {
                await AppDownloadModel.collection.updateOne(
                    query,
                    { $set: data },
                    { upsert: true }
                );
                success++;
            } catch (err) {
                fail++;
                console.log('sync appDownload error:', err.message);
            }
        }
        return { success, fail, total: appList.length };
    }

    writeAppDownloadJsonList(appList = []) {
        if (!Array.isArray(appList)) return { success: 0, fail: 0, total: 0 };
        const cacheDir = path.join(this.ctx.app.baseDir, 'cache', 'app_download');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        let success = 0;
        let fail = 0;
        for (const item of appList) {
            const fileId = item && item.id;
            if (!fileId) {
                fail++;
                continue;
            }
            const fileName = String(fileId).replace(/[\\/:*?"<>|]/g, '-');
            try {
                fs.writeFileSync(
                    path.join(cacheDir, `${fileName}.json`),
                    JSON.stringify(item, null, 2),
                    'utf-8'
                );
                success++;
            } catch (err) {
                fail++;
                console.log('write app_download json error:', err.message);
            }
        }
        return { success, fail, total: appList.length };
    }

    async jump301() {
        const { ctx } = this;
        let jumpUrl = ctx.query.url
        if (jumpUrl && (jumpUrl.indexOf('http://') == 0 || jumpUrl.indexOf('https://') == 0) && jumpUrl.indexOf('.') > 0 && jumpUrl.length > 10) {
            ctx.status = 200;
            return ctx.redirect(jumpUrl);
        } else {
            ctx.status = 404;
            return ctx.redirect('/');
        }
    }
    async appjs() {
        const { ctx } = this;
        const filePath = this.getAppJsFilePath();
        ctx.type = 'application/javascript; charset=utf-8';
        ctx.set('Cache-Control', 'public, max-age=300');

        const cacheText = await this.getAppJsCache();
        if (cacheText) {
            return ctx.body = cacheText;
        }

        if (!fs.existsSync(filePath)) {
            ctx.status = 404;
            ctx.type = 'text/plain; charset=utf-8';
            return ctx.body = '';
        }

        const fileText = await fs.promises.readFile(filePath, 'utf-8');
        await this.setAppJsCache(fileText);
        return ctx.body = fileText;
    }
    async app123() {
        const { ctx } = this;
        let index = ctx.params.id
        let jumpUrl = ctx.query.url
        let userAgentA = ctx.request.header['user-agent']
        // let uaStr = ctx.get('user-agent');
        let sUserAgent = ''
        if (userAgentA) {
          sUserAgent = userAgentA.toLowerCase();
        }
        let isAndroid = sUserAgent.indexOf('android') > -1 || sUserAgent.indexOf('adr') > -1;  //android
        let isIos = sUserAgent.indexOf('iphone') > -1 || sUserAgent.indexOf('ipad') > -1;  //ios
        if (jumpUrl && (jumpUrl.indexOf('http://') == 0 || jumpUrl.indexOf('https://') == 0) && jumpUrl.indexOf('.') > 0 && jumpUrl.length > 10) {
            ctx.status = 200;
            return ctx.redirect(jumpUrl);
        }
        if (index > -1) {
            let agentPageName = '/app/public/html/app.json';
            let agentPageFilePath = process.cwd() + agentPageName
            let isHaveagentFile = fs.existsSync(agentPageFilePath)
            if (isHaveagentFile) {
                let textJSON = fs.readFileSync(agentPageFilePath, 'utf-8');
                if (textJSON) {
                    let appdata = JSON.parse(textJSON)
                    if (appdata && appdata.length > 0) {
                        let itemc = appdata.find((item, ic) => item.index == index)
                        if(!itemc) return;
                        //判断 安卓 ios
                        let jumpUrl = itemc.url;
                        if(isAndroid&&itemc.androidUrl){
                            jumpUrl = itemc.androidUrl
                        }
                        if(isIos&&itemc.iosUrl){
                            jumpUrl = itemc.iosUrl
                        }
                        if (itemc && jumpUrl) {
                            ctx.status = 400;
                            return ctx.redirect(jumpUrl);
                        }
                    }
                }
            }
        }
        return ctx.body = `app-404`
    }
    
    async bc123() {
        const { ctx } = this;
        let index = ctx.params.id
        let jumpUrl = ctx.query.url
        let userAgentA = ctx.request.header['user-agent']
        // let uaStr = ctx.get('user-agent');
        let sUserAgent = ''
        if (userAgentA) {
          sUserAgent = userAgentA.toLowerCase();
        }
        let isAndroid = sUserAgent.indexOf('android') > -1 || sUserAgent.indexOf('adr') > -1;  //android
        let isIos = sUserAgent.indexOf('iphone') > -1 || sUserAgent.indexOf('ipad') > -1;  //ios
        if (jumpUrl && (jumpUrl.indexOf('http://') == 0 || jumpUrl.indexOf('https://') == 0) && jumpUrl.indexOf('.') > 0 && jumpUrl.length > 10) {
            ctx.status = 200;
            return ctx.redirect(jumpUrl);
        }
        if (index > -1) {
            let agentPageName = '/app/public/html/bc.json';
            let agentPageFilePath = process.cwd() + agentPageName
            let isHaveagentFile = fs.existsSync(agentPageFilePath)
            if (isHaveagentFile) {
                let textJSON = fs.readFileSync(agentPageFilePath, 'utf-8');
                if (textJSON) {
                    let appdata = JSON.parse(textJSON)
                    if (appdata && appdata.length > 0) {
                        let itemc = appdata.find((item, ic) => item.index == index)
                        if(!itemc) return;
                        //判断 安卓 ios
                        let jumpUrl = itemc.url;
                        if(isAndroid&&itemc.androidUrl){
                            jumpUrl = itemc.androidUrl
                        }
                        if(isIos&&itemc.iosUrl){
                            jumpUrl = itemc.iosUrl
                        }
                        if (itemc && jumpUrl) {
                            ctx.status = 200;
                            return ctx.redirect(jumpUrl);
                        }
                    }
                }
            }
        }
        return ctx.body = `app-404`
    }

    async favicon(ctx, next) {
            let { domain } = await ctx.service.utils.getSiteInfo();
            if (!domain || !domain.link) {
                ctx.status = 444;
                return '';
            }
            const faviconPath = path.join(
                ctx.app.baseDir,
                `app/view/template/${domain.tname}`,
                `favicon.ico`
            );

            if (templateExists(`template:${domain.tname}:favicon.ico`, faviconPath)) {
                ctx.type = 'image/x-icon';
                ctx.set('Cache-Control', 'public, max-age=86400');
                return ctx.body = fs.createReadStream(faviconPath);
            }
            ctx.type = 'image/x-icon';
            ctx.set('Cache-Control', 'public, max-age=86400');
            return ctx.body = fs.createReadStream(path.join(
                ctx.app.baseDir,
                'app/public',
                `favicond.ico`
            ));
        };
    async gogogo() {
        const { ctx } = this;
        if(ctx.request&&ctx.request.host&&/^(\d{1,3}\.){3}\d{1,3}$/.test(ctx.request.host)){
            ctx.status = 403; 
            ctx.body = '';
            return;
          }
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain) {
            ctx.status = 404;
            return ctx.body = `MuLu NO Domain - 404`
        }
        let jumpHTML = domain.jumpHTML;
        let nowRrl = ctx.request.url;
        let f_item = {}
        let m_item = {}
        // 如果是首页无内页百度的话直接444-baidu01  内页访问--百度蜘蛛正常，用户访问状态502 广告页面
        if((domain.browserType == 'baidu01'||domain.browserType == 'baidu02')&&!domain.isBaiduSpider){
            ctx.status = 201;
            //这里应该是跳转
            ctx.body = `<!DOCTYPE html><html lang='en'><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no'><meta name='robots' content='noindex'><title>@</title></head><body></body>${domain.jumpIFrameHTML}</html>`
            return;
        }
        // console.log(domain.jumpHTML)
        // 取一个泛词当标题
        if (nowRrl && nowRrl.length > 1) {
            let fanIndex = ctx.service.utils.strToNumber(domain.fullDomain + nowRrl)
            //先去缓存fan文件里面查找泛的 分类id-泛索引indexB 命名的json 文件
            f_item = await ctx.service.utils.getFanItemOne(fanIndex, domain.fcid)
            if (f_item.title) {
                domain.title = f_item.title;
                domain.description = f_item.description;
                domain.keyWords = f_item.keywords;
            }
            if (f_item.description) {
                f_item.description = f_item.description.replace(/\[域名\]|域名/g, domain.fullDomain)
                f_item.description = f_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
                f_item.description = f_item.description.replace(/\[数字\]|数字/g, domain.urlNumber)
                f_item.description = f_item.description.replace(/\[字母\]|字母/g, ctx.service.utils.RandomZiMu(1, 5, 10, 1))
                f_item.description = f_item.description.replace(/\[符号\]|符号/g, ctx.service.utils.randomEmojc(1, 1, 1))

                f_item.description = f_item.description.replace(/\《|\》/g, "")
            }

            m_item = await ctx.service.utils.getMuluItemOne(fanIndex, domain.mcid)

            if (m_item.title) {
                domain.title = m_item.title;
                domain.description = m_item.description;
                domain.keyWords = m_item.keywords;
            }
            if (m_item.description) {
                m_item.description = m_item.description.replace(/\[域名\]|域名/g, domain.fullDomain)
                m_item.description = m_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
                m_item.description = m_item.description.replace(/\[数字\]|数字/g, domain.urlNumber)
                m_item.description = m_item.description.replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(ctx.url))
                m_item.description = m_item.description.replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(ctx.url))
                m_item.description = m_item.description.replace(/\《|\》/g, "")
            }
        }
        //目录以及无页面跳转
        if (!jumpHTML && (domain.isOpenUrl > 0) &&
            domain.isMobile && !domain.isSpider
        ) {
            let url = `/html/${domain.agentLink.agentPageName}.html`
            jumpHTML = this.ctx.app.config.common.JUMPHTML(url)
        }
        if (domain.titleType == 1) {
            f_item.title = domain.fullDomain + ctx.url
            m_item.title = domain.fullDomain + ctx.url
        }
        let path = process.cwd() + `/app/view/template/${domain.tname}/gogogo.html`;

        const renderName = resolveTemplate(
            `${domain.tname}:gogogo.html`,
            path,
            `template/${domain.tname}/gogogo.html`,
            ''
        );

        if (renderName) {
            return await ctx.render(renderName, {
            domain,
            tdk: f_item,
            mtdk: m_item,
            jumpHTML
        }).catch(() => {
                return this.ctx.render('error.html');
            });
        }

        return ctx.render('/gogogo.html', {
            domain,
            tdk: f_item,
            mtdk: m_item,
            jumpHTML
        });
    }
    async url() {
        const { ctx } = this;
        let offset = ctx.params.id
        if (offset) {
            offset = offset.replace('.html', '')
        }
        let criteria = {}
        let detail = {
            title: '网站标题',
            keyWords: '关键词',
            description: '描述',
        }
        let domains = []
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain || !domain.isMuLu) return ctx.render('/404.html')
        if (!domain || !domain._id) return ctx.render('/404.html')
        criteria.uname = domain.uname
        if (offset && offset.match(/^[0-9a-fA-F]{24}$/)) {
            detail = await ctx.model.Domain.findById(offset)
            if (detail && detail._id) criteria['_id'] = { "$lt": offset }
        } else if (offset) {
            detail = await ctx.model.Domain.findOne({ title: offset }).select('_id link title')
            if (detail && detail._id) criteria['_id'] = { "$lt": detail._id }
        }
        domains = await ctx.model.Domain.find(criteria).sort({ "_id": -1 }).skip(0).limit(3).select('link title').lean()
        let images = [] //await this.ctx.service.cache.get('BingYingImages');
        return ctx.render('/url.html', {
            domains,
            domain,
            detail,
            images
        });
    }
    async n() {
        // 根据标题名称获取网站
        const { ctx } = this;
        let title = ctx.params.id
        if (title) {
            title = title.replace('.html', '')
        }
        let detail = {
            title: '网站标题',
            keyWords: '关键词',
            description: '描述',
        }
        let criteria = {}
        let domains = []
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain || !domain.isMuLu) return ctx.render('/404.html')

        if (!domain || !domain._id) return ctx.render('/404.html')
        criteria.uname = domain.uname
        if (title && title.length > 0 && title.length < 80) {
            detail = await ctx.model.Domain.findOne({ title })
            if (detail && detail._id) {
                criteria['_id'] = { "$lt": detail._id }  // 小于
            }
        }
        domains = await ctx.model.Domain.find(criteria).sort({ "_id": -1 }).skip(0).limit(3).select('link title').lean()
        let images = [];
        return ctx.render('/l.html', {
            detail,
            domains,
            domain,
            images
        });
    }
    async l() {
        // 根据域名获取网站
        const { ctx } = this;
        let link = ctx.params.id
        if (link) {
            link = link.replace('.html', '')
        }
        let detail = {
            link: '网站标题',
            keyWords: '关键词',
            description: '描述',
        }
        let criteria = {}
        let domains = []
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain || !domain.isMuLu) return ctx.render('/404.html')

        if (!domain || !domain._id) return ctx.render('/404.html')
        criteria.uname = domain.uname
        if (link && link.length < 50 && link.indexOf('.') > 0) {
            detail = await ctx.model.Domain.findOne({ link })
            if (detail && detail._id) {
                criteria['_id'] = { "$lt": detail._id }  // 小于
            }
        }
        domains = await ctx.model.Domain.find(criteria).sort({ "_id": -1 }).skip(0).limit(3).select('link title').lean()
        let images = [];
        return ctx.render('/l.html', {
            detail,
            domains,
            domain,
            images
        });
    }
    async wurl() {
        // 根据泛词id获取列表
        const { ctx } = this;
        let offset = ctx.params.id
        if (offset) {
            offset = offset.replace('.html', '')
        }
        let criteria = {}
        let detail = {
            title: '网站标题',
            keyWords: '关键词',
            description: '描述',
        }
        let domains = []
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain || !domain.isMuLu) return ctx.render('/404.html')
        detail = domain
        if (!domain || !domain._id) return ctx.render('/404.html')
        criteria.fcid = domain.fcid;
        if (offset && offset.match(/^[0-9a-fA-F]{24}$/)) {
            criteria['_id'] = { "$lt": offset } // 小于
            detail = await ctx.model.Fan.findById(offset)
        }
        domains = await ctx.model.Fan.find(criteria).sort({ "_id": -1 }).limit(3).select('link title').lean()
        let images = [];
        return ctx.render('/wurl.html', {
            domains,
            domain,
            detail,
            images
        });
    }
    async mulu() {
        const { ctx } = this;
        if(ctx.request&&ctx.request.host&&/^(\d{1,3}\.){3}\d{1,3}$/.test(ctx.request.host)){
            ctx.status = 403; 
            ctx.body = '';
            return;
        }
        await ctx.service.utils.mulu()
    }
    async allPage() {
        const { ctx } = this;
        if(ctx.request&&ctx.request.host&&/^(\d{1,3}\.){3}\d{1,3}$/.test(ctx.request.host)){
            ctx.status = 403; 
            ctx.body = '';
            return;
        }
        await ctx.service.utils.allPage()
    }
    async baiduSubmit() {
        // 百度提交
        const { ctx } = this;
        // http://data.zz.baidu.com/urls?site=cmei567.com&token=ytK7lsHHvOiT8Ez0
        const urls = ctx.request.body.urls
        const link = ctx.request.body.link
        const token = ctx.request.body.token
        await axios({
            method: 'post',
            url: `http://data.zz.baidu.com/urls?site=${link}&token=${token}`,
            headers: {
                'Content-Type': ' text/plain',
                'User-Agent': 'curl/7.12.1'
            },
            data: urls
        }).then(res => {
            return this.ctx.body = {
                code: 200,
                massage: '成功',
                data: res.data,
                link
            }
        })
            .catch(error => {
                let datacc = {}
                if (error && error.response && error.response.data) {
                    datacc = (error && error.response.data && error.response.data.message) ? error.response.data.message : '无失败原因!'
                }
                return this.ctx.body = {
                    code: -1,
                    massage: '失败',
                    data: datacc,
                    link
                }
            })
    }
    async staticPageIndex() {
        // 当前页面内只允许蜘蛛访问
        const { ctx } = this;
        let userAgentA = ctx.request.header['user-agent']
        let isSplid = false
        userAgentA = userAgentA.toLowerCase()
        isSplid = (userAgentA.indexOf('bot') >= 0 || userAgentA.indexOf('spider') >= 0)
        return ctx.render('/se.html')
        if (isSplid) {
            return ctx.render('/se.html')
        } else {
            await ctx.service.utils.allPage()
        }
    }
    async w() {
        // 根据泛词名称获取列表
        const { ctx } = this;
        let title = ctx.params.id
        if (title) {
            title = title.replace('.html', '')
        }
        let detail = {
            title: '网站标题',
            keyWords: '关键词',
            description: '描述',
        }
        let domains = []
        let criteria = {}
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain || !domain.isMuLu) return ctx.render('/404.html')
        if (!domain || !domain._id) return ctx.render('/404.html')
        criteria.fcid = domain.fcid;
        if (title && title.length > 0 && title.length < 80) {
            detail = await ctx.model.Fan.findOne({ title })
            if (detail && detail['_id']) {
                criteria['_id'] = { "$lt": detail._id }  // 小于
            }
        }
        domains = await ctx.model.Fan.find(criteria).sort({ "_id": -1 }).skip(0).limit(3).select('link title').lean()

        let images = [];
        return ctx.render('/w.html', {
            detail,
            domain,
            domains,
            images
        });
    }
    async refreshVisitorPageCacheAfterAdvUpdate() {
        try {
            return await this.ctx.service.localData.refreshVisitorPageCache();
        } catch (error) {
            this.ctx.logger.warn('[adv-links] refresh visitor pages failed: ' + String(error.message || error));
            return [ 'pc', 'h5' ].map(device => ({ device, status: 'failed', message: '访客页面缓存刷新失败，请检查服务日志' }));
        }
    }

    async updateAdvLinks(){
        return this.applyAdvUpdate(this.ctx.request.body.link);
    }

    async applyAdvUpdate(source){
        const baseDir = this.ctx.app && this.ctx.app.baseDir || path.resolve(__dirname, '../../..');
        return withUpdateQueue(path.join(baseDir, 'app/public/html'), () => this.applyAdvUpdateLocked(source));
    }

    async applyAdvUpdateLocked(source){
        //更新代理链接//    sbb02.html app.js
        const { ctx } = this;
        const baseDir = ctx.app && ctx.app.baseDir || path.resolve(__dirname, '../../..');
        const nameJsonFile = '/app/public/html/app.json';
        const nameJsonFilePath = baseDir + nameJsonFile

        const nameSbbAdvFile = "/app/public/html/sbbadvtp.html"///html/app.js
        const nameSbbAdvFilePath = baseDir + nameSbbAdvFile
        const nameSbbAdvFilePatha = baseDir + "/app/public/html/sbb-adv.html"
        // 
        let files;
        try {
            // 使用发送端传来的更新源，三个文件全部下载、验证后才覆盖。
            files = await downloadAdvFiles(source);
        } catch (error) {
            ctx.logger.warn('[adv-links] download failed: %s', error.message);
            ctx.body = { code: 502, message: error.message };
            return;
        }
        try {
            await fs.promises.mkdir(path.dirname(nameJsonFilePath), { recursive: true });
            await publish(path.dirname(nameJsonFilePath), {
                'sbb02.html': files.html, 'app.json': JSON.stringify(files.list), 'app.js': files.js,
            });
        } catch (error) {
            ctx.logger.error('[adv-links] write failed: %s', error.message);
            ctx.body = { code: 500, message: '更新文件写入失败：' + (error.code || error.message) };
            return;
        }
        const jsFate = files.js;
        await this.setAppJsCache(jsFate);
        const appDownloadSyncResult = await this.syncAppDownloadList(files.list);
        const appDownloadJsonResult = this.writeAppDownloadJsonList(files.list);
        let isHaveagenctFile = fs.existsSync(nameSbbAdvFilePath)
        let textHtmladv = ``
        if (isHaveagenctFile) {
            textHtmladv = fs.readFileSync(nameSbbAdvFilePath, 'utf-8');
            if(textHtmladv){
                textHtmladv =  textHtmladv.replace('####APPJS####',`<script>${jsFate}</script>`)
                await fs.promises.writeFile(nameSbbAdvFilePatha, textHtmladv);
            }
        }

        const pageFetchStatus = await this.refreshVisitorPageCacheAfterAdvUpdate();
        const pageFailures = pageFetchStatus.filter(item => !['completed', 'skipped', 'textarea'].includes(item.status));
        const incomplete = pageFailures.length > 0 || appDownloadSyncResult.fail > 0 || appDownloadJsonResult.fail > 0;
        this.ctx.body = {
            code: incomplete ? 500 : 200,
            message: incomplete ? '文件已更新，但数据库或页面缓存刷新失败，请查看更新详情' : '文件已更新，启用的访客页面缓存已刷新',
            source: files.source,
            item_count: files.list.length,
            updated_at: new Date().toISOString(),
            appDownloadSyncResult,
            appDownloadJsonResult,
            page_fetch_status: pageFetchStatus
        }
    }

    async updateBCAdvLinks(){
        //更新代理链接//    sbb02.html app.js
        const { ctx } = this;
        const nameJsonFile = '/app/public/html/bc.json';
        const nameJsonFilePath = process.cwd() + nameJsonFile

        const nameJsFile = '/app/public/html/bc.js';
        const nameJsFilePath = process.cwd() + nameJsFile   //

        const nameHtml002File = '/app/public/html/bc01.html';
        const nameHtml002FilePath = process.cwd() + nameHtml002File

        const nameSbbAdvFile = "/app/public/html/bcadvtp.html"///html/app.js
        const nameSbbAdvFilePath = process.cwd() + nameSbbAdvFile
        const nameSbbAdvFilePatha = process.cwd() + "/app/public/html/bc-adv.html"
        // 
        let updateUrl = ''
        if(ctx.request.body.link){
            updateUrl = ctx.request.body.link
        }
        //直接获取url 里面的文件
        await axios.get(updateUrl+'bc01.html?v='+Date.now()).then(async (res)=>{
            if(res.data){
                await fs.promises.writeFile(nameHtml002FilePath, res.data);
            }
        })
       
        await axios.get(updateUrl+'bc.json?v='+Date.now()).then(async (res)=>{
            if(res.data){
                await fs.promises.writeFile(nameJsonFilePath, JSON.stringify(res.data));
            }
        })

        let jsFate = ""
        await axios.get(updateUrl+'bc.js?v='+Date.now()).then(async (res)=>{
            if(res.data){
                jsFate =  res.data
                await fs.promises.writeFile(nameJsFilePath, res.data);
            }
        })
        let isHaveagenctFile = fs.existsSync(nameSbbAdvFilePath)
        let textHtmladv = ``
        if (isHaveagenctFile) {
            textHtmladv = fs.readFileSync(nameSbbAdvFilePath, 'utf-8');
            if(textHtmladv){
                textHtmladv =  textHtmladv.replace('####APPJS####',`<script>${jsFate}</script>`)
                await fs.promises.writeFile(nameSbbAdvFilePatha, textHtmladv);
            }
        }

        const pageFetchStatus = await this.refreshVisitorPageCacheAfterAdvUpdate();
        this.ctx.body = {
            code: 200,
            message: '成功',
            page_fetch_status: pageFetchStatus
        }
    }
}

