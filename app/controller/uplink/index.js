'use strict';
const Controller = require('egg').Controller;
const fs = require('fs');
const path = require('path');
const { withUpdateQueue, publish } = require('../../lib/advFileStore');
const PageLink = require('../page/link');
const { normalizeSource, currentSource } = require('../../lib/advUpdateSource');
require('../../lib/uplinkData').ensure();
var rp = require("request-promise");
const axios = require('axios')
var moment = require('moment')
moment.locale('zh-CN');

const nameJsonFile = '/app/public/html/app.json';
const nameJsonFilePath = path.resolve(__dirname, '../../..') + nameJsonFile

const nameJsFile = '/app/public/html/app.js';
const nameJsFilePath = path.resolve(__dirname, '../../..') + nameJsFile   //

const nameHtmlFile = '/app/public/html/sbbtp.html';
const nameHtmlFilePath = path.resolve(__dirname, '../../..') + nameHtmlFile

const nameHtml002File = '/app/public/html/sbb02.html';
const nameHtml002FilePath = path.resolve(__dirname, '../../..') + nameHtml002File

const nameTestJsFile = '/app/public/html/testurl.js';
const nameTestJsFilePath = path.resolve(__dirname, '../../..') + nameTestJsFile   //

class IndexController extends Controller {
    async appjs() {
        this.ctx.set('Cache-Control', 'no-store');
        this.ctx.type = 'application/javascript; charset=utf-8';
        if (!fs.existsSync(nameJsFilePath)) {
            this.ctx.status = 404;
            return;
        }
        this.ctx.body = await fs.promises.readFile(nameJsFilePath, 'utf8');
    }

    async appjson() {
        this.ctx.set('Cache-Control', 'no-store');
        this.ctx.type = 'application/json; charset=utf-8';
        if (!fs.existsSync(nameJsonFilePath)) {
            this.ctx.status = 404;
            return;
        }
        this.ctx.body = await fs.promises.readFile(nameJsonFilePath, 'utf8');
    }

    // 同步原 updatelin 的预览读取逻辑，读取本模块更新生成的同一份文件。
    async sbb02(){
        this.ctx.set('Cache-Control', 'no-store');
        let textHtml = '';
        if (fs.existsSync(nameHtml002FilePath)) {
            textHtml = await fs.promises.readFile(nameHtml002FilePath, 'utf-8');
        }
        if (textHtml) {
            this.ctx.type = 'text/html; charset=utf-8';
            this.ctx.body = textHtml;
        } else {
            this.ctx.status = 500;
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

    async saveAppDownloadToDb(item = {}) {
        const data = this.getAppDownloadPayload(item);
        if (!data.id && !data.index && !data.name) return null;
        const query = item.id ? { id: data.id } : { index: data.index };
        const AppDownloadModel = this.ctx.model.AppDownload || this.ctx.model.Appdownload || this.ctx.model.appDownload;
        return await AppDownloadModel.collection.updateOne(
            query,
            { $set: data },
            { upsert: true }
        );
    }

    getAppJsonList() {
        if (!fs.existsSync(nameJsonFilePath)) return [];
        const textJSON = fs.readFileSync(nameJsonFilePath, 'utf-8');
        if (!textJSON) return [];
        return JSON.parse(textJSON);
    }

    async saveAppDb() {
        const { ctx } = this;
        let success = 0;
        let fail = 0;
        const textJSON = this.getAppJsonList();
        for (const item of textJSON) {
            try {
                await this.saveAppDownloadToDb(item);
                success++;
            } catch (err) {
                fail++;
                console.log('save appDownload db error:', err.message);
            }
        }
        const resultdata = {
            code: 200,
            total: textJSON.length,
            success,
            fail,
            message: `保存数据库成功：${success} 条，失败：${fail} 条`,
        };
        this.ctx.body = {
            code: 200,
            data: ctx.service.uplink.utils.jiamiFn(resultdata)
        };
    }

    async appList(){
        const { ctx } = this;
        let agentPageName = '/app/public/html/app.json';
        let agentPageFilePath = path.resolve(__dirname, '../../..') + agentPageName
        let isHaveagentFile = fs.existsSync(agentPageFilePath)
        let textJSON = []
        if (isHaveagentFile) {
            textJSON = fs.readFileSync(agentPageFilePath, 'utf-8');
            if(textJSON){
                textJSON = JSON.parse(textJSON)
                textJSON = textJSON.reverse()
            }
        }
        this.ctx.body = {
            code:200,
            data:ctx.service.uplink.utils.jiamiFn(textJSON)
        }
    }
    async createApp(){
        const { ctx } = this;
        let itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        itemdata.createTime = new Date().toString()
        itemdata.updateTime = new Date().toString()
        itemdata.id = Date.now()+Math.floor(Math.random() * 1000000) + 1;
        let isHaveagentFile = fs.existsSync(nameJsonFilePath)
        let isHaveHtml = fs.existsSync(nameHtmlFilePath)

        let textJSON = []
        let textHtml = ``

        if (isHaveagentFile) {
            textJSON = fs.readFileSync(nameJsonFilePath, 'utf-8');
            if(textJSON){
                textJSON = JSON.parse(textJSON)
            }
        }

        if (isHaveHtml) {
            textHtml = fs.readFileSync(nameHtmlFilePath, 'utf-8');
        }
        textJSON.push(itemdata)
        const savedJson = JSON.stringify(textJSON);
        textJSON = textJSON.filter(item=>item.status==1) //过滤开启状态

        
        let JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')

        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList002 = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
        
        textHtml = textHtml.replace('####JAVASCRIPT####',strJsItem);
        await publish(path.dirname(nameJsonFilePath), { 'app.json': savedJson, 'app.js': strJsItem, 'sbb02.html': textHtml });
        await this.saveAppDownloadToDb(itemdata);

        let resultdata = {
            code:200,
            message:'添加成功！'
        }
        this.ctx.body = {
            code:200,
            data:ctx.service.uplink.utils.jiamiFn(resultdata)
        }
    }
    async deleteApp(){
        const { ctx } = this;
        let itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        let isHaveagentFile = fs.existsSync(nameJsonFilePath)
        let isHaveHtml = fs.existsSync(nameHtmlFilePath)
        
        let textJSON = []
        let textHtml = ``

        if (isHaveagentFile) {
            textJSON = fs.readFileSync(nameJsonFilePath, 'utf-8');
            if(textJSON){
                textJSON = JSON.parse(textJSON)
            }
        }
        if (isHaveHtml) {
            textHtml = fs.readFileSync(nameHtmlFilePath, 'utf-8');
        }
        let indexc = textJSON.findIndex(itemc=>itemc.id == itemdata.id&&itemc.name==itemdata.name)
        if(indexc>-1){
            textJSON.splice(indexc,1)
        }
        const savedJson = JSON.stringify(textJSON);
        textJSON = textJSON.filter(item=>item.status==1) //过滤开启状态
        let JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')

        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList002 = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
        
        textHtml = textHtml.replace('####JAVASCRIPT####',strJsItem);
        await publish(path.dirname(nameJsonFilePath), { 'app.json': savedJson, 'app.js': strJsItem, 'sbb02.html': textHtml });
        let resultdata = {
            code:200,
            message:'删除成功！'
        }
        this.ctx.body = {
            code:200,
            data:ctx.service.uplink.utils.jiamiFn(resultdata)
        }
    }
    async imagesUrl(){
        const { ctx } = this;
        let itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
        
        let beforeUrl = itemdata.beforeUrl
        let endUrl = itemdata.endUrl
        if(!beforeUrl||!endUrl) return this.ctx.body = {code:-1,message:'错误'};

        let isHaveagentFile = fs.existsSync(nameJsonFilePath)
        let isHaveHtml = fs.existsSync(nameHtmlFilePath)

        let textJSON = []
        let numc = 0;
        let textHtml = ``

        if (isHaveagentFile) {
            textJSON = fs.readFileSync(nameJsonFilePath, 'utf-8');
            if(textJSON){
                textJSON = JSON.parse(textJSON)
            }
        }

        if (isHaveHtml) {
            textHtml = fs.readFileSync(nameHtmlFilePath, 'utf-8');
        }
        // let indexc = textJSON.findIndex(itemc=>itemc.id == itemdata.id)

        
        for(let i =0;i<textJSON.length;i++ ){
            if(textJSON[i]["image"].indexOf(beforeUrl)>=0){
                textJSON[i]["image"] =  textJSON[i]["image"].replace(beforeUrl,endUrl);
                numc++
            }
        }

        const savedJson = JSON.stringify(textJSON);

        textJSON = textJSON.filter(item=>item.status==1) //过滤开启状态
        let JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList002 = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
        textHtml = textHtml.replace('####JAVASCRIPT####',strJsItem);
        await publish(path.dirname(nameJsonFilePath), { 'app.json': savedJson, 'app.js': strJsItem, 'sbb02.html': textHtml });

        let resultdata = {
            code:200,
            message:'修改成功！',
            numc
        }
        this.ctx.body = {
            code:200,
            data:ctx.service.uplink.utils.jiamiFn(resultdata)
        }
    }
    async updateApp(){
        const { ctx } = this;
        const itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        const nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')

        itemdata.updateTime = nowDatec
        await withUpdateQueue(path.dirname(nameJsonFilePath), async () => {
            const isHaveagentFile = fs.existsSync(nameJsonFilePath)
            const isHaveHtml = fs.existsSync(nameHtmlFilePath)
            let textJSON = []
            let textHtml = ``

            if (isHaveagentFile) {
                textJSON = fs.readFileSync(nameJsonFilePath, 'utf-8');
                if (textJSON) textJSON = JSON.parse(textJSON)
            }
            if (isHaveHtml) textHtml = fs.readFileSync(nameHtmlFilePath, 'utf-8');

            const indexc = textJSON.findIndex(itemc => itemc.id == itemdata.id)
            if (indexc < 0) throw new Error('未找到需要修改的 APP 数据');
            textJSON[indexc] = itemdata;

            const savedJson = JSON.stringify(textJSON);
            textJSON = textJSON.filter(item => item.status == 1)
            const JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
            const strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList002 = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
            textHtml = textHtml.replace('####JAVASCRIPT####', strJsItem);
            await publish(path.dirname(nameJsonFilePath), { 'app.json': savedJson, 'app.js': strJsItem, 'sbb02.html': textHtml });
        });

        let dbTimer;
        try {
            await Promise.race([
                this.saveAppDownloadToDb(itemdata),
                new Promise((_, reject) => {
                    dbTimer = setTimeout(() => reject(new Error('MongoDB 写入超时')), 5000);
                }),
            ]);
        } catch (error) {
            ctx.logger.warn('[uplink] APP 文件已更新，数据库同步失败: %s', error && error.message || error);
        } finally {
            if (dbTimer) clearTimeout(dbTimer);
        }

        const resultdata = { code: 200, message: '修改成功！' }
        this.ctx.body = {
            code: 200,
            data: ctx.service.uplink.utils.jiamiFn(resultdata)
        }
    }
    async updateServer(){
        const { ctx } = this;
        let itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        const source = ctx.request.body.source
            ? normalizeSource(ctx.request.body.source)
            : currentSource(ctx);
        let results = []
        if(itemdata&&itemdata.length>0){
            for (let item of itemdata) {
                await rp({
                        method: 'POST',
                        url: item.val,
                        headers: {
                            'Content-Type': 'Application/json',
                            'User-Agent': 'Baiduspider Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
                        },
                        body:{link:source},
                        timeout: 30000,
                        encoding: null, //设置encoding
                        json: true,
                        pool: {
                            maxSockets: Infinity
                        }
                    })
                    .then(res => {
                        const valid = res && typeof res === 'object' && res.code !== undefined;
                        results.push({val:item.val,code:valid ? res.code : 'INVALID_RESPONSE',message:valid ? (res.message || '目标服务器未提供更新说明') : '目标服务器未返回更新结果，不能确认成功',source:res && res.source,page_fetch_status:res && res.page_fetch_status})
                    })
                    .catch((red) => {
                        const code = red.statusCode || (red.cause && red.cause.code) || red.code || 'REQUEST_ERROR';
                        const message = red.statusCode ? '目标服务器返回 HTTP ' + red.statusCode : '请求未确认成功：' + code;
                        ctx.logger.warn('[uplink] update failed: %s %s', item.val, code);
                        results.push({val:item.val,code,message})
                    });
            }
        }
        this.ctx.body = {
            code:200,
            data:ctx.service.uplink.utils.jiamiFn(results)
        }
    }
    async updateAdvLinks(){
        return new PageLink(this.ctx).applyAdvUpdate(currentSource(this.ctx));
    }
    async urlAllTest(){
        const { ctx } = this;
        const data = ctx.request.body.data ? ctx.service.uplink.utils.jiemiFn(ctx.request.body.data) : null;
        let rows = fs.existsSync(nameJsonFilePath) ? JSON.parse(fs.readFileSync(nameJsonFilePath, 'utf8')) : [];
        rows = rows.filter(item => item.status == 1 && (!data || !data.id || item.id == data.id));
        const results = [];
        async function check(url) {
            try {
                const target = new URL(url);
                if (!/^https?:$/.test(target.protocol)) return -1;
                await axios.get(target.origin, { timeout: 5000 });
                return 1;
            } catch (error) {
                return -1;
            }
        }
        for (const item of rows) {
            const urlstatus = await check(item.url);
            const andUrlstatus = item.androidUrl ? await check(item.androidUrl) : 0;
            results.push({ ...item, urlstatus, andUrlstatus });
        }
        results.sort((a, b) => a.urlstatus - b.urlstatus);
        const time = moment().format('YYYY-MM-DD HH:mm:ss');
        const script = 'window.TIMEUPDATE = ' + JSON.stringify(time) + '; window.AppList = ' + JSON.stringify(results) + ';';
        await fs.promises.writeFile(nameTestJsFilePath, script);
        ctx.body = { code: 200, data: ctx.service.uplink.utils.jiamiFn(results) };
    }

    async sebobaoappjson(){
        const { ctx } = this;
        let textHtml = ''
        let an = '/app/public/html/alldata.js';
        let can = path.resolve(__dirname, '../../..') + an
        let isHaveHtml = fs.existsSync(can)
        if (isHaveHtml) {
            textHtml = fs.readFileSync(can, 'utf-8');
        }
        if(textHtml){
            this.ctx.body = {
                code:200,
                data:textHtml,
            }
        }else{
            this.ctx.body = {
                code:200,
                data:'',
            }
        }
    }
    async saveupdatesebobaojson(){
        const { ctx } = this;
        let itemdata = null;
        let an = '/app/public/html/alldata.js';
        let can = path.resolve(__dirname, '../../..') + an
        if(ctx.request.body.data){
            itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        }
        if(itemdata){
            await fs.promises.writeFile(can, itemdata );
        }
        this.ctx.body = {
            code:200,
            data:'保存成功！',
        }
    }
   
}
// Serialize read-modify-publish operations within this worker without disk locks.
for (const name of ['createApp', 'deleteApp', 'imagesUrl']) {
    const original = IndexController.prototype[name];
    IndexController.prototype[name] = function(...args) {
        return withUpdateQueue(path.dirname(nameJsonFilePath), () => original.apply(this, args));
    };
}
module.exports = IndexController;
