
'use strict';

const Controller = require('egg').Controller;
class UserController extends Controller {
  async regist() {
    const { ctx } = this;
    const createRule = {
      username: { type: 'string', format: /[a-zA-Z0-9_]{5,30}/, message: '用户名格式为长度5到30的英文数字下划线！' },
      password: { type: 'string', format: /[a-zA-Z0-9_]{5,30}/, message: '密码格式为长度5到30的英文数字下划线！' },
      // email: { type: 'string', format: /^[A-Za-z0-9]+([_\.][A-Za-z0-9]+)*@([A-Za-z0-9\-]+\.)+[A-Za-z]{2,6}$/, message: '邮箱不正确！' },
      // captcha: { type: 'string', format: /[a-zA-Z0-9_]{1,4}/, message: '验证码格式不正确！' },
    };
    // console.log(ctx.request.body)
    // 校验参数
    try {
      ctx.validate(createRule, ctx.request.body);
    } catch {
      return ctx.body = {
        code: 400,
        message: '参数错误！'
      }
    }
    // if (ctx.session.registCode !== ctx.request.body.captcha.toLowerCase()) {
    //   return ctx.body = {
    //     message: '验证码错误！',
    //     code: 400
    //   }
    // }
    // 组装参数...
    ctx.body = await ctx.service.user.regist(ctx.request.body);
  }
  async login() {
    const { ctx } = this;
    const createRule = {
      username: { type: 'string', trim: true, message: '用户名不能为空！' },
      password: { type: 'string', trim: true, message: '密码不能为空！' },
      captcha: { type: 'string', trim: true, message: '验证码不能为空！' },
    };
    let joc = this.ctx.service.utils.jiemiFn(ctx.request.body.data);
    //校验参数
    try{
      ctx.validate(createRule, joc)
    }catch{
      return ctx.body = {
        message: '参数错误！',
        code: -1
      }
    }
    // if (ctx.session.loginCode !== ctx.request.body.captcha.toLowerCase()) {
    //   return ctx.body = {
    //     message: '验证码错误！',
    //     code: 400
    //   }
    // }
    
    ctx.body = await ctx.service.user.login(joc);
  }
  async logout() {
    const { ctx } = this;
    ctx.body = await ctx.service.user.logout(ctx.request.body);
  }
  async userInfo() {
    const { ctx } = this;
    // const errors = ctx.validate(createRule, ctx.request.body);
    // if (errors) return ctx.body = { code: 400, message: '参数不正确' }
    ctx.body = await ctx.service.user.userInfo()
  }
  async userList() {
    const { ctx } = this;
    ctx.body = await ctx.service.user.userList(ctx.request.body)
  }
  async createUser() {
    const { ctx } = this;
    const createRule = {
      username: { type: 'string', allowEmpty: false, message: '用户名不能为空！' },
      password: { type: 'string', allowEmpty: false, message: '密码不能为空！' }
    };
    ctx.validate(createRule, ctx.request.body)
    ctx.body = await ctx.service.user.createUser(ctx.request.body)
  }
  async findUser() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    ctx.body = await ctx.service.user.findUser(options.id)
  }
  async updateUser() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      updates: ctx.request.body.updates
    }
    // console.log(ctx.request.body)
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
      updates: {
        type: ['object'], allowEmpty: false,
      }
    };
    ctx.validate(rule, options)
    ctx.body = await ctx.service.user.updateUser(options.id, options.updates)
  }
  async disableUser() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    ctx.body = await ctx.service.user.disableUser(options.id)
  }
  //获取验证码
  async captcha() {
    const { ctx } = this;
    let captcha = await ctx.service.user.captcha(); // 服务里面的方法
    ctx.response.type = 'image/svg+xml';  // 知道你个返回的类型
    ctx.body = captcha.data; // 返回一张图片
  }
  // async index() {
  //     const users = awaitctx.model.user.findAll();
  //    ctx.body = users;
  // }
}
module.exports = UserController;