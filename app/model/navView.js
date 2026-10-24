

module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const NavView = new Schema({
        nid:{ type:Schema.Types.ObjectId }
    },
    {
        collection: 'nav_view',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('nav_view', NavView);
};