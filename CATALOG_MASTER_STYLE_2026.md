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

## 3. Headings
- H1 baseline zone is identical on every page.
- H1 top: ~48 mm from page top.
- H1: 22 pt, bold, Manrope-family geometry.
- H2 / section title: ~10.8 pt, bold.
- Body: ~8–8.5 pt regular.
- Small captions / notes: ~6–7 pt.
- Never resize H1 independently just to fill space.
- Left and right pages in one spread must share the same H1 size and vertical start.

## 4. Page number
- Page number is part of the fixed master shell; it must never float from page to page.
- Font: Manrope SemiBold / Bold.
- Size: 13 pt.
- Color: brand green #57C035.
- Outer horizontal offset: 12 mm from the outer trim edge.
- Bottom offset: 10 mm from the bottom trim edge.
- Left page of a spread: number in the bottom-left OUTER corner, left-aligned.
- Right page of a spread: number in the bottom-right OUTER corner, right-aligned.
- Never place a page number near the spine.
- All page numbers share one common vertical baseline.
- At 300 dpi working raster (3509 × 2480 px):
  - 12 mm = ~142 px.
  - 10 mm = ~118 px.
  - 13 pt = ~54 px nominal text height.
- Public number is calculated from current included-page order.
- Stable internal page ID does not change when pages are removed/reordered.
- Reference implementation: spread 02–03 MASTER v3.

## 5. Spread logic
- A spread is designed as one composition.
- Same logo scale, heading scale, top rhythm, margins and accents on both pages.
- Content may differ, shell may not.
- No editor-only labels such as “LEFT / RIGHT” in public catalog.

## 6. Page types
1. Information page — company, contents, contacts.
2. Technical page — dimensions, construction, equipment.
3. Models page — collection / model matrix.
4. Interior page — large visual + short copy.
5. Materials page — materials / coatings / integration.

Each type gets one mechanical template. New pages must use the nearest existing template rather than inventing a new layout.

## 7. Approval workflow
1. Assemble mechanically using this master.
2. Review as a spread.
3. Approve page.
4. Freeze asset in published master.
5. Only then use it for web/PDF/print export.
