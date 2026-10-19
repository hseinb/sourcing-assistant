# Sourcing Assistant — Active Debugging List

This document tracks reported bugs, diagnostic traces, and resolution statuses.

---

## Active / Pending Issues

### ⚠️ BUG-003: Image Extraction Fails on Legacy Excel (.xls / BIFF8 / OLE2) Files
* **Status**: `Pending`
* **Reported By**: User
* **File Under Test**: `销售单义乌市达而贸易有限公司唛头BBCXS202608280010 (1).xls`
* **Root Cause Discovered**:
  * `extractor.ts` (`parseExcelWithImages` & `extractImagesFromSheetScoped`) strictly expects OpenXML `.xlsx` ZIP containers with `xl/media/` and `xl/drawings/drawing1.xml`.
  * Legacy `.xls` files are Compound File Binary Format (CFBF/OLE2/BIFF8) where images are embedded as binary Escher OfficeArt BLIP records and Drawing Client Anchors (`0xF010`), not OpenXML DrawingML files.
  * Although `XLSX.read` correctly parses cell text/numbers from `.xls`, `extractImagesFromSheetScoped` finds no `xl/media` or `xl/drawings` files in the archive, returning 0 image blobs.

---

## Resolved Issues

### ✅ BUG-005: Total Cartons Rollup String Concatenation in Excel Importer PO Generation
* **Status**: `Resolved`
* **Reported By**: User
* **PO Fixed**: `PO-EXCEL-654737` (Fixed total cartons from 4252 to 31 in database)
* **Root Cause Discovered**:
  * In `src/app/excel/import/page.tsx`, when users edited row inputs, `handleUpdateRow` saved string values from `e.target.value`.
  * In `handleGeneratePurchaseOrder`, `uploadedItems.reduce((sum, item) => sum + (item.cartonCount || 0), 0)` performed string concatenation (`"4"` + `"2"` + `"5"` + `"2"` = `"4252"`), which PostgreSQL coerced into integer `4252`.
* **Fix Implemented**:
  1. Sanitized all numeric fields in `handleUpdateRow` (`cartonCount`, `pcsPerCarton`, `quantityPcs`, `priceCNY`, `cbmPerCarton`, `totalCbm`).
  2. Wrapped all rollup `.reduce` accumulators in `Number(...)`.
  3. Updated `PO-EXCEL-654737` to `total_cartons = 31` in Supabase PostgreSQL and ran a consistency sync query across all POs.
* **Verified**: Compiled cleanly with `npx tsc --noEmit` (0 errors), database verified.

### ✅ BUG-004: Desktop Navigation Drawer Scrolling Away With Page
* **Status**: `Resolved`
* **Reported By**: User
* **Root Cause Discovered**:
  * In CSS, `position: sticky` on the `<aside>` element was broken because the parent `<body>` in `src/app/layout.tsx` had `overflow-x-hidden` and `h-full`, which breaks viewport sticky positioning during document scrolling.
* **Fix Implemented**:
  1. Updated `src/components/layout/Sidebar.tsx` to use true viewport-fixed positioning: `fixed inset-y-0 left-0 w-64 z-40`.
  2. Updated `src/app/layout.tsx` to offset the main content wrapper with `md:pl-64`, removed `overflow-x-hidden` from `<body>`, and kept `Navbar` sticky at `top-0 z-30`.
* **Verified**: Compiled with `npx tsc --noEmit` (0 errors).

---

### ✅ BUG-002: Excel Importer "Generate PO Directly" Failed with Empty PO Created
* **Status**: `Resolved`
* **Reported By**: User
* **Root Cause Discovered**:
  * In `src/app/excel/import/page.tsx` (`handleGeneratePurchaseOrder`), line item property names were mismatched with the Postgres table schema:
    - `purchase_order_id` $\rightarrow$ `po_id`
    - `item_code` $\rightarrow$ `item_code_snapshot`
    - `item_name` $\rightarrow$ `item_name_snapshot`
    - `image_url` $\rightarrow$ `image_url_snapshot`
  * PostgREST rejected the insert, causing the previously inserted PO header to remain empty.
* **Fix Implemented**:
  1. Updated `poLineItems` mapping in `src/app/excel/import/page.tsx` to match the exact database column names.
  2. Added automatic rollback logic to delete the empty PO header if line items insertion ever fails.
* **Verified**: Compiled successfully with `npm run build` (0 errors).

---

### ✅ BUG-001: Excel Image Row Alignment Mismatch in Parsed Rows
* **Status**: `Resolved`
* **Reported By**: User
* **Root Cause Discovered**: Multi-sheet drawing collisions, non-chronological drawing order, and multi-row anchor spans (`from.row` $\rightarrow$ `to.row`).
* **Fix Implemented**: Sheet-scoped drawing extraction (`extractImagesFromSheetScoped`) with multi-row span propagation.
