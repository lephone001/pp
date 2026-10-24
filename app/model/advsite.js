module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Advsite = new Schema({
        aid: { type: Number, index: true },
        sid: { type: Number, index: true },
    }, {
        collection: 'adv_site',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    } // schema 的选项options
    );
    return mongoose.model('adv_site', Advsite);
};
