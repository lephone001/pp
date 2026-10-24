

module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const VideoImage = new Schema({
        collectType: { type: String, enum: [ 'video', 'book', 'image' ], default: 'image', index: true },
        id: {
            type: Number,
        },
        title: {
            type: String,
        },
        copyid: {
            type: String,
        },
        time: {type: String},
        status: { type: Number },
        content: { type: String },
        image: { type: String },
        image_list: { type: String },
        description: { type: String, default: '' },
        keywords: { type: String, default: '' },
        categoryId: { type: Schema.Types.ObjectId, ref: 'video_category', default: null, index: true },
        collectSourceId: { type: String, index: true },
        collectVodId: { type: String, index: true },
        sourceName: { type: String, default: '' },
        sourceUrl: { type: String, default: '' },
        vodId: { type: String, default: '' },
        typeId: { type: String, default: '' },
        typeName: { type: String, default: '' },
        publishTime: { type: Date },
        updateTime: { type: Date },
        rawData: { type: Schema.Types.Mixed, default: {} },
        width: { type: Number },
        tag: { type: String },
        view: { type: Number },
        star: { type: Number },
        bad: { type: Number },
        isHot: { type: Number },//0 全部 
        cid: { type: Number },//0 全部 
        pid: { type: Number },//0 全部 
                fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

    },
    {
        collection: 'video_image',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    VideoImage.index({ collectSourceId: 1, collectVodId: 1 }, { unique: true, sparse: true, name: 'video_image_collect_source_vod_unique' });
    return mongoose.model('video_image', VideoImage);
};
