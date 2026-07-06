// tag-plugin-lite.js
(function() {
  var $docsify = window.$docsify || {};
  var data = {};
  var isLoaded = false;

  function loadIndex(callback) {
    var url = './tags.json';
    fetch(url)
      .then(function(res) {
        if (!res.ok) throw new Error('无法加载 tags.json');
        return res.json();
      })
      .then(function(json) {
        data = json;
        isLoaded = true;
        var tagCount = Object.keys(data.tags || {}).length;
        var catCount = Object.keys(data.categories || {}).length;
        console.log('[标签插件] 加载成功，tags: ' + tagCount + ' 个，categories: ' + catCount + ' 个');
        callback();
      })
      .catch(function(err) {
        console.error('[标签插件] 加载失败：', err);
        isLoaded = true;
        callback();
      });
  }

  // 排序函数（保持之前的功能：先按目录，再 order 升序，再 date 降序）
  function sortArticles(articles) {
    var groups = {};
    articles.forEach(function(a) {
      var dir = a.link.lastIndexOf('/') === -1 ? '' : a.link.substring(0, a.link.lastIndexOf('/'));
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(a);
    });
    var dirs = Object.keys(groups).sort();
    var sortedGroups = {};
    dirs.forEach(function(dir) {
      var group = groups[dir];
      group.sort(function(a, b) {
        var orderA = a.frontmatter.order !== undefined ? parseInt(a.frontmatter.order, 10) : null;
        var orderB = b.frontmatter.order !== undefined ? parseInt(b.frontmatter.order, 10) : null;
        var hasOrderA = orderA !== null && !isNaN(orderA);
        var hasOrderB = orderB !== null && !isNaN(orderB);

        if (hasOrderA && !hasOrderB) return -1;
        if (!hasOrderA && hasOrderB) return 1;

        if (hasOrderA && hasOrderB) {
          if (orderA !== orderB) return orderA - orderB;
          var dateA = a.frontmatter.date || '';
          var dateB = b.frontmatter.date || '';
          if (dateA && dateB && dateA !== dateB) return dateA > dateB ? -1 : 1;
          return 0;
        }

        var dateA = a.frontmatter.date || '';
        var dateB = b.frontmatter.date || '';
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        if (dateA !== dateB) return dateA > dateB ? -1 : 1;
        return 0;
      });
      sortedGroups[dir] = group;
    });

    var result = [];
    dirs.forEach(function(dir) {
      result = result.concat(sortedGroups[dir]);
    });
    return result;
  }

  function slugify(text) {
    return text.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-]/g, '');
  }

  // ========== 修改点1：增加 listId 参数，标题改为 <h3> ==========
  function renderArticleList(articles, showTitle, titleText, listId) {
    if (!articles || articles.length === 0) {
      return '<p class="tag-plugin-empty">📭 没有相关文章</p>';
    }
    var sorted = sortArticles(articles);
    var prefix = window.location.href.split('#')[0];

    var html = '';
    if (showTitle && titleText) {
      var id = slugify(titleText);
      html += '<h3 id="' + id + '" class="tag-plugin-title">';
      html += '<i class="bi bi-tag-fill"></i>' + titleText;
      html += '</h3>';
    }

    // 如果有 listId，则作为 ul 的 id
    html += '<ul class="tag-plugin-list"' + (listId ? ' id="' + listId + '"' : '') + '>';
    sorted.forEach(function(p) {
      var fm = p.frontmatter;
      var title = fm.title || p.link;
      var shortTitle = fm.shortTitle || '';
      var date = fm.date || '';
      var link = p.link;
      if (link === 'README') link = '';
      var hasShort = !!shortTitle;
      html += '<li class="tag-plugin-item' + (hasShort ? ' has-short' : '') + '">';
      html += '<span class="tag-plugin-item-bullet">·</span>';
      html += '<span class="tag-plugin-item-title">';
      html += '<span class="tag-plugin-full-title"><a href="' + prefix + '#/' + link + '">' + title + '</a></span>';
      if (hasShort) {
        html += '<span class="tag-plugin-short-title"><a href="' + prefix + '#/' + link + '">' + shortTitle + '</a></span>';
      }
      html += '</span>';
      if (date) {
        html += '<span class="tag-plugin-item-date">' + date + '</span>';
      }
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }

  function processTags(match, tag) {
    var tagName = tag.trim();
    var tagMap = data.tags || {};
    if (tagName === 'all') {
      var allNames = Object.keys(tagMap).sort();
      if (allNames.length === 0) {
        return '<p class="tag-plugin-empty">📭 当前没有任何标签</p>';
      }
      var navHtml = '<div class="tag-nav">';
      allNames.forEach(function(t) {
        var tid = slugify(t);
        navHtml += '<span class="frontmatter-btn">' + '<a href="#/Others/tags?id=' + tid + '">' + t + '</a>' + '</span>';
      });
      navHtml += '</div>';

      var bodyHtml = '';
      allNames.forEach(function(t) {
        var articles = tagMap[t] || [];
        bodyHtml += renderArticleList(articles, true, t); // 不传 listId
      });
      return navHtml + bodyHtml;
    } else {
      var articles = tagMap[tagName] || [];
      return renderArticleList(articles, true, tagName);
    }
  }

  // ========== 修改点2：category 调用时传入 listId = slugify(catName) ==========
  function processCategory(match, cat) {
    var catName = cat.trim();
    var catMap = data.categories || {};
    var articles = catMap[catName] || [];
    var listId = slugify(catName);
    return renderArticleList(articles, false, '', listId);
  }

  function processContent(html) {
    html = html.replace(/<!--\s*docsify\/tags\s+(.*?)\s*-->/g, processTags);
    html = html.replace(/<!--\s*docsify\/category\s+(.*?)\s*-->/g, processCategory);
    return html;
  }

  function replacePlaceholdersInDOM() {
    if (!isLoaded) return;
    var contentEl = document.querySelector('.content');
    if (!contentEl) return;
    var html = contentEl.innerHTML;
    if (!html.includes('<!-- docsify/tags') && !html.includes('<!-- docsify/category')) {
      return;
    }
    var processedHtml = processContent(html);
    if (processedHtml !== html) {
      contentEl.innerHTML = processedHtml;
      console.log('[标签插件] DOM 占位符已替换');
    }
  }

  if (!Array.isArray($docsify.plugins)) $docsify.plugins = [];
  $docsify.plugins.push(function(hook, vm) {
    hook.init(function() {
      loadIndex(function() {
        replacePlaceholdersInDOM();
      });
    });

    hook.afterEach(function(html, next) {
      if (!isLoaded) {
        return next(html);
      }
      var processed = processContent(html);
      next(processed);
    });

    hook.doneEach(function() {
      if (isLoaded) {
        setTimeout(replacePlaceholdersInDOM, 50);
      }
    });
  });
})();