#!/usr/bin/env node

// Script to copy bill-sharing files to the main genie.ph project
import fs from 'fs';
import path from 'path';

console.log('📋 Copying bill-sharing files to genie.ph project\n');

// Define source and destination directories
const sourceDir = '../genieph---bill-sharing';
const destDir = '.';

// Files to copy
const filesToCopy = [
  'services/discountService.ts',
  'services/incentiveService.ts',
  'components/ContributionSuccessModal.tsx'
];

// Files to compare and potentially update
const filesToCompare = [
  'services/shareService.ts',
  'components/ShareModal.tsx'
];

console.log('📂 Copying new files:');
filesToCopy.forEach(file => {
  const srcPath = path.join(sourceDir, file);
  const destPath = path.join(destDir, file);
  
  try {
    // Ensure destination directory exists
    const destDirName = path.dirname(destPath);
    if (!fs.existsSync(destDirName)) {
      fs.mkdirSync(destDirName, { recursive: true });
    }
    
    // Copy file
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✅ ${file}`);
  } catch (error) {
    console.error(`  ❌ Error copying ${file}:`, error.message);
  }
});

console.log('\n🔍 Files to compare manually:');
filesToCompare.forEach(file => {
  console.log(`  📄 ${file}`);
});

console.log('\n✅ Copy process completed!');
console.log('\n📝 Next steps:');
console.log('1. Compare the files listed above manually');
console.log('2. Update App.tsx to integrate new features');
console.log('3. Test the application locally');
console.log('4. Run build to verify everything works');