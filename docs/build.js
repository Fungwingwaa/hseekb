// build.js
const fs = require('fs');
const path = require('path');

// ==================== 1. 生成 tags.json（原 generate-tags.js，未做任何字段裁剪） ====================
function buildTagsJson() {
  const DOCS_DIR = '.';
  const OUTPUT_FILE = './tags.json';

  function getAllMdFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (file === 'node_modules' || file === '.git') return;
        getAllMdFiles(fullPath, fileList);
      } else if (file.endsWith('.md')) {
        fileList.push(fullPath);
      }
    });
    return fileList;
  }

  function parseFrontMatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const yaml = match[1];
    const obj = {};
    const lines = yaml.split('\n');
    let currentKey = null;
    let currentArray = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      const sep = line.indexOf(':');
      if (sep !== -1) {
        if (currentKey && currentArray.length > 0) {
          obj[currentKey] = currentArray;
          currentArray = [];
          currentKey = null;
        }
        let key = line.slice(0, sep).trim();
        let val = line.slice(sep + 1).trim();
        if (val.startsWith('[') && val.endsWith(']')) {
          val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
          obj[key] = val;
        } else if (val === '') {
          currentKey = key;
          currentArray = [];
        } else {
          obj[key] = val;
        }
      } else if (currentKey && line.trim().startsWith('- ')) {
        const item = line.trim().substring(2).trim().replace(/^['"]|['"]$/g, '');
        currentArray.push(item);
      }
    }
    if (currentKey && currentArray.length > 0) {
      obj[currentKey] = currentArray;
    }
    return obj;
  }

  function extractTitleFromBody(content) {
    const match = content.match(/^#\s+(.*)/m);
    return match ? match[1].trim() : '';
  }

  function extractTags(fm) {
    let tags = fm.tags || [];
    if (typeof tags === 'string') {
      tags = tags.split(',').map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(tags)) {
      tags = [];
    }
    return tags;
  }

  function extractCategories(fm) {
    let cats = fm.category || [];
    if (typeof cats === 'string') {
      cats = cats.split(',').map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(cats)) {
      cats = [];
    }
    return cats;
  }

  const mdFiles = getAllMdFiles(DOCS_DIR);
  console.log(`📚 找到 ${mdFiles.length} 个 .md 文件`);

  const tagMap = {};
  const categoryMap = {};

  mdFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const fm = parseFrontMatter(content);
    const tags = extractTags(fm);
    const categories = extractCategories(fm);

    // 确保 title 字段存在（若 frontmatter 无 title，则从正文提取）
    if (!fm.title) {
      fm.title = extractTitleFromBody(content) || path.basename(filePath, '.md');
    }
    if (!fm.date) fm.date = '';

    const relPath = path.relative(DOCS_DIR, filePath).replace(/\\/g, '/');
    const link = relPath.replace(/\.md$/i, '');

    // ★ 保留完整的 frontmatter 对象，不做任何裁剪
    const article = {
      link: link,
      frontmatter: fm   // 全量保留
    };

    tags.forEach((tag) => {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(article);
    });

    categories.forEach((cat) => {
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(article);
    });
  });

  const output = { tags: tagMap, categories: categoryMap };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`✅ 生成 ${OUTPUT_FILE}，tags: ${Object.keys(tagMap).length} 个，categories: ${Object.keys(categoryMap).length} 个`);
}

// ==================== 2. 更新侧边栏（原 generate-sidebar.js，完全未改动） ====================
function updateSidebars() {
  const TAGS_JSON = './tags.json';
  const TARGET_DIRS = ['Laws', 'Standards'];

  if (!fs.existsSync(TAGS_JSON)) {
    console.error('❌ tags.json 不存在，请先运行生成步骤');
    process.exit(1);
  }
  const tagData = JSON.parse(fs.readFileSync(TAGS_JSON, 'utf8'));

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

  function processSidebarFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = /<!--\s*sidebar\/category(?:\.(\w+))?\s+([\w\u4e00-\u9fa5]+)\s*-->/g;
    let match;
    let newContent = content;
    let hasReplacement = false;

    const matches = [];
    while ((match = regex.exec(content)) !== null) {
      matches.push({
        fullMatch: match[0],
        field: match[1] || 'title',
        catName: match[2],
      });
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const { fullMatch, field, catName } = m;
      const articles = tagData.categories[catName] || [];
      const html = generateSidebarHTML(articles, field);

      let insertContent = '';
      if (html) {
        insertContent = `\n<!-- sidebar/category-content-start -->\n${html}\n<!-- sidebar/category-content-end -->\n`;
      } else {
        insertContent = '\n<!-- sidebar/category-content-start -->\n<!-- sidebar/category-content-end -->\n';
      }

      const startMarker = '<!-- sidebar/category-content-start -->';
      const endMarker = '<!-- sidebar/category-content-end -->';
      const placeholderPos = newContent.indexOf(fullMatch);
      if (placeholderPos === -1) continue;
      const afterPlaceholder = newContent.substring(placeholderPos + fullMatch.length);
      const startIdx = afterPlaceholder.indexOf(startMarker);
      const endIdx = afterPlaceholder.indexOf(endMarker);

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const oldSegment = newContent.substring(placeholderPos, placeholderPos + fullMatch.length + afterPlaceholder.length);
        const newSegment = fullMatch + insertContent;
        newContent = newContent.replace(oldSegment, newSegment);
        hasReplacement = true;
      } else {
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

  const baseDir = path.resolve('.');
  const sidebarFiles = getAllSidebarFiles(baseDir);
  console.log(`📚 找到 ${sidebarFiles.length} 个 _sidebar.md 文件`);

  sidebarFiles.forEach(file => {
    processSidebarFile(file);
  });

  console.log('🎉 侧边栏生成完成');
}

// ==================== 主流程 ====================
console.log('🚀 开始构建...\n');
buildTagsJson();
console.log('\n' + '='.repeat(50) + '\n');
updateSidebars();
console.log('\n✨ 全部完成！');