"use strict";
const Service = require("egg").Service;
const fs = require('fs');
const axios = require('axios');
class userAgent extends Service {
    //用户列表
    async userAgentList() {
        const limit = 20;
        const criteria = {};
        // 把cont的数量存起来
        criteria.username = this.ctx.service.utils.getTokenInfo('username');
        let count = await this.ctx.model.UserAgent.countDocuments(criteria, (err, c) => c);
        let rows = await this.ctx.model.UserAgent.find(criteria).sort({ "_id": 1 }).skip().limit(limit).lean()
        let rowsc = this.ctx.service.utils.jiamiFn(rows);

        const ResponseData = {
            code: 200,
            data: {
                data: rowsc,
                count,
                limit,
            },
        };
        return ResponseData;
    }
    async userAgentCreate(o) {
        if (!o.name) return { code: -2, message: '参数错误!' }
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let username = this.ctx.service.utils.getTokenInfo('username')
        let userAgent = await this.ctx.model.UserAgent.create({
            ...o,
            username,
            uid,
            type: 0
        })
        this.ctx.service.cache.set('userAgent-' + userAgent._id, userAgent);

        // if (userAgent.isAgentPage) {
        //     let agentPageName = userAgent.agentPageName + '.html';
        //     let agentPageFilePath = process.cwd() + '/app/public/html';
        //     let agentPageFilePathName = process.cwd() + '/app/public/html/' + agentPageName;
        //     let isHaveagentFile = fs.existsSync(agentPageFilePath)
        //     if (isHaveagentFile) {
        //         let pageurl = userAgent.openUrlH5;
        //         if (pageurl) {
        //             axios.get(pageurl).then((res) => {
        //                 if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
        //                     let tongji = '';
        //                     if(userAgent.gajs) tongji = userAgent.gajs;
        //                     let savehtml = res.data.replace('</body>', tongji + '</body>')
        //                     let savelist = {
        //                         updateCacheTime: Date.now(),
        //                         txtpage: savehtml
        //                     }
        //                     fs.writeFile(agentPageFilePathName, JSON.stringify(savelist), null, function (err) { });
        //                     fs.writeFile(process.cwd() + '/app/public/agentpage/' +  userAgent.agentPageName+ userAgent._id + '.html', savehtml, null, function (err) { });

        //                 }
        //             }).catch(()=>{
        //                 console.log('广告地址请求错误1.3！')
        //               })
        //         }
        //     }
        // }

        return {
            message: "创建成功！",
            code: 200,
        };
    }
    async userAgentDelete(o) {
        const { _id } = o;
        if (!_id) return { code: -2, message: '参数错误!' }
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let username = this.ctx.service.utils.getTokenInfo('username')
        let useragent = await this.ctx.model.UserAgent.findById(_id)
        if (useragent.uid != uid || username != useragent.username) return { code: -2, message: '参数错误!' }
        await this.ctx.model.UserAgent.findByIdAndDelete(_id);
        return {
            message: "删除成功！",
            code: 200,
        };
    }
    async userAgentUpdate(o) {
        let { _id } = o
        if (!_id) return { code: -2, message: '参数错误!' }
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let username = this.ctx.service.utils.getTokenInfo('username')
        let useragent = await this.ctx.model.UserAgent.findById(_id)
        if (useragent.uid != uid || username != useragent.username) return { code: -2, message: '参数错误!' }
        delete o._id
        let userAgent = await this.ctx.model.UserAgent.findOneAndUpdate({ _id: _id }, { $set: o }, { new: true });
        this.ctx.service.cache.set('userAgent-' + userAgent._id, userAgent);
        // if (userAgent.isAgentPage) {
        //     let agentPageName = userAgent.agentPageName + userAgent._id + '.json';
        //     let agentPageFilePathName = process.cwd() + '/app/public/agentpage/' + agentPageName;
        //     let isHaveagentFile = fs.existsSync(agentPageFilePathName)
            
        //     let pageurl = userAgent.openUrlH5;
        //     if (pageurl) {
        //         axios.get(pageurl).then((res) => {
        //             if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
        //                 if (isHaveagentFile) {
        //                     fs.unlinkSync(agentPageFilePathName);
        //                 }
        //                 let tongji = '';
        //                 if(userAgent.gajs) tongji = userAgent.gajs;
        //                 let savehtml = res.data.replace('</body>', tongji + '</body>')
        //                 let savelist = {
        //                     updateCacheTime: Date.now(),
        //                     txtpage: savehtml
        //                 }
        //                 fs.writeFile(agentPageFilePathName, JSON.stringify(savelist), null, function (err) { });
        //                 fs.writeFile(process.cwd() + '/app/public/agentpage/' +  userAgent.agentPageName+ userAgent._id + '.html', savehtml, null, function (err) { });

        //             }
        //         }).catch((res)=>{
        //             // console.log(res)
        //              console.log('广告地址请求错误1.w3！')
        //           })
        //     }
        // }
        return {
            code: 200,
            message: '修改成功!'
        }
    }
    async userAgentGetOne(o) {
        // 数据库获取代理线
        let { agentid } = o
        let agentLink = []
        if (agentid) {
            agentLink = await this.ctx.model.UserAgent.findById(agentid)
        }
        if (!agentLink || agentLink.length == 0) {
            // 没有找到就获取第一个
            agentLink = await this.ctx.model.UserAgent.find().limit(1)
        }
        return {
            data: agentLink[0],
            code: 200,
        }
    }
}

module.exports = userAgent;
