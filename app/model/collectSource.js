module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const CollectSource = new Schema({
    siteType: { type: Number, default: 11, index: true },
    // siteType=8 下区分视频、小说和图片采集，旧数据默认仍按视频处理。
    collectType: { type: String, enum: [ 'video', 'book', 'image' ], default: 'video', index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    url: { type: String, required: true },
    format: { type: String, enum: [ 'xml', 'json', 'html' ], default: 'xml' },
    method: { type: String, enum: [ 'GET', 'POST' ], default: 'GET' },
    status: { type: Number, default: 1 },
    pageParam: { type: String, default: 'pg' },
    pageSizeParam: { type: String, default: 'limit' },
    pageSize: { type: Number, default: 20 },
    concurrency: { type: Number, default: 8 },
    listPath: { type: String, default: '' },
    headers: { type: Schema.Types.Mixed, default: {} },
    params: { type: Schema.Types.Mixed, default: {} },
    parser: { type: Schema.Types.Mixed, default: {} },
    remoteCategories: {
      type: [ {
        remoteId: { type: String, default: '' },
        remoteName: { type: String, default: '' },
        parentId: { type: String, default: '' },
      } ],
      default: [],
    },
    remoteCategoriesFetchedAt: { type: Date },
    // 远程采集分类 -> 本地电影分类的绑定配置
    categoryMappings: {
      type: [ {
        remoteId: { type: String, default: '' },
        remoteName: { type: String, default: '' },
        localCategoryId: { type: Schema.Types.ObjectId, ref: 'movie_category', default: null },
        localTypeId: { type: String, default: '' },
        localName: { type: String, default: '' },
        status: { type: Number, default: 1 },
      } ],
      default: [],
    },
    // video 使用独立映射字段，避免把 movie_category 的 ObjectId 写入 video 分类。
    videoCategoryMappings: {
      type: [ {
        remoteId: { type: String, default: '' },
        remoteName: { type: String, default: '' },
        localCategoryId: { type: Schema.Types.ObjectId, ref: 'video_category', default: null },
        localName: { type: String, default: '' },
        status: { type: Number, default: 1 },
      } ],
      default: [],
    },
    videoPlatformId: { type: Schema.Types.ObjectId, ref: 'video_platform', default: null },
    sort: { type: Number, default: 0 },
    scheduleEnabled: { type: Number, default: 0 },
    scheduleTime: { type: String, default: '03:00' },
    schedulePages: { type: Number, default: 10 },
    scheduleLastDate: { type: String, default: '' },
    lastPage: { type: Number, default: 0 },
    lastCursor: { type: String, default: '' },
    lastRunAt: { type: Date },
  }, { collection: 'collect_source', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  CollectSource.index({ siteType: 1, code: 1 }, { unique: true, name: 'collect_source_site_code_unique' });
  return mongoose.model('collect_source', CollectSource);
};
