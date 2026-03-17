const fs = require('fs');
const path = './src/app/page.tsx';

let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import NewsletterPopup')) {
    content = content.replace("import { LandingFooter } from '@/components/landing/LandingFooter';", "import { LandingFooter } from '@/components/landing/LandingFooter';\nimport NewsletterPopup from '@/components/NewsletterPopup';");
    content = content.replace("<LandingFooter />", "<LandingFooter />\n            <NewsletterPopup />");
    fs.writeFileSync(path, content);
    console.log("Patched page.tsx successfully.");
} else {
    console.log("Already patched.");
}
