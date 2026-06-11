# Instruction: Fix Thin / Near-Duplicate Content on Custom Cake Product Pages

## Context
Our custom cake product pages (`/customizing/[slug]`) are dynamically generated from AI analysis records in `cakegenie_analysis_cache`. While we have AI analysis for almost all pages, the average unique content word count per page is **188 words**—which is flagged as "thin content" (under 250 words) by SEO search crawlers. 

To improve search visibility and user conversion rate optimization (CRO), we need to programmatically enrich these pages with **highly specific, context-aware information** that provides real consumer utility.

---

## Objectives
1. **Increase Unique Word Count:** Elevate the unique, non-boilerplate content on all customizing pages to **> 250–300 words**.
2. **Implement Budget-Saving Topper Swaps:** Dynamically suggest low-cost alternatives based on the specific decorations detected on the cake.
3. **Add Cake-Care Advice:** Add instructions on storing and transporting the cake based on the icing finish.
4. **Maintain Low Document Similarity:** Ensure the text remains distinct and does not exceed a 65% Jaccard similarity threshold.

---

## Step-by-Step Implementation Guide

### Step 1: Update the Description Generator
In `src/utils/designContentUtils.ts`, enhance `generateDesignDetails` to dynamically build a new paragraph containing **Budget Customization Tips** and **Cake Care Guidelines**.

#### Topper Replacement Logic:
Scan the `cakeType`, `icing_design`, `main_toppers`, and `support_elements` to dynamically suggest money-saving swaps:
* **Fondant Finish:** If `cakeType` or `icing_design.base` contains `"fondant"`, suggest:
  > *"You can save money on this design by changing the cake finish from fondant to soft icing."*
* **Edible Toppers:** If any topper contains `"edible"` (but is not a photo/print), suggest:
  > *"The edible toppers can be replaced with a plastic toy or a free paper printout."*
* **Toy Toppers:** If any topper contains `"toy"`, `"figure"`, `"doll"`, or `"plastic"`, suggest:
  > *"To reduce costs, the toy toppers can be replaced with a free paper printout."*
* **Edible Photo:** If any topper contains `"photo"`, `"image"`, or `"edible_print"`, suggest:
  > *"The edible photo elements can be replaced with a free paper printout."*
* **Glitter Cardstock Toppers:** If any topper contains `"cardstock"`, `"glitter"`, or `"paper_topper"`, suggest:
  > *"The glitter cardstock toppers can be replaced with a free printout."*

#### Cake Care Logic:
* **Soft Icing / Whipped Cream:** If the finish is soft/whipped icing, add:
  > *"Because this design features a delicate soft icing finish, keep the cake refrigerated until 30 minutes before serving. Always transport flat in an air-conditioned vehicle."*
* **Fondant:** If the finish is fondant, add:
  > *"To preserve the hand-crafted fondant details, store the cake in a cool, air-conditioned room and avoid direct sunlight. Avoid refrigerating fondant elements before serving to prevent condensation."*

---

### Step 2: Update the Dynamic FAQ Generator
In `src/utils/designContentUtils.ts`, update `generateDynamicFAQ` to add a new dynamic FAQ about budget customization options.

* **Question:** *"How can I customize this [Keywords] design to fit a smaller budget?"*
* **Answer:** Dynamically compile the topper replacement tips generated in Step A and format them as a detailed answer.

---

### Step 3: Run the Verification Audit
After applying these code changes, run the audit script to verify that unique content word counts have successfully risen above 250 words, and that the page similarity index remains under 60%.

```bash
npx tsx scripts/audit-thin-content.ts
```
