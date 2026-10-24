

module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const MissProvince = new Schema({
        id: {
            type: Number,
        },
        name: {
            type: String,
        },
        copyid: {
            type: String,
        },
        status: { type:Number },
    },
    {
      collection: 'miss_province',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('miss_province', MissProvince);
};