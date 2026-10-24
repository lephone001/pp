'use strict';

const { Application } = require('egg');

const COUNT = 100;
const IMAGE_URLS = [
  '/uploads/miss/1787218496591-9409190bb436751a.png',
  '/uploads/miss/1787218508175-74e079ea6711e06c.jpg',
  '/uploads/miss/2026-08-20/1787218808700-9ffe26cc2506c02e.jpg',
];

async function main() {
  const app = new Application({
    baseDir: process.cwd(),
    mode: 'single',
  });

  await app.ready();
  const ctx = app.createAnonymousContext();
  const Miss = ctx.model.Miss;
  const cities = await ctx.model.MissCity.find({ status: { $ne: 0 } })
    .sort({ level: 1, provinceId: 1, sort: 1, id: 1 })
    .lean();
  const categories = await ctx.model.MissCategory.find({ status: { $ne: 0 } })
    .sort({ sort: 1, id: 1 })
    .lean();

  const cityRows = cities.filter(item => item.parentId && String(item.parentId) !== '0');
  const usableCities = cityRows.length ? cityRows : cities;
  if (!usableCities.length) throw new Error('没有可用城市，无法生成 miss 数据');

  const now = Date.now();
  const operations = Array.from({ length: COUNT }, (_, index) => {
    const number = index + 1;
    const city = usableCities[index % usableCities.length];
    const category = categories.length ? categories[index % categories.length] : null;
    const cityName = String(city.name || '城市').trim();
    const cityId = Number(city.id || city.copyid || 0);
    const provinceId = Number(city.provinceId || city.parentId || 0);
    const data = {
      title: `${cityName}上门服务展示 ${String(number).padStart(3, '0')}`,
      provinceId,
      cityId,
      type: 1,
      copyid: `seed-miss-${String(number).padStart(3, '0')}`,
      missType: '上门服务',
      job: '专业服务',
      remarks: '演示资料，请在后台编辑为实际内容。',
      overview: 0,
      status: 1,
      image_list: JSON.stringify([IMAGE_URLS[index % IMAGE_URLS.length]]),
      video_list: '',
      price: '面议',
      contact_information: '请通过站内联系方式咨询',
      isShowInfoContent: 1,
      service: '上门服务 / 预约咨询',
      environment: '标准环境',
      service_time: '10:00-23:00',
      safety_assessment: '请遵守平台规则',
      num: '1',
      age: '成年',
      figure: '标准',
      info_from: 'seed-miss-demo',
      detail_address: `${cityName}市区`,
      content: '这是用于页面展示的演示资料，正式发布前请替换标题、图片和服务信息。',
      view: 0,
      isHot: 0,
      missPass: 1,
      isTop: 0,
      time: new Date(now - index * 60 * 1000).toISOString(),
      star: 5,
      bad: 0,
      tags: [cityName, '演示资料'],
    };
    if (category) data.categoryId = Number(category.id || category.copyid || 0);

    return {
      updateOne: {
        filter: { copyid: data.copyid },
        update: { $setOnInsert: data },
        upsert: true,
      },
    };
  });

  const result = await Miss.bulkWrite(operations, { ordered: false });
  console.log(JSON.stringify({
    requested: COUNT,
    inserted: result.upsertedCount || 0,
    skipped: COUNT - (result.upsertedCount || 0),
    total: await Miss.countDocuments(),
  }, null, 2));

  if (app.mongoose && typeof app.mongoose.disconnect === 'function') {
    await app.mongoose.disconnect();
  }
  process.exit(0);
}

main().catch(error => {
  console.error('[seed-miss-demo] failed:', error.stack || error);
  process.exitCode = 1;
});
