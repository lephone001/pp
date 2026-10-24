'use strict';

/** @type Egg.EggPlugin */
module.exports = {
  // had enabled by egg
  static: {
    enable: true,
  },
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks'
  },
  validate: {
    enable: true,
    package: 'egg-validate',
  },
  jwt: {
    enable: true,
    package: 'egg-jwt',
  },
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  mongoose: {
    enable: true,
    package: 'egg-mongoose'
  },
  redis: {
    enable: true,
    package: 'egg-redis',
  },
  // onerror: {
  //   enable: true,
  //   package: 'egg-onerror',
  // }
};