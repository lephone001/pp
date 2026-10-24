'use strict';

const Service = require('egg').Service;
const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');

const cryptoPassword = (value) => {
  if (value) {
    return crypto.createHash('md5').update(value).digest('hex')
  } else {
    throw ('加密格式错误！')
  }
}

class User extends Service {
  isHighestAdmin(user) {
    return Boolean(user && user.is_admin)
      || String(user && user.username || '').toLowerCase() === 'admin01';
  }

  async updateUser(id, updates) {
    const user = await this.ctx.model.User.findById(id);
    if (!user) {
      return { code: -1, message: '用户找不到！' };
    }
    return user.update(updates);
  }
  async regist(o) {
    const user = await this.ctx.model.User.findOne({
      username: o.username
    });
    if (user) {
      return {
        message: '用户名已存在或IP无权限！',
        code: -1
      }
    }
    const createdUser = await this.ctx.model.User.create({
      ...o,
      registIp: this.ctx.request.ip,
      is_admin: false,
      user_type: 1,
      status: 1,
      online: 1,
      level: 1,
      allowSiteNum: 1000,
      alreadySiteNum: 0,
      coin: 0,
      is_admin: false,
      nickname: o.username,
      email: '',
      loginIp: this.ctx.request.ip,
      imgsrc: '',
      description: '',
    });
    if (createdUser) {
      return {
        message: '创建成功！',
        code: 200
      }
    }
  }
  //退出登录
  async logout() {
    //删除redis
    let username = this.ctx.session.username
    if (username) {
      let redisUser = await this.ctx.service.cache.get('u-' + username)
      if (redisUser) {
        this.ctx.service.cache.del('u-' + username)
      }
      let user = await this.ctx.model.User.findOne({ username })
      if (user) {
        user.update({ last_login_time: user.login_time, online: false });
      }
    }
    //设置token过期
    this.session = null;
    return {
      message: '退出成功！',
      code: 200
    }
  }
  //登录
  async login(o) {
    // console.log(this.ctx.session.loginCode)
    let userInfo = await this.ctx.model.User.findOne({
      username: o.username, password: o.password
    });
    // 用户名或密码错误
    if (userInfo === null) return {
      code: -1,
      message: '用户名或密码错误！'
    }
    // 账户冻结
    if (userInfo.status === 0) return {
      code: -1,
      message: '该账户已被冻结，请联系客服！'
    }
    //更新一下登录时间
    const loginTime = parseInt(Date.now()) //登录时间
    await this.ctx.model.User.updateOne({username:o.username},{$set:{ login_time: loginTime, online: true, loginIp: this.ctx.request.ip }});
    //设置token
    const isAdmin = this.isHighestAdmin(userInfo);
    let token = this.app.jwt.sign({ username: userInfo.username, loginTime, id: userInfo._id, isAdmin }, this.app.config.jwt.secret)
    //权限处理
    userInfo = userInfo.toObject ? userInfo.toObject() : userInfo;
    userInfo.is_admin = isAdmin;
    userInfo.roles = isAdmin ? ['admin'] : ['editor']
    delete userInfo.password;
    // 用户信息存入Redis
    try {
      await this.ctx.service.cache.set('u-' + userInfo.username, {
        token,
        userInfo,
        loginTime
      });
    } catch (error) {
      // Redis 只是辅助缓存，不得导致登录失败。
      this.ctx.logger.warn('[auth] cache user failed: %s', error && error.message || error);
    }
    let rows = this.ctx.service.utils.jiamiFn({
      token,
      userInfo
    })
    return {
      code: 200,
      data: rows
    }
  }
  //用户信息
  async userInfo() {
    const username = this.ctx.service.utils.getTokenInfo('username');
    const id = this.ctx.service.utils.getTokenInfo('id');
    const tokenIsAdmin = Boolean(this.ctx.service.utils.getTokenInfo('isAdmin'));
    if (!username || !id) return { code: -4, message: '请先登录！' };

    // 路由恢复只需身份和权限，直接使用已签名 JWT，不在刷新页面时访问 MongoDB。
    const isAdmin = tokenIsAdmin || String(username).toLowerCase() === 'admin01';
    const userInfo = {
      _id: id,
      id,
      username,
      is_admin: isAdmin,
      roles: isAdmin ? ['admin'] : ['editor']
    };
    let jmuserinfo = this.ctx.service.utils.jiamiFn(userInfo)
    return {
      code: 200,
      data: jmuserinfo
    }
  }
  // 产生验证码
  async captcha() {
    // console.log(this.ctx.session)
    const captcha = svgCaptcha.create({
      size: 4,
      fontSize: 50,
      width: 100,
      height: 40,
      color: true,
      bacground: '#cc9966',
      ignoreChars: 'aGcC70Oo1iIl'
    });
    const { type } = this.ctx.query
    // 登陆验证码
    if (type === '1') {
      this.ctx.session.loginCode = captcha.text.toLowerCase()//把验证码保存到session
    } else if (type === '2') {
      // 注册验证码
      this.ctx.session.registCode = captcha.text.toLowerCase()
    } else if (type === '3'){
      this.ctx.session.navCode = captcha.text.toLowerCase()
    }else{
      this.ctx.session.pachCode = captcha.text.toLowerCase()
    }
    return captcha;
  }
  //用户列表
  async userList({ offset = 0, limit = 10, username, sTime, eTime }) {
    if (limit - 0 > 50) limit = 50;
    let criteria = {}
    if (username) criteria['$or'] = [{ username: { $regex: new RegExp(username, 'i') } }]
    let { count, rows } = await this.ctx.model.User.find(criteria).limit(limit).skip(offset);
    return {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset
      }
    }
  }
  //用户添加
  async createUser(o) {
    const user = await this.ctx.model.User.findOne({ username: o.username })
    if (user) return {
      message: '用户名已存在',
      code: 400
    }
    await this.ctx.model.User.create({
      where: { username: o.username },
      defaults: {
        description: '这个人很懒没有留下任何内容！',
        password: o.password
      }
    });
    return {
      message: '创建成功！',
      code: 200
    }
  }

  async findUser(id) {
    const user = await this.ctx.model.User.findById(id);
    if (!user) {
      return { code: -1, message: '用户找不到！' };
    }
    return user;
  }
  // async findOneUser(){
  //   const user = await this.ctx.model.User.find().limit(1);
  //   return user;
  // }


  async disableUser(id) {
    const user = await this.ctx.model.User.findById(id);
    if (!user) {
      return { code: -1, message: '用户找不到！' };
    }
    await user.update({ status: false })
    // .destroy();
    return { code: 200, message: user.username + '操作成功！' };
  }
}

module.exports = User;
