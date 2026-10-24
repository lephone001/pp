

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissBill = new Schema({
    type: {
      type: String,
    },
    coin: {
      type:Number,
    },
    status: {
      type:Number,
    },
    missid: {
      type:Number,
    },
    money: {
      type:Number,
    },
    uid: {
      type:Number,
    },
    username: {
      type: String,
    },
    mask: {
      type: String,
    },
    
    
  }, 
  {
    collection: 'miss_bill',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('miss_bill', MissBill);
}