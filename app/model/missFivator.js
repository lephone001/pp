

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissFivator = new Schema({
    missId: {
      type: Number,
      primaryKey: true
    },
    userId: {
      type: Number,
      primaryKey: true
    },
  },
  {
    collection: 'miss_favator',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('miss_favator', MissFivator);
}