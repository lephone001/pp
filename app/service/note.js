"use strict";
const Service = require("egg").Service;
const message = {
    c404: {
        code: 404,
        message: "找不到该内容！",
    },
};
class Note extends Service {
    //用户列表
    async noteList({ title, offset = 0, limit = 15, sTime, eTime }) {
        let uid = this.ctx.service.utils.getTokenInfo('id')
        let criteria = {}
        if (title) criteria.title = eval('/' + title + '/i');
        if (sTime && eTime) {
            criteria.createdAt = {
                $gte: new Date(sTime),
                $lt: new Date(eTime),
            }
        }
        if (!uid) return { code: -2, message: '没有权限访问！' }
        let count = await this.ctx.model.Note.countDocuments(criteria, (err, c) => c);
        let rows = await this.ctx.model.Note.find(criteria).select('title isTop description createdAt updatedAt tags uname')
            .sort({ "isTop":-1,"_id": -1 })
            .skip(offset)
            .limit(limit)
        return {
            code: 200,
            data: {
                data: rows,
                count,
                limit,
                offset,
            },
        };
    }
    //用户添加
    async createNote(o) {
        let uname = this.ctx.service.utils.getTokenInfo('username');
        let id = this.ctx.service.utils.getTokenInfo('id');
        // 先查找标题是否存在
        let isHave = await this.ctx.model.Note.findOne({title:o.title})
        if(isHave) {
            return {
                message: "标题重复！",
                code: -2,
            };
        }
        await this.ctx.model.Note.create({
            uid: id,
            uname,
            title: o.title,
            category: o.category,
            tags: o.tags,
            sort: o.isTop,
            isTop: o.isTop,
            content: o.content,
            description: o.description,
        })
        return {
            message: "创建成功！",
            code: 200,
        };
    }

    async findNote(id) {
        const note = await this.ctx.model.Note.findById(id);
        if (!note) {
            return { code: -1, message: "导航找不到！" };
        }
        return note;
    }
    async updateNote(id, updates) {
        const note = await this.ctx.model.Note.findByIdAndUpdate(id,updates);
        if (!note) {
            return { code: -1, message: "导航找不到！" };
        }
        return { code: 200, message: "更新成功！" };
    }

    async delNote(id) {
        let uname = this.ctx.service.utils.getTokenInfo('username')
        let uid = this.ctx.service.utils.getTokenInfo('id')
        await this.ctx.model.Note.findByIdAndDelete({
            _id: id,
            uname,
            uid
        });
        return { code: 200, message: "删除成功！" };
    }
}

module.exports = Note;
