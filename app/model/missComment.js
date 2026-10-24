

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissComment = new Schema({
      //创建导航表
      id: {
        type: Number,
        primaryKey: true,
        autoIncrement: true,
      },
      status: { type: Number },
      isTop: { type: Number },
      isHot: { type: Number },
      star: { type: Number},
      bad: { type: Number},
      missId: { type: Number },
      
      
      uid: { type: Number },
      isReply: { type: Number },
      missTitle: { type: Number },
      content: { type: String },

      replayCommentId: { type: Number },

      nickname: {
        type: String,
      },
    }, 
    {
      collection: 'miss_comment',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('miss_comment', MissComment);
};
