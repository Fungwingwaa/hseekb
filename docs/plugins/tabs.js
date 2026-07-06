(function() {
  // =====================================================================
  // 配置合并（兼容 $docsify.tabs）
  // =====================================================================
  const settings = {
    persist: true,
    sync: true,
    theme: 'classic',
    tabComments: true,
    tabHeadings: true
  };

  if (window.$docsify && window.$docsify.tabs) {
    Object.keys(window.$docsify.tabs).forEach(key => {
      if (settings.hasOwnProperty(key)) {
        settings[key] = window.$docsify.tabs[key];
      }
    });
  }

  // =====================================================================
  // 工具函数
  // =====================================================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getClosest(elm, selector) {
    if (elm.closest) return elm.closest(selector);
    while (elm) {
      if (elm.matches && elm.matches(selector)) return elm;
      elm = elm.parentNode;
    }
    return null;
  }

  // =====================================================================
  // 解析 tabs 并生成交替结构的 HTML
  // =====================================================================
  function renderTabs(markdown, vm) {
    const lines = markdown.split('\n');
    const tabs = [];
    let currentTab = null;
    let currentContent = [];

    // 支持 #### **标题** 和 <!-- tab:标题 --> 两种格式
    const headingRegex = /^####\s*\*{2}\s*(.*?)\s*\*{2}\s*$/;
    const commentRegex = /^<!--\s+tab:\s*(.*?)\s+-->$/;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let match;

      if ((match = line.match(headingRegex)) !== null) {
        const title = match[1].trim();
        if (title) {
          if (currentTab) {
            currentTab.content = currentContent.join('\n');
            tabs.push(currentTab);
          }
          currentTab = { title, content: '' };
          currentContent = [];
          i++;
          continue;
        }
      }

      if ((match = line.match(commentRegex)) !== null) {
        const title = match[1].trim();
        if (title) {
          if (currentTab) {
            currentTab.content = currentContent.join('\n');
            tabs.push(currentTab);
          }
          currentTab = { title, content: '' };
          currentContent = [];
          i++;
          continue;
        }
      }

      if (currentTab) {
        currentContent.push(line);
      }
      i++;
    }
    if (currentTab) {
      currentTab.content = currentContent.join('\n');
      tabs.push(currentTab);
    }

    if (tabs.length === 0) return '';

    const themeClass = settings.theme ? `docsify-tabs--${settings.theme}` : '';
    let html = `<div class="docsify-tabs ${themeClass}">`;

    // ★★★ 关键修复：按钮和内容交替生成 ★★★
    tabs.forEach((tab, index) => {
      const active = index === 0 ? ' docsify-tabs__tab--active' : '';
      html += `<button class="docsify-tabs__tab${active}" data-tab="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</button>`;
      const contentHtml = vm.compiler.compile(tab.content);
      html += `<div class="docsify-tabs__content">${contentHtml}</div>`;
    });

    html += '</div>';
    return html;
  }

  // =====================================================================
  // 插件
  // =====================================================================
  function plugin(hook, vm) {
    // 在渲染前替换 tabs 标记为静态 HTML
    hook.beforeEach(function(content) {
      const startRegex = /<!--\s*tabs:start\s*-->/;
      if (!startRegex.test(content)) return content;

      const parts = content.split(/<!--\s*tabs:start\s*-->|<!--\s*tabs:end\s*-->/);
      let result = '';
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          result += parts[i];
        } else {
          result += renderTabs(parts[i], vm);
        }
      }
      return result;
    });

    // 挂载后绑定点击切换（仅切换按钮的 active 类）
    hook.mounted(function() {
      document.addEventListener('click', function(e) {
        const tabBtn = getClosest(e.target, '.docsify-tabs__tab');
        if (!tabBtn) return;

        const container = getClosest(tabBtn, '.docsify-tabs');
        if (!container) return;

        // 移除同组所有按钮的 active 类
        const buttons = container.querySelectorAll('.docsify-tabs__tab');
        buttons.forEach(btn => btn.classList.remove('docsify-tabs__tab--active'));

        // 激活当前按钮
        tabBtn.classList.add('docsify-tabs__tab--active');

        // 持久化存储（保持与官方兼容）
        if (settings.persist) {
          const path = window.location.pathname;
          const key = `docsify-tabs.persist.${path}`;
          const storage = JSON.parse(sessionStorage.getItem(key) || '{}');
          const containers = document.querySelectorAll('.docsify-tabs');
          let containerIndex = -1;
          containers.forEach((c, i) => { if (c === container) containerIndex = i; });
          if (containerIndex !== -1) {
            storage[containerIndex] = tabBtn.getAttribute('data-tab');
            sessionStorage.setItem(key, JSON.stringify(storage));
          }
        }
      });
    });

    // 路由切换后处理锚点
    hook.doneEach(function() {
      const hash = window.location.hash;
      if (!hash || hash.length < 2) return;

      const targetId = hash.substring(1);
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      let panel = getClosest(targetEl, '.docsify-tabs__content');
      if (!panel) return;

      const container = getClosest(panel, '.docsify-tabs');
      if (!container) return;

      const buttons = container.querySelectorAll('.docsify-tabs__tab');
      const panels = container.querySelectorAll('.docsify-tabs__content');

      let index = -1;
      panels.forEach((p, i) => { if (p === panel) index = i; });
      if (index === -1) return;

      // 激活对应按钮
      buttons.forEach(btn => btn.classList.remove('docsify-tabs__tab--active'));
      if (buttons[index]) buttons[index].classList.add('docsify-tabs__tab--active');

      // 延迟滚动，确保布局稳定
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  }

  // =====================================================================
  // 注册插件
  // =====================================================================
  if (window.$docsify) {
    window.$docsify.plugins = (window.$docsify.plugins || []).concat(plugin);
  } else {
    console.warn('Docsify 未加载，插件注册失败');
  }
})();