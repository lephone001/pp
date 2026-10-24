

module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const sportPlaying = new Schema({
        //创建体育直播表
        ALogo: { type: String },
        Aname: { type: String },
        startTime: {
            type: String,
        },
        type:{type: String},
        typeName:{type:String},
        typeImage: {type: String},
        BLogo: { type: String },
        Bname: { type: String },
        playUrl:{ type: String },
        playId:{ type: String },
    },
    {
        collection: 'sportPlaying',
        usePushEach: true, //解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('sportPlaying', sportPlaying);
};