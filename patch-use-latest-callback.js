// Patch script for use-latest-callback Metro bundler compatibility
// Run this after: npm install
// Purpose: Fixes the esm.mjs import issue that causes Metro bundler errors

const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules/use-latest-callback/esm.mjs');

const patchedContent = `// Fixed for Metro bundler compatibility
// Import and re-export the React hook
import { useCallback, useRef } from 'react';

function useLatestCallback(callback) {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args) => ref.current(...args), []);
}

export default useLatestCallback;
`;

try {
  if (fs.existsSync(targetFile)) {
    fs.writeFileSync(targetFile, patchedContent, 'utf8');
    console.log('✅ Successfully patched use-latest-callback/esm.mjs');
    console.log('   Metro bundler should now work correctly');
  } else {
    console.log('⚠️  File not found:', targetFile);
    console.log('   Run npm install first');
  }
} catch (error) {
  console.error('❌ Error patching file:', error.message);
}
