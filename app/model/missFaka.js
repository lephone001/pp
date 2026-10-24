

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissFaka = new Schema({
    type: {
      type:Number,
    },
    money: {
      type:Number,
    },
    password: {
      type: String,
    },
    name: {
      type: String,
    },
    status: {
      type: Number,
    },
    uid: {
      type:Number,
    },
    username: {
      type: String,
    },
    
    
  },
  {
    collection: 'miss_faka',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('miss_faka', MissFaka);
}