

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissUser = new Schema({
    username: {
      type: String,
    },
    password: {
      type: String,
    },
    status: { type: Number },
    isLeader: { type: Number },
    level: { type: Number },
    exp: { type: Number },
    coin: { type: Number },
    isAdmin: { type: Number },
    isVip: { type: Number },
    loginTime: { type: Date },
    lastLoginTime: { type: Date },
    verifyLoginTime: { type: Date },
    vipStartDate: { type: Date },
    vipEndDate: { type: Date },
    forverVip: { type: Number },
    nickname: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    inviteCode: {
      type: String,
    },
    honor: {
      type: String,
    },
    email: {
      type: String,
    },
    registIP: {
      type: String,
    },
    imgsrc: {
      type: String,
    },
    description: {
      type: String,
    }
  },
  {
    collection: 'miss_user',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('miss_user', MissUser);
};