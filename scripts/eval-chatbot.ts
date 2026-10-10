/**
 * Live evaluation of the customer-chat assistant against real customer questions.
 * Calls Claude (needs ANTHROPIC_API_KEY); touches no database and sends nothing.
 *
 *   npx tsx --env-file=.env.local scripts/eval-chatbot.ts
 */
import { decideWithClaude } from '@/lib/chatbot/assistant';
import {
  DEFAULT_AUTO_CATEGORIES,
  applyDecisionPolicy,
  findForcedHandoff,
  type BotAction,
} from '@/lib/chatbot/guardrails';

type Case = { text: string; expect: BotAction[]; mustInclude?: RegExp; mustNotInclude?: RegExp };

const CASES: Case[] = [
  // Should be answered
  { text: 'Hi, do you deliver in quezon city?', expect: ['reply'], mustInclude: /metro cebu|not|sorry/i },
  { text: 'Hi free delivery ba gihapon if sa lapu2?', expect: ['reply'], mustInclude: /200/ },
  { text: 'Do you deliver to Cavite?', expect: ['reply'], mustInclude: /pick ?up/i, mustNotInclude: /treehouse|aboitiz|camputhaw/i },
  { text: 'How much is this cake', expect: ['reply'], mustInclude: /genie\.ph/i },
  { text: 'hm po sa price list nyo?', expect: ['reply'], mustInclude: /price-list/ },
  { text: 'hello', expect: ['reply'] },
  { text: 'Where are you located?', expect: ['reply'], mustInclude: /cebu/i },
  { text: 'how to pay by visa and master card ?', expect: ['reply'], mustInclude: /xendit|checkout|card/i },
  { text: 'Do you have minimalist cake designs?', expect: ['reply'], mustInclude: /collections\/minimalist/ },
  { text: 'do you have kuromi cakes?', expect: ['reply'], mustInclude: /collections\// },
  { text: 'How do I order?', expect: ['reply'], mustInclude: /cart|upload/i },
  { text: 'Can I change the flavor to mocha?', expect: ['reply', 'handoff'], mustInclude: /chocolate|vanilla|ube|soon/i },
  { text: 'Do you make money pulling cakes?', expect: ['reply'], mustInclude: /400/ },
  { text: 'until what time can I order for same day?', expect: ['reply'], mustInclude: /4/ },
  { text: 'Pwede ba magpadala ng picture dito para malaman ang price?', expect: ['reply'], mustInclude: /chat|here|dito/i },
  // Must go to the admin
  { text: 'what is the status of my order #ORD-20260814-23231', expect: ['handoff'] },
  { text: 'I want a refund, the cake was wrong', expect: ['handoff'] },
  { text: 'Can you make a cake that looks exactly like my pet pomeranian? Needs to be 3D', expect: ['handoff'] },
  { text: 'I need a 3 tier wedding cake quote for 120 guests on Dec 12 at Marco Polo', expect: ['handoff'] },
  { text: 'Can I get it delivered tomorrow 9am at Banilad?', expect: ['handoff'] },
  { text: 'I would like to speak to a person', expect: ['handoff'] },
  // Should stay quiet
  { text: '3vd8ytk3c36i3', expect: ['silent', 'handoff'] },
  { text: 'ok thank you!', expect: ['silent'] },
];

async function main() {
  let failed = 0;

  for (const testCase of CASES) {
    const forced = findForcedHandoff(testCase.text);
    const raw = forced
      ? { action: 'handoff' as const, category: forced, confidence: 1, reply: '', reason: 'forced' }
      : await decideWithClaude(`<conversation>\nCustomer: ${testCase.text}\n</conversation>`, []);
    const decision = applyDecisionPolicy({ decision: raw, allowedCategories: DEFAULT_AUTO_CATEGORIES });

    const actionOk = testCase.expect.includes(decision.action);
    const contentOk = !testCase.mustInclude || decision.action !== 'reply' || testCase.mustInclude.test(decision.reply);
    const forbiddenOk = !testCase.mustNotInclude || !testCase.mustNotInclude.test(decision.reply);
    const ok = actionOk && contentOk && forbiddenOk;
    if (!ok) failed += 1;

    console.log(`${ok ? 'PASS' : 'FAIL'}  [${decision.action}/${decision.category} ${decision.confidence}]  ${testCase.text}`);
    if (decision.reply) console.log(`      → ${decision.reply}`);
    if (!ok) console.log(`      expected ${testCase.expect.join('|')}${testCase.mustInclude ? ` and reply matching ${testCase.mustInclude}` : ''}; reason: ${decision.reason}`);
  }

  console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
