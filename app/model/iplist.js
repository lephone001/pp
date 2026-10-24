module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Iplist = new Schema({
        ip: { type: String,index:true,lowercase: true, required: true, unique: true, trim: true},
        nums: { type: Number },
        headers:{type:String},
        gurl:{type:String,index:true}
    },
    {
      collection: 'iplist',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('iplist', Iplist);
  }