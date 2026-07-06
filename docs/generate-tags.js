// generate-tags.js
// 每次新增或修改文章后 node generate-tags.js
const fs = require('fs');
const path = require('path');

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

function buildIndex() {
  const mdFiles = getAllMdFiles(DOCS_DIR);
  console.log(`📚 找到 ${mdFiles.length} 个 .md 文件`);

  const tagMap = {};
  const categoryMap = {};

  mdFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const fm = parseFrontMatter(content);
    const tags = extractTags(fm);
    const categories = extractCategories(fm);

    // 确保 title
    if (!fm.title) {
      const title = extractTitleFromBody(content);
      fm.title = title || path.basename(filePath, '.md');
    }
    if (!fm.date) fm.date = '';

    const relPath = path.relative(DOCS_DIR, filePath).replace(/\\/g, '/');
    const link = relPath.replace(/\.md$/i, '');

    const article = {
      link: link,
      frontmatter: fm
    };

    // 按 tags 分组
    tags.forEach((tag) => {
      if (!tagMap[tag]) tagMap[tag] = [];
      // 去重（同一篇文章可能多个标签，但此处不会重复，因为每个标签不同）
      tagMap[tag].push(article);
    });

    // 按 category 分组
    categories.forEach((cat) => {
      if (!categoryMap[cat]) categoryMap[cat] = [];
      // 去重（同一篇文章可能多个分类，但每个分类不同）
      categoryMap[cat].push(article);
    });
  });

  const output = {
    tags: tagMap,
    categories: categoryMap
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`✅ 成功生成 ${OUTPUT_FILE}，tags: ${Object.keys(tagMap).length} 个标签，categories: ${Object.keys(categoryMap).length} 个分类`);
}

buildIndex();