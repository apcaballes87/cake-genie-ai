import { main } from './backfill-server-phashes';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
