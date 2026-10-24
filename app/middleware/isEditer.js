//编辑权限
module.exports = () => {
  return async function (ctx, next) {
    let userId = ctx.service.utils.getTokenInfo('id')
    let isAdmin = ctx.service.utils.getTokenInfo('isAdmin')

    if (isAdmin || userId) {
      await next();
    } else {
      return (ctx.body = {
        code: -1,
        message: "不允许操作！",
      });
    }
  };
};
