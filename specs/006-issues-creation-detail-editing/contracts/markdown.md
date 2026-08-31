# Contract — the shared markdown renderer

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**:
[`../research.md`](../research.md) group C

`OT-DATA-015` fixes one markdown subset for issue **and** project descriptions in a single sentence.
Roadmap §1.1 names R6 as where that bites, records that the subset is hand-written rather than
bought, and leaves its design to this child spec. `FR-044` makes the extraction a requirement of this
feature rather than an option left to its plan.

This file is the grammar, the module boundary, and what R5 and every later reader inherit.

---

## Module

```
src/components/shared/markdown/
  parse.ts        parseMarkdown(source: string): Block[]     pure, no React
  markdown.tsx    <Markdown source={…} />                    blocks → React elements
```

`AGENTS.md` promotes to `src/components/shared` after a **real second use**, and this is it: two R5
surfaces and two R6 surfaces. Principle I's precondition is met by fact, not by anticipation.

Two files rather than one because the escaping and allowlist guarantees (`SC-013`) are claims about
the parsed **tree**, and asserting them against a value in the node project is sharper and cheaper
than asserting them against rendered DOM. The rendering test then covers what the tree becomes.

`src/components/ui` is still not created. Nothing here is a reusable accessible primitive, and R2 and
R5 made the same call.

**No dependency is added.** `marked` and `react-markdown` are absent from `AGENTS.md`'s approved
table, and reaching for either adds an unapproved package to render a grammar smaller than its own
options object (IV, roadmap §1.1).

---

## The grammar, closed

Blocks are found line by line; a blank line ends a block.

| Block | Written as |
| --- | --- |
| Heading, levels 1–6 | `#` … `######` followed by one space |
| Bullet item | a line beginning `- ` or `* ` |
| Numbered item | a line beginning with digits, then `.`, then one space |
| Paragraph | anything else |

Inline, inside a paragraph, a heading or a list item:

| Inline | Written as |
| --- | --- |
| Bold | `**text**` |
| Italic | `*text*` |
| Inline code | `` `text` `` |
| Link | `[text](url)` |

**That is the whole grammar.** Seven constructs, matching `FR-009` exactly.

### What is deliberately not in it

| Not supported | Renders as | Why |
| --- | --- | --- |
| Tables, images, embeds | their own literal characters | `FR-009`, `OT-DATA-015` name each as excluded |
| HTML of any kind | its own literal characters, escaped | `FR-009` — escaped, not rendered |
| Fenced or indented code blocks | literal characters | not among the seven; inline code is |
| Blockquotes, horizontal rules | literal characters | not among the seven |
| `_italic_`, `__bold__` | literal characters | `_` is a word character here — see below |
| Backslash escapes (`\*`) | literal characters | not a construct; adding one adds a rule the spec does not state |
| Bare URLs (autolinks) | text | not a construct; a link is written `[text](url)` |
| Nested lists | flattened into one list | leading whitespace before a marker is not significant |
| Inline nodes inside inline nodes | the inner delimiters render literally | see below |

### `_` is left alone entirely

A bug tracker's descriptions are full of `project_id`, `snake_case`, `sort_order`, `issue_counter`
and `must_change_password`. A subset that treats `_` as emphasis renders `created_at and updated_at`
with an italic run through the middle of it. `*` alone costs an author one keystroke of unfamiliarity
and removes a whole class of surprise.

### Inline nodes do not nest

A bold node carries a string, not children. `**bold *and italic***` renders bold text containing
literal asterisks, and `[**bold**](url)` renders a link labelled `**bold**`. Nesting means a
delimiter stack, a rule for crossing pairs, and a decision about every degenerate case — machinery
Principle III admits only for a requirement present today, and `FR-009` names seven constructs
without naming a composition of them.

---

## Two guarantees, and how each is structural rather than defended

### HTML cannot be rendered, because no HTML is ever produced

The renderer builds React elements. It never builds an HTML string and
`dangerouslySetInnerHTML` never appears — `AGENTS.md` requires exactly this. `<b>hi</b>` is not a
construct in the grammar above, so it falls through to a text node, and React escapes text nodes.

There is no sanitizer to bypass because there is no parser output that could carry markup. `FR-009`
and `SC-013` hold by the shape of the code rather than by a filter someone could weaken.

### A link's scheme is checked at parse time, not at render time

`FR-010`, `OT-DATA-015`, `AGENTS.md` → Architecture notes. While `[text](url)` is being read:

- `http:`, `https:` and `mailto:` become a link node;
- **everything else** makes the whole construct a text node carrying the characters the author typed
  — `javascript:`, `data:`, `file:`, a scheme-relative `//host`, an empty href.

Deciding at parse time means the renderer has no branch and no way to render an unchecked href, and
the allowlist has one call site to test. `SC-013`'s "no link with an unlisted scheme is ever
clickable" is then a property of the tree.

---

## The extraction

`FR-044`, and the sequencing matters.

**R5 writes it inside R5.** Project descriptions are the subset's first call site, and Principle I
extracts at the *second* precisely so the first does not guess the shared shape. R5's plan should
place the implementation under `src/features/projects/` and must not pre-place it in
`src/components/shared/` to save this feature the move.

**R6 moves it.** This feature promotes the module to the path above, repoints R5's two imports, and
adds nothing to its behaviour beyond whatever of the grammar above R5 had no call site for.

**What the move is allowed to change**: the module path and the two imports. Nothing else.

**The regression test is R5's own.** R5's description acceptance scenarios pass unchanged after the
move and are what proves the extraction changed nothing (`FR-044`, `SC-017`). A genuine divergence
from `OT-DATA-015` found in R5's implementation — a construct missing, or one supported that the
subset excludes — is an **R5 defect, fixed as one**, not absorbed into this feature's diff.

**`SC-017` is the outcome**: an issue description and a project description holding identical source
render identically, because one implementation renders both.

---

## What consumes this, and what does not

| Surface | Reads or writes | Entry |
| --- | --- | --- |
| Project description, on the record | rendered | R5 |
| Project description, while editing | raw source | R5 |
| Issue description, on the issue page | rendered | R6 |
| Issue description, on the create form | raw source | R6 |

**Neither write surface offers a preview or a formatting toolbar.** The field shows raw source and
the rendered form appears on save — on the create form and the issue page alike (`FR-044`).

**Comments are not markdown.** §3.4 keeps them plain text with mention tokens, and R7 renders those
through its own path. This module has no comment caller, now or later.
