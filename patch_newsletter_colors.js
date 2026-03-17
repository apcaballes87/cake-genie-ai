const fs = require('fs');
const path = './src/components/NewsletterPopup.tsx';

let content = fs.readFileSync(path, 'utf8');

// Change modal container background to pink-50 (consistent with genie.ph background gradient start)
// and make it completely rounded to match common modern styling
content = content.replace("bg-[#FFF5F5] rounded-lg", "bg-pink-50 rounded-2xl");

// Change text colors to be darker purple/indigo (consistent with genie.ph)
content = content.replaceAll("text-[#2E3159]", "text-purple-900");

// Primary button color from peach #F39C8E to pink-500 (consistent with genie.ph primary action colors)
content = content.replaceAll("bg-[#F39C8E]", "bg-pink-500");
content = content.replaceAll("hover:bg-[#e08b7d]", "hover:bg-pink-600");

// Input borders and focus rings
content = content.replaceAll("border-[#F39C8E]", "border-pink-300");
content = content.replaceAll("focus:ring-[#F39C8E]", "focus:ring-pink-500");

// Text color for the new discount code text
content = content.replace("text-[#F39C8E]", "text-pink-600");

// Continue shopping button to use purple-600
content = content.replace("bg-[#2E3159] hover:bg-[#1f213d]", "bg-purple-600 hover:bg-purple-700");

// Cancel button to use a softer gray/indigo
content = content.replace("bg-[#717684] hover:bg-[#5a5e6a]", "bg-slate-500 hover:bg-slate-600");

fs.writeFileSync(path, content);
console.log("Patched NewsletterPopup colors successfully.");
