'use strict';
const Controller = require('egg').Controller;
class WenzhangController extends Controller {
  async manage() {
    const { ctx } = this;
    const s = ctx.service.wenzhang;
    const body = ctx.request.body || {};
    const actions = {
      list: () => s.list(body),
      detail: () => ctx.model.Wenzhang.findById(s.requireId(body.id)).lean(),
      save: () => s.save(body), remove: () => s.remove(body.id),
      categories: () => s.categories(), saveCategory: () => s.saveCategory(body), removeCategory: () => s.removeCategory(body.id),
      sources: () => s.sources(), saveSource: () => s.saveSource(body), removeSource: () => s.removeSource(body.id),
      collect: () => s.collect(body.id),
      syncSettings: () => ctx.service.wenzhangSync.publicSettings('wenzhang'),
      saveSyncSettings: () => ctx.service.wenzhangSync.save('wenzhang', {
        ...body,
        receiveUrl: `${ctx.protocol}://${ctx.host}`,
      }),
    };
    if (!Object.prototype.hasOwnProperty.call(actions, ctx.params.action)) { ctx.status = 404; return; }
    try { ctx.body = { code: 200, data: await actions[ctx.params.action]() }; } catch (error) {
      ctx.logger.warn('[wenzhang] %s: %s', ctx.params.action, error.message);
      ctx.body = { code: -1, message: error.code === 11000 ? '名称或地址已存在' : error.message };
    }
  }
}
module.exports = WenzhangController;
