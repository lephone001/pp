
'use strict';
const Controller = require('egg').Controller;
class getSportLive extends Controller {
    async sportLive360IsPlayList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.getSportLive.sportLive360IsPlayList()
    }
    async sportLive360ListALL() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.getSportLive.sportLive360ListALL()
    }
    async sportTianYuGa(){
        const { ctx } = this;
        this.ctx.body = await ctx.service.getSportLive.sportTianYuGa()
    }
    async getGaLiveRoomNowOnlineList(){
        const { ctx } = this;
        this.ctx.body = await ctx.service.getSportLive.getGaLiveRoomNowOnlineList()
    }
}
module.exports = getSportLive; 