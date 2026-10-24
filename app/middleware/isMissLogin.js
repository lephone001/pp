module.exports = () => {
  return async function (ctx, next) {
    let message = {
      code: -4,
      message: '请先登录！'
    }
    let message2 = {
      code: -4,
      message: '账号掉线,请重新登录！'
    }
    let message3 = {
      code: -4,
      message: '登录超时，请重新登录！'
    }
    let client_token = ctx.headers['authorization']
    if (!client_token) return ctx.body = message
    let verifyRes = {}
    verifyRes = ctx.app.jwt.verify(client_token, ctx.app.config.jwt.secret, (err, decoded) => decoded)
    if (!verifyRes.loginTime || !verifyRes.username || !verifyRes.id) return ctx.body = message
    //如果redis 存在
    let redisData = await ctx.service.cache.get('miss-user-' + verifyRes.username)
    if (redisData) {
      //验证用户在其他地方登录
      if (redisData.loginTime !== verifyRes.loginTime) return ctx.body = message2
      await next()
    } else {
      //到数据库里面查询
      let userinfo = ctx.service.miss.findUser(verifyRes.id)
      if (userinfo.loginTime !== verifyRes.loginTime) return ctx.body = message3
      await next()
    }
  }
}