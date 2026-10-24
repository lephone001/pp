module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Image = new Schema({
        view: { type: Number},
        status: { type: Boolean},
        list: { type: Array},
        preview: { type:String},
        previewWidth:{type:Number},
        previewHeight:{type:Number},
        size:{type: Number,index:true},
        isHot:{type: Boolean},
        isBad:{type: Boolean},
        cid:{type:Number},
        num:{type:Number},
        cname:{type:String},
        tag:{type:Array}
    }, { 
        collection: 'image',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
      } // schema 的选项options
    );
    return mongoose.model('image', Image);
}