module.exports = () => {
  return async function (ctx, next) {
    const message = {
      code: -4,
      message: '请先登录！!'
    }
    const clientToken = ctx.headers.authorization
    if (!clientToken) return ctx.body = message

    let verifyRes
    try {
      // jsonwebtoken 使用回调时不返回 decoded，这里必须同步校验。
      verifyRes = ctx.app.jwt.verify(clientToken, ctx.app.config.jwt.secret)
    } catch (error) {
      ctx.logger.warn('[auth] invalid token: %s', error && error.name || 'verify failed')
      return ctx.body = message
    }

    if (!verifyRes || !verifyRes.loginTime || !verifyRes.username || !verifyRes.id) {
      return ctx.body = message
    }

    // JWT 本身已签名且不设过期时间。请求鉴权不再依赖 Redis/MongoDB，
    // 避免数据库短暂断开导致刷新页面后被误判为掉线。
    ctx.state.user = verifyRes
    await next()
  }
}
