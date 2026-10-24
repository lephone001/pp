module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const UserAgent = new Schema({
        name: { type: String },
        myOpenDomain: { type: String},
        openUrlPc: { type: String},
        openUrlH5: { type: String},
        openUrlIOS: { type: String},
        openUrlAndroid: { type: String},
        openUrlAPP: { type: String},
        openUrlAgentPage:{ type: String},
        gajs: { type: String},
        username:{ type: String, index: true },
        uid:{ type: Schema.Types.ObjectId, index: true },
        kefuLink:{ type: String },
        noticeDom:{ type: String },
        connect:{ type: String},
        autoChangeUrl:{type:Number,default:0},//自动切换地址
        type:{ type: Number,index: true},
        isAgentPage:{type:Boolean,index:false},
        agentPageName:{type:String,default:'index',index:false},
        commonAdv:{ type: String},
        muluUrlList:{type:Array,default:[]}
    }, {
        collection: 'user_agent_link',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    } // schema 的选项options
    );
    return mongoose.model('user_agent_link', UserAgent);
};
