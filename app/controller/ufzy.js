
'use strict';

const Controller = require('egg').Controller;
const axios = require('axios')
class UfzyController extends Controller {
  async feixiaohao() {
    const { ctx } = this;
    let { start = 0, limit = 100, convert } = ctx.query
    let options = {}
    if (start) options.start = start;
    if (limit) options.limit = limit;
    if (convert) options.convert = convert;
    await axios({
      method: 'get',
      url: 'https://fxhapi.feixiaohao.com/public/v1/ticker/',
      params: options
    }).then((res) => {
      this.ctx.body = res.data
    })
  }
  async getFeixiaohaoData() {
    const { ctx } = this;
    let start = [0, 1, 2]
    let limit = 5000
    this.ctx.body = { code: 200, message: '请求成功！' }

    for (let star of start) {
      let start_num = star * limit
      let url = 'https://fxhapi.feixiaohao.com/public/v1/ticker/?start=' + start_num + '&limit=' + limit
      console.log(url)
      await setTimeout(() => { }, 10000)
      await axios({
        method: 'get',
        url
      }).then(async (datalsit) => {
        if (datalsit && datalsit.length > 0) {
           for (let item of datalsit) {
            console.log(item.id + '-成功！')
            await ctx.model.Coindata.create(item)
          }
        }
      }).catch((res)=>{
        console.log('请求错误！'+res.status)
      })
    }
  }
}
module.exports = UfzyController;