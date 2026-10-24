

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const VideoPlatform = new Schema({
    name: {
      type: String,
    },
    shortName: {
      type: String,
    },
    siteType: { type: Number },
    updateType: { type: Number },
    typeName: {
      type: String,
    },
    link: {
      type: String,
    },
    status: { type: Number },
    num:{ type: Number },
    collectSourceId: { type: String, default: '', index: true },
    collectSourceCode: { type: String, default: '' },
            fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

  },
  {
    collection: 'video_platform',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('video_platform', VideoPlatform);
};


