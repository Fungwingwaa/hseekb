// ============================================
// TOC 插件 - 为 docsify 添加 [TOC] 目录功能
// 版本: 1.2.0 (不显示 H1 标题)
// ============================================

(function() {
  'use strict';

  // ===== 插件配置 =====
  var CONFIG = {
    maxLevel: 4,              // 最大显示标题层级 (2-6)
    minLevel: 2,              // 最小显示标题层级（从 H2 开始，不显示 H1）
    listClass: 'toc-list',
    itemClass: 'toc-item',
    containerClass: 'toc-container'
  };

  // ===== 插件核心代码 =====
  function install(hook, vm) {
    hook.doneEach(function() {
      var content = document.querySelector('.markdown-section');
      if (!content) return;

      var currentPath = getCurrentPath();

      var tocPosition = findTOCMarkerAndGetPosition(content);
      if (!tocPosition) return;

      var headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (!headings.length) return;

      var tocHTML = buildTOC(headings, CONFIG.maxLevel, currentPath);
      if (!tocHTML) return;

      insertTOCAtPosition(content, tocHTML, tocPosition);
    });
  }

  function findTOCMarkerAndGetPosition(content) {
    var result = null;

    var paragraphs = content.querySelectorAll('p');
    for (var i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].textContent.trim() === '[TOC]') {
        result = {
          type: 'element',
          element: paragraphs[i],
          parent: paragraphs[i].parentNode,
          nextSibling: paragraphs[i].nextSibling
        };
        paragraphs[i].parentNode.removeChild(paragraphs[i]);
        return result;
      }
    }

    var allNodes = content.childNodes;
    for (var j = 0; j < allNodes.length; j++) {
      if (allNodes[j].nodeType === 3) {
        var text = allNodes[j].textContent.trim();
        if (text === '[TOC]') {
          result = {
            type: 'text',
            element: allNodes[j],
            parent: allNodes[j].parentNode,
            nextSibling: allNodes[j].nextSibling
          };
          allNodes[j].parentNode.removeChild(allNodes[j]);
          return result;
        }
      }
    }

    var allElements = content.querySelectorAll('*');
    for (var k = 0; k < allElements.length; k++) {
      if (allElements[k].textContent.trim() === '[TOC]' && allElements[k].children.length === 0) {
        result = {
          type: 'element',
          element: allElements[k],
          parent: allElements[k].parentNode,
          nextSibling: allElements[k].nextSibling
        };
        allElements[k].parentNode.removeChild(allElements[k]);
        return result;
      }
    }

    return null;
  }

  function getCurrentPath() {
    var path = window.location.hash || '';
    path = path.replace(/^#\/?/, '');
    if (!path) return '';
    var queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }
    return path;
  }

  function buildTOC(headings, maxLevel, currentPath) {
    var toc = [];
    var stack = [{ level: 0, children: toc }];

    for (var i = 0; i < headings.length; i++) {
      var heading = headings[i];
      var level = parseInt(heading.tagName.substring(1));
      
      // ✅ 关键修改：跳过 H1 和超出最大层级的标题
      if (level > maxLevel || level < CONFIG.minLevel) continue;

      var id = heading.id || generateId(heading.textContent);
      heading.id = id;

      var item = {
        level: level,
        text: heading.textContent,
        id: id,
        children: []
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      var parent = stack[stack.length - 1] || { children: toc };
      parent.children.push(item);
      stack.push(item);
    }

    return renderTOC(toc, currentPath);
  }

  function renderTOC(items, currentPath) {
    if (!items || !items.length) return '';

    var html = '<ul class="' + CONFIG.listClass + '">';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      
      var href = buildHeadingLink(currentPath, item.id);
      
      html += '<li class="' + CONFIG.itemClass + ' level-' + item.level + '">';
      html += '<a href="#' + href + '">' + escapeHtml(item.text) + '</a>';
      if (item.children && item.children.length) {
        html += renderTOC(item.children, currentPath);
      }
      html += '</li>';
    }
    html += '</ul>';
    return html;
  }

  function buildHeadingLink(currentPath, headingId) {
    if (!currentPath) {
      return headingId;
    }
    
    var pathWithoutExt = currentPath.replace(/\.md$/, '').replace(/\.html$/, '');
    
    if (!pathWithoutExt) {
      return headingId;
    }
    
    return pathWithoutExt + '#' + headingId;
  }

  function insertTOCAtPosition(content, tocHTML, position) {
    var container = document.createElement('div');
    container.className = CONFIG.containerClass;
    container.innerHTML = tocHTML;

    if (position && position.parent) {
      if (position.nextSibling) {
        position.parent.insertBefore(container, position.nextSibling);
      } else {
        position.parent.appendChild(container);
      }
    } else {
      var firstHeading = content.querySelector('h1, h2, h3, h4, h5, h6');
      if (firstHeading) {
        content.insertBefore(container, firstHeading);
      } else {
        content.appendChild(container);
      }
    }
  }

  function generateId(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (window.$docsify) {
    if (!window.$docsify.plugins) {
      window.$docsify.plugins = [];
    }
    window.$docsify.plugins.push(install);
  }

})();