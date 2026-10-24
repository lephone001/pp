module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Counters = new Schema({
        id: { type: String, required: true, unique: true, trim: true},
        seq: { type: Number,required: true,index:true},
    }, { 
        collection: 'counters',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
      } // schema 的选项options
    );
    return mongoose.model('counters', Counters);
}