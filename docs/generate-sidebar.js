// generate-sidebar.js
const fs = require('fs');
const path = require('path');

const TAGS_JSON = './tags.json';
const TARGET_DIRS = ['Laws', 'Standards'];

// ---------- 工具函数 ----------
function getAllSidebarFiles(baseDir) {
  const files = [];
  TARGET_DIRS.forEach(dir => {
    const fullDir = path.join(baseDir, dir);
    if (fs.existsSync(fullDir)) {
      walkDir(fullDir, files);
    }
  });
  return files;
}

function walkDir(dir, fileList) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (entry.isFile() && entry.name === '_sidebar.md') {
      fileList.push(fullPath);
    }
  }
}

// 排序函数（与 tag-plugin-lite.js 保持一致）
function sortArticles(articles) {
  const groups = {};
  articles.forEach(a => {
    const dir = a.link.lastIndexOf('/') === -1 ? '' : a.link.substring(0, a.link.lastIndexOf('/'));
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(a);
  });
  const dirs = Object.keys(groups).sort();
  const sortedGroups = {};
  dirs.forEach(dir => {
    const group = groups[dir];
    group.sort((a, b) => {
      const orderA = a.frontmatter.order !== undefined ? parseInt(a.frontmatter.order, 10) : null;
      const orderB = b.frontmatter.order !== undefined ? parseInt(b.frontmatter.order, 10) : null;
      const hasOrderA = orderA !== null && !isNaN(orderA);
      const hasOrderB = orderB !== null && !isNaN(orderB);

      if (hasOrderA && !hasOrderB) return -1;
      if (!hasOrderA && hasOrderB) return 1;
      if (hasOrderA && hasOrderB) {
        if (orderA !== orderB) return orderA - orderB;
        const dateA = a.frontmatter.date || '';
        const dateB = b.frontmatter.date || '';
        if (dateA && dateB && dateA !== dateB) return dateA > dateB ? -1 : 1;
        return 0;
      }
      const dateA = a.frontmatter.date || '';
      const dateB = b.frontmatter.date || '';
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      if (dateA !== dateB) return dateA > dateB ? -1 : 1;
      return 0;
    });
    sortedGroups[dir] = group;
  });

  let result = [];
  dirs.forEach(dir => {
    result = result.concat(sortedGroups[dir]);
  });
  return result;
}

function generateSidebarHTML(articles, field) {
  if (!articles || articles.length === 0) return '';
  const sorted = sortArticles(articles);
  let html = '<ul>';
  sorted.forEach(p => {
    const fm = p.frontmatter;
    const displayText = fm[field] || fm.title || p.link;
    const titleAttr = fm.title || p.link;
    const link = p.link === 'README' ? '' : p.link;
    html += `<li><a href="#/${link}" title="${titleAttr}">${displayText}</a></li>`;
  });
  html += '</ul>';
  return html;
}

function processSidebarFile(filePath, tagData) {
  let content = fs.readFileSync(filePath, 'utf8');
  const regex = /<!--\s*sidebar\/category(?:\.(\w+))?\s+([\w\u4e00-\u9fa5]+)\s*-->/g;
  let match;
  let newContent = content;
  let hasReplacement = false;

  // 收集所有匹配
  const matches = [];
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      fullMatch: match[0],
      field: match[1] || 'title',
      catName: match[2],
      index: match.index,
    });
  }

  // 从后往前处理
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const { fullMatch, field, catName } = m;
    const catMap = tagData.categories || {};
    const articles = catMap[catName] || [];
    const html = generateSidebarHTML(articles, field);

    // 插入内容（带标记）
    let insertContent = '';
    if (html) {
      insertContent = `\n<!-- sidebar/category-content-start -->\n${html}\n<!-- sidebar/category-content-end -->\n`;
    } else {
      // 无文章，插入空标记（保留占位符）
      insertContent = '\n<!-- sidebar/category-content-start -->\n<!-- sidebar/category-content-end -->\n';
    }

    // 检查占位符后是否已有旧内容
    const startMarker = '<!-- sidebar/category-content-start -->';
    const endMarker = '<!-- sidebar/category-content-end -->';
    const placeholderPos = newContent.indexOf(fullMatch);
    const afterPlaceholder = newContent.substring(placeholderPos + fullMatch.length);
    const startIdx = afterPlaceholder.indexOf(startMarker);
    const endIdx = afterPlaceholder.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      // 已有内容，替换旧内容
      const oldSegment = newContent.substring(placeholderPos, placeholderPos + fullMatch.length + afterPlaceholder.length);
      const newSegment = fullMatch + insertContent;
      newContent = newContent.replace(oldSegment, newSegment);
      hasReplacement = true;
    } else {
      // 无旧内容，直接在占位符后插入
      const oldSegment = fullMatch;
      const newSegment = fullMatch + insertContent;
      newContent = newContent.replace(oldSegment, newSegment);
      hasReplacement = true;
    }
  }

  if (hasReplacement) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ 已更新侧边栏文件: ${filePath}`);
  } else {
    console.log(`⏭️ 无占位符，跳过: ${filePath}`);
  }
}

function main() {
  if (!fs.existsSync(TAGS_JSON)) {
    console.error(`❌ 找不到 ${TAGS_JSON}，请先运行 generate-tags.js`);
    process.exit(1);
  }
  const tagData = JSON.parse(fs.readFileSync(TAGS_JSON, 'utf8'));

  const baseDir = path.resolve('.');
  const sidebarFiles = getAllSidebarFiles(baseDir);
  console.log(`📚 找到 ${sidebarFiles.length} 个 _sidebar.md 文件`);

  sidebarFiles.forEach(file => {
    processSidebarFile(file, tagData);
  });

  console.log('🎉 侧边栏生成完成');
}

main();