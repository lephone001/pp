'use strict';

module.exports = () => async function uplinkLogin(ctx, next) {
  const denied = { code: -4, message: '请先登录！' };
  const token = ctx.headers.authorization;
  if (!token) { ctx.body = denied; return; }
  let user;
  try {
    user = ctx.app.jwt.verify(token, ctx.app.config.uplink.jwtSecret);
  } catch (error) {
    ctx.body = denied;
    return;
  }
  // 兼容原系统的令牌，同时拒绝主后台及其他模块令牌。
  if (!user || user.username !== 'admin001' || user.password !== 'a123456'
      || (user.scope && user.scope !== 'uplink')) {
    ctx.body = denied;
    return;
  }
  ctx.state.uplinkUser = user;
  await next();
};
