# B HOME — China Wholesale & Factory Sourcing Command Center (`SourcingAssisstant`)

An end-to-end **International Procurement, OpenXML Excel Image Parser, Multi-Currency Supplier Ledger & Container Consolidation Platform** built with **Next.js, TypeScript, and Supabase**.

Designed for **B HOME (Bachir Home)** to replace fragmented WeChat spreadsheets and manual landed-cost calculations across factory sourcing operations in **Yiwu, Guangzhou, Hangzhou, and Foshan**.

---

## 🎯 Business Problem Solved

International importers working with Chinese factories receive dozens of unstandardized Excel quotation and packing sheets (`货号`, `品名`, `单价`, `装箱量`, `总体积`, `毛重`) containing floating embedded product photos. Re-keying those sheets into an ERP, tracking 30% RMB/USD deposits vs. 70% balance due dates, and calculating 20GP/40GP/40HQ shipping container CBM volume and KG weight utilization manually takes days and causes costly errors.

**`SourcingAssisstant`** automates the entire workflow from supplier Excel ingestion to container stuffing and ERP SKU linking.

---

## ✨ Key Features & Automated Workflows

1. **In-Memory OpenXML Excel & Floating Image Extractor (`/excel/import`)**:
   - Uses `jszip` and custom XML DOM traversal (`xl/drawings/drawing*.xml`, `xl/_rels/`, `xl/media/`) to extract embedded product photos and anchor them to their exact worksheet rows.
   - Auto-detects bilingual Chinese/English column headers (`货号` Item No, `品名` Name, `单价` Unit Price, `装箱量` Carton Qty, `总体积` CBM, `毛重` Gross Weight).
   - Includes an interactive **Image Alignment & Shifting Suite** (*Push Up a Notch*, *Shift Down*, *Global Column Nudge*) to fix misaligned supplier drawings in 1 click.
2. **Bilingual Purchase Order & Financial Summary Generator (`exceljs`)**:
   - Generates factory-ready bilingual Chinese/English `.xlsx` Purchase Orders (`客户订单模版.xlsx`) with embedded product images and live `=SUM(...)` Excel formulas.
3. **Flexible Payment Terms & Automated Supplier Financial Ledger (`/orders`, `/ledger`)**:
   - Supports COD, Net 30/60/90, and Deposit + Balance structures across **RMB (CNY)** and **USD**.
   - Automatically calculates payment due dates, posts Credit Invoices to `sourcing_supplier_ledger`, and tracks deposit settlements per PO.
4. **8-Stage Container Consolidation & CBM/KG Stuffing Workspace (`/containers/[id]`)**:
   - Tracks containers across `Planning` → `Consolidating at WH` → `Loading` → `On Board` → `In Transit` → `Arrived Port` → `Customs Cleared` → `Received WH`.
   - Visual **CBM Volume & Gross Weight Utilization Bars**, **Container Stuffing Diagram**, direct **CMA CGM** carrier tracking links, and 1-click export of Container Packing Lists.

---

## 🛠️ Tech Stack

* **Framework**: Next.js 13.5 (App Router), React 18, TypeScript 5, Tailwind CSS
* **Excel & OpenXML Engine**: `jszip`, `xlsx` (SheetJS), `exceljs`
* **Backend & Storage**: Supabase (PostgreSQL + Supabase Storage buckets `sourcing-attachments` and `sourcing-item-images`, linked to ERP `tbl_items`)

---

## 🚀 Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run development server:
   ```bash
   npm run dev
   ```
