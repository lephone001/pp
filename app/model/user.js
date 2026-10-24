

module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const User = new Schema({
        username: { type: String,required: true,min: [6, '用户名长度不够！'],max: [18, '用户名长度太多！'], },
        password: {type: String,required: true,},
        user_type: { type: Number },
        status: { type: Number },
        online: { type: Number },
        level: { type: Number },
        allowSiteNum: { type: Number },
        alreadySiteNum: { type: Number },
        coin: { type: Number },
        is_admin: { type: Boolean,default: false },
        last_login_time: { type: Number },
        login_time: { type: Number },
        verify_login_time: { type: Number },
        nickname: {
            type: String
        },
        email: {
            type: String
        },
        loginIp: {
            type: String
        },
        registIp: {
            type: String
        },
        imgsrc: {
            type: String,default:''
        },
        description: {
            type: String,default:''
        }
    },
    {
        collection: 'user',
        usePushEach: true, //解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('user', User);
};