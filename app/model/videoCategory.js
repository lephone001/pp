

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const VideoCategory = new Schema({
    name: {
      type: String,
    },
    copyid: {
      type: String,
    },
    type: { type: Number},
    pid: { type:Schema.Types.ObjectId},
    typeName: {
      type: String,
    },
    status: { type:Number },
    isHot: { type: Number },
    view: { type:Number },
    num: { type:Number },
    remoteParentId: { type: String, default: '' },
    collectSourceId: { type: String, default: '', index: true },
            fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

  },
  {
    collection: 'video_category',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('video_category', VideoCategory);
};
