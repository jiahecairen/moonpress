'use strict';
/* 示例插件：阅读时间 —— filter post_init 给每篇文章标注阅读分钟数 */
module.exports = function readingTime(api) {
  const WPM = 380; // 中文每分钟约 380 字
  api.filter('post_init', post => {
    post.reading_minutes = Math.max(1, Math.round(post.raw.length / WPM));
    return post;
  }, 20);
};
