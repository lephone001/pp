

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Video = new Schema({
    collectType: { type: String, enum: [ 'video', 'book', 'image' ], default: 'video', index: true },
    title: {
      type: String,
      index: true,
    },
    copyid: {
      type: String,
    },
    time: { type: String },
    status: { type: Number },
    content: { type: String },
    image: { type: String },
    video: { type: String },
    description: { type: String ,default:""},
    keywords: { type: String ,default:""},
    tag: { type: String },
    view: { type: Number },
    star: { type: Number },
    bad: { type: Number },
    cid: { type: Schema.Types.ObjectId,ref: 'video_category' },//0 全部 
    isHot: { type: Number },//0 全部 
    pid: { type: Schema.Types.ObjectId,ref: 'video_platform'  },//0 全部 
    viewUrl: { type: String },
    videoTime: { type: String },
    fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

    // 采集扩展字段：保留原有 video 字段，同时记录来源和远程 vod 数据。
    collectSourceId: { type: String, index: true },
    collectVodId: { type: String, index: true },
    sourceName: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    vodId: { type: String, default: '' },
    subName: { type: String, default: '' },
    enName: { type: String, default: '' },
    typeId: { type: String, default: '' },
    typeName: { type: String, default: '' },
    firstLetter: { type: String, default: '' },
    year: { type: String, default: '' },
    area: { type: String, default: '' },
    lang: { type: String, default: '' },
    actor: { type: String, default: '' },
    director: { type: String, default: '' },
    writer: { type: String, default: '' },
    remarks: { type: String, default: '' },
    score: { type: Number, default: 0 },
    isEnd: { type: Number, default: 0 },
    episodeCount: { type: Number, default: 0 },
    cover: { type: String, default: '' },
    coverBig: { type: String, default: '' },
    publishTime: { type: Date },
    updateTime: { type: Date },
    playFrom: { type: String, default: '' },
    playUrl: { type: String, default: '' },
    playSources: { type: [ Schema.Types.Mixed ], default: [] },
    rawData: { type: Schema.Types.Mixed, default: {} },

  },
    {
      collection: 'video_video',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  // 仅约束带有采集键的数据，不影响历史手工 video 文档。
  Video.index({ collectSourceId: 1, collectVodId: 1 }, { unique: true, sparse: true, name: 'video_collect_source_vod_unique' });
  return mongoose.model('video_video', Video);
};
