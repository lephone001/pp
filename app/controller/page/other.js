'usestrict';
const egg = require('egg');
const fs = require('fs');
const axios = require('axios');
const { resolveTemplate } = require('../../utils/templateExistsCache');
var moment = require('moment')
moment.locale('zh-CN');
module.exports = class IndexController extends egg.Controller {
    async updateAgentLink(){
        const { ctx } = this;
        let isSpider = false
        let userAgentA = ctx.request.header['user-agent']
        let sUserAgent = userAgentA.toLowerCase();
        if (sUserAgent) {
            sUserAgent = sUserAgent.replace(/\s/g, '')
            isSpider = (sUserAgent.indexOf('bot') >= 0 || sUserAgent.indexOf('spider') >= 0)
        }
        if(isSpider) {
            ctx.status = 404;
            return ctx.body = '你是zz！';
        }

        let agent_id = ctx.params.id.replace(/.html/g, '')
        let isobjectId = /^[a-fA-F0-9]{24}$/.test(agent_id)
        if (!agent_id || !isobjectId) {
            return ctx.body = '参数错误';
        }
        let isSuccess = false;
        let userAgent = await this.ctx.model.UserAgent.findById(agent_id).catch(()=>{
            nowDom = '<h1>更新失败！</h1>'
        })
        let pageurl = ''
        let beforeDate = {}
        let nowDom = ''
        if (userAgent&&userAgent.isAgentPage) {
            // let agentPageName = userAgent.agentPageName + userAgent._id + '.json';
            // let agentPageFilePathName = process.cwd() + '/app/public/agentpage/' + agentPageName;
            // let isHaveagentFile = fs.existsSync(agentPageFilePathName)
            // if (isHaveagentFile) {
            //     let text = fs.readFileSync(agentPageFilePathName, 'utf-8');
            //     beforeDate = JSON.parse(text);
            // }
            // pageurl = userAgent.openUrlH5;
            // let savehtml = ''
            // if (pageurl) {
            //    await axios.get(pageurl).then((res) => {
            //         if (res && res.data && res.data.length > 3000 && res.data.indexOf('script') > 0) {
            //             fs.unlinkSync(agentPageFilePathName);
            //             isSuccess = true;
            //             let tongji = '';
            //             if(userAgent.gajs) tongji = userAgent.gajs;
            //             savehtml = res.data.replace('</body>', tongji + '</body>')
            //             let savelist = {
            //                 updateCacheTime: Date.now(),
            //                 txtpage: savehtml
            //             }
            //             fs.writeFile(agentPageFilePathName, JSON.stringify(savelist), null, function (err) { });
            //             fs.writeFile(process.cwd() + '/app/public/agentpage/' +  domain.agentLink.agentPageName+domain.agentLink._id + '.html', savehtml, null, function (err) { });

            //         }
            //     }).catch(()=>{

            //     })
            // }
            if(isSuccess){
                let dateBefore = moment(beforeDate.updateCacheTime).format('YYYY-MM-DD HH:mm:ss')
                let dateNow = moment().format('YYYY-MM-DD HH:mm:ss')
                let domUp = `<h1>更新成功！</h1>上次更新时间：${dateBefore}</br>本次更新时间：${dateNow}</br><h3><a href="${pageurl}" target="_blank">点击查看：${pageurl}</a></h3>`
                nowDom = savehtml.replace('<body>','<body style="max-width:500px;margin:0 auto;">'+domUp)
            }else{
                nowDom = '<h1>更新失败！</h1>'
            }
        }
        ctx.body = nowDom;
    }
    async disclaimers() {
        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let result = {};
        result.domain = domain;
        const disclaimersTemplatePath = process.cwd()+`/app/view/template/${domain.tname}/disclaimers.html`
        const disclaimersRenderName = resolveTemplate(
            `${domain.tname}:disclaimers.html`,
            disclaimersTemplatePath,
            `template/${domain.tname}/disclaimers.html`,
            'template/s01/disclaimers.html'
        )
        if(domain.siteType==8){
            result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)
        }
        await ctx.render(disclaimersRenderName, result);
    }
    async business() {
        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let result = {};
        result.domain = domain;

        const businessTemplatePath = process.cwd()+`/app/view/template/${domain.tname}/business.html`
        const businessRenderName = resolveTemplate(
            `${domain.tname}:business.html`,
            businessTemplatePath,
            `template/${domain.tname}/business.html`,
            'template/s01/business.html'
        )
        if(domain.siteType==8){
            result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)
        }
        await ctx.render(businessRenderName, result);
    }
    async aboutus() {
        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let result = {};
        result.domain = domain;
        const aboutusTemplatePath = process.cwd()+`/app/view/template/${domain.tname}/aboutus.html`
        const aboutusRenderName = resolveTemplate(
            `${domain.tname}:aboutus.html`,
            aboutusTemplatePath,
            `template/${domain.tname}/aboutus.html`,
            'template/s01/aboutus.html'
        )
        if(domain.siteType==8){
            result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)
        }
        await ctx.render(aboutusRenderName, result);
    }
    async articleCategory(){
        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let result = {};
        result.domain = domain;
        let tnamec = `template/components/articlecategory.html`
        if(domain.tname){
            const articleCategoryTemplatePath = process.cwd()+`/app/view/template/${domain.tname}/articlecategory.html`
            tnamec = resolveTemplate(
                `${domain.tname}:articlecategory.html`,
                articleCategoryTemplatePath,
                `template/${domain.tname}/articlecategory.html`,
                tnamec
            )
        }
        await ctx.render(tnamec, result);
    }
    async articleList() {
        const { ctx } = this;
        const { domain } = await ctx.service.utils.getSiteInfo();
        if (domain.tname === 'vn_waji_4') {
            const formatDate = require('../../utils/vietnamArticleDate');
            const listing = await ctx.service.article.publicCursorList(ctx.query);
            const rows = listing.rows.map(formatDate);
            return ctx.render('template/vn_waji_4/article_list.html', {
                domain,
                articleList: rows,
                pagination: {
                    previousUrl: listing.hasPrev ? '/article.html?direction=prev&cursor=' + rows[0]._id : '',
                    nextUrl: listing.hasNext ? '/article.html?direction=next&cursor=' + rows[rows.length - 1]._id : '',
                    isCursorPage: Boolean(ctx.query.cursor),
                },
            });
        }
        let rows = []
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'article_list'

        let articleRdmNum = ['/index.json', '/index1.json', '/index2.json', '/index3.json', '/index4.json', '/index5.json', '/index6.json', '/index7.json', '/index8.json', '/index9.json']
        let articleRdmName = articleRdmNum[Math.floor(Math.random() * articleRdmNum.length)]

        try {
            let rowstext = fs.readFileSync(cachePageFilePath + articleRdmName, 'utf-8');
            if(rowstext){
                rows = JSON.parse(rowstext)
            }
        } catch (e) {
            // 如果没有缓存目录就创建一个缓存域名文件夹
            rows = await this.ctx.service.cache.get('articleList'); // await ctx.model.Article.find().sort({ "_id": -1 }).skip(0).limit(10).select('tag articleCategory title image description createdAt view time')
            if(!cachePageFilePath){
                fs.mkdirSync(cachePageFilePath);
            }
        }
        let result = {};
        result.articleList = rows
        result.domain = domain;
        // 缓存到本地
        // let path = process.cwd() + `/app/view/template/${domain.tname}/article_list.html`
        // if (fs.existsSync(path)) {
        // await ctx.render(`template/${domain.tname}/detail.html`, result).catch(() => {
        //     return this.ctx.render('error.html');
        // });
        // } else {
        // await ctx.render(`template/components/detail.html`, result).catch((res) => {
        //     // console.log(res)
        //     return this.ctx.render('error.html');
        // });
        // }

        try{
            await ctx.render(`template/${domain.tname}/article_list.html`, result).then(()=>{
                // 如果缓存文件没有并且首页没有参数 创建一个/home/domain.link
                if(rows&&rows.length>0){
                    fs.writeFile(cachePageFilePath + '/index.json', JSON.stringify(rows), null, function (err) { });
                }
            }).catch(() => {
                return this.ctx.render('error.html');
            });
        }catch{
            await ctx.render(`template/components/article_list.html`, result).then((res) => {
                // 如果缓存文件没有并且首页没有参数 创建一个/home/domain.link
                if(rows&&rows.length>0){
                   fs.writeFile(cachePageFilePath + '/index.json', JSON.stringify(rows), null, function (err) { });
                }
            }).catch((err) => {
                return this.ctx.render('error.html');
            });
        }
    }
}
