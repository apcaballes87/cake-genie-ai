import { buildMarketingPageMetadata } from '@/lib/utils/metadata';
import ChatGptCakeDesignQuoteClient from './ChatGptCakeDesignQuoteClient';
import {
  CHATGPT_CAKE_DESIGN_QUOTE_DESCRIPTION,
  CHATGPT_CAKE_DESIGN_QUOTE_FAQS,
  CHATGPT_CAKE_DESIGN_QUOTE_H1,
  CHATGPT_CAKE_DESIGN_QUOTE_SLUG,
  CHATGPT_CAKE_DESIGN_QUOTE_TITLE,
} from './content';

const canonicalPath = `https://genie.ph/${CHATGPT_CAKE_DESIGN_QUOTE_SLUG}`;

export const metadata = buildMarketingPageMetadata({
  title: CHATGPT_CAKE_DESIGN_QUOTE_TITLE,
  description: CHATGPT_CAKE_DESIGN_QUOTE_DESCRIPTION,
  canonicalPath,
});

export default function ChatGptCakeDesignQuotePage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: CHATGPT_CAKE_DESIGN_QUOTE_TITLE,
      headline: CHATGPT_CAKE_DESIGN_QUOTE_H1,
      description: CHATGPT_CAKE_DESIGN_QUOTE_DESCRIPTION,
      url: canonicalPath,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Genie.ph',
        url: 'https://genie.ph',
      },
      about: {
        '@type': 'Thing',
        name: 'ChatGPT cake design quotes in Cebu',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://genie.ph',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: CHATGPT_CAKE_DESIGN_QUOTE_TITLE,
          item: canonicalPath,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: CHATGPT_CAKE_DESIGN_QUOTE_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ];

  return (
    <>
      {jsonLd.map((schema, index) => (
        <script
          key={`chatgpt-cake-design-quote-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}
      <ChatGptCakeDesignQuoteClient />
    </>
  );
}
