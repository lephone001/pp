
'use strict';

const Controller = require('egg').Controller;
const verifyUser = function (value) {
  var uPattern = /^[a-zA-Z0-9_-]{5,20}$/;
  return uPattern.test(value)
}
const verifyEmail = function (value) {
  var ePattern = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
  return ePattern.test(value)
}
class MissController extends Controller {
  async logout () {
    const { ctx } = this;
    return ctx.body = await ctx.service.miss.logout()
  }
  /**
 * @description: 用户登录 
 * @param {username,password} 
 */
  async missLogin () {
    const { ctx } = this;
    const { username, password, code } = ctx.request.body
    if (!code) return ctx.body = { code: -1, message: '验证码格式不正确！' }
    if (!verifyUser(username)) return ctx.body = { code: -1, message: '用户名格式不正确！' }
    if (!verifyUser(password)) return ctx.body = { code: -1, message: '密码格式不正确！' }
    let data = await await ctx.service.miss.missLogin(username, password, ctx)
    return ctx.body = data
  }


  async changePassword () {
    const { ctx } = this;
    const { username, newPassword, email } = ctx.request.body
    if (!verifyEmail(email)) return ctx.body = { code: -1, message: '邮箱不正确！' }
    if (!verifyUser(username)) return ctx.body = { code: -1, message: '用户名格式不正确！' }
    if (!verifyUser(newPassword)) return ctx.body = { code: -1, message: '密码格式不正确！' }
    let data = await ctx.service.miss.changePassword({ username, newPassword, email })
    return ctx.body = data
  }

  /**
   * @description: 用户注册
   * @param {username, password} 
   * @return: 
   */
  async missRegist () {
    const { ctx } = this;
    let { username, password, inviteCode, email, code } = ctx.request.body
    // console.log(ctx.session.registCode)
    // 验证验证码是否正确
    if (!code) return ctx.body = { code: -1, message: '验证码不正确！' }
    // 判断长度防止恶意注入
    if (!verifyUser(username)) return ctx.body = { code: -1, message: '用户名不正确！' }
    if (!verifyUser(password)) return ctx.body = { code: -1, message: '密码不正确！' }
    if (!verifyEmail(email)) return ctx.body = { code: -1, message: '邮箱不正确！' }
    if (!inviteCode || inviteCode.length < 4) return ctx.body = { code: -1, message: '邀请码不正确！' }
    let data = await ctx.service.miss.missRegist({ username, password, inviteCode, email, registIP: ctx.request.body.ip })
    return ctx.body = data
  }
  async missUserInfo () {
    const { ctx } = this;
    let id = ctx.service.utils.getTokenInfo('id')
    // console.log(id)
    let options = {
      id
    }
    const rule = {
      id: { type: 'string', allowEmpty: false, message: 'id不能为空！' }
    };
    try{
      ctx.validate(rule, options)
    }catch{
      return ctx.body = {code:-1,message:'参数错误！'}
    }
    ctx.body = await ctx.service.miss.missUserInfo(options.id)
  }
  async withdraw () {
    const { ctx } = this;
    let id = ctx.service.utils.getTokenInfo('id')
    // console.log(ctx.request.body)
    let options = {
      id,
      coin: ctx.request.body.coin - 0,
      usdtType: ctx.request.body.usdtType,
      usdtUrl: ctx.request.body.usdtUrl,
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      coin: { type: 'number', allowEmpty: false, message: 'coin不能为空！' },
      usdtType: { type: 'string', allowEmpty: false, message: 'usdtType不能为空！' },
      usdtUrl: { type: 'string', allowEmpty: false, message: 'usdtUrl不能为空！' }
    };
    ctx.validate(rule, options)
    if (options.coin < 0) return ctx.body = { code: -1, message: '提现金额不正确！' }
    ctx.body = await ctx.service.miss.withdraw({ id: options.id, ...ctx.request.body })
  }
  async withdrawList () {
    const { ctx } = this;
    let id = ctx.service.utils.getTokenInfo('id')
    let options = {
      id
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    ctx.body = await ctx.service.miss.withdrawList({ id: options.id, ...ctx.request.body })
  }
  async payMiss () {
    const { ctx } = this;
    let userId = ctx.service.utils.getTokenInfo('id')
    let missId = ctx.request.body.id - 0
    let options = {
      userId, missId
    }
    const rule = {
      userId: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      missId: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    ctx.body = await ctx.service.miss.payMiss(options)
  }
  async recharge () {
    const { ctx } = this;
    let userId = ctx.service.utils.getTokenInfo('id')
    let money = ctx.request.body.money
    let cardPassword = ctx.request.body.cardPassword
    let options = {
      cardPassword, money, userId
    }
    const rule = {
      userId: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      cardPassword: { type: 'string', allowEmpty: false, message: 'cardPassword不能为空！' }
    };
    ctx.validate(rule, options)
    let data = await ctx.service.miss.recharge(options)
    ctx.body = data
  }
  async billList () {
    const { ctx } = this;
    let id = ctx.service.utils.getTokenInfo('id')
    let options = {
      id
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    ctx.body = await ctx.service.miss.billList({ id: options.id, ...ctx.request.body })
  }
  async missList () {
    const { ctx } = this;
    ctx.body = await ctx.service.miss.missList({ ...ctx.request.body })
  }
  async leaderMissList () {
    const { ctx } = this;
    const { leaderId } = ctx.request.body
    let options = {
      leaderId: leaderId,
    }
    const rule = {
      leaderId: { type: 'number', allowEmpty: false, message: 'missId不能为空！' },
    };
    try{
      ctx.validate(rule, options)
    }catch{
      return ctx.body = {code:-1,message:'错误！'}
    }
    ctx.body = await ctx.service.miss.leaderMissList({ ...ctx.request.body, leaderId: options.leaderId })
  }
  async fivator () {
    const { ctx } = this;
    const { missId, type } = ctx.request.body
    const userId = this.service.utils.getTokenInfo('id')
    let options = {
      missId: ctx.request.body.missId - 0,
      type: ctx.request.body.type,
    }
    const rule = {
      missId: { type: 'number', allowEmpty: false, message: 'missId不能为空！' },
      type: { type: 'string', allowEmpty: false, message: 'type' },
    };
    ctx.validate(rule, options)
    let data = await ctx.service.miss.fivator({ userId, type, missId })
    return ctx.response.body = data
  }
  async fivatorList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.miss.fivatorList(ctx.request.body)
  }

  async history () {
    const { ctx } = this;
    const { missId, type } = ctx.request.body
    const userId = this.service.utils.getTokenInfo('id')
    let options = {
      missId: ctx.request.body.missId - 0,
      type: ctx.request.body.type,
    }
    const rule = {
      missId: { type: 'number', allowEmpty: false, message: 'missId不能为空！' },
      type: { type: 'string', allowEmpty: false, message: 'type' },
    };
    ctx.validate(rule, options)
    let data = await ctx.service.miss.history({ userId, type, missId })
    return ctx.response.body = data
  }
  async historyList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.miss.historyList(ctx.request.body)
  }

  async checkMissPass () {
    const { ctx } = this;
    const { id, type, remarks } = ctx.request.body
    let userId = this.service.utils.getTokenInfo('id')
    let isAdmin = this.service.utils.getTokenInfo('isAdmin')

    let options = {
      id: ctx.request.body.id - 0,
      type: ctx.request.body.type,
      userId
    }
    if (!isAdmin) return ctx.response.body = { code: -1, message: '无权限！' }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'missId不能为空！' },
      type: { type: 'string', allowEmpty: false, message: 'type' },
      userId: { type: 'number', allowEmpty: false, message: 'userId不能为空！' },
    };
    ctx.validate(rule, options)
    let data = await ctx.service.miss.checkMissPass({ type, id, remarks })
    return ctx.response.body = data
  }
  async checkMissName () {
    const { ctx } = this;
    const { title } = ctx.request.body
    const createRule = {
      title: { type: 'string', allowEmpty: false, message: 'title不能为空！' },
    };
    ctx.validate(createRule, { title })
    let data = await ctx.service.miss.checkMissName({ title })
    return ctx.response.body = data
  }
  async checkMissPassList () {
    const { ctx } = this;
    let userId = this.service.utils.getTokenInfo('id')
    let isAdmin = this.service.utils.getTokenInfo('isAdmin')
    this.ctx.body = await ctx.service.miss.checkMissPassList({ ...ctx.request.body, userId, isAdmin })
  }
  async createMiss () {
    const { ctx } = this;
    const saveData = ctx.request.body
    let up_uid = this.service.utils.getTokenInfo('id')
    let up_username = this.service.utils.getTokenInfo('username')
    let isAdmin = this.service.utils.getTokenInfo('isAdmin')
    let isLeader = this.service.utils.getTokenInfo('isLeader')

    const createRule = {
      up_uid: { type: 'number', allowEmpty: false, message: 'up_uid不能为空！' },
      up_username: { type: 'string', allowEmpty: false, message: 'up_uid不能为空！' },
    };
    ctx.validate(createRule, { up_username, up_uid })
    //添加经纪人下面的信息 只有admin 才能添加
    if (saveData.createType == 2 && ((!isAdmin&&!isLeader) || !saveData.leaderUserName || !saveData.leaderId)) return ctx.response.body = { code: -1, message: '无权限添加！' }
    //验证小姐参数
    if (!up_uid || !up_username || !saveData.cityId || !saveData.provinceId || !saveData.title || !saveData.price || !saveData.service || !saveData.contact_information || !saveData.image_list || !saveData.content) return ctx.response.body = { code: -1, message: '信息填写不正确！' }
    let data = await ctx.service.miss.createMiss({ saveData, up_uid, up_username })
    return ctx.response.body = data
  }
  async findMiss () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      type: ctx.request.body.type - 0
    }
    // console.log(options)
    const rule = {
      id: { type: 'string', allowEmpty: false, message: 'id不能为空！' },
      // isVip: { type: 'boolean', allowEmpty: false, message: 'isVip不能为空！' },
      type: { type: 'number', allowEmpty: false, message: 'type不能为空！' }
    };
    try{
      ctx.validate(rule, options)
    }catch{
      return {
        code:-2,
        message:'错误！'
      }
    }
    this.ctx.body = await ctx.service.miss.findMiss({
      // uid: options.uid,
      type: ctx.request.body.type,
      // isVip: options.isVip,
      id: options.id
    })
  }
  async updateMiss () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      updates: ctx.request.body.updates
    }
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
      updates: {
        type: ['object'], allowEmpty: false,
      }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.miss.updateMiss(options.id, options.updates)
  }
  async disableMiss () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
    }
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.miss.disableMiss(options.id, options.updates)
  }
  async delMiss () {
    const { ctx } = this;
    let isAdmin = ctx.service.utils.getTokenInfo('isAdmin')
    let uid = ctx.service.utils.getTokenInfo('id')

    let options = {
      uid,
      id: ctx.request.body.id - 0
    }
    const rule = {
      uid: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    if (!isAdmin) {
      return this.ctx.body = { code: -1, message: '无权限！' }
    }
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.miss.delMiss(options.id)
  }
  async commentMissList(){
    const { ctx } = this;
    let options = {
      missId: ctx.request.body.missId,
      offset: ctx.request.body.offset
    }
    const rule = {
      // missId: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      offset: { type: 'number', allowEmpty: false, message: 'offset 不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.miss.commentMissList(options)
  }
  async createMissComment(){
    const { ctx } = this;
    let uid = ctx.service.utils.getTokenInfo('id')
    let options = {
      missId: ctx.request.body.missId - 0,
      content:ctx.request.body.content,
      uid,
      missTitle: ctx.request.body.missTitle
    }
    const rule = {
      missId: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      content:{ type: 'string', allowEmpty: false, message: '内容不能为空！' },
      missTitle:{ type: 'string', allowEmpty: false, message: '内容不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.miss.createMissComment(options)
  }
  async delMissComment(){
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.miss.delMissComment({id:options.id})
  }
  async updateMissComment(){
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      type:ctx.request.body.type,
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.miss.updateMissComment(options)
  }
}
module.exports = MissController;