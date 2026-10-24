module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const SebobaoApp = new Schema({
        name: { type: String },
        image: { type: String },
        des: { type: String },
        clickNum: { type: Number,default: 1 },
        isFree: { type: Number,default: 1 },
        isTuiJian: { type: Boolean,default:false },
        status: { type: Number,default: 1 },
        sort: { type: Number,default: 1 },
        cid: { type: Number,default: 1 },
        isHot: { type: Number,default: 1 },
        isTop: { type: Number,default: 0 },
        isBanner: { type: Number,default: 0 },
        link: { type: String},
    }, {
        collection: 'sebobao_app',
        usePushEach: true, 
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, 
    });
    return mongoose.model('sebobao_app', SebobaoApp);
}