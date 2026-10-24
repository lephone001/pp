
'use strict';

const Service = require('egg').Service;

class Counters extends Service {
    async set(key) {
        let countitem = await this.ctx.model.Counters.findOne({id:key})
        let count = await this.ctx.model[key].countDocuments(null, (err, c) => c);
        if (countitem) {
            try {
                await this.ctx.model.Counters.updateOne({ id: key }, {
                    seq: count
                })
            } catch {
                console.log('失败')
            }
        } else {
            this.ctx.model.Counters.create({ id: key, seq: count })
        }
        return 1
    }
    async get(key) {
        var data = await this.ctx.model.Counters.findOne({id:key});
        if (data&&data.seq>=0) {
            return data.seq;
        } else {
            this.ctx.service.counters.set(key)
            return 0
        }
    }
    async del(key) {
        await this.app.Counters.findOneAndDelete(key);
        return {
            code: 200,
            message: '删除成功！'
        }
    }
}

module.exports = Counters;