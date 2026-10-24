'use strict';
const Controller = require('egg').Controller;
const axios = require('axios')
const token = '6823418655:AAFw5144tZV__oqQbw3IB2mRCssm24oUtuE';
class BotController extends Controller {
    async sendServerWarningMessage(){
        const { ctx } = this;
        let messageStrc = JSON.stringify(ctx.request.body)
        let serverIP = ctx.request.body.serverIP
        await axios({
            method: 'post',
            url: `https://api.telegram.org/bot${token}/sendMessage`,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'curl/7.12.1'
            },
            data: {
                chat_id:"-1002337053977",
                text:serverIP
            }
          }).then(res => {}).catch(error => {
            console.log(error)
        })
        this.ctx.body = {
            code:200,
            data:'发送成功！',
        }
    }
    
}
module.exports = BotController;
