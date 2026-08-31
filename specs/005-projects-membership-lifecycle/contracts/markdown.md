# Contract — the markdown subset

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) → E · `OT-DATA-015`, `FR-010`, `FR-011`, `FR-039`

R5 is this rule's first caller and implements it (spec → *Clarifications*). R6 is the second call
site, where Principle I decides whether it is promoted out of this feature.

**It adds no dependency, and it never builds an HTML string.** `parse.ts` turns source into a block
and inline tree; `render.tsx` turns that tree into React nodes. Escaping is therefore React's own and
`dangerouslySetInnerHTML` never appears (AGENTS.md → Architecture notes, IV).

---

## Blocks

Source is split on blank lines. Each line is classified independently; consecutive list lines of the
same kind form one list.

| Block | Source | Renders as |
| --- | --- | --- |
| Heading | `#` … `######` followed by one space | `h1` … `h6` |
| Bullet list | consecutive lines starting `- ` or `* ` | `ul` > `li` |
| Numbered list | consecutive lines starting `<digits>. ` | `ol` > `li` |
| Paragraph | anything else | `p` |

Nothing else is a block. A table row, a blockquote, a fenced code block, an indented code block, an
image, an embed, an HTML tag: **no node type exists for them**, so each falls through to the
paragraph it was written in and appears as its own literal text (`FR-010`, spec → *Edge Cases*). That
is the requirement — `OT-DATA-015` says tables, images and embeds MUST NOT be supported — not a
shortfall.

**Ordinals are not honoured.** A numbered list renders as `ol` from position one whatever digits the
source used, because the subset has no node for a start offset and `ol` renumbers anyway. A list
written `3.` `4.` `5.` renders 1, 2, 3.

Nesting is not supported. A list item is a line of inlines, never a list. An indented line is a
paragraph, not a nested item — the block table has no indentation rule at all.

---

## Inlines

Applied inside every block.

| Inline | Source | Renders as |
| --- | --- | --- |
| Bold | `**text**` | `strong` |
| Italic | `*text*` or `_text_` | `em` |
| Inline code | `` `text` `` | `code` |
| Link | `[text](href)` | `a`, if the scheme passes — otherwise the literal text |

**Inline code wins.** Inside a code span no other marker is recognised, so `` `**a**` `` renders the
five characters `**a**` inside a `code` element. The alternative renders a different document from
the one that was written.

An unclosed marker is not a marker: `**bold` is the five characters. There is no error state — a
description is prose, and prose that looks like a half-written marker renders as prose. The parser is
total: every input produces output, so there is no parse failure for a screen to handle.

**There is no escape character.** A backslash is a backslash. Adding `\*` would mean deciding what a
lone backslash does everywhere else, and the subset is small enough that a literal asterisk survives
on its own — an unclosed marker is already just text, and inline code already suppresses every marker
inside it.

---

## Link schemes

`http`, `https`, `mailto` — and nothing else (`FR-011`).

**Only `[text](href)` is a link.** A bare URL, an autolink in angle brackets and a reference-style
`[text][id]` are none of them constructs the block and inline tables name, so each renders as its own
text. There is no scheme check to run on something that never becomes an anchor.

The check parses the href with the `URL` constructor and compares `protocol`. It does **not** match a
prefix: prefix matching is what `JaVaScRiPt:`, leading whitespace and `java\nscript:` defeat, and each
of those is a real bypass rather than a hypothetical one.

A href that fails to parse, or whose protocol is not one of the three, renders **the link's text as
plain text** — not a dead anchor, and not the raw source (spec, *Edge Cases*).

A relative href has no scheme, so it renders as text — and a protocol-relative `//host/path` fails to
parse without a base, which lands in the same branch. Nothing in a project description should link
into the app by relative path, and admitting one would mean deciding what it resolves against.

**A rendered link carries `rel="noopener noreferrer"` and opens in the same tab.** The description is
a record field, not a feed of outbound links, so nothing here should steal the tab's history; and a
link a member typed is still a link an admin did not, which is what `noreferrer` is for.

---

## HTML

Escaped, not rendered (`OT-DATA-015`). Because the renderer returns React nodes, `<script>alert(1)</script>`
in a description is a text node holding that string; there is no code path through which it could be
anything else.

The test asserts the rendered container's `textContent` equals the source and that
`container.querySelector("script")` is `null` — the assertion that fails the day someone reaches for
an HTML string.

**Control and bidirectional-override characters are not stripped.** They are text, they are stored as
written, and React renders them as text nodes; none of them can close an element or open an
attribute, because no markup is being assembled. Stripping them would silently rewrite a description
whose author meant them — which II forbids as surely as it forbids accepting bad input.

---

## Storage and editing

**Stored as markdown source** (`FR-010`, `FR-027`). The renderer runs on read.

**While the description is open for editing, the raw source is in the field** — never the rendered
form (`FR-039`, US2 scenario 12).

**An empty description reads as a placeholder, not as nothing.** On read there is no rendered output
to click, so the surface that opens the editor is a placeholder line carrying the same disabled
reason for a non-member as every other field on the screen (`FR-021`). Opening it yields an empty
field, and saving it empty is a legal write — the column is nullable and the description is optional
(`FR-027`).

---

## Where it lives

```text
src/features/projects/markdown/
├── parse.ts       source → blocks and inlines. No DOM, no React. Where the grammar's tests live
└── render.tsx     blocks and inlines → React nodes. Where the escaping and scheme tests live
```

Two modules rather than one because the parse is the part with the large test table and no DOM, and
the render is the part that needs jsdom.

**Not promoted to `src/lib` or `src/components/shared`.** One call site today; R6 is the second, and
that is where the shared shape is settled (I, spec → *Dependencies*).
