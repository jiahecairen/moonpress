'use strict';
/* Moonpress 编程入口：require('moonpress') 拿到核心能力 */
module.exports = {
  init: require('./init').init,
  generate: require('./generate').generate,
  server: require('./server').serve,
  loadConfig: require('./config').loadConfig,
  listThemes: require('./config').listThemes,
  source: require('./source'),
  render: require('./render'),
};
