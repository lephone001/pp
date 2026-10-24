'use strict';

const Service = require('egg').Service;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v',
]);
const VIDEO_EXTENSIONS = new Set([ '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v' ]);
const SOURCE_UPLOAD_PASSWORD = 'a123456';

function safeName(value) {
  return path.basename(String(value || '')).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class MissUploadService extends Service {
  basePath() {
    return path.join(process.cwd(), 'uploads', 'miss');
  }

  dateFolder(value = new Date()) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  normalizeFiles(files) {
    if (!files) return [];
    if (Array.isArray(files)) return files;
    return Object.keys(files).map(key => files[key]).filter(Boolean);
  }

  filePath(file) {
    return file && (file.filepath || file.path);
  }

  async fileSize(file, filepath) {
    const declared = Number(file && file.size);
    if (Number.isFinite(declared) && declared >= 0) return declared;
    const stat = await fs.promises.stat(filepath);
    return stat.size;
  }

  isSourceUploadPasswordValid(password) {
    const expected = Buffer.from(SOURCE_UPLOAD_PASSWORD);
    const actual = Buffer.from(String(password || ''));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  async sourceUpload() {
    const body = this.ctx.request.body || {};
    if (!this.isSourceUploadPasswordValid(body.password)) {
      return { code: -1, message: '源服务器上传密码错误！' };
    }
    return this.upload({ uploadMode: 'source' });
  }

  async upload(sourceMeta = {}) {
    const { ctx } = this;
    const files = this.normalizeFiles(ctx.request.files);
    if (!files.length) return { code: -1, message: '请选择要上传的文件' };
    if (files.length > 50) return { code: -1, message: '单次最多上传 50 个文件' };

    const dateFolder = this.dateFolder();
    const uploadPath = path.join(this.basePath(), dateFolder);
    await fs.promises.mkdir(uploadPath, { recursive: true });
    const uploaded = [];
    const failed = [];
    const uid = this.service.utils.getTokenInfo('id') || 0;
    const username = this.service.utils.getTokenInfo('username') || '';

    try {
      for (const file of files) {
        const tempPath = this.filePath(file);
        const originalName = safeName(file.filename || file.name || '');
        const ext = path.extname(originalName).toLowerCase();
        let targetPath = '';
        try {
          if (!tempPath || !originalName) throw new Error('文件名称无效');
          if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error('不支持的文件格式');
          const size = await this.fileSize(file, tempPath);
          if (size > MAX_FILE_SIZE) throw new Error('文件不能超过 100MB');

          const randomName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
          targetPath = path.join(uploadPath, randomName);
          await fs.promises.copyFile(tempPath, targetPath);

          const relativePath = path.posix.join('uploads', 'miss', dateFolder, randomName);
          const url = `/uploads/miss/${dateFolder}/${randomName}`;
          const type = VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image';
          const mime = String(file.mime || file.mimetype || '').toLowerCase();
          const row = await ctx.model.Upload.create({
            name: randomName,
            filename: randomName,
            originalName,
            uid: Number(uid) || 0,
            sid: 0,
            username,
            type: type === 'video' ? 2 : 1,
            typeName: type === 'video' ? '美女视频' : '美女图片',
            sitename: 'miss',
            path: url,
            url,
            relativePath,
            storagePath: relativePath,
            ext,
            mime,
            size,
            sizeBytes: size,
            module: 'miss',
            siteType: 12,
            uploadMode: sourceMeta.uploadMode || 'local',
            sourceServer: sourceMeta.sourceServer || undefined,
            sourcePort: sourceMeta.sourcePort,
            sourceDomain: sourceMeta.sourceDomain || undefined,
            status: 1,
          });
          uploaded.push({
            id: row._id,
            name: randomName,
            originalName,
            url,
            type,
            ext,
            mime,
            size,
            uploadMode: sourceMeta.uploadMode || 'local',
            sourceServer: sourceMeta.sourceServer || '',
            sourcePort: sourceMeta.sourcePort,
            sourceDomain: sourceMeta.sourceDomain || '',
            createdAt: row.createdAt,
          });
        } catch (error) {
          if (targetPath) await fs.promises.unlink(targetPath).catch(() => {});
          failed.push({ name: originalName, message: error.message || '上传失败' });
        }
      }
    } finally {
      if (typeof ctx.cleanupRequestFiles === 'function') await Promise.resolve(ctx.cleanupRequestFiles()).catch(() => {});
    }

    if (!uploaded.length) {
      return { code: -1, message: failed[0] ? failed[0].message : '文件上传失败', data: { files: [], failed } };
    }
    return {
      code: 200,
      message: failed.length ? '部分文件上传成功' : '上传成功',
      data: { files: uploaded, failed, count: uploaded.length },
    };
  }

  async list(input = {}) {
    const page = Math.max(1, Number(input.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
    const query = { module: 'miss', siteType: 12 };
    const keyword = String(input.keyword || input.name || '').trim();
    if (keyword) {
      const reg = new RegExp(escapeRegExp(keyword), 'i');
      query.$or = [{ originalName: reg }, { filename: reg }, { name: reg }];
    }
    if (input.type === 'image' || input.type === 'video') query.typeName = input.type === 'video' ? '美女视频' : '美女图片';
    const [ data, count ] = await Promise.all([
      this.ctx.model.Upload.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ctx.model.Upload.countDocuments(query),
    ]);
    return { code: 200, data: { data, rows: data, count, page, limit } };
  }

  async stream(filename) {
    const requested = String(filename || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = requested.split('/');
    const validParts = parts.length === 1 || (
      parts.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])
    );
    if (!requested || !validParts || parts.some(part => !part || safeName(part) !== part)) {
      this.ctx.status = 404;
      return;
    }
    const basePath = this.basePath();
    const targetPath = path.resolve(basePath, ...parts);
    const resolvedBasePath = path.resolve(basePath);
    if (!targetPath.startsWith(`${resolvedBasePath}${path.sep}`) || !fs.existsSync(targetPath)) {
      this.ctx.status = 404;
      return;
    }
    this.ctx.type = path.extname(targetPath);
    this.ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
    this.ctx.body = fs.createReadStream(targetPath);
  }
}

module.exports = MissUploadService;
