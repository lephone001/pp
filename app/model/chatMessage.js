module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const ChatMessage = new Schema({
        user_id: { type: String, index: true },
        to_uid: { type: String, index: true },
        content: { type: Number },
        time: { type: Number, index: true },
        image: { type: Array },
        chat_type: { type: String, index: true },
        ip: { type: String },
        browser_info: { type: String },
    }, {
        collection: 'chat_message',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    } // schema 的选项options
    );
    return mongoose.model('chat_message', ChatMessage);
};
