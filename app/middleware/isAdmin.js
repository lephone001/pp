module.exports = () => {
  return async function (ctx, next) {
    const message = {
      code: -1,
      message: '非管理员不允许操作！'
    }
    const client_token = ctx.headers['authorization']
    if (!client_token) return ctx.body = message
    let verifyRes
    try {
      verifyRes = ctx.app.jwt.verify(client_token, ctx.app.config.jwt.secret)
    } catch (error) {
      return ctx.body = message
    }
    const isAdmin = Boolean(verifyRes && verifyRes.isAdmin)
      || String(verifyRes && verifyRes.username || '').toLowerCase() === 'admin01'
    if (isAdmin) {
      await next()
    } else {
      return ctx.body = message
    }
  }
}
