'use strict';
/* 示例插件：外链安全 —— post_render 给站外链接补 rel="noopener" 并新窗口打开 */
module.exports = function externalLinks(api, config) {
  const host = String(config.url || '').replace(/^https?:\/\//, '').split('/')[0];
  api.filter('post_render', html => {
    if (!host) return html;
    return html.replace(/<a href="(https?:\/\/[^"]+)"/g, (m, href) => {
      try { return new URL(href).hostname.endsWith(host) ? m : '<a href="' + href + '" target="_blank" rel="noopener nofollow"'; }
      catch (e) { return m; }
    });
  });
};
