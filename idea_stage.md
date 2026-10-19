# Sourcing Assistant — Ideas & Enhancement Backlog

This backlog documents approved ideas, enhancements, and roadmap items for the Sourcing Assistant project.

---

## Active Discussion: None

---

## Completed Features

### ✅ Flexible Purchase Order Payment Terms Suite (COD, Net 30, Net 60, Net 90, Deposit)
* Added `payment_terms` and `payment_due_date` columns in PostgreSQL `sourcing_purchase_orders`.
* Supported selectable payment terms presets (Cash on Delivery / COD, 30 Days After Receiving, 60 Days After Receiving, 90 Days After Receiving, 30% Deposit + Balance Before Delivery, 100% Advance, Custom).
* Auto-calculates projected due dates from delivery dates and auto-adjusts deposit requirements (0% deposit for COD & credit terms).
* Full lifecycle integration across PO creation (`/orders/new`), PO editing & view (`/orders/[id]`), orders list (`/orders`), Excel import (`/excel/import`), and container consolidation (`/containers/[id]`).

### ✅ Executive Container Supplier Financial Summary (Excel & UI)
* Implemented `exportContainerSupplierSummaryExcel` generating a spreadsheet summarizing each supplier in the container with store / booth numbers (`shop_no`), contact person, phone, WeChat ID, PO numbers, total order value, paid deposits, balance due, payment terms, and due dates.
* Automated Excel `=SUM(...)` formulas for total container financial outlay, paid amount, and remaining balance due.
* Added on-screen Supplier Financial Breakdown table and download buttons inside the Container workspace (`/containers/[id]`).

### ✅ Interactive Excel Image Alignment & Shifting Suite
* Delete & Push Up ("Push up a notch"), Shift Down, Replace Photo, Clear Photo, and Global Column Nudge.

---

## Backlog: PO Full Editing Suite & Automatic Supplier Ledger Synchronization

### 1. 📝 Comprehensive Purchase Order Editor (`/orders/[id]`)
* **Edit Existing Items**: Real-time inline editing of carton count, pcs/carton, unit price RMB, carton CBM, gross weight, item code, internal code (`BBC-5001`), and product name.
* **Add Items to PO**: Select items from the Sourced Catalog or add custom new items on the fly.
* **Remove Items**: Delete any row from the PO with instant rollup re-computation.
* **Header Editing**: Edit PO Number, Deposit %, Shipping Mark, Delivery Date, and Notes.
* **Sync**: Recomputes all PO financials and volume totals, saving atomically to Supabase.

### 2. 💰 Complete PO-to-Ledger Financial Integration
* **Auto-Invoice Creation**: Every issued/created Purchase Order automatically creates/syncs a **Credit - Invoice** entry in `sourcing_supplier_ledger` for the supplier.
* **Link Payments/Deposits to PO**:
  - The Ledger modal (`/suppliers/[id]`, `/ledger`) includes a **"Link to Purchase Order"** selector.
  - Recording a deposit or balance payment linked to a PO automatically updates `deposit_paid_cny`, `balance_due_cny`, and updates PO status (e.g. advances to `Deposit Paid`).
* **Direct "Record Payment" from PO Workspace (`/orders/[id]`)**:
  - One-click button inside the PO details page to pay deposit or balance, pre-populating amounts and logging directly into the supplier ledger.
