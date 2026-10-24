// {app_root}/app/io/controller /nsp.js
'use strict';
const Controller = require('egg').Controller;
class ChatMessage extends Controller {
    async sendMessage() {
        const { ctx } = this;
        const message = this.ctx.args[0];
        //console.log(message);

        // ctx.socket.emit('res', `Hi! I've got your message: ${message}`);
    }
}

module.exports = ChatMessage;