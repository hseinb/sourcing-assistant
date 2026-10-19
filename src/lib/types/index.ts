export interface ERPItem {
  item_id: number;
  code: string | null;
  item_name: string | null;
  class_id: number | null;
  description: string | null;
  upc: string | null;
  qtty: number;
  price: number;
  material: string | null;
  house_rooms: string | null;
  length: number | null;
  width: number | null;
  thickness: number | null;
  weight: number | null;
  discount: number | null;
  tags: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  modified_date: string;
}

export interface ERPItemImage {
  ItemID: number;
  Thumb: string[] | Array<{ url?: string; [key: string]: any }>;
  View: string[] | Array<{ url?: string; [key: string]: any }>;
  Raw: string[] | Array<{ url?: string; [key: string]: any }>;
  UpdateDate: string;
}

export interface SourcingSupplier {
  id: string;
  name: string;
  shop_no: string | null;
  market_city: string | null;
  contact_person: string | null;
  phone: string | null;
  wechat_id: string | null;
  wechat_qr_url: string | null;
  business_card_url: string | null;
  categories: string[];
  rating: number;
  payment_terms: string | null;
  bank_details: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourcingItem {
  id: string;
  supplier_id: string | null;
  erp_item_id: number | null;
  internal_item_code: string | null;
  factory_item_code: string | null;
  factory_item_name_cn: string | null;
  item_name_en: string | null;
  description: string | null;
  primary_image_url: string | null;
  additional_image_urls: string[];
  price_cny: number;
  price_usd: number;
  pcs_per_carton: number;
  carton_length_cm: number;
  carton_width_cm: number;
  carton_height_cm: number;
  carton_cbm: number;
  carton_gross_weight_kg: number;
  carton_net_weight_kg: number;
  moq: number;
  material: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined relation fields
  supplier?: SourcingSupplier;
  erp_item?: ERPItem;
}

export type ContainerType = '20GP' | '40GP' | '40HQ' | '45HQ' | 'LCL';
export type ContainerStatus = 
  | 'Planning' 
  | 'Consolidating at WH' 
  | 'Loading' 
  | 'On Board' 
  | 'In Transit' 
  | 'Arrived Port' 
  | 'Customs Cleared' 
  | 'Received WH';

export interface SourcingContainer {
  id: string;
  container_number: string | null;
  seal_number: string | null;
  bl_number: string | null;
  container_type: ContainerType;
  max_cbm: number;
  shipping_line: string;
  status: ContainerStatus;
  warehouse_delivery_deadline: string | null;
  container_loading_date: string | null;
  etd: string | null;
  eta: string | null;
  forwarder_name: string | null;
  forwarder_contact: string | null;
  loading_warehouse_location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  purchase_orders?: SourcingPurchaseOrder[];
}

export type POStatus = 
  | 'Draft' 
  | 'PO Issued' 
  | 'Deposit Paid' 
  | 'In Production' 
  | 'Ready at Factory' 
  | 'Delivered to WH' 
  | 'Loaded' 
  | 'Received WH' 
  | 'Cancelled';

export const PO_PAYMENT_TERMS_PRESETS = [
  { value: 'Cash on Delivery (COD)', label: '📦 Cash on Delivery (COD) / 货到付款', defaultDeposit: 0 },
  { value: '30 Days After Receiving', label: '⏳ 30 Days After Receiving / 货到30天 (Net 30)', defaultDeposit: 0 },
  { value: '60 Days After Receiving', label: '⏳ 60 Days After Receiving / 货到60天 (Net 60)', defaultDeposit: 0 },
  { value: '90 Days After Receiving', label: '⏳ 90 Days After Receiving / 货到90天 (Net 90)', defaultDeposit: 0 },
  { value: '30% Deposit + Balance Before Delivery', label: '💰 30% Deposit + Balance Before Delivery / 30%定金+发货前尾款', defaultDeposit: 30 },
  { value: '100% Advance Payment', label: '⚡ 100% Advance Payment / 全款预付', defaultDeposit: 100 },
  { value: 'Custom', label: '✏️ Custom Payment Terms / 自定义条款', defaultDeposit: 30 },
] as const;

export interface SourcingPurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  container_id: string | null;
  status: POStatus;
  currency: string;
  total_amount_cny: number;
  total_amount_usd: number;
  deposit_required_percent: number;
  deposit_paid_cny: number;
  balance_due_cny: number;
  payment_terms?: string | null;
  payment_due_date?: string | null;
  total_pieces: number;
  total_cartons: number;
  total_cbm: number;
  total_weight_kg: number;
  shipping_mark: string | null;
  expected_factory_ready_date: string | null;
  warehouse_delivery_date: string | null;
  order_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  supplier?: SourcingSupplier;
  container?: SourcingContainer;
  items?: SourcingPurchaseOrderItem[];
}

export interface SourcingPurchaseOrderItem {
  id: string;
  po_id: string;
  sourcing_item_id: string | null;
  erp_item_id: number | null;
  internal_item_code: string | null;
  item_code_snapshot: string | null;
  item_name_snapshot: string | null;
  image_url_snapshot: string | null;
  quantity_pcs: number;
  pcs_per_carton: number;
  carton_count: number;
  unit_price_cny: number;
  unit_price_usd: number;
  total_price_cny: number;
  total_price_usd: number;
  carton_cbm: number;
  total_cbm: number;
  total_weight_kg: number;
  notes: string | null;
  created_at: string;
  // Joined fields
  sourcing_item?: SourcingItem;
  erp_item?: ERPItem;
}

export type LedgerEntryType = 
  | 'Credit - Invoice' 
  | 'Debit - Deposit' 
  | 'Debit - Balance Payment' 
  | 'Debit - Advance Wire' 
  | 'Adjustment' 
  | 'Refund';

export interface SourcingLedgerEntry {
  id: string;
  supplier_id: string;
  po_id: string | null;
  container_id: string | null;
  entry_type: LedgerEntryType;
  amount_cny: number;
  amount_usd: number;
  exchange_rate: number;
  payment_method: string | null;
  reference_no: string | null;
  receipt_url: string | null;
  notes: string | null;
  transaction_date: string;
  created_at: string;
  // Joined fields
  supplier?: SourcingSupplier;
  purchase_order?: SourcingPurchaseOrder;
}
