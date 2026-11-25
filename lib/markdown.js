'use strict';
const { marked } = require('marked');

let renderer = null;
function getRenderer() {
  if (renderer) return renderer;
  renderer = new marked.Renderer();
  const uid = new Map();
  renderer.heading = function (text, level) {
    const plain = String(text).replace(/<[^>]+>/g, '').trim();
    let id = /[\u4e00-\u9fff\w-]+/.exec(plain) ? plain.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') : 'h';
    const n = (uid.get(id) || 0) + 1; uid.set(id, n);
    if (n > 1) id += '-' + n;
    return `<h${level} id="${id}">${text}</h${level}>`;
  };
  renderer.image = function (href, title, text) {
    const src = typeof href === 'object' ? href.href : href;
    const t = typeof href === 'object' ? href.title : title;
    const a = typeof href === 'object' ? href.text : text;
    return `<img src="${src}" alt="${a || ''}"${t ? ` title="${t}"` : ''} loading="lazy">`;
  };
  renderer.table = function (header, body) {
    return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  };
  return renderer;
}

function renderMarkdown(md) {
  if (!md) return '';
  const r = getRenderer();
  return marked.parse(String(md), { gfm: true, breaks: false, renderer: r, headerIds: false, mangle: false });
}

/* 评论等用户输入的消毒：全转义，仅保留换行→<br> */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { renderMarkdown, escapeHtml };
