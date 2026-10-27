'use strict';

const ERROR_TEMPLATE = /^(?:404[abcv]?|error|new404|notfind)\.html$/;

module.exports = () => async function errorPageData(ctx, next) {
  const render = ctx.render;
  ctx.render = async function renderWithErrorPageData(template, locals, ...args) {
    const name = String(template).replace(/^\/+/, '');
    if (!ERROR_TEMPLATE.test(name)) return render.call(this, template, locals, ...args);

    const data = Object.assign({}, locals);
    if (!data.domain) {
      const site = await ctx.service.utils.getSiteInfo();
      data.domain = site && site.domain;
    }
    data.detail = data.detail || {};
    return render.call(this, template, data, ...args);
  };
  try {
    await next();
  } finally {
    ctx.render = render;
  }
};
