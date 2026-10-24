"use strict";
const Service = require("egg").Service;
// const { IndexHints } = require("sequelize");
var mongoose = require('mongoose');
const fs = require("fs");
class Fan extends Service {
    async fanList({
        offset = 0,
        limit = 20,
        fcid
    }) {
        let criteria = {};
        // 把cont的数量存起来
        // criteria.uname = this.ctx.service.utils.getTokenInfo('username');
        let count = 0
        if (fcid) {
            criteria.fcid = fcid
            let fanCate = await this.ctx.model.Fancategory.findById(fcid)
            if (fanCate) {
                count = fanCate.num
                this.ctx.model.Fan.countDocuments(criteria, async (err, c) => {
                    if (count !== c) {
                        await this.ctx.model.Fancategory.findOneAndUpdate({
                            _id: fanCate._id,
                        }, { $set: { num: c } });
                    }
                });
            } else {
                count = await this.ctx.model.Fan.countDocuments(criteria, (err, c) => c);
            }
        } else {
            count = await this.ctx.model.Fan.countDocuments(criteria, (err, c) => c);
        }
        let rows = await this.ctx.model.Fan.find(criteria).sort({ "_id": -1 }).skip(offset).limit(limit).select().lean()
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

    async fanListAll({
        fcid,
    }) {
        // 获取全部
        let criteria = {};
        if (fcid) criteria.fcid = fcid;
        let rows = await this.ctx.model.Fan.find(criteria).sort({ "_id": -1 }).lean()
        const ResponseData = {
            code: 200,
            data: {
                data: rows,
            },
        };
        return ResponseData;
    }
    async createFanList(fanList) {
        let uname = this.ctx.service.utils.getTokenInfo('username');
        let uid = this.ctx.service.utils.getTokenInfo('id');
        let indexcc = 0
        let fcid = fanList[0]['fcid']
        if (!fcid) return { code: -2, message: '格式错误！' }
        let max_id = await this.ctx.model.Fan.aggregate([
            { $match: { fcid: mongoose.Types.ObjectId(fcid) } },
            { $group: { _id: null, max_value: { $max: "$index" } } },
        ]);
        if (max_id && max_id[0]) {
            indexcc = max_id[0].max_value + 1
        }
        for (let item of fanList) {
            //判断重复
            if (item.title && item.fcid) {
                // let isHave = await this.ctx.model.Fan.findOne({
                //     title: item.title,
                //     fcid: item.fcid,
                // }).select('_id')
                // if (!isHave) {
                    let fanItem = await this.ctx.model.Fan.create({
                        link: item.link,
                        title: item.title,
                        keywords: item.keywords,
                        description: item.description,
                        uname,
                        uid,
                        fcid: item.fcid,
                        index: indexcc
                    })
                    // 生成缓存文件
                    let fanFileName = item.fcid + '-' + indexcc
                    let FanPageFilePath = this.ctx.app.config.cacheFile + 'fan/' + fanFileName
                    fs.writeFile(FanPageFilePath + '.json', JSON.stringify(fanItem), null, function (err) { });
                    indexcc++
                // }
            }
        }
        await this.ctx.service.fan.refushFanCategory();
        return { code: 200, message: "添加成功！" };
    }
    async mutDelFan({ ids }) {
        // 检测删除权限
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let uid = this.ctx.service.utils.getTokenInfo('id')
        await this.ctx.model.Fan.remove({ _id: { $in: ids }, uname, uid })
        // 删除缓存
        // fs.unlinkSync(filePath);
        return { code: 200, message: "删除成功！" };
    }

    async createFanCategoryList(name) {
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let uid = this.ctx.service.utils.getTokenInfo('id')
        await this.ctx.model.Fancategory.create({
            uname,
            uid,
            name
        })
        return { code: 200, message: "添加成功！" };
    }
    async updateFanCategoryList(c) {
        let o = this.ctx.service.utils.jiemiFn(c.data)
        let { _id } = o
        if (!_id) return { code: -2, message: '参数错误!' }
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let fancategory = await this.ctx.model.Fancategory.findById(_id)
        if (fancategory.uid != uid || uname != fancategory.uname) return { code: -2, message: '参数错误!' }
        delete o._id
        await this.ctx.model.Fancategory.updateOne({ _id: _id }, { $set: { name: o.name } });
        return {
            code: 200,
            message: '修改成功!'
        }
    }
    async refushFanCategory() {
        let fanCateGoryList = await this.ctx.model.Fancategory.find().sort({ "_id": -1 }).select('_id').lean();
        for (let item of fanCateGoryList) {
            let count = await this.ctx.model.Fan.countDocuments({
                fcid: item._id
            }, (err, c) => c);
            if (count !== item.num) {
                await this.ctx.model.Fancategory.findOneAndUpdate({
                    _id: item._id,
                }, { $set: { num: count } });
            }
        }
        return {
            code: 200,
            message: '刷新成功!'
        }
    }
    async delFanCategory({ _id }) {
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let cate = await this.ctx.model.Fancategory.findByIdAndDelete({
            _id,
            uid,
            uname
        });
        await this.ctx.model.Fan.remove({ fcid: _id, uname, uid });
        let cachePageFilePath = this.ctx.app.config.cacheFile + 'fan/';
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
    async fanCategoryList({
        offset = 0,
        limit = 20
    }) {
        let criteria = {};
        let count = 0
        // 把cont的数量存起来
        // criteria.uname = this.ctx.service.utils.getTokenInfo('username');

        count = await this.ctx.model.Fancategory.countDocuments(criteria, (err, c) => c);
        let rows = await this.ctx.model.Fancategory.find(criteria).sort({ "_id": -1 }).skip(offset).limit(limit).select().lean()
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

    async mutUpdateReplaceFanWords({
        fans,
        updates,
        isAll,
        fcid
    }) {
        let options = {}
        // if (!isAll) {
        //     options.title = {
        //         $in: fans
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
                if(fcid) objcc.fcid = mcid
                let mulusList = await this.ctx.model.Fan.find(objcc).select('title keywords description')
                for (let item of mulusList) {
                    let opcitem = {}
                    let bzz = eval('/' + upObj.aval + '/g')
                    if (upObj.key && upObj.bval) {
                        opcitem[upObj.key] = item[upObj.key].replace(bzz, upObj.bval);
                        await this.ctx.model.Fan.update({ "_id": item._id }, { "$set": opcitem });
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

module.exports = Fan;

