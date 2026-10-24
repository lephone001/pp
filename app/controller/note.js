
'use strict';

const Controller = require('egg').Controller;
class NoteController extends Controller {
    async noteList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.note.noteList(ctx.request.body)
    }
    async createNote() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.note.createNote(ctx.request.body)
    }
    async findNote() {
        const { ctx } = this;
        let id = ctx.request.body.id;
        if(!id) return {
            code:-1,
            message:'id错误！'
        }
        let data = await ctx.service.note.findNote(id)
        this.ctx.body = {
            data,
            code:200,
        }
    }
    async updateNote() {
        const { ctx } = this;
        let options = ctx.request.body
        this.ctx.body = await ctx.service.note.updateNote(options.id, options.updates)
    }
    async delNote() {
        const { ctx } = this;
        let id = ctx.request.body.id;
        if(!id) return {
            code:-1,
            message:'id错误！'
        }
        this.ctx.body = await ctx.service.note.delNote(id)
    }
}
module.exports = NoteController;