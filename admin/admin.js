/* Moonpress 控制台 SPA —— 零依赖 */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let CSRF = null;

async function api(path, opts = {}) {
  const o = Object.assign({ headers: {} }, opts);
  if (o.body && !(o.body instanceof FormData)) {
    o.headers['content-type'] = 'application/json';
    o.body = JSON.stringify(o.body);
  }
  if (CSRF) o.headers['x-csrf-token'] = CSRF;
  const r = await fetch('/api/admin/' + path, o);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login') { showLogin(); throw new Error('unauthorized'); }
  if (!r.ok) { toast(j.error || r.status, true); throw new Error(j.error || r.status); }
  return j;
}
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.borderColor = bad ? 'var(--bad)' : 'var(--accent)';
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2600);
}
const TITLES = { dash: '仪表盘', posts: '文章', editor: '编辑器', pages: '页面', media: '媒体库', comments: '评论', themes: '主题', settings: '设置' };

/* ── 登录 ── */
function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginErr').textContent = '';
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: $('#pw').value }) });
    const j = await r.json();
    if (!r.ok) { $('#loginErr').textContent = j.error === 'too_many_attempts' ? '尝试过多，稍后再试' : '密码不对'; return; }
    CSRF = j.csrf;
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    route();
  } catch (err) { $('#loginErr').textContent = '无法连接服务器'; }
});
$('#logout').addEventListener('click', async () => { await fetch('/api/admin/logout', { method: 'POST' }); location.reload(); });

/* ── 路由 ── */
const VIEWS = {};
async function route() {
  const h = location.hash.replace(/^#\/?/, '') || '';
  const [name, qs] = h.split('?');
  const v = name || 'dash';
  if (!(v in VIEWS)) return location.hash = '#/';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === v || (v === 'editor' && a.dataset.v === 'posts')));
  $('#viewTitle').textContent = TITLES[v];
  $('#newPost').style.display = v === 'editor' ? 'none' : '';
  $('#view').innerHTML = '<p class="dim">载入中…</p>';
  try { await VIEWS[v](Object.fromEntries(new URLSearchParams(qs || ''))); }
  catch (e) { if (String(e.message) !== 'unauthorized') $('#view').innerHTML = `<p class="err">载入失败：${esc(e.message)}</p>`; }
}
window.addEventListener('hashchange', route);
$('#newPost').addEventListener('click', () => location.hash = '#/editor?type=post');

/* ── 仪表盘 ── */
VIEWS.dash = async () => {
  const s = await api('stats');
  const all = await api('posts');
  window._srcMap = {}; all.posts.forEach(p => window._srcMap[p.title] = p.source_rel);
  $('#cbadge').textContent = s.comments_pending || '';
  $('#cbadge').classList.toggle('hidden', !s.comments_pending);
  $('#view').innerHTML = `
  <div class="cards">
    <div class="card"><b>${s.posts}</b><span>已发布文章</span></div>
    <div class="card"><b>${s.drafts}</b><span>草稿</span></div>
    <div class="card"><b>${s.pages}</b><span>页面</span></div>
    <div class="card"><b>${s.uploads}</b><span>媒体文件</span></div>
    <div class="card"><b>${s.comments_pending}</b><span>待审评论</span></div>
    <div class="card"><b>${(s.words / 1000).toFixed(1)}k</b><span>全站字数</span></div>
  </div>
  <h3 style="margin-bottom:10px">最近内容</h3>
  <table><tbody>${s.recent.map(p => `<tr>
    <td style="width:70px"><span class="dot ${p.status === '草稿' ? 'dft' : 'pub'}"></span>${p.status}</td>
    <td><a href="#/editor?src=${encodeURIComponent(window._srcMap[p.title] || '')}">${esc(p.title)}</a></td>
    <td class="dim">${(p.date || '').slice(0, 10)}</td></tr>`).join('')}</tbody></table>
  <p style="margin-top:18px" class="dim">当前主题：<b>${esc(s.theme_name)}</b>（<a href="#/themes" style="color:var(--accent)">去换</a>）</p>`;
};

/* ── 文章列表 ── */
VIEWS.posts = async (q) => {
  const st = q.status || 'all';
  const { posts } = await api('posts?status=' + (st === 'all' ? '' : st));
  window._srcMap = {}; posts.forEach(p => window._srcMap[p.title] = p.source_rel);
  $('#view').innerHTML = `
  <div style="margin-bottom:14px;display:flex;gap:8px">
    ${['all', 'published', 'draft'].map(x => `<button class="btn sm ${st === x ? 'primary' : ''}" onclick="location.hash='#/posts${x !== 'all' ? '?status=' + x : ''}'">${x === 'all' ? '全部' : x === 'published' ? '已发布' : '草稿'}</button>`).join('')}
  </div>
  <table><thead><tr><th>标题</th><th>分类 / 标签</th><th>状态</th><th>字数</th><th>评论</th><th></th></tr></thead><tbody>
  ${posts.map(p => `<tr>
    <td><a href="#/editor?src=${encodeURIComponent(p.source_rel)}">${esc(p.title || p.slug)}</a>
      <div class="dim" style="font-size:11px">/${esc(p.path)}</div></td>
    <td>${p.cats.map(c => `<span class="tag">${esc(c)}</span>`).join('')}${p.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</td>
    <td>${p.draft ? '🌒 草稿' : '🌕 已发布'}</td>
    <td class="dim">${p.words}</td>
    <td>${p.pending ? `<span class="tag" style="border-color:var(--bad)">${p.pending} 待审</span>` : '—'}</td>
    <td class="row-actions">
      <a class="btn sm" href="/${esc(p.path)}" target="_blank">预览</a>
      <button class="btn sm danger" onclick="delPost('${esc(p.source_rel)}','${esc(p.title)}')">删</button></td></tr>`).join('')}
  </tbody></table>`;
};
window.delPost = async (src, title) => {
  if (!confirm(`删除《${title}》？文件将从磁盘移除，不可恢复。`)) return;
  await api('post/delete', { method: 'POST', body: { source_rel: src } });
  toast('已删除'); route();
};

/* ── 编辑器 ── */
VIEWS.editor = async (q) => {
  const src = q.src || '';
  let data = {}, body = '', type = q.type || 'post';
  if (src) { const r = await api('post?src=' + encodeURIComponent(src)); data = r.data || {}; body = r.body || ''; type = src.startsWith('source/_posts') || src.startsWith('_posts') ? 'post' : 'page'; }
  $('#view').innerHTML = `
  <div class="editor">
    <div class="body-col">
      <input id="edTitle" placeholder="标题…" value="${esc(data.title || '')}">
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn sm" id="btnBold">B</button><button class="btn sm" id="btnH2">H2</button>
        <button class="btn sm" id="btnLink">链接</button><button class="btn sm" id="btnImg">图片</button>
        <button class="btn sm" id="btnCode">代码</button>
        <label class="check dim" style="margin-left:auto;font-size:12px"><input type="checkbox" id="showPrev" checked> 实时预览</label>
      </div>
      <textarea id="edBody" placeholder="用 Markdown 写…支持表格、图片、任务列表">${esc(body)}</textarea>
      <div class="preview hidden" id="prev"></div>
    </div>
    <div class="meta-col">
      <div class="meta-box"><h4>发布</h4>
        <div class="row-actions" style="margin-bottom:10px">
          <button class="btn primary" id="btnPublish">发布 / 更新</button>
          <button class="btn" id="btnDraft">存草稿</button>
        </div>
        <p class="dim" style="font-size:11px">${src ? esc(src) : '新' + (type === 'page' ? '页面' : '文章') + ' · Ctrl+S 保存'}</p></div>
      <div class="meta-box"><h4>分类</h4><input id="edCats" placeholder="逗号分隔" value="${esc([].concat(data.categories || data.category || []).join(', '))}"></div>
      <div class="meta-box"><h4>标签</h4><input id="edTags" placeholder="逗号分隔" value="${esc([].concat(data.tags || []).join(', '))}"></div>
      <div class="meta-box"><h4>封面图 URL</h4><input id="edCover" placeholder="/uploads/xxx.jpg" value="${esc(data.cover || '')}">
        <a class="btn sm" style="display:inline-block;margin-top:8px" href="#/media">去媒体库选</a></div>
      <div class="meta-box"><h4>选项</h4>
        <label class="check"><input type="checkbox" id="edFeatured" ${data.featured ? 'checked' : ''}> 首页精选</label>
        <label class="check"><input type="checkbox" id="edComments" ${data.comments === false ? '' : 'checked'}> 允许评论</label>
        <div style="margin-top:8px"><label class="dim" style="font-size:12px">精选排序（1=最强）</label><input id="edOrder" type="number" value="${data.order || ''}" placeholder="99"></div></div>
      <div class="meta-box"><h4>别名 slug</h4><input id="edSlug" value="${esc(data.slug || '')}" placeholder="留空=按标题生成"></div>
    </div>
  </div>`;

  const ta = $('#edBody');
  const wrap = (pre, post = '') => { const s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + pre + ta.value.slice(s, e) + post + ta.value.slice(e);
    ta.focus(); ta.setSelectionRange(s + pre.length, e + pre.length); preview(); };
  $('#btnBold').onclick = () => wrap('**', '**');
  $('#btnH2').onclick = () => wrap('\n## ');
  $('#btnLink').onclick = () => wrap('[', '](https://)');
  $('#btnImg').onclick = () => wrap('\n![描述](', '/uploads/… )');
  $('#btnCode').onclick = () => wrap('\n```\n', '\n```\n');

  let prevT = null;
  async function preview() {
    if (!$('#showPrev').checked) return;
    clearTimeout(prevT);
    prevT = setTimeout(async () => {
      const r = await api('preview', { method: 'POST', body: { body: ta.value } });
      $('#prev').classList.remove('hidden');
      $('#prev').innerHTML = r.html;
    }, 350);
  }
  ta.addEventListener('input', preview);
  $('#showPrev').addEventListener('change', e => $('#prev').classList.toggle('hidden', !e.target.checked));
  if (body) preview();

  const collect = () => ({
    title: $('#edTitle').value.trim() || '未命名',
    categories: $('#edCats').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
    tags: $('#edTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
    cover: $('#edCover').value.trim() || undefined,
    featured: $('#edFeatured').checked ? true : undefined,
    order: $('#edOrder').value ? Number($('#edOrder').value) : undefined,
    comments: $('#edComments').checked ? undefined : false,
    slug: $('#edSlug').value.trim() || undefined,
  });
  const save = async (publish) => {
    const r = await api('post', { method: 'POST', body: { source_rel: src || null, type, data: collect(), body: ta.value, publish } });
    history.replaceState(null, '', '#/editor?src=' + encodeURIComponent(r.source_rel));
    toast(publish ? '已发布 ✓' : '草稿已存 ✓');
    VIEWS.editor({ src: r.source_rel, type });
  };
  $('#btnPublish').onclick = () => save(true);
  $('#btnDraft').onclick = () => save(false);
  document.addEventListener('keydown', function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(true); }
    if (!document.querySelector('#edBody')) document.removeEventListener('keydown', onKey);
  });
};

/* ── 页面 ── */
VIEWS.pages = async () => {
  const { pages } = await api('pages');
  $('#view').innerHTML = `
  <button class="btn primary" style="margin-bottom:14px" onclick="location.hash='#/editor?type=page'">+ 新页面</button>
  <table><thead><tr><th>标题</th><th>路径</th><th>更新</th></tr></thead><tbody>
  ${pages.map(p => `<tr><td><a href="#/editor?src=${encodeURIComponent(p.source_rel)}">${esc(p.title || p.source_rel)}</a></td>
    <td class="dim">/${esc(p.path)}</td><td class="dim">${(p.updated || '').slice(0, 10)}</td></tr>`).join('') || '<tr><td colspan=3 class="dim">还没有页面</td></tr>'}
  </tbody></table>`;
};

/* ── 媒体库 ── */
VIEWS.media = async () => {
  const { uploads } = await api('media');
  $('#view').innerHTML = `
  <div class="drop" id="drop">拖拽图片到这里，或点击选择文件（jpg/png/webp/svg/gif…）
    <input type="file" id="file" multiple hidden></div>
  <div class="grid">${uploads.map(u => {
    const img = /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(u.path);
    return `<div class="m-item">${img ? `<img src="${esc(u.path)}" loading="lazy">` : '<div class="ph">📎</div>'}
      <div class="info">${esc(u.path.split('/').pop())}<br>${(u.bytes / 1024).toFixed(0)} KB</div>
      <div class="acts"><button class="btn sm" onclick="copyPath('${esc(u.path)}')">复制路径</button>
      <button class="btn sm danger" onclick="delMedia('${esc(u.path)}')">删</button></div></div>`;
  }).join('') || '<p class="dim">媒体库是空的，上传第一张图吧。</p>'}</div>`;

  const drop = $('#drop'), file = $('#file');
  drop.onclick = () => file.click();
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('on'); };
  drop.ondragleave = () => drop.classList.remove('on');
  drop.ondrop = async e => { e.preventDefault(); drop.classList.remove('on'); await upload(e.dataTransfer.files); };
  file.onchange = () => upload(file.files);
  async function upload(files) {
    for (const f of files) {
      const fd = new FormData(); fd.append('file', f);
      await api('media', { method: 'POST', body: fd });
    }
    toast(`已上传 ${files.length} 个文件`); VIEWS.media();
  }
};
window.copyPath = p => { navigator.clipboard.writeText(p).then(() => toast('路径已复制：' + p)); };
window.delMedia = async p => {
  if (!confirm('删除 ' + p + '？')) return;
  await api('media/delete', { method: 'POST', body: { path: p } }); toast('已删除'); VIEWS.media();
};

/* ── 评论 ── */
VIEWS.comments = async () => {
  const { pending, approved } = await api('comments');
  $('#cbadge').textContent = pending.length || ''; $('#cbadge').classList.toggle('hidden', !pending.length);
  const row = c => `<tr><td><b>${esc(c.author)}</b><div class="dim" style="font-size:11px">${esc(c.post_title || c.slug)}</div></td>
    <td>${esc(c.text)}<div class="dim" style="font-size:11px">${(c.date || '').slice(0, 16).replace('T', ' ')}</div></td>
    <td class="row-actions">
      ${c.status !== 'approved' ? `<button class="btn sm primary" onclick="cmtAct('${esc(c.slug)}','${esc(c.id)}','approve')">通过</button>` : ''}
      <button class="btn sm danger" onclick="cmtAct('${esc(c.slug)}','${esc(c.id)}','delete')">删</button></td></tr>`;
  $('#view').innerHTML = `
  <h3 style="margin-bottom:10px">待审 ${pending.length}</h3>
  <table><tbody>${pending.map(row).join('') || '<tr><td class="dim">没有待审评论，收件箱干净 ✨</td></tr>'}</tbody></table>
  <h3 style="margin:22px 0 10px">最近通过</h3>
  <table><tbody>${approved.map(row).join('') || '<tr><td class="dim">还没有通过的评论</td></tr>'}</tbody></table>`;
};
window.cmtAct = async (slug, id, action) => {
  await api('comment', { method: 'POST', body: { slug, id, action } }); toast('已处理'); VIEWS.comments();
};

/* ── 主题 ── */
VIEWS.themes = async () => {
  const { themes, active } = await api('themes');
  $('#view').innerHTML = `<div class="t-grid">${themes.map(t => `
    <div class="t-card ${t.name === active ? 'on' : ''}">
      <h3>${esc(t.display)} ${t.name === active ? '<span class="tag" style="border-color:var(--accent);color:var(--accent)">使用中</span>' : ''}</h3>
      <p>${esc(t.description)}<br><span class="dim">${esc(t.author)} · v${esc(t.version)}</span></p>
      <div class="row-actions">
        ${t.name === active ? `<a class="btn sm" href="/" target="_blank">预览</a>` :
        `<button class="btn sm primary" onclick="useTheme('${esc(t.name)}')">启用</button>`}
        <a class="btn sm" href="/?theme-preview" target="_blank" onclick="useTheme('${esc(t.name)}')">看效果</a>
      </div></div>`).join('')}</div>
  <p class="dim" style="margin-top:16px">主题放在 <code>站点/themes/&lt;名字&gt;/</code> 或引擎 <code>themes/</code> 下；同名时站点覆盖引擎。详见 docs/themes.md。</p>`;
};
window.useTheme = async name => {
  await api('theme', { method: 'POST', body: { name } });
  toast('主题已切换为 ' + name); VIEWS.themes();
};

/* ── 设置 ── */
VIEWS.settings = async () => {
  const s = await api('settings');
  $('#view').innerHTML = `<div class="form">
    <div><label>站点标题</label><input id="stTitle" value="${esc(s.title)}"></div>
    <div><label>副标题</label><input id="stSub" value="${esc(s.subtitle)}"></div>
    <div><label>作者</label><input id="stAuthor" value="${esc(s.author)}"></div>
    <div><label>站点描述（SEO）</label><input id="stDesc" value="${esc(s.description || '')}"></div>
    <div><label>正式域名（用于 RSS / sitemap，上线时改）</label><input id="stUrl" value="${esc(s.url)}"></div>
    <div><label>固定链接</label><select id="stPm">
      <option value="date" ${s.permalink === 'date' ? 'selected' : ''}>/2026/11/文章名/（默认）</option>
      <option value="pretty" ${s.permalink === 'pretty' ? 'selected' : ''}>/文章名/</option>
      <option value="ugly" ${s.permalink === 'ugly' ? 'selected' : ''}>文章名.html</option></select></div>
    <div><label>首页每页文章数</label><input id="stPer" type="number" value="${s.posts_per_page}"></div>
    <label class="check"><input type="checkbox" id="stCmt" ${s.comments_enabled ? 'checked' : ''}> 开启评论</label>
    <label class="check"><input type="checkbox" id="stMod" ${s.comments_moderation ? 'checked' : ''}> 评论先审后放</label>
    <div><label>${s.password_hashed ? '重置后台密码' : '设置后台密码（当前还是默认密码，建议立刻改掉！）'}</label>
      <input id="stPw" type="password" placeholder="留空则不修改" autocomplete="new-password"></div>
    <div><button class="btn primary" id="stSave">保存设置</button></div></div>`;
  $('#stSave').onclick = async () => {
    const body = { title: $('#stTitle').value, subtitle: $('#stSub').value, author: $('#stAuthor').value,
      description: $('#stDesc').value, url: $('#stUrl').value, permalink: $('#stPm').value,
      posts_per_page: Number($('#stPer').value) || 8,
      comments_enabled: $('#stCmt').checked, comments_moderation: $('#stMod').checked };
    if ($('#stPw').value) body.password = $('#stPw').value;
    await api('settings', { method: 'POST', body });
    toast('设置已保存 ✓');
  };
};

/* ── 启动 ── */
(async function boot() {
  const s = await fetch('/api/admin/session').then(r => r.json());
  if (s.authed) { CSRF = s.csrf; $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); route(); }
  else showLogin();
})();
