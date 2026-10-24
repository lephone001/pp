'use strict';

const Controller = require('egg').Controller;

class AiArticleController extends Controller {
  async generate() {
    const { ctx } = this;

    try {
      ctx.body = await ctx.service.aiArticle.generate(ctx.request.body || {});
    } catch (error) {
      const message = error && error.publicMessage
        ? error.publicMessage
        : 'AI文章生成失败，请稍后重试';

      ctx.logger.error('[ai-article] generate failed: %s', error && error.stack ? error.stack : error);
      ctx.body = {
        code: -1,
        message,
      };
    }
  }
}

module.exports = AiArticleController;
