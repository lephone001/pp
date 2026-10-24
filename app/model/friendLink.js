

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const FriendLink = new Schema({
    name: {
      type: String,
    },
    status: { type:Boolean },
    category: {
      type: String,
      allowNull: false,
    },
    isHot:{
      type: Boolean,
      allowNull: false,
    },
    isTop:{
      type: Boolean,
      allowNull: false,
    },
    host:{
      type: String,
      allowNull: false,
      len: [1, 50],
    },
    link: {
      type: String,
      allowNull: false,
      len: [1, 50],
    },
    view:{
      type: Number,
      default: 0,
    },
    fromNum:{
      type: Number,
      default: 0,
    },
    sid:{
      type: Number,
      default: 0,
    }
  },
  {
    collection: 'friendlink',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('FriendLink', FriendLink);
};