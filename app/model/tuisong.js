

module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Tuisong = new Schema({
        domain: {
            type: String,//www.baidu.com  需要加前缀
        },
        token:{
            type: String,
        },
        name:{
            type: String,
        },
        searchType:{//引擎类型
            type: String,
            default: 'baidu'
        },
        siteTypeNum:{//站点类型
            type: Number,
            default: 4
            // { label: "企业文章站", value: 4 },
            // { label: "视频站", value: 6 },
            // { label: "导航站", value: 8 },
            // { label: "单页导航站", value: 9 },
        },
        isMulu:{ type: Boolean, default: true },
        status:{ type: Number, default: 0 },//0 未开启 1开启 -1 推送异常
        tuiNum:{// 剩余推送数量
            type: Number,
            default: 0
        },
        todayTui:{ type: Boolean, default: false },
    },
    {
        collection: 'tuisong',
        usePushEach: true, //解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('tuisong', Tuisong);
};