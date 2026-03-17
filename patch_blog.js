const fs = require('fs');
const path = './src/app/blog/[slug]/page.tsx';

let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import NewsletterPopup')) {
    content = content.replace("import LazyImage from '@/components/LazyImage';", "import LazyImage from '@/components/LazyImage';\nimport NewsletterPopup from '@/components/NewsletterPopup';");
    content = content.replace("</article>", "</article>\n      <NewsletterPopup />");
    fs.writeFileSync(path, content);
    console.log("Patched blog page successfully.");
} else {
    console.log("Already patched.");
}
