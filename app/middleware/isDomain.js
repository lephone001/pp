//编辑权限
module.exports = () => {
  return async function (ctx, next) {
    let hostBefore = ctx.header.host;
    let hostAfter = ctx.header.host;
    if (hostBefore.indexOf("www.") === 0) {
      hostAfter = hostBefore.replace("www.", "");
    }
    let redisDomain = await ctx.service.cache.get(hostAfter);
    if (hostBefore && hostAfter && redisDomain) {
      next();
    } else {
      return (ctx.body = {
        code: -1,
        message: "不允许操作！Domain",
      });
    }
  };
};
