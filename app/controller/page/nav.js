'usestrict';
const { count } = require('console');
const egg = require('egg');
const http = require('http')
var moment = require('moment')
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveTemplate } = require('../../utils/templateExistsCache');

moment.locale('zh-CN');
function hashId(id) {
    return crypto.createHash('md5').update(String(id)).digest('hex');
}

function getDomainCacheName(domain, fallbackHost) {
    const domainName = String(
        (domain && (domain.link || domain.fullDomain)) || fallbackHost || 'default'
    ).trim().toLowerCase();

    // 与现有 home 缓存目录保持一致：b.com:7001 -> b.com##7001。
    return domainName
        .replace(/:/g, '##')
        .replace(/[\\/?*"<>|]/g, '_');
}

module.exports = class NavController extends egg.Controller {
    async navhomepage() {
        const { ctx } = this;
        const { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain) return ctx.render('404.html');

        const domainCacheName = getDomainCacheName(domain, ctx.host);
        const cacheFilePath = path.join(
            this.app.config.cacheFile,
            'home',
            domainCacheName,
            'navhomepage.html'
        );

        // 导航首页优先返回静态 HTML，避免每次访问都触发模板渲染和数据库查询。
        try {
            const cacheStat = await fs.promises.stat(cacheFilePath);
            if (cacheStat.size > 0) {
                const cachedHtml = await fs.promises.readFile(cacheFilePath, 'utf8');
                if (cachedHtml.includes('data-nav-style="nav_03-content"')) {
                    ctx.type = 'html';
                    ctx.body = cachedHtml;
                    return;
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        // 没有 HTML 缓存时先读 Redis，Redis 没有数据才查询数据库。
        let homepageData = await ctx.service.cache.get('homepage');
        if (!homepageData || !Array.isArray(homepageData.navHomepageCategories)) {
            homepageData = await ctx.service.nav.getNavHomepageData();
            await ctx.service.cache.set('homepage', homepageData);
        }

        const result = {
            ...homepageData,
            domain,
            cateNavList: homepageData.navHomepageCategories,
        };
        const navHomepageTemplatePath = path.join(
            process.cwd(),
            'app',
            'view',
            'template',
            domain.tname,
            'navhomepage.html'
        );
        const navHomepageRenderName = resolveTemplate(
            `${domain.tname}:navhomepage.html`,
            navHomepageTemplatePath,
            `template/${domain.tname}/navhomepage.html`,
            'template/s04/navhomepage.html'
        );

        try {
            const html = await ctx.renderView(navHomepageRenderName, result);
            await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
            await fs.promises.writeFile(cacheFilePath, html, 'utf8');
            ctx.type = 'html';
            ctx.body = html;
        } catch (error) {
            ctx.logger.error(error);
            return ctx.render('error.html');
        }
    }

    async addnav() {
        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let result = {}
        let cateNavList = domain.cids.map(item => { return { ...item, data: [] } })
        result.cateNavList = cateNavList
        result.domain = domain
        


        const addNavTemplatePath = process.cwd()+`/app/view/template/${domain.tname}/addnav.html`
        const addNavRenderName = resolveTemplate(
            `${domain.tname}:addnav.html`,
            addNavTemplatePath,
            `template/${domain.tname}/addnav.html`,
            'template/s01/addnav.html'
        )
        if(domain.siteType==8){
            result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)
        }
        await ctx.render(addNavRenderName, result);


    }
    async detail() {
        const { ctx } = this;
        let id = ctx.params.id;
        if (!id.match(/^[0-9a-fA-F]{24}$/)) return ctx.render(`404.html`);
        let { domain } = await ctx.service.utils.getSiteInfo();
        let result = {};
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'nav/';
        let navHash = hashId(id)
        let navCacheDir = cachePageFilePath + navHash.slice(0, 2) + '/' + navHash.slice(2, 4)
        let filePath = navCacheDir + '/' + id + '.json'
        let isHaveNavCache = false;
        let isHaveCachePageFilePath = fs.existsSync(this.ctx.app.config.cacheFile + 'nav');
        try {
            let text = fs.readFileSync(filePath, 'utf-8');
            result = JSON.parse(text);
            isHaveNavCache = true;
            result.domain = domain;
            let nowTodayTime = moment().format('YYYY-MM-DD');
            if(nowTodayTime !== result.updateCacheTime){
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            if (!isHaveCachePageFilePath) {
            // 如果没有缓存目录就创建一个缓存域名文件夹
               fs.mkdirSync(cachePageFilePath);
            }
        }
        if(!result||!result.detail){
            let cateNavList = domain.cids.map(item => { return { ...item, data: [] } })
            result.cateNavList = cateNavList
            result.domain = domain
            let { data, otherNavList, moreNavList } = await ctx.service.nav.findNav({ id })

            result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)
          

            result.detail = data
            result.otherNavList = otherNavList
            result.moreNavList = moreNavList
            //写入缓存更新时间
            result.updateCacheTime = moment().format('YYYY-MM-DD')
            if (!isHaveNavCache) {
                fs.mkdirSync(navCacheDir, { recursive: true });
                fs.writeFile(filePath, JSON.stringify(result), null, function (err) { });
            }
        }
        if (result.detail) {
            // ctx.service.nav.viewNavAddOne({ id })
            await ctx.render(`template/${domain.tname}/navdetail.html`, result).catch(()=>{
                ctx.render(`404.html`);
            });
        } else {
            ctx.render(`404.html`);
        }
    }
    async navarticle() {

        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let count = 0
        let nowPage = ctx.query.e || 1
        let spage = ctx.query.s || 0
        let epage = ctx.query.e || 0
        let cid = ctx.query.c
        let limit = 15
        let offset = (Math.abs(ctx.query.e-ctx.query.s - 1))*limit
        let pageType = ctx.query.e<ctx.query.s?'prve':'next'
        if (pageType=='prve') {
            offset = (Math.abs(ctx.query.e-ctx.query.s) - 1) * limit;
        }
        let pageTypeId = ctx.query.o
        let result = {
            count,
            nowPage,
            snowPage: 1,
            offset,
            pageNum:1,
            articleList:[],
            categoryNavList:[],
            articleCategoryList:[],
        };

        if (spage && epage && pageTypeId) {
          // 不符合分页条件
          let isObjectId = /^[a-fA-F0-9]{24}$/.test(pageTypeId)
          let num = epage - spage
          if (num < -20 || num > 20 || !isObjectId) {
            return this.ctx.render('error.html');
          }
        }
        if(cid){
            let iscid = /^[a-fA-F0-9]{24}$/.test(cid)
            if (!iscid) {
                return this.ctx.render('error.html');
            }
        }

        let domainFileName = domain.link.replace(':','##')+'/'
        // let isHaveHomeFile = fs.existsSync(homePageFilePath)
        // let isHaveIndexHtml = fs.existsSync(homePageFilePath+'/allcategory.json')
        // let isError = false;

        //从缓存里面获取列表
        let list_name = ctx.url
        if (list_name) {
            list_name = list_name.replace(/\?|\/|\||\*|\"|\'|\<|\>/g, '##')
            list_name = list_name.slice(list_name.indexOf('e='), list_name.indexOf('&o'))
        }
        let isHaveList = false;
        let cachePageFilePath = this.ctx.app.config.cacheFile+'navarticle/'+domainFileName

        let filePath = cachePageFilePath + list_name + '.json'
        let isHaveListCache = false;
        if (list_name && list_name.length < 500) {
            //从缓存视频列表里面获取
            try {
                let text = fs.readFileSync(filePath, 'utf-8');
                let datac = JSON.parse(text);
                isHaveListCache = true;
                result = datac;
                let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                if (chaTime >= 86400000 || chaTime < 0) {
                    isHaveList = false
                } else {
                    isHaveList = true
                }
            } catch (e) {
            }
            if(isHaveList&&result.cateNavList){
                return await ctx.render(`template/${domain.tname}/navarticle.html`, result).then(() => {
                }).catch((e) => {
                    this.ctx.service.utils.allPage();
                });
            }
        }

        result.articleCategoryList = await this.ctx.service.cache.get('articleCategoryList');
        if(!result.articleCategoryList||result.articleCategoryList.length==0){
            result.articleCategoryList = await ctx.model.ArticleCategory.find({ siteType: 4, status: 1 }).skip(0).limit(60).select('name num id image')
        }


        
        let optionsc = { pageType,pageTypeId, offset, limit}
        if(cid)optionsc.cid = cid
        if(pageTypeId)optionsc.pageTypeId = pageTypeId
        if(pageType)optionsc.pageType = pageType

        let ncidsList = await this.service.article.getArticleList(optionsc);
        result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)

        if(ncidsList.data){
            result.count = ncidsList.data.count;
            result.articleList = this.service.utils.jiemiFn(ncidsList.data.data)
            if (result.articleList.length > 0) {
                result.offset = result.articleList[result.articleList.length - 1]['_id']
                result.offsetStart = result.articleList[0]['_id']
            }
        }
        result.pageNum = Math.ceil( result.count / limit) || 1;
        result.domain = domain;
        result.updateCacheTime=Date.now()
        result.pageSize = limit;
        result.snowPage = nowPage - 5 < 1 ? 1 : nowPage - 5
        result.nowPage = nowPage;
        result.pageNum = Math.ceil(result.count / limit)||1;


        await ctx.render(`template/${domain.tname}/navarticle.html`, result).then(()=>{
            // 如果缓存文件没有 创建一个/home/domain.link
            if(!isHaveListCache|| isError){
                fs.writeFile(filePath, JSON.stringify(result), null, function (err) { });
            }
        });
    }
    async navarticlecategory() {
        const { ctx } = this;
        let cate_id = ctx.params.id
        let isobjectId = /^[0-9]/.test(cate_id)
        if (!cate_id || !isobjectId) {
            return ctx.render('/404.html');
        }
        let { domain } = await ctx.service.utils.getSiteInfo();
        let result = {}
        result.domain = domain
        let rows = await ctx.model.Article.find({ cid: cate_id }).sort({ "_id": -1 }).skip(0).limit(30).select('tag articleCategory title image description createdAt view time')
        let articleCategoryList = await ctx.model.ArticleCategory.find({ siteType: 4, status: 1 }).skip(0).limit(60).select('name num id image')
        result.articleList = rows
        result.articleCategoryList = articleCategoryList
        result.nowcateid = cate_id
        result.nowcatename = articleCategoryList.find(item => cate_id == item.id)

        const navArticleCategoryTemplatePath = process.cwd()+`/app/view/template/${domain.tname}/navarticlecategory.html`
        const navArticleCategoryRenderName = resolveTemplate(
            `${domain.tname}:navarticlecategory.html`,
            navArticleCategoryTemplatePath,
            `template/${domain.tname}/navarticlecategory.html`,
            ''
        )
        if(navArticleCategoryRenderName){
            await ctx.render(navArticleCategoryRenderName, result);
        }else{
            await ctx.service.utils.allPage()
        }

    }
    //分类里面显示导航的
    async navcategory() {
        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let muluIndex = ctx.service.utils.strToNumber(ctx.header.host + ctx.url)
        let f_item = {}
        f_item = await ctx.service.utils.getMuluItemOne(muluIndex, domain.mcid)
        if (f_item && f_item.description && f_item.title) {
            f_item.description = f_item.description.replace(/\[站名\]|站名/g, domain.beiAnName)
                .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                .replace(/\[数字\]|数字/g, domain.urlNumber)
                .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
            f_item.title = f_item.title.replace(/\[站名\]|站名/g, domain.beiAnName)
                .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
                .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
                .replace(/\[数字\]|数字/g, domain.urlNumber)
                .replace(/\[域名\]|域名/g, ctx.header.host + ctx.url)
        }
        let id = ctx.params.id;
        let result = {};
        // 分页代码部分开始
        let nowPage = ctx.query.e || 1
        let spage = ctx.query.s || 0
        let epage = ctx.query.e || 0
        let offset = ctx.query.o || 0
        let limit = 120;

        //从缓存里面获取列表
        let list_name = ctx.url
        // console.log(list_name)
        if (list_name) {
            list_name = list_name.replace(/\?|\/|\||\*|\"|\'|\<|\>/g, '##')
            list_name = list_name.slice(list_name.indexOf('e='), list_name.indexOf('&o'))
            if(!list_name) list_name = "index"
            list_name = ctx.params.id+list_name
        }
        let isHaveList = false;
        let isHaveListCache = false;
        let cachePageFilePath = this.ctx.app.config.cacheFile+'navclist/'
        let filePath = cachePageFilePath + list_name + '.json'

        //判断缓存
        if (list_name && list_name.length < 500) {
            //从缓存视频列表里面获取
            try {
                let text = fs.readFileSync(filePath, 'utf-8');
                let datac = JSON.parse(text);
                isHaveListCache = true;
                result = datac;
                let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                if (chaTime >= 86400000 || chaTime < 0) {
                    isHaveList = false
                } else {
                    isHaveList = true
                }
            } catch (e) {
            }
            if(isHaveList&&result.cateNavList.length>0){
                return await ctx.render(`template/${domain.tname}/navcategory.html`, result).then(() => {
                }).catch((e) => {
                    this.ctx.service.utils.allPage();
                });
            }
        }
        // 验证id 类型
        if(!/^[0-9a-fA-F]{24}$/.test(id)){
           return await ctx.service.utils.allPage()
        };

        let category = await this.ctx.model.NavCategory.findById(id);
        if(!category||!category._id){
           return await ctx.service.utils.allPage()
        }
        let criteria = {
            ncids: { $in: [category._id] },
            status: 1,
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
        let rows = await this.ctx.model.Nav.find(criteria).sort({ "_id": skipId }).skip(skip).limit(limit).lean();


        result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)
        if (pageType < 0) {
            rows = rows.reverse()
        }
        // 获取最后一个id
        if (rows.length > 0) {
            result.offset = rows[rows.length - 1]['_id']
            result.offsetStart = rows[0]['_id']
        }
        result.navList = rows;
        result.pageSize = limit;
        result.snowPage = nowPage - 5 < 1 ? 1 : nowPage - 5
        result.count = category.num;
        result.nowPage = nowPage;
        result.pageNum = Math.ceil(category.num / limit)||1;
        // 分页代码部分结束
        result.domain = domain;
        result.category = category;
        result.mtdk = f_item
        await ctx.render(`template/${domain.tname}/navcategory.html`, result).then(()=>{
            // 如果缓存文件没有 创建一个/home/domain.link
            fs.writeFile(filePath, JSON.stringify(result), null, function (err) { });
        });
    }
    //全部导航分类
    async allcategory() {
        const { ctx } = this;
        let { domain } = await ctx.service.utils.getSiteInfo();
        let count = 0
        let nowPage = ctx.query.e || 1
        let spage = ctx.query.s || 0
        let epage = ctx.query.e || 0
        let limit = 120
        let offset = (Math.abs(ctx.query.e-ctx.query.s - 1))*limit
        let pageType = ctx.query.e<ctx.query.s?'prve':'next'
        if (pageType=='prve') {
            offset = (Math.abs(ctx.query.e-ctx.query.s) - 1) * limit;
        }
        let pageTypeId = ctx.query.o

        
        let result = {
            count,
            nowPage,
            snowPage: 1,
            offset,
            pageNum:1,
            cateNavList:[],
            categoryNavList:[]
        };
        if (spage && epage && pageTypeId) {
          // 不符合分页条件
          let isObjectId = /^[a-fA-F0-9]{24}$/.test(pageTypeId)
          let num = epage - spage
          if (num < -20 || num > 20 || !isObjectId) {
            return this.ctx.render('error.html');
          }
        }

        let domainFileName = domain.link.replace(':','##')+'/'
        // let isHaveHomeFile = fs.existsSync(homePageFilePath)
        // let isHaveIndexHtml = fs.existsSync(homePageFilePath+'/allcategory.json')
        // let isError = false;

        //从缓存里面获取列表
        let list_name = ctx.url
        if (list_name) {
            list_name = list_name.replace(/\?|\/|\||\*|\"|\'|\<|\>/g, '##')
            list_name = 'nacate'+list_name.slice(list_name.indexOf('e='), list_name.indexOf('&o'))
        }
        let isHaveList = false;
        let cachePageFilePath = this.ctx.app.config.cacheFile+'home/'+domainFileName

        let filePath = cachePageFilePath + list_name + '.json'
        let isHaveListCache = false;
        if (list_name && list_name.length < 500) {
            //从缓存视频列表里面获取
            try {
                let text = fs.readFileSync(filePath, 'utf-8');
                let datac = JSON.parse(text);
                isHaveListCache = true;
                result = datac;
                let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                if (chaTime >= 86400000 || chaTime < 0) {
                    isHaveList = false
                } else {
                    isHaveList = true
                }
            } catch (e) {
            }
            if(isHaveList&&result.cateNavList){
                return await ctx.render(`template/${domain.tname}/allcategory.html`, result).then(() => {
                }).catch((e) => {
                    this.ctx.service.utils.allPage();
                });
            }
        }
        
        let optionsc = { pageType,pageTypeId, offset, limit}
        if(pageTypeId)optionsc.pageTypeId = pageTypeId
        if(pageType)optionsc.pageType = pageType
        optionsc.num = { $gt: 0 }

        let ncidsList = await this.service.nav.navCategoryList(optionsc);
        result.cateNavList = await this.service.nav.getNavCagegoryNavList(domain.navcids)

        let ncidsListArr = []
        if(ncidsList.data){
            result.count = ncidsList.data.count;
            ncidsListArr = this.service.utils.jiemiFn(ncidsList.data.data)
            result.count = ncidsList.data.count;
            if (ncidsListArr.length > 0) {
                result.offset = ncidsListArr[ncidsListArr.length - 1]['_id']
                result.offsetStart = ncidsListArr[0]['_id']
            }
        }

        result.updateCacheTime=Date.now()
        result.pageSize = limit;
        result.snowPage = nowPage - 5 < 1 ? 1 : nowPage - 5
        result.nowPage = nowPage;
        result.pageNum = Math.ceil(result.count / limit)||1;

        result.category = ncidsListArr;
        result.domain = domain;

        await ctx.render(`template/${domain.tname}/allcategory.html`, result).then(()=>{
            // 如果缓存文件没有 创建一个/home/domain.link
            if(!isHaveListCache|| isError&&ncidsListArr.length>0){
                // fs.writeFile(filePath, JSON.stringify(result), null, function (err) { });
            }
        });
    }

}
