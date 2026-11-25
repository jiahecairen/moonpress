/* Moonlit Folio · main.js (<10KB, 零依赖, prefers-reduced-motion 全局降级) */
(function () {
  var d = document, r = d.documentElement;

  /* 主题：首页深、案例浅为默认（body[data-default-theme]），localStorage 覆盖 */
  var saved = null;
  try { saved = localStorage.getItem('mf-theme'); } catch (e) {}
  if (saved) r.setAttribute('data-theme', saved);
  var tb = d.querySelector('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var t = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', t);
    try { localStorage.setItem('mf-theme', t); } catch (e) {}
  });

  /* 语言：chrome 文案与双语标题切换（data-zh / data-en / data-title-zh） */
  var lang = 'zh';
  try { lang = localStorage.getItem('mf-lang') || d.body.getAttribute('data-default-lang') || 'zh'; } catch (e) {}
  function setLang(l) {
    r.setAttribute('data-lang', l);
    r.lang = l === 'zh' ? 'zh-CN' : 'en';
    Array.prototype.forEach.call(d.querySelectorAll('[data-zh]'), function (n) {
      n.textContent = n.getAttribute(l === 'zh' ? 'data-zh' : 'data-en') || n.textContent;
    });
    Array.prototype.forEach.call(d.querySelectorAll('[data-title-zh]'), function (n) {
      n.textContent = n.getAttribute(l === 'zh' ? 'data-title-zh' : 'data-title') || n.textContent;
    });
    var lb = d.querySelector('[data-lang-toggle]');
    if (lb) lb.textContent = l === 'zh' ? 'EN' : '中';
  }
  var lb = d.querySelector('[data-lang-toggle]');
  if (lb) lb.addEventListener('click', function () {
    lang = lang === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem('mf-lang', lang); } catch (e) {}
    setLang(lang);
  });
  setLang(lang);

  /* 滚动揭示：IntersectionObserver + ≤60ms 交错；reduced-motion 直接显示 */
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = Array.prototype.slice.call(d.querySelectorAll('[data-reveal]'));
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -2% 0px" });
    els.forEach(function (e, i) {
      e.style.setProperty('--d', (i % 6) * 60 + 'ms');
      io.observe(e);
    });
  }

  /* 页脚：本页存在了 X 天 */
  var el = d.querySelector('[data-days]');
  if (el) {
    var start = new Date(el.getAttribute('data-days'));
    el.textContent = Math.max(0, Math.floor((Date.now() - start.getTime()) / 864e5));
  }
})();
