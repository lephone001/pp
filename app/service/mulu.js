"use strict";
const Service = require("egg").Service;
// const { IndexHints } = require("sequelize");
var mongoose = require('mongoose');
const fs = require("fs");
class Mulu extends Service {
    async muluList({
        offset = 0,
        limit = 20,
        mcid
    }) {
        let criteria = {};
        // 把cont的数量存起来
        // criteria.uname = this.ctx.service.utils.getTokenInfo('username');
        let count = 0
        if (mcid) {
            criteria.mcid = mcid
            let muluCate = await this.ctx.model.Mulucategory.findById(mcid)
            if (muluCate) {
                count = muluCate.num
                this.ctx.model.Mulu.countDocuments(criteria, async (err, c) => {
                    if (count !== c) {
                        await this.ctx.model.Mulucategory.findOneAndUpdate({
                            _id: muluCate._id,
                        }, { $set: { num: c } });
                    }
                });
            } else {
                count = await this.ctx.model.Mulu.countDocuments(criteria, (err, c) => c);
            }
        } else {
            count = await this.ctx.model.Mulu.countDocuments(criteria, (err, c) => c);
        }
        let rows = await this.ctx.model.Mulu.find(criteria).sort({ "_id": -1 }).skip(offset).limit(limit).select().lean()
        let rowsc = this.ctx.service.utils.jiamiFn(rows);

        const ResponseData = {
            code: 200,
            data: {
                data: rowsc,
                count,
                limit,
                offset,
            },
        };
        return ResponseData;
    }

    async muluListAll({
        mcid,
    }) {
        // 获取全部
        let criteria = {};
        if (mcid) criteria.mcid = mcid;
        let rows = await this.ctx.model.Mulu.find(criteria).sort({ "_id": -1 }).lean()
        const ResponseData = {
            code: 200,
            data: {
                data: rows,
            },
        };
        return ResponseData;
    }
    async createMuluList(muluList) {
        let uname = this.ctx.service.utils.getTokenInfo('username');
        let uid = this.ctx.service.utils.getTokenInfo('id');
        let indexcc = 0
        let mcid = muluList[0]['mcid']
        if (!mcid) return { code: -2, message: '格式错误！' }
        let max_id = await this.ctx.model.Mulu.aggregate([
            { $match: { mcid: mongoose.Types.ObjectId(mcid) } },
            { $group: { _id: null, max_value: { $max: "$index" } } },
        ]);
        if (max_id && max_id[0]) {
            indexcc = max_id[0].max_value + 1
        }
        for (let item of muluList) {
            //判断重复
            if (item.title && item.mcid) {
            //     let isHave = await this.ctx.model.Mulu.findOne({
            //         title: item.title,
            //         mcid: item.mcid,
            //     }).select('_id')
            //     if (!isHave) {
                    let muluItem = await this.ctx.model.Mulu.create({
                        link: item.link,
                        title: item.title,
                        keywords: item.keywords,
                        description: item.description,
                        uname,
                        uid,
                        mcid: item.mcid,
                        index: indexcc
                    })
                    // 生成缓存文件
                    let muluFileName = item.mcid + '-' + indexcc
                    let MuluPageFilePath = this.ctx.app.config.cacheFile + 'mulu/' + muluFileName
                    fs.writeFile(MuluPageFilePath + '.json', JSON.stringify(muluItem), null, function (err) { });
                    indexcc++
                }
            // }
        }
        await this.ctx.service.mulu.refushMuluCategory();
        return { code: 200, message: "添加成功！" };
    }
    async mutDelMulu({ ids }) {
        // 检测删除权限
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let uid = this.ctx.service.utils.getTokenInfo('id')
        await this.ctx.model.Mulu.remove({ _id: { $in: ids }, uname, uid })
        // 删除缓存
        // fs.unlinkSync(filePath);
        return { code: 200, message: "删除成功！" };
    }

    async createMuluCategoryList(name) {
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let uid = this.ctx.service.utils.getTokenInfo('id')
        await this.ctx.model.Mulucategory.create({
            uname,
            uid,
            name
        })
        return { code: 200, message: "添加成功！" };
    }
    async updateMuluCategoryList(c) {
        let o = this.ctx.service.utils.jiemiFn(c.data)
        let { _id } = o
        if (!_id) return { code: -2, message: '参数错误!' }
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let mulucategory = await this.ctx.model.Mulucategory.findById(_id)
        if (mulucategory.uid != uid || uname != mulucategory.uname) return { code: -2, message: '参数错误!' }
        delete o._id
        await this.ctx.model.Mulucategory.updateOne({ _id: _id }, { $set: { name: o.name } });
        return {
            code: 200,
            message: '修改成功!'
        }
    }
    async refushMuluCategory() {
        let muluCateGoryList = await this.ctx.model.Mulucategory.find().sort({ "_id": -1 }).select('_id').lean();
        for (let item of muluCateGoryList) {
            let count = await this.ctx.model.Mulu.countDocuments({
                mcid: item._id
            }, (err, c) => c);
            if (count !== item.num) {
                await this.ctx.model.Mulucategory.findOneAndUpdate({
                    _id: item._id,
                }, { $set: { num: count } });
            }
        }
        return {
            code: 200,
            message: '刷新成功!'
        }
    }
    async delMuluCategory({ _id }) {
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let cate = await this.ctx.model.Mulucategory.findByIdAndDelete({
            _id,
            uid,
            uname
        });
        await this.ctx.model.Mulu.remove({ mcid: _id, uname, uid });
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'mulu/';
        for(let i = 0;i<cate.num;i++){
            let filePath = cachePageFilePath + '-'+i+ '.json'
            fs.unlinkSync(filePath);
        }
        if (uid == cate.uid && uname == cate.uname) {
            return { code: 200, message: "删除成功！" };
        } else {
            return { code: -2, message: "无删除权限！" };
        }
    }
    async muluCategoryList({
        offset = 0,
        limit = 20
    }) {
        let criteria = {};
        let count = 0
        // 把cont的数量存起来
        // criteria.uname = this.ctx.service.utils.getTokenInfo('username');

        count = await this.ctx.model.Mulucategory.countDocuments(criteria, (err, c) => c);
        let rows = await this.ctx.model.Mulucategory.find(criteria).sort({ "_id": -1 }).skip(offset).limit(limit).select().lean()
        let rowsc = this.ctx.service.utils.jiamiFn(rows);

        const ResponseData = {
            code: 200,
            data: {
                data: rowsc,
                count,
                limit,
                offset,
            },
        };
        return ResponseData;
    }

    async mutUpdateReplaceMuluWords({
        mulus,
        updates,
        isAll,
        mcid,
    }) {
        let options = {}
        // if (!isAll) {
        //     options.title = {
        //         $in: mulus
        //     }
        // }
        // 如果是替换  updates = [{key，bval，aval}]
        // upObj.key  字段名称
        // upObj.bval 修改后
        // upObj.aval 修改前
        // if (type === 'replace') {
        for (let upObj of updates) {
            let title = upObj.key;
            let objcc = {}
            if(title=='description') objcc.description = eval('/' + upObj.aval + '/g')
            if(title=='title') objcc.title = eval('/' + upObj.aval + '/g')
            if(title=='keywords') objcc.keywords = eval('/' + upObj.aval + '/g')
            if(mcid) objcc.mcid = mcid
            let mulusList = await this.ctx.model.Mulu.find(objcc).select('title keywords description')
            for (let item of mulusList) {
                let opcitem = {}
                let bzz = eval('/' + upObj.aval + '/g')
                if (upObj.key && upObj.bval) {
                    opcitem[upObj.key] = item[upObj.key].replace(bzz, upObj.bval);
                    await this.ctx.model.Mulu.update({ "_id": item._id }, { "$set": opcitem });
                }
            }
        }
        // } else {
        //     // 如果是批量修改 updates = [{link,update:{title,keyWords,description}}]
        //     for (let item of domains) {
        //         let opt = updates.find(itemcsc => itemcsc.link == item.link)
        //         await this.ctx.model.Domain.update({ "_id": item._id }, { "$set": opt.update });
        //     }
        // }
    }
}

module.exports = Mulu;

