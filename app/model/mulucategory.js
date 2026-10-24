

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Mulucategory = new Schema({
    name: {
      type: String, index: true
    },
    uname: {
      type: String, index: true
    },
    status: {
      type: Number, index: true
    },
    uid: { type: Schema.Types.ObjectId },
    num: {
      type: Number
    },
    isHaveFanLink: { type: Boolean, index: true, default: true },
    fromObj:{ type: Object },//id:原始_id server:'来自服务器的ip'
  },
    {
      collection: 'mulu_category',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  Mulucategory.index({ 'fromObj.server': 1, 'fromObj.id': 1 });
  return mongoose.model('mulu_category', Mulucategory);
};
