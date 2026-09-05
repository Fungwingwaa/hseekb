(function() {
  var scrollBound = false;

  // 统一控制显隐，每次动态获取按钮
  function toggleBtn() {
    var btn = document.getElementById('scroll-top-btn');
    if (!btn) return;
    if (window.scrollY > 500) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  }

  // 绑定滚动事件（只执行一次）
  function bindScroll() {
    if (!scrollBound) {
      window.addEventListener('scroll', toggleBtn);
      scrollBound = true;
    }
  }

  // 初始化按钮（每次页面切换都会调用）
  function initScrollTop() {
    var btn = document.getElementById('scroll-top-btn');
    if (!btn) return;

    // 点击事件：每次重新赋值，确保绑定最新按钮
    btn.onclick = function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 确保滚动监听已绑定（只绑定一次）
    bindScroll();
    // 立即根据当前滚动位置更新按钮显示状态
    toggleBtn();
  }

  // 注册为 Docsify 插件
  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(function(hook) {
    hook.afterEach(function(html) {
      return html + `
        <div id="scroll-top-btn" class="scroll-top-btn" aria-label="返回顶部">
          <i class="bi bi-chevron-double-up" style="margin-top: -1px;color: white"></i>
        </div>
      `;
    });

    // 每次页面渲染完成后重新初始化按钮
    hook.doneEach(function() {
      initScrollTop();
    });
  });
})();