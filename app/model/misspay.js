

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Misspay = new Schema({
    missId: {
      type: Number,
    },
    userId: {
      type: Number,
    }
  }, 
  {
    collection: 'miss_pay',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('miss_pay', Misspay);
}