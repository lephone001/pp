module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const CateAndDamain = new Schema({
    domainId: { type: Schema.Types.ObjectId, ref: 'domain' },//[{type: Schema.Types.ObjectId, ref: 'User'}],
    categoryId: { type: Schema.Types.ObjectId, ref: 'articleCategory' },//[{type: Schema.Types.ObjectId, ref: 'User'}],
  },
    {
      collection: 'cate_domain',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  return mongoose.model('cate_domain', CateAndDamain);
}
