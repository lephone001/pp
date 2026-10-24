

module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const App = new Schema({
      title: {
        type: String,
        require:true
      },
      reltitle: {
        type: String
      },
      status: { type:Number,default:1 },
      view:{ type:Number,default:0 },
      tags:{
        type:Array,
        default:[]
      },
      uname:{
        type: String,
      },
      ncids:[{ type: Schema.Types.ObjectId, ref: 'appCategory' }],
      isProxy:{
        type:Boolean,//是否需要翻墙
        default:false
      },
      isT:{
        type:Boolean,
        default:false
      },
      isH:{
        type:Boolean,
        default:false
      },
      isN:{
        type:Boolean,
        default:false
      },
      sort:{
        type:Number,
        default:0
      },
      isOpenUrl:{
        type:Number,
        default:0
      },
      image: {
        type: String,
        default:''
      },
      addIP: {
        type: String,
        default:''
      },
      category: {
        type: String,
        default:''
      },
      imageList:{
        type:Array,
        default:[]
      },
      link: {//地址
        type: String,
        len: [1, 100]
      },
      slink: {//备用地址
        type: String,
        len: [1, 100]
      },
      h5: {
        type: String,
        len: [1, 100],
        default:''
      },
      app: {
        type: String,
        len: [1, 100],
        default:''
      },
      logo: {
        type: String,
        default:''
      },
      h5logo: {
        type: String,
        default:''
      },
      themeColor:{
        type: String,
      },
      applogo:{
        type: String,
        default:''
      },
      keywords:{
        type: String,
        default:''
      },
      bad:{
        type:Number,
        default:0
      },
      star:{
        type:Number,
        default:0
      },
      description: {
        type: String,
        default:'',
        len: [1, 180],
      },
      copyid:{
        default:'',
        type:String
      },
      time:{
        default:'',
        type:String
      },
      content:{
        default:'',
        type:String
      },
      content2:{
        default:'',
        type:String
      },
      id:{ type: String},
    fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

    },
    {
      collection: 'app',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('app', App);
  };