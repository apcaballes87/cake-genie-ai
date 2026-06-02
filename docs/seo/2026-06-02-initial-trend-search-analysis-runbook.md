# Initial Trend Collection Search-Analysis Runbook

Research date: 2026-06-02

## Purpose

This is the first manually reviewed trend intake for the collection pipeline. Apply the stocking migration first, then use `/admin/search-analysis` to collect relevant cake images from search results. Do not publish a collection merely because the topic is popular. A page becomes indexable only after the cache contains at least eight relevant priced cake designs and the studio-image synchronizer verifies the collection.

## Existing Coverage

The repo already contains broad and recent themes such as `blackpink-cake`, `bts-cake`, `bini-cake`, `minecraft-cake`, `roblox-cake`, `bluey-cake`, `labubu-cake`, `smiski-cakes`, `sprunki-cake`, `capybara-cake`, and `kpop-demon-hunters-cake`. Do not create duplicates for those themes. They can still receive additional search-analysis intake if their image coverage is weak.

## New Stocking Queue

| Priority | Collection | Slug | Why it is in the first run | Search-analysis queries |
| --- | --- | --- | --- | --- |
| 1 | KATSEYE Cake | `katseye-cake` | Current Pinoy fan relevance and strong 2026 visibility around Coachella and Philippine audience interest | `katseye birthday cake`, `katseye cake design`, `katseye kpop cake` |
| 2 | Jellycat Cake | `jellycat-cake` | Collectible plush trend with broad 2026 momentum | `jellycat birthday cake`, `jellycat cake design`, `jellycat plush cake` |
| 3 | Stray Kids Cake | `stray-kids-cake` | Missing dedicated collection despite strong current K-pop visibility | `stray kids birthday cake`, `stray kids cake design`, `skz cake` |
| 4 | TWICE Cake | `twice-cake` | Missing dedicated collection despite strong current K-pop visibility | `twice birthday cake`, `twice cake design`, `once kpop cake` |
| 5 | ENHYPEN Cake | `enhypen-cake` | Missing dedicated collection with meaningful Philippines fan demand | `enhypen birthday cake`, `enhypen cake design`, `engene cake` |
| 6 | Aespa Cake | `aespa-cake` | Missing dedicated collection and suitable visual identity for cake designs | `aespa birthday cake`, `aespa cake design`, `aespa kpop cake` |
| 7 | Baby Three Cake | `baby-three-cake` | Plush blind-box trend with Philippine retail relevance | `baby three birthday cake`, `baby three cake design`, `baby three blind box cake` |
| 8 | Crybaby Cake | `crybaby-cake` | Pop Mart collectible extension adjacent to existing Labubu demand | `crybaby pop mart cake`, `crybaby birthday cake`, `crybaby cake design` |
| 9 | Twinkle Twinkle Cake | `twinkle-twinkle-cake` | Newly visible Pop Mart character; speculative but cheap to stock-test | `twinkle twinkle pop mart cake`, `twinkle twinkle birthday cake`, `twinkle twinkle cake design` |

## Manual Intake Steps

1. Apply `supabase/migrations/20260602113000_seed_initial_trend_collection_stocking_queue.sql`.
2. Open `/admin/search-analysis`.
3. Run the listed queries one by one. Review each search-result image before adding it to the offline queue.
4. Submit the search-analysis batch only after the desired result images have been collected.
5. Reconcile the completed batch so accepted cake images land in `cakegenie_analysis_cache`.
6. Run:

   ```bash
   npx tsx scripts/update-collections-studio-images.ts --dry-run
   npx tsx scripts/update-collections-studio-images.ts
   ```

7. Verify the promoted collections. Rows with fewer than eight matching designs must remain `stocking`, `is_indexable = false`, and absent from the sitemap.

## Optional Existing-Theme Refresh

After the new queue, consider collecting more images for existing themes that remain timely:

- `kpop-demon-hunters-cake`
- `bini-cake`
- `labubu-cake`
- `bluey-cake`
- `minecraft-cake`
- `roblox-cake`

## Research Sources

- [TIME100 Most Influential Companies 2026: Jellycat](https://time.com/collection/time100-most-influential-companies/2026/jellycat/)
- [Manila Bulletin: Pop Mart opens third store at SM North EDSA](https://mb.com.ph/2026/02/17/pop-mart-opens-third-store-at-sm-north-edsa)
- [Smart Parenting: Blind Boxes Explained](https://www.smartparenting.com.ph/shopping-guide/kids/blind-boxes-kids-a5076-20250320-lfrm)
- [GMA Entertainment: KATSEYE misses Pinoy fans' energy](https://www.gmanetwork.com/entertainment/showbiznews/katseye-misses-pinoy-fans-energy-such-passionate-people/127835/)
- [KpopStarz: Most Popular KPop Groups in 2026](https://www.kpopstarz.com/articles/322931/20260403/most-popular-kpop-groups-2026.htm)
- [GamesRadar: KPop Demon Hunters Lego sets teased](https://www.gamesradar.com/toys-collectibles/lego-kpop-demon-hunters-set-teased-and-this-is-just-the-beginning/)

