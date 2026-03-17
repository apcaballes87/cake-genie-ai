const fs = require('fs');
const path = './src/app/customizing/[slug]/page.tsx';

let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import NewsletterPopup')) {
    content = content.replace("import LazyImage from '@/components/LazyImage'", "import LazyImage from '@/components/LazyImage'\nimport NewsletterPopup from '@/components/NewsletterPopup'");

    // Find where the CustomizationProvider ends to inject the popup at the end of the page body.
    content = content.replace("</CustomizationProvider>", "    <NewsletterPopup />\n            </CustomizationProvider>");

    fs.writeFileSync(path, content);
    console.log("Patched customizing page successfully.");
} else {
    console.log("Already patched.");
}
