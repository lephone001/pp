module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Ids = new Schema({
        _id: { type: String},
        seq: { type: Number,index:true},
    }, { 
        collection: 'ids',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
      } // schema 的选项options
    );
    return mongoose.model('ids', Ids);
}