module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Adv = new Schema({
        name: { type: String },
        //站点配置相关
        status: { type: Number, index: true },
        sort: { type: Number, index: true },
        view: { type: Number, index: true },
        advType: { type: Number, index: true },
        advPosition: { type: Number, index: true },
        isHot: { type: Number, index: true },
        isTop: { type: Number, index: true },
        isIframeHideAdv: { type: Number, index: true },
        content: { type: String },
        uid: { type: Number, index: true },
        sid: { type: Number, index: true },
        cid: { type: Number, index: true },
        image: { type: String },
        link: { type: String },
        description: { type: String },
    }, {
        collection: 'adv',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    } // schema 的选项options
    );
    return mongoose.model('adv', Adv);
};
