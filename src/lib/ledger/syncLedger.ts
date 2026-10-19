import { supabase } from '@/lib/supabase/client';

export interface POSyncData {
  id: string;
  supplier_id: string;
  po_number: string;
  total_amount_cny: number;
  order_date?: string | null;
}

/**
 * Ensures a 'Credit - Invoice' entry exists in sourcing_supplier_ledger for the given PO.
 * If one already exists with this po_id, it updates the amount and date.
 */
export async function syncPOInvoiceEntry(po: POSyncData): Promise<void> {
  if (!po.id || !po.supplier_id) return;

  try {
    // Check if an invoice entry already exists for this PO
    const { data: existing, error: findErr } = await supabase
      .from('sourcing_supplier_ledger')
      .select('id')
      .eq('po_id', po.id)
      .eq('entry_type', 'Credit - Invoice')
      .maybeSingle();

    if (findErr) {
      console.warn('Error checking existing PO invoice:', findErr);
    }

    const payload = {
      supplier_id: po.supplier_id,
      po_id: po.id,
      entry_type: 'Credit - Invoice',
      amount_cny: po.total_amount_cny,
      amount_usd: 0,
      exchange_rate: 1.0,
      payment_method: 'Invoice',
      reference_no: po.po_number,
      notes: `Purchase Order #${po.po_number} Invoice`,
      transaction_date: po.order_date || new Date().toISOString().slice(0, 10),
    };

    if (existing?.id) {
      await supabase
        .from('sourcing_supplier_ledger')
        .update(payload)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('sourcing_supplier_ledger')
        .insert(payload);
    }
  } catch (err) {
    console.error('Failed to sync PO invoice in ledger:', err);
  }
}

/**
 * Deletes any ledger invoice or linked records when a PO is deleted.
 */
export async function deletePOInvoiceEntry(poId: string): Promise<void> {
  if (!poId) return;
  try {
    await supabase
      .from('sourcing_supplier_ledger')
      .delete()
      .eq('po_id', poId);
  } catch (err) {
    console.error('Failed to delete PO ledger records:', err);
  }
}

/**
 * Recalculates total paid amounts for a PO from all Debit ledger records,
 * and updates deposit_paid_cny, balance_due_cny, and status on sourcing_purchase_orders.
 */
export async function recalculatePOPaidAmounts(poId: string): Promise<{
  totalPaid: number;
  balanceDue: number;
  statusUpdated: boolean;
}> {
  if (!poId) return { totalPaid: 0, balanceDue: 0, statusUpdated: false };

  try {
    // 1. Fetch the PO
    const { data: po, error: poErr } = await supabase
      .from('sourcing_purchase_orders')
      .select('*')
      .eq('id', poId)
      .single();

    if (poErr || !po) {
      console.error('PO not found for payment recalculation:', poErr);
      return { totalPaid: 0, balanceDue: 0, statusUpdated: false };
    }

    // 2. Fetch all Debit ledger entries linked to this PO
    const { data: debits, error: debErr } = await supabase
      .from('sourcing_supplier_ledger')
      .select('amount_cny, entry_type')
      .eq('po_id', poId)
      .ilike('entry_type', 'Debit%');

    if (debErr) {
      console.error('Error fetching debit ledger entries:', debErr);
    }

    const totalPaid = (debits || []).reduce((sum, d) => sum + (Number(d.amount_cny) || 0), 0);
    const totalAmount = Number(po.total_amount_cny) || 0;
    const balanceDue = Math.max(0, totalAmount - totalPaid);
    const depositRequired = (totalAmount * (Number(po.deposit_required_percent) || 30)) / 100;

    const updates: Record<string, any> = {
      deposit_paid_cny: totalPaid,
      balance_due_cny: balanceDue,
    };

    let statusUpdated = false;
    if (totalPaid >= depositRequired && (po.status === 'Draft' || po.status === 'PO Issued')) {
      updates.status = 'Deposit Paid';
      statusUpdated = true;
    }

    await supabase
      .from('sourcing_purchase_orders')
      .update(updates)
      .eq('id', poId);

    return { totalPaid, balanceDue, statusUpdated };
  } catch (err) {
    console.error('Error recalculating PO payments:', err);
    return { totalPaid: 0, balanceDue: 0, statusUpdated: false };
  }
}
