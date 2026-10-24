




module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const ArticleCompany= new Schema({
  companyId: {
    type: String,
    index: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  content: {
    type: Array,
    default: [],//{name }  内容列表 字段
  },
  tdk:{
    type: Array,
    default: [],//{title:"",description:"",keywords:""}
  },
  fileName:{ type: String  },//文件夹
  imgTypeName: { type: String, default: 'bdmn-151' },
  isFileName:{ type: Boolean,default:false  },
  tdkNums: {
    type: Number,
    default: 0,
  },
  templateSection:{
    type: Array,
    default: [], //文章章节 {field:'tp_1',name:'',content:[]}
  },
  templates: {
    type: Array,
    default: [], //文章模板列表
  },
  status: {
    type: Number,
    default: 1,
  },
          fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

},  {
    collection: 'articleCompany',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });

  return mongoose.model('articleCompany', ArticleCompany);
};




