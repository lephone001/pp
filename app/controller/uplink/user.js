'use strict';

const Controller = require('egg').Controller;

class UplinkUserController extends Controller {
  async login() {
    const { ctx } = this;
    let userinfo;
    try {
      userinfo = ctx.service.uplink.utils.jiemiFn(ctx.request.body.data);
    } catch (error) {
      ctx.body = { code: -1, message: '用户名或密码错误！' };
      return;
    }
    // 保留 updatelin 的独立账号与 AES 请求协议，不接入主后台用户表。
    if (!userinfo || userinfo.username !== 'admin001' || userinfo.password !== 'a123456') {
      ctx.body = { code: -1, message: '无权限！' };
      return;
    }
    const token = ctx.app.jwt.sign({
      username: userinfo.username,
      password: userinfo.password,
      loginTime: Date.now(),
      scope: 'uplink',
    }, ctx.app.config.uplink.jwtSecret);
    ctx.body = { code: 200, data: { token } };
  }
}

module.exports = UplinkUserController;
