module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Biyingimg = new Schema({
        title: { type: String,index:true},
        search: { type: String },
        image: { type: String,required: true, unique: true },
        quiz: { type: String },
    },
    {
      collection: 'biyingimg',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('biyingimg', Biyingimg);
  }