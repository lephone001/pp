

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const GaLive = new Schema({
    ip: {
      type: String,
      index: true
    },
    roomNumber: {
      type: String,
      index: true
    },
    ua: {
      type: String,
    },
    type: {
      type: String,
    },
    uuid: {
      type: String,
    },
    device: {
      type: String, // pc h5 android ios
    },
    username: {
      type: String,
    }
  },
    {
      collection: 'ga_live',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  return mongoose.model('ga_live', GaLive);
};