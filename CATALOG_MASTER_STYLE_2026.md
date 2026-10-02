# HIDDEN DOORS 2026 — MASTER STYLE

Status: baseline for mechanical assembly of all catalog pages.
Reference spread: pages 02–03.

## 1. Page
- Format: A4 landscape, 297 × 210 mm.
- Working raster: 3509 × 2480 px at 300 dpi.
- Background: white.
- Brand green: #57C035.
- Primary text: #231F20.
- Secondary text: neutral gray.
- All approved content stays intact; normalization changes only the visual shell unless separately approved.

## 2. Header grid
Reference: approved page 02.

- Outer page margin: 9.5–13.5 mm depending on element.
- Logo top: ~11.9 mm.
- Logo visual size: ~57.4 × 17.8 mm.
- Left page: logo in upper-left outer corner.
- Right page: same logo size in upper-right outer corner.
- Green rule: 16.7 × 1.5 mm.
- Green rule vertical position: ~38.7 mm from page top.
- Rule is always on the SAME outer side as the logo.
- Do not place the green rule near the spine if the logo is on the outer edge.

## 3. Typography and headings
- H1 baseline zone is identical on every page.
- H1 top: ~48 mm from page top.
- H1: 22 pt, Manrope Bold.
- H2 / section title: 12–14 pt, Manrope Bold.
- Main body: 9 pt preferred; never below 8.5 pt.
- Lists / contents / material names: 9 pt preferred; never below 8.5 pt.
- Small captions / notes: 7 pt minimum.
- Page number: 13 pt Manrope SemiBold / Bold.
- Never resize H1 independently just to fill space.
- Left and right pages in one spread must share the same H1 size, weight and vertical start.
- H1 is always Manrope Bold; do not mix Regular and Bold H1 inside one spread.
- If content does not fit, first optimize grid, spacing and grouping. Reducing text below the minimum readable size is not an acceptable layout solution.
- H1 safety zone: title edits may affect only the H1/subtitle area; they must never crop or erase the first content heading below.
- Minimum optical gap from the visible bottom of H1 to the next content heading: 8 mm.
- After any H1 normalization, verify the first row of content headings for intact glyphs and full ascenders/descenders.

## 4. Page number — FOLIO MASTER v1
- Status: **approved 2026-10-02**.
- Front cover is logically page 01, but the number is **not printed on the cover**.
- All other included pages use one shared folio component. Page numbers are never designed or positioned per page.
- Typeface: **Manrope SemiBold**.
- Nominal size: **10 pt**.
- Color: brand green **#57C035**.
- Left page of a spread: folio only in the **bottom-left outer corner**.
- Right page of a spread: folio only in the **bottom-right outer corner**.
- Horizontal outer offset: **8 mm from trim**.
- Bottom offset: **5 mm from trim**.
- No capsule, white/gray badge, rectangle, border or background is allowed behind a folio.
- On full-bleed photography only, a very thin white optical halo is allowed for legibility; it must not read as a box.
- A folio must never touch or overlap text, a card, a rule, a diagram, a model caption or another page element.
- Old page numbers and old spread ranges embedded in source artwork must be removed/masked before the new folio is shown.
- Legacy folio cleanup is audited page-by-page. A source page may contain more than one historical number; every historical folio must be removed so exactly one FOLIO MASTER number remains visible.
- Legacy-number cleanup must be optically invisible: its mask samples the actual local footer tone and must not interrupt nearby horizontal rules.
- Public folio is calculated from the final order of **included** pages. Stable internal/source page IDs never change when pages are hidden or reordered.
- Current public sequence after hiding 23A / Classic / Reverse: 01…23, then source 26→24, 27→25, 28→26, 29→27, 30→28 … source 43→41.
- Website, screen catalog and future print/PDF export must all use this same FOLIO MASTER v1.
- Control proof approved on six page types: 36 mm technical, 36 mm models, 36 mm interior, 42 mm technical, 59 mm materials and wall panels.

## 5. Spread logic
- Review and approval are spread-first: after the single front cover, all catalog work is shown and evaluated only as two-page spreads.
- Do not present isolated inner pages for visual approval unless the user explicitly asks for one.
- Any page normalization must be checked against its facing page before approval.
- Every working spread is shown together with the approved reference spread 02–03 at the same viewing scale, so logo, rule, H1, typography, margins and page numbers can be compared directly.
- A spread is designed as one composition.
- Same logo scale, heading scale, top rhythm, margins and accents on both pages.
- Content may differ, shell may not.
- No editor-only labels such as “LEFT / RIGHT” in public catalog.

## 6. Technical micro-elements
- Orphan technical fragments are not allowed: a section/profile/thickness sketch must visually belong to the parent schematic or explanatory block.
- Dimension labels, profile fragments and explanatory captions must not float in the footer zone.
- If a technical micro-diagram is not necessary for understanding, keep the confirmed text value and remove the decorative fragment rather than leaving a detached element.

## 7. Page types
1. Information page — company, contents, contacts.
2. Technical page — dimensions, construction, equipment.
3. Models page — collection / model matrix.
4. Interior page — large visual + short copy.
5. Materials page — materials / coatings / integration.

Each type gets one mechanical template. New pages must use the nearest existing template rather than inventing a new layout.

## 8. Readability balance inside a spread
- Both pages of one spread must have comparable visual readability and typographic weight.
- One page must not look like a readable editorial page while the opposite page looks like a compressed reference sheet.
- Main information must be readable at normal catalog viewing size without zoom.
- The visual shell may be mirrored, but font hierarchy, scale and rhythm must remain consistent.
- A page is considered non-compliant if its main text is visibly smaller than the neighboring page without a functional reason.

## 9. Contents / navigation pages
- Contents is an information page, not a technical micro-table.
- Section headers: 12–14 pt minimum.
- Navigation rows: 9 pt preferred; 8.5 pt absolute minimum.
- Page numbers inside contents use the same readable minimum as navigation text.
- Increase text size before adding decorative whitespace.
- If the contents becomes crowded, use:
  1. tighter internal spacing;
  2. two-column grouping;
  3. clearer section grouping;
  4. shorter wording where meaning is preserved.
- Do not solve overflow by shrinking primary navigation text below the readable minimum.

## 10. Optical consistency check
Before approval, every spread must pass a visual check at one common zoom:
- logo scale matches;
- green rule scale and vertical coordinate match;
- H1 baseline matches;
- main body/list text has comparable perceived size;
- page numbers share one baseline and outer-edge rule;
- neither page appears visually “weaker” only because its typography was reduced.

## 10. Font integrity and proof QA
- Mechanical assembly must use a full Cyrillic-capable Manrope font file, never an embedded/subset font extracted from a PDF.
- Missing glyphs, tofu squares, broken text or font fallback are release-blocking defects.
- Before showing any spread for approval, render the final spread to PNG and inspect it visually at 100%.
- Verify: Cyrillic text, digits, logo, page numbers, alignment, cropping and image quality.
- If a source page already contains approved raster/vector typography, preserve that typography rather than retyping it unless the master template requires a deliberate typography change.

## 11. Approval workflow
1. Assemble mechanically using this master.
2. Review as a spread.
3. Approve page.
4. Freeze asset in published master.
5. Only then use it for web/PDF/print export.


## 12. Frozen approved product pages
- Pages 06–21 (36 mm framed-panel / milled collections: MODENA, SIENA, LUCCA, AXIS, VECTOR, RHYTHM, ARC, FLUTE) are approved source pages and are **frozen as-is**.
- Do not crop, reframe, redraw, resize internal artwork, retype headings, move model cards, replace images, or apply the global master shell inside these approved pages.
- The website viewer may place two frozen pages side by side as a spread, but the page pixels themselves must remain unchanged.
- Any future edit to a frozen page requires an explicit user request for that exact page.
- For review, show the frozen spread exactly from the approved page assets, without editorial overlays inside the page area.
