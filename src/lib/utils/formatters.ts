import { ContainerType } from "../types";

export function formatCNY(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "¥0.00";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number | null | undefined, decimals = 2): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function calculateCartonCBM(lengthCm: number, widthCm: number, heightCm: number): number {
  if (!lengthCm || !widthCm || !heightCm) return 0;
  const cbm = (lengthCm * widthCm * heightCm) / 1_000_000;
  return Number(cbm.toFixed(4));
}

export function getContainerMaxCBM(type: ContainerType): number {
  switch (type) {
    case "20GP":
      return 28.0;
    case "40GP":
      return 58.0;
    case "40HQ":
      return 68.0;
    case "45HQ":
      return 78.0;
    case "LCL":
      return 100.0;
    default:
      return 68.0;
  }
}

/**
 * Standard ocean shipping container maximum permissible cargo payload weight limits (in kg)
 */
export function getContainerMaxPayloadKg(type: ContainerType): number {
  switch (type) {
    case "20GP":
      return 21700; // 21.7 Tons
    case "40GP":
      return 26500; // 26.5 Tons
    case "40HQ":
      return 26500; // 26.5 Tons
    case "45HQ":
      return 27500; // 27.5 Tons
    case "LCL":
      return 100000;
    default:
      return 26500;
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export interface CarrierTrackingInfo {
  carrier: string;
  trackingUrl: string;
  isAutoDetected: boolean;
}

/**
 * Multi-Carrier Tracking Link Auto-Detector based on ISO container prefix standard (BIC code)
 */
export function getContainerTrackingInfo(containerNo: string | null | undefined, specifiedCarrier?: string): CarrierTrackingInfo {
  if (!containerNo || !containerNo.trim()) {
    return {
      carrier: specifiedCarrier || "CMA CGM",
      trackingUrl: "https://www.cma-cgm.com/ebusiness/tracking",
      isAutoDetected: false,
    };
  }

  const cleanNo = containerNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = cleanNo.substring(0, 4);

  // Auto-detect by 4-letter BIC prefix
  if (prefix.startsWith("MSCU") || prefix.startsWith("MEDU")) {
    return {
      carrier: "MSC",
      trackingUrl: `https://www.msc.com/en/track-a-shipment?query=${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("MAEU") || prefix.startsWith("MSKU") || prefix.startsWith("MRKU")) {
    return {
      carrier: "Maersk",
      trackingUrl: `https://www.maersk.com/tracking/${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("COSU") || prefix.startsWith("CBHU") || prefix.startsWith("CCLU")) {
    return {
      carrier: "COSCO Shipping",
      trackingUrl: `https://lines.coscoshipping.com/ebusiness/cargoTracking?trackingNumber=${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("ONEY")) {
    return {
      carrier: "Ocean Network Express (ONE)",
      trackingUrl: `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?type=cntrNo&number=${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("EGLV") || prefix.startsWith("EMCU")) {
    return {
      carrier: "Evergreen",
      trackingUrl: `https://ct.shipmentlink.com/servlet/TTrk_ConQuery?CNTR_NO=${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("HLCU")) {
    return {
      carrier: "Hapag-Lloyd",
      trackingUrl: `https://www.hapag-lloyd.com/en/online-business/tracing/tracing-by-booking.html?query=${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("YMLU")) {
    return {
      carrier: "Yang Ming",
      trackingUrl: `https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx?type=Quick&num=${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("OOLU")) {
    return {
      carrier: "OOCL",
      trackingUrl: `https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx?query=${cleanNo}`,
      isAutoDetected: true,
    };
  }
  if (prefix.startsWith("ZIMU")) {
    return {
      carrier: "ZIM",
      trackingUrl: `https://www.zim.com/tools/track-a-shipment?consignment=${cleanNo}`,
      isAutoDetected: true,
    };
  }

  // Default to CMA CGM or specified carrier
  return {
    carrier: specifiedCarrier || "CMA CGM",
    trackingUrl: `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&SearchValue=${cleanNo}`,
    isAutoDetected: prefix.startsWith("CMAU") || prefix.startsWith("APZU"),
  };
}

export function getCMATrackingUrl(containerNo: string | null | undefined): string {
  return getContainerTrackingInfo(containerNo).trackingUrl;
}
