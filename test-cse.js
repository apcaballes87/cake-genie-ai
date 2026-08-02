const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('Navigating...');
  await page.goto('http://localhost:3002/admin/search-analysis', { waitUntil: 'networkidle0' });

  console.log('Logging in...');
  if (!process.env.ADMIN_STAFF_EMAIL || !process.env.ADMIN_STAFF_PASSWORD) {
    throw new Error('Set ADMIN_STAFF_EMAIL and ADMIN_STAFF_PASSWORD before running this test.');
  }
  await page.type('input[type="email"]', process.env.ADMIN_STAFF_EMAIL);
  await page.type('input[type="password"]', process.env.ADMIN_STAFF_PASSWORD);
  await page.click('button[type="submit"]');

  console.log('Waiting for search input...');
  await page.waitForSelector('input[placeholder*="Enter keyword"]', { timeout: 30000 });

  console.log('Searching...');
  await page.type('input[placeholder*="Enter keyword"]', 'birthday cake');
  await page.click('button:has(svg.lucide-search)');

  console.log('Waiting for images...');
  await page.waitForSelector('.gs-image-box img', { timeout: 30000 });

  console.log('Images loaded. Waiting 2s...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Clicking first image link...');
  const firstImage = await page.$('.gs-image-box a');
  if (firstImage) {
    await firstImage.click();
    console.log('Clicked first image');

    // Wait for expansion/modal
    await new Promise(r => setTimeout(r, 2000));

    console.log('Checking for full size image DOM presence...');
    const previewImage = await page.$('img.gsc-image-preview');
    if (previewImage) {
      console.log('Found full size image in DOM!');
      const isVisible = await previewImage.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });
      console.log('Is large image visually visible?', isVisible);
    } else {
      console.log('Full size image not found in DOM!');
    }
  } else {
    console.log('Could not find image to click');
  }

  await browser.close();
  console.log('Done');
})();
