module.exports = () => {
  return async function (ctx, next) {
    //验证是否可以跳转
    //跳转条件  1.非蜘蛛 2.h5 3.非强制不跳转
    let { domain } = await ctx.service.utils.getSiteInfo();
    if (domain&&!domain.isMobile && !domain.ispcpage && !domain.spider) {
      ctx.status = 500
      ctx.body = '';
      return;
    }
    await next();
  }
}

