'usestrict';
const egg = require('egg');
const fs = require('fs');
const axios = require('axios');
var moment = require('moment')
moment.locale('zh-CN');
module.exports = class JingtaiController extends egg.Controller {
    async detail() {
        const { ctx } = this;
        let id = ctx.params.id
        if (!id.match(/^[0-9a-fA-F]{24}$/)) return ctx.render(`404.html`);
        return ctx.body = id+`-jingtai-app`
    }
}