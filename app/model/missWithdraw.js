

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissWithdraw = new Schema({
    type: {
      type: String,
    },
    coin: {
      type:Number,
    },
    status: {
      type:Number,
    },
    uid: {
      type:Number,
    },
    username: {
      type: String,
    },
    money: {
      type:Number,
    },
    mask: {
      type: String,
    },
    usdtUrl: {
      type: String,
    },
    usdtType: {
      type: String,
    },
  },
  {
    collection: 'miss_withdraw',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('miss_withdraw', MissWithdraw);
}