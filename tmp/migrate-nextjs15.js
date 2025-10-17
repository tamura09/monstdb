const fs = require('fs');
const path = require('path');

// 修正対象ファイルと修正内容のマッピング
const files = [
  { 
    path: 'app/friends/page.tsx',
    search: /searchParams,\n\}:\s*\{\n\s*searchParams:\s*\{\s*search\?:\s*string\s*\}/,
    replace: `searchParams,\n}: {\n  searchParams: Promise<{ search?: string }>`
  },
  { 
    path: 'app/friends/page.tsx',
    search: /const session = await getServerSession\(authOptions\)\n\n  if \(!session\) \{\n    redirect\('\/login'\)\n  \}/,
    replace: `const session = await getServerSession(authOptions)\n\n  if (!session) {\n    redirect('/login')\n  }\n\n  const { search } = await searchParams`
  }
];

console.log('Next.js 15 migration script started...\n');

// 簡易版: 主要な変更パターンをファイルごとに適用
const filesToFix = [
  'app/friends/page.tsx',
  'app/friends/[friendId]/page.tsx',
  'app/friends.disabled/page.tsx',
  'app/friends.disabled/[friendId]/page.tsx',
  'app/admin/characters/page.tsx',
  'app/admin/characters/new/page.tsx',
  'app/admin/characters/[id]/edit/page.tsx'
];

filesToFix.forEach(file => {
  const filePath = path.join(__dirname, '..', '..', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // searchParams: { ... } → searchParams: Promise<{ ... }>
    if (content.includes('searchParams:') && !content.includes('searchParams: Promise<{')) {
      content = content.replace(
        /searchParams:\s*\{([^}]+)\}/g,
        'searchParams: Promise<{$1}>'
      );
      modified = true;
    }
    
    // params: { ... } → params: Promise<{ ... }> (except already fixed)
    if (content.includes('params:') && !content.includes('params: Promise<{')) {
      content = content.replace(
        /params:\s*\{([^}]+)\}/g,
        'params: Promise<{$1}>'
      );
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed type definitions in ${file}`);
      console.log('  Note: You must manually add "const { ... } = await searchParams" or "const { ... } = await params" in the function body.\n');
    } else {
      console.log(`- Skipped ${file} (no changes needed or already fixed)`);
    }
  } else {
    console.log(`✗ File not found: ${file}`);
  }
});

console.log('\nType definitions updated. Please manually add await statements for params/searchParams destructuring.');
console.log('Example: const { element, type } = await searchParams');
