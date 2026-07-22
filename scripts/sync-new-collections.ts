import { refreshCollections } from './update-collections-studio-images';

const TARGET_SLUGS = [
  'mothers-day-cakes',
  'fathers-day-cakes',
  'stray-kids',
  'yellow-cakes',
  'purple-cakes',
  'lavender-cakes',
];

refreshCollections(process.argv.includes('--dry-run'), TARGET_SLUGS)
  .then((summary) => {
    console.log(JSON.stringify({ summary, targetSlugs: TARGET_SLUGS }));
    if (summary.failed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
