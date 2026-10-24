'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissCity = new Schema({
    id: {
      type: Number,
      index: true,
    },
    name: {
      type: String,
    },
    copyid: {
      type: String,

    },
    provinceId: {
      type: Number,
    },
    parentId: {
      type: String,
      default: '0',
      index: true,
    },
    level: {
      type: Number,
      default: 0,
    },
    sort: {
      type: Number,
      default: 0,
    },
    hot: {
      type: Number,
      default: 0,
      index: true,
    },
    status: { type: Number },
  }, {
    collection: 'miss_city',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间
  });
  return mongoose.model('miss_city', MissCity);
};
