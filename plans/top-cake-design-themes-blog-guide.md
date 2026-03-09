# Blog Reference Guide: Top Cake Design Themes

This guide provides templates and guidelines for creating "Top Cake Design Themes" blog posts for Genie.ph.

---

## Required Sections

### 1. Introduction

- Hook: Mention the celebration (birthday, toddler milestone)
- Acknowledge the popularity of the theme
- Promise of inspiration and guidance
- Brief overview of what the blog will cover

### 2. Theme Sections (5 themes)

For EACH theme, include:

#### Theme Name Heading (H2)

```
## 1. [Theme Name] Cake Designs
```

#### What Makes [Theme] Cakes Special (H3)

- Brief description of the character/show
- Why kids love it
- Color palette typically used
- What makes it special for Filipino celebrations

#### Popular [Theme] Cake Styles (H3)

Bullet list of 4-5 cake style options with brief descriptions:

- **Style Name**: Brief description
- Use bold for style names

#### Design Showcase Placeholder

```
[[design_showcase:theme-slug]]
```

### 3. How to Order Section (IMPORTANT)

Replace generic tips with this specific format:

```markdown
## How to Order Your Custom [Theme] Cake

Ready to bring your little one's favorite [theme] to life on a delicious birthday cake? Here is how to get started with Genie.ph:

1. **Upload Your Design Idea**: Have a specific design in mind? Simply upload your cake image or describe your vision on Genie.ph to get a personalized price quote in seconds
2. **Choose Your Flavor**: Popular options include vanilla, chocolate, ube, and mango—Filipino favorites that everyone loves
3. **Select Your Size**: We offer various sizes to match your guest count
4. **Rush Orders Welcome**: Need your cake sooner? We accept rush orders depending on availability—as early as 2 days in advance

Browse our design showcase above to find inspiration, or upload your own design idea to get started today!
```

---

## Important Guidelines

### DO NOT Include

- ❌ "Order 1-2 weeks in advance"
- ❌ Generic tips about providing reference images
- ❌ "Contact the bakery for details"

### MUST Include

- ✅ Upload design feature (get price in seconds)
- ✅ Rush orders: "as early as 2 days in advance"
- ✅ Flavor options: vanilla, chocolate, ube, mango
- ✅ Call to action: upload design or browse showcase

---

## Design Showcases Configuration

When inserting blog posts, include this JSON structure for design_showcases:

```json
[
  {"id":"theme-slug","title":"Theme Name Cake Designs","keyword":"theme name cake","intro":"Description of the theme cakes..."},
  {"id":"theme2-slug","title":"Theme 2 Cake Designs","keyword":"theme 2 cake","intro":"Description..."}
]
```

### Showcase Placeholder Format

Use lowercase, hyphenated format: `[[design_showcase:theme-slug]]`

---

## SEO Guidelines

### Keywords Format

- Primary keyword in title
- Include "cake" and "Philippines" or location-specific
- Use comma-separated format

### cake_search_keywords

- Comma-separated list of themes
- Include "character cake", "kids birthday cake", "toddler cake"
- Example: `hello kitty, minnie mouse, peppa pig, disney princess, barbie, character cake, kids birthday cake, toddler cake`

---

## Content Style

- Tone: Friendly, helpful, Filipino context
- Word count: 1,500+ words
- Use H2 for each theme
- Use H3 for subsections
- Bold style names in lists
- Keep sentences simple and conversational
- Include local context (Filipino flavors, celebrations)

---

## Example: Boys 1-3 Blog Themes

1. Cocomelon
2. Paw Patrol
3. Bluey
4. Peppa Pig
5. Mickey Mouse

## Example: Girls 1-3 Blog Themes

1. Hello Kitty
2. Minnie Mouse
3. Peppa Pig
4. Disney Princess
5. Barbie
