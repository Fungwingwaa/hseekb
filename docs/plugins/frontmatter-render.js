(function() {
  console.log('✅ frontmatter-render plugin loaded');

  // 简单 YAML 解析器（支持键值对和数组）
  function parseFrontMatter(fmString) {
    const lines = fmString.split('\n');
    const data = {};
    let currentKey = null;
    let currentArray = [];
    let isArray = false;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('- ')) {
        if (!isArray) {
          currentArray = [];
          isArray = true;
        }
        currentArray.push(line.substring(2).trim());
        continue;
      } else {
        if (isArray) {
          data[currentKey] = currentArray;
          currentArray = [];
          isArray = false;
        }
        const sepIndex = line.indexOf(':');
        if (sepIndex > -1) {
          currentKey = line.substring(0, sepIndex).trim();
          let value = line.substring(sepIndex + 1).trim();
          // 尝试转换类型
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(value) && value !== '') value = Number(value);
          data[currentKey] = value;
        }
      }
    }
    if (isArray) {
      data[currentKey] = currentArray;
    }
    return data;
  }

  // 日期格式化
  function formatDate(dateStr) {
    if (!dateStr) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return year + '年' + month + '月' + day + '日';
  }

  // 主插件
  function frontmatterRenderPlugin(hook) {
    hook.beforeEach(function(content) {
      // 清洗 BOM 和开头空白（兼容性）
      content = content.replace(/^\uFEFF/, '').replace(/^\s+/, '');
      
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) {
        return content;
      }

      const fmString = match[1];
      const fm = parseFrontMatter(fmString);
      const afterFrontmatter = content.substring(match.index + match[0].length);
      let processed = afterFrontmatter;

      // ---------- 处理 date ----------
      if (fm.date) {
        const formatted = formatDate(fm.date);
        processed = processed.replace(/\{\{\s*date\s*\}\}/g, formatted);
      }

      // ---------- 遍历所有字段 ----------
      for (const key in fm) {
        const value = fm[key];

        // ----- 处理 rules（支持数字或范围字符串） -----
        if (key === 'rules') {
          let start = 1, end = 0;
          let valid = false;

          if (typeof value === 'number' && value > 0) {
            // 纯数字：从 1 到 value
            start = 1;
            end = value;
            valid = true;
          } else if (typeof value === 'string' && value.includes('-')) {
            // 范围字符串：如 "100-200"
            const parts = value.split('-').map(s => parseInt(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] <= parts[1]) {
              start = parts[0];
              end = parts[1];
              valid = true;
            }
          }

          if (valid && end >= start) {
            const linkHtml = Array.from({ length: end - start + 1 }, (_, i) => {
              const num = start + i;
              return `<span class="frontmatter-btn frontmatter-btn-rules">[${num}](#t${num})</span>`;
            }).join(' ');
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            processed = processed.replace(regex, linkHtml);
          }
          continue;
        }

        // ----- 处理数组（category, tags 等） -----
        if (Array.isArray(value)) {
          if (value.length === 0) {
            // 空数组直接移除占位符
            const regexDirect = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            processed = processed.replace(regexDirect, '');
            const regexBlock = new RegExp(`\\{\\{\\s*#${key}\\s*\\}\\}[\\s\\S]*?\\{\\{\\s*\\/${key}\\s*\\}\\}`, 'g');
            processed = processed.replace(regexBlock, '');
            continue;
          }

          let linkHtml;

          // --- 特殊处理 category：支持动态后缀和默认路径 ---
          if (key === 'category') {
            // 1. 先处理带后缀的 {{ category.xxx }}
            processed = processed.replace(/\{\{\s*category\.(\w+)\s*\}\}/g, function(match, suffix) {
              const prefix = `/${suffix}/index`;
              return value.map(item =>
                `<span class="frontmatter-btn">[${item}](${prefix}#${encodeURIComponent(item)})</span>`
              ).join(' ');
            });

            // 2. 再处理无后缀的 {{ category }}，使用默认路径（可配置）
            const defaultPrefix = (window.$docsify && window.$docsify.frontmatterDefaults && window.$docsify.frontmatterDefaults.categoryBase) || '/Laws/index';
            const defaultHtml = value.map(item =>
              `<span class="frontmatter-btn">[${item}](${defaultPrefix}#${encodeURIComponent(item)})</span>`
            ).join(' ');
            processed = processed.replace(/\{\{\s*category\s*\}\}/g, defaultHtml);

            // 跳过后面的通用替换，因为已经处理完毕
            continue;
          }

          // --- 处理 tags ---
          if (key === 'tags') {
            linkHtml = value.map(item =>
              `<span class="frontmatter-btn">[${item}](/Others/tags#${encodeURIComponent(item)})</span>`
            ).join(' ');
          } else {
            // 其他数组（无链接，纯文本）
            linkHtml = value.map(item => `<span>${item}</span>`).join(' ');
          }

          // 替换 {{ key }} 和 {{#key}}...{{/key}}
          const regexDirect = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          processed = processed.replace(regexDirect, linkHtml);
          const regexBlock = new RegExp(`\\{\\{\\s*#${key}\\s*\\}\\}[\\s\\S]*?\\{\\{\\s*\\/${key}\\s*\\}\\}`, 'g');
          processed = processed.replace(regexBlock, linkHtml);
          continue;
        }

        // ----- 普通字段（字符串、数字、布尔） -----
        if (typeof value !== 'object') {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          processed = processed.replace(regex, value);
        }
      }

      return processed;
    });
  }

  // 注册插件
  if (window.$docsify) {
    window.$docsify.plugins = (window.$docsify.plugins || []).concat(frontmatterRenderPlugin);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.$docsify) {
        window.$docsify.plugins = (window.$docsify.plugins || []).concat(frontmatterRenderPlugin);
      }
    });
  }
})();