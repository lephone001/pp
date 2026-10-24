'use strict';
const Controller = require('egg').Controller;
const fs = require('fs');
const path = require('path');
const { currentSource } = require('../../lib/advUpdateSource');
require('../../lib/uplinkData').ensure();
var rp = require("request-promise");
const axios = require('axios')
var moment = require('moment')

const nameJsonFile = '/app/public/html/bc.json';
const nameJsonFilePath = path.resolve(__dirname, '../../..') + nameJsonFile

const nameJsFile = '/app/public/html/bc.js';
const nameJsFilePath = path.resolve(__dirname, '../../..') + nameJsFile   //

const nameHtmlFile = '/app/public/html/bctp.html';
const nameHtmlFilePath = path.resolve(__dirname, '../../..') + nameHtmlFile

const nameHtml002File = '/app/public/html/bc01.html';
const nameHtml002FilePath = path.resolve(__dirname, '../../..') + nameHtml002File

const nameTestJsFile = '/app/public/html/bc-testurl.js';
const nameTestJsFilePath = path.resolve(__dirname, '../../..') + nameTestJsFile   //

class BcController extends Controller {
    async bcList(){
        const { ctx } = this;
        let agentPageName = '/app/public/html/bc.json';
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
    async createBC(){
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
        await fs.promises.writeFile(nameJsonFilePath, JSON.stringify(textJSON));
        textJSON = textJSON.filter(item=>item.status==1) //过滤开启状态
        let JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')

        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
        
        await fs.promises.writeFile(nameJsFilePath, strJsItem );
        textHtml = textHtml.replace('####JAVASCRIPT####',strJsItem)
        await fs.promises.writeFile(nameHtml002FilePath, textHtml );

        let resultdata = {
            code:200,
            message:'添加成功！'
        }
        this.ctx.body = {
            code:200,
            data:ctx.service.uplink.utils.jiamiFn(resultdata)
        }
    }
    async deleteBC(){
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
        await fs.promises.writeFile(nameJsonFilePath, JSON.stringify(textJSON));
        textJSON = textJSON.filter(item=>item.status==1) //过滤开启状态
        let JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')

        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
        
        await fs.promises.writeFile(nameJsFilePath, strJsItem );
        textHtml = textHtml.replace('####JAVASCRIPT####',strJsItem)
        await fs.promises.writeFile(nameHtml002FilePath, textHtml );
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

        await fs.promises.writeFile(nameJsonFilePath, JSON.stringify(textJSON));

        textJSON = textJSON.filter(item=>item.status==1) //过滤开启状态
        let JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
        await fs.promises.writeFile(nameJsFilePath, strJsItem );
        textHtml = textHtml.replace('####JAVASCRIPT####',strJsItem)
        await fs.promises.writeFile(nameHtml002FilePath, textHtml );

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
    async updateBC(){
        const { ctx } = this;
        let itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
        
        itemdata.updateTime = nowDatec
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
        let indexc = textJSON.findIndex(itemc=>itemc.id == itemdata.id)

        textJSON[indexc] =  itemdata;

        await fs.promises.writeFile(nameJsonFilePath, JSON.stringify(textJSON));

        textJSON = textJSON.filter(item=>item.status==1) //过滤开启状态
        let JIAMIAPPJSONLIST = encodeURIComponent(JSON.stringify(textJSON));
        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var JIAMIAPPJSONLIST = "${JIAMIAPPJSONLIST}";window.AppList = JSON.parse(decodeURIComponent(JIAMIAPPJSONLIST))`
        await fs.promises.writeFile(nameJsFilePath, strJsItem );
        textHtml = textHtml.replace('####JAVASCRIPT####',strJsItem)
        await fs.promises.writeFile(nameHtml002FilePath, textHtml );

        let resultdata = {
            code:200,
            message:'修改成功！'
        }
        this.ctx.body = {
            code:200,
            data:ctx.service.uplink.utils.jiamiFn(resultdata)
        }
    }
    async updateBCServer(){
        const { ctx } = this;
        let itemdata = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data)
        let results = []
        if(itemdata&&itemdata.length>0){
            for (let item of itemdata) {
                await rp({
                        method: 'POST',
                        url: item.val,
                        headers: {
                            'Content-Type': 'Application/json'
                        },
                        body:{link:currentSource(ctx)},
                        timeout: 30000,
                        encoding: null, //设置encoding
                        json: true,
                        pool: {
                            maxSockets: Infinity
                        }
                    })
                    .then(res => {
                        results.push({val:item.val,code:res && res.code !== undefined ? res.code : 200,message:res && res.message || '成功！'})
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
    async updateBCAdvLinks(){
        //更新代理链接//    sbb02.html app.js
        const { ctx } = this;
        const nameJsonFile = '/app/public/html/bc.json';
        const nameJsonFilePath = path.resolve(__dirname, '../../..') + nameJsonFile

        const nameJsFile = '/app/public/html/bc.js';
        const nameJsFilePath = path.resolve(__dirname, '../../..') + nameJsFile   //

        const nameHtml002File = '/app/public/html/bc01.html';
        const nameHtml002FilePath = path.resolve(__dirname, '../../..') + nameHtml002File
        // 
        let updateUrl = currentSource(ctx)
        //直接获取url 里面的文件
        await axios.get(updateUrl+'sbb02.html?v='+Date.now(), { timeout: 30000 }).then(async (res)=>{ 
            if(res.data){
                await fs.promises.writeFile(nameHtml002FilePath, res.data );
            }
        })
        await axios.get(updateUrl+'app.js?v='+Date.now(), { timeout: 30000 }).then(async (res)=>{
            if(res.data){
                await fs.promises.writeFile(nameJsFilePath, res.data );
            }
        })
        await axios.get(updateUrl+'app.json?v='+Date.now(), { timeout: 30000 }).then(async (res)=>{
            if(res.data){
                await fs.promises.writeFile(nameJsonFilePath,JSON.stringify(res.data)  );
            }
        })
        this.ctx.body = {
            code: 200,
            message: '成功'
        }
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
        let an = '/app/public/html/bc-alldata.js';
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
        let an = '/app/public/html/bc-alldata.js';
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
module.exports = BcController;
