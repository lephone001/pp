"use strict";
const Service = require("egg").Service;
const message = {
  c404: {
    code: 404,
    message: "找不到该内容！",
  },
};
class VideoCategory extends Service {
  //用户列表
  async videoCategoryList (params = {}) {
    const options = {};
    if (params.pid) options.pid = params.pid;
    if (params.status !== undefined && params.status !== '') options.status = Number(params.status) === 1 ? 1 : 0;
    if (params.keyword) options.name = { $regex: String(params.keyword).trim(), $options: 'i' };
    let rows = await this.ctx.model.VideoCategory.find(options).sort({ updatedAt: -1, _id: -1 }).lean();
    let rowsc = this.ctx.service.utils.jiamiFn(rows);
    return {
      code: 200,
      data: {
        data: rowsc,
        count: rows.length,
      },
    };
  }
  //添加
  async createVideoCategory (cates) {
    let uid = this.ctx.service.utils.getTokenInfo('id')
    if (!uid) return { message: '不允许添加！', code: -2 }
    let resault = {
      code: 200,
      data: {
        success: [],
        filed: []
      }
    }
    for (let item of cates) {
      let { name } = item
      if (!name) {
        resault.data.filed.push({ name: '', message: '分类名称不能为空！' })
        continue
      }
      let cateone = await this.ctx.model.VideoCategory.findOne({
        name: item.name, pid: item.pid, status: { $ne: 0 }
      })
      if (!cateone) {
        await this.ctx.model.VideoCategory.create({
          name: item.name,
          copyid: item.copyid || '',
          isHot: 0,
          num: 0,
          pid: item.pid,
          status: item.status === undefined ? 1 : Number(item.status),
          type: item.type === undefined ? 0 : Number(item.type),
          typeName: item.typeName || '视频',
          view: item.view === undefined ? 0 : Number(item.view),
        }).then(() => {
          resault.data.success.push({ name:item.name, message: '添加成功' })
        }).catch((res) => {
          resault.data.filed.push({ name:item.name, message: '链接重复！' })
        })
      } else {
        resault.data.filed.push({ name:item.name, message: '链接重复！' })
      }
    }
    return {
      code: 200,
      data: resault
    }
  }

  async findVideoCategory (id) {
    const videoCategory = await this.ctx.model.VideoCategory.findById(id);
    if (!videoCategory) {
      return { code: -1, message: "站点找不到！" };
    }
    return videoCategory;
  }

  async updateVideoCategory (id, updates) {
    const videoCategory = await this.ctx.model.VideoCategory.findById(id);
    if (!videoCategory) return { code: 404, message: '视频分类不存在' };
    if (videoCategory) {
      if (updates.type == 'view') {
        await videoCategory.increment('view', { by: 1 });
        let categorys = await this.ctx.model.VideoCategory.find({ status: 1,num:{$gt:0} }).sort({ createdAt: -1 }).limit(40);
        await this.ctx.service.cache.set('video-category-all',categorys)
        return { code: 200, message: "修改成功！" };
      }else{
        const allowed = [ 'name', 'copyid', 'type', 'typeName', 'status', 'isHot', 'view' ];
        const normalized = {};
        allowed.forEach(key => { if (updates && updates[key] !== undefined) normalized[key] = updates[key]; });
        [ 'type', 'status', 'isHot', 'view' ].forEach(key => {
          if (normalized[key] !== undefined) normalized[key] = Number(normalized[key]);
        });
        await this.ctx.model.VideoCategory.updateOne({ _id: id }, { $set: normalized });
      }
    }
    return { code: 200, message: "修改成功！" };
    // if (!videoCategory) {
    //   return { code: -1, message: "找不到！" };
    // }
    // await videoCategory.update(updates);
  }
  async disableVideoCategory (id) {
    const videoCategory = await this.ctx.model.VideoCategory.findById(id);
    if (!videoCategory) {
      return { code: -1, message: "站点找不到！" };
    }
    await videoCategory.update({ status: !videoCategory.status });
    // .destroy();
    return { code: 200, message: videoCategory.name + "操作成功！" };
  }
  async delVideoCategory (id) {
    if (!/^[a-fA-F0-9]{24}$/.test(String(id || ''))) return { code: -1, message: '视频分类 ID 无效' };
    const videoCategory = await this.ctx.model.VideoCategory.findById(id).lean();
    if (!videoCategory) return { code: 404, message: '视频分类不存在' };

    const [videoCount, bookCount, imageCount] = await Promise.all([
      this.ctx.model.Video.countDocuments({ cid: id }),
      this.ctx.model.VideoBook.countDocuments({ categoryId: id }),
      this.ctx.model.VideoImage.countDocuments({ categoryId: id }),
    ]);
    await Promise.all([
      this.ctx.model.Video.updateMany({ cid: id }, { $unset: { cid: 1 } }),
      this.ctx.model.VideoBook.updateMany({ categoryId: id }, { $set: { categoryId: null } }),
      this.ctx.model.VideoImage.updateMany({ categoryId: id }, { $set: { categoryId: null } }),
    ]);
    if (this.ctx.model.CollectSource) {
      const sources = await this.ctx.model.CollectSource.find({ 'videoCategoryMappings.localCategoryId': id }).select('_id videoCategoryMappings').lean();
      await Promise.all(sources.map(source => {
        const mappings = (source.videoCategoryMappings || []).map(mapping => String(mapping.localCategoryId || '') === String(id)
          ? { ...mapping, localCategoryId: null, localName: '', status: 0 }
          : mapping);
        return this.ctx.model.CollectSource.updateOne({ _id: source._id }, { $set: { videoCategoryMappings: mappings } });
      }));
    }
    await this.ctx.model.VideoCategory.deleteOne({ _id: id });
    await this.ctx.service.cache.del('video-category-all');
    return {
      code: 200,
      data: { videoCount, bookCount, imageCount },
      message: `${videoCategory.name} 已删除，关联资源已保留但分类已解除`,
    };
  }
}

module.exports = VideoCategory;
