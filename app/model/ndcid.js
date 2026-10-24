

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Ndcid = new Schema({
    did: { type: Schema.Types.ObjectId, index: true, ref: 'domain' },//站点域名id
    cid: { type: Schema.Types.ObjectId, index: true, ref: 'articleCategory' },//分类id
    pcid: { type: Schema.Types.ObjectId, index: true , ref: 'articleCategory'},//父级分类id
  },
    {
      collection: 'ndc_id',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  return mongoose.model('ndc_id', Ndcid);
};
