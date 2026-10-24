module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const ChatUser = new Schema({
        user_id: { type: String, index: true },
        status:{ type: String, index: true },
        online:{ type:Boolean,index:true},
        username:{
            type:String,index:true
        },
        password:{type:String},
        is_admin:{ type:Boolean,index:true},
        ip: { type: String },
        browser_info: { type: String },
    }, {
        collection: 'chat_user',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    } // schema 的选项options
    );
    return mongoose.model('chat_user', ChatUser);
};
