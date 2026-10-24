module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const ArticleCbd = new Schema({
        title: {
            type: String,
            required: true,
            trim: true,
        },
        keywords: {
            type: String
        },
        description: {
            type: String
        },
        content: {
            type: String
        },
        image: {
            type: String
        },
        prevName:{
            type: String
        },
        nextName: {
            type: String
        },
        nowName: {
            type: String
        },
        block: {
            type: Object,
            default: {}
        },
        articleCompany: { type: Schema.Types.ObjectId, ref: "articleCompany" },//[{type: Schema.Types.ObjectId, ref: 'User'}],
            fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

    }, {
        collection: 'articleCbd',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });

    ArticleCbd.index({ articleCompany: 1, _id: -1 });

    return mongoose.model('articleCbd', ArticleCbd);
};




