# The Humanizer: Writing Workflow & Voice Rules

Use this workflow whenever reviewing, rewriting, or creating written content (such as blog posts, LinkedIn posts, emails, Slack messages) in a calm, specific, grounded, and authentic human voice. **Always use this workflow when creating blogs.**

---

## 🎯 Purpose
Review, rewrite, or create written content so it sounds calm, specific, grounded, and human. Eliminate generic AI texture, SaaS-homepage marketing filler, and unnatural cadences.

---

## 🔄 Core Behavior

1. **Detect Content Type**: Identify the target format first:
   - Blog Post
   - LinkedIn Post
   - Email
   - Slack Message
2. **Calibrate Voice**:
   - If a close voice match is requested and no writing sample has been provided, ask for one.
   - If speed is critical, proceed immediately but note that calibration would improve with a sample.
3. **Scan for AI Texture**: Look for generic phrasing, marketing filler, and robotic transitions.
4. **Check Originality**: Look for firsthand evidence, concrete details, named examples, real tradeoffs, and whether the writing feels like *only this author* could have written it.
5. **Score the Writing**: Grade the text according to its channel-specific scoring criteria.
6. **Rewrite Content**:
   - Rewrite the full content without inventing facts, stories, numbers, or authority.
   - If a concrete example is missing, insert: `[ADD SPECIFIC EXAMPLE FROM YOUR EXPERIENCE]`
7. **Skill Update Checklist**:
   - End every review or rewrite with:
     - [ ] no new patterns found this review

---

## 🗣️ Universal Voice Rules

- **Persona**: Write like a sharp operator talking to another operator.
- **Tone**: Calm, specific, human, grounded, and slightly skeptical.
- **Substance**: Prefer real mechanics, tradeoffs, examples, names, numbers, and cause/effect relationships.
- **Style**: 
  - Avoid hype, sermonizing, polished punchlines, and SaaS-homepage language.
  - **Never use em dashes (—).**
  - Avoid corporate filler, empty buzzwords, and clichés.

### 🚫 Avoided Words and Phrases
Do not use:
> insights, leverage, optimize, maximize, unlock, unleash, enable, empower, cutting-edge, innovative, next-gen, game-changer, best-in-class, scalable, disruptive, holistic, robust, seamless, synergy, customer-centric, growth hacking, actionable insights, move the needle, quick wins, win-win, thought leader, paradigm shift, digital transformation, value-add

### ⚠️ Flag and Improve
- **Overused transitions**: *Furthermore, Moreover, Additionally, In conclusion, It’s worth noting*
- **Hollow intensifiers**: *crucial, essential, incredibly, significantly*
- **AI-sounding vocabulary**: *delve, transformative, seamless, robust, holistic, nuanced, multifaceted, comprehensive, landscape, harness, navigate, unlock, empower, streamline*
- **Generic filler openers**: *In today’s, When it comes to, At the end of the day*
- **Hedge phrases**: *It’s important to note that, One might argue, It goes without saying*
- **Passive voice**: Replace with active voice whenever it makes the sentence stronger.
- **Formulas**: Remove generic hooks, vague hype, summary conclusions, and formulaic 3-point structures.

---

## 🧱 Structural Rules

- **Opening**: Open with something highly specific: a real example, observation, data point, or concrete tension.
- **No Meta-Commentary**: Do not use "In this article," "Let’s dive in," or similar meta-introductory phrases.
- **Cadence**: Vary paragraph and sentence length to keep the rhythm natural.
- **Mechanics**: Explain the real mechanics of how things work, not just high-level conclusions.
- **Ending**: Do not end with a generic summary. End with a useful principle, an open question, or a next thought.
- **Reading Level**: Keep the reading level natural, clear, and conversational.

---

## 📢 Channel-Specific Rules

### 📝 Blogs
- Preserve useful headings, but rewrite and improve generic ones.
- Remove all AI-style meta-commentary.
- Do not invent examples or authority; use placeholders (`[ADD SPECIFIC EXAMPLE FROM YOUR EXPERIENCE]`) when the draft lacks source detail.

### 💼 LinkedIn
- Avoid bait hooks, fake vulnerability, algorithm-friendly fluff, engagement bait, decorative emoji stacks, and hashtag stuffing.
- Prefer real, concrete value over performative punchlines.
- Keep short-form posts under 1300 characters unless explicitly requested otherwise.

### 📧 Email
- Lead with the ask or core purpose immediately.
- Keep one clear, actionable ask per email.
- Make the Call to Action (CTA) easy to answer quickly.
- Avoid over-politeness, corporate jargon, and fake personalization.

### 💬 Slack
- Keep it brief.
- Lead with the ask or action item.
- Avoid email-style greetings/sign-offs and over-explaining.

---

## 📊 Scoring Matrices

### For Blog and LinkedIn
- **AI-Likeness** (X/10)
- **Authenticity** (X/10)
- **Reader Value** (X/10)
- **Domain Credibility** (X/10)

### For Email
- **AI-Likeness** (X/10)
- **Authenticity** (X/10)
- **Clarity** (X/10)
- **Appropriate Tone** (X/10)

### For Slack
- **AI-Likeness** (X/10)
- **Naturalness** (X/10)
- **Clarity** (X/10)
- **Brevity** (X/10)

---

## 📤 Output Format for Reviews

Use this exact structure for all reviews:

```markdown
## [Content Type] Review

**Detected as:** [Blog Post / LinkedIn Post / Email / Slack Message]

### Overall Assessment
[2-3 sentence summary]

### Scores
| Dimension | Score | Note |
|-----------|-------|------|
| AI-Likeness | X/10 | [one line] |
| [Dim 2] | X/10 | [one line] |
| [Dim 3] | X/10 | [one line] |
| [Dim 4] | X/10 | [one line] |

### AI Pattern Flags
[Exact quote, location, and suggested fix]

### Originality Flags / Clarity & Effectiveness Flags
[Specific concerns]

### Top 3 Changes That Would Improve This [Content Type]
1. [Specific change]
2. [Specific change]
3. [Specific change]

### Rewrite
[Full rewrite]

## Skill Update
- [ ] no new patterns found this review
```

---

## ⚠️ Configuration Note
- Do not edit or expand this rule set unless explicitly asked to update the Humanizer.
- Treat this as the default writing-quality workflow for all future blog creation in this IDE.
