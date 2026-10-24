module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Qiniu = new Schema({
        name:{type:String},
        url:{type:String},
        type:{type:String},
        path:{type:String},
        width:{type:Number},
        height:{type:Number},
        size:{type: Number,index:true},
    }, { 
        collection: 'qiniu',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
      } // schema 的选项options
    );
    return mongoose.model('qiniu', Qiniu);
}