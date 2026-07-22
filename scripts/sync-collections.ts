import { refreshCollections } from './update-collections-studio-images';

refreshCollections(process.argv.includes('--dry-run'))
  .then((summary) => {
    console.log(JSON.stringify({ summary }));
    if (summary.failed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
