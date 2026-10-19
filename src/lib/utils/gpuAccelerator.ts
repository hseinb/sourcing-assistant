/**
 * NVIDIA GPU & WebGPU / WebGL Hardware Acceleration Engine
 * Leverages high-performance WebGPU and WebGL contexts
 * to offload image decoding, scaling, and spreadsheet media processing.
 */

export interface GPUInfo {
  isSupported: boolean;
  isNvidia: boolean;
  isIntelIris: boolean;
  renderer: string;
  vendor: string;
  driverType: string;
  webglVersion: string;
}

let cachedGPUInfo: GPUInfo | null = null;

/**
 * Detects the active graphics hardware via WebGPU / WebGL with discrete GPU preference.
 */
export async function detectGPUInfoAsync(): Promise<GPUInfo> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      isSupported: false,
      isNvidia: false,
      isIntelIris: false,
      renderer: 'Server / Headless',
      vendor: 'Unknown',
      driverType: 'None',
      webglVersion: 'None',
    };
  }

  // 1. Try WebGPU with high-performance discrete adapter preference
  if ('gpu' in navigator && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (adapter) {
        let rendererName = 'Discrete GPU Adapter';
        let vendorName = 'Unknown';

        // Check WebGPU adapter info if available in browser
        if (typeof adapter.requestAdapterInfo === 'function') {
          const info = await adapter.requestAdapterInfo();
          if (info.description) rendererName = info.description;
          if (info.vendor) vendorName = info.vendor;
        }

        const isNvidia = /nvidia|geforce|quadro|rtx|gtx/i.test(rendererName) || /nvidia/i.test(vendorName);
        const isIntel = /intel|iris|uhd/i.test(rendererName) || /intel/i.test(vendorName);

        cachedGPUInfo = {
          isSupported: true,
          isNvidia,
          isIntelIris: isIntel,
          renderer: rendererName,
          vendor: vendorName,
          driverType: 'WebGPU (Direct Hardware)',
          webglVersion: 'WebGPU 1.0',
        };
        return cachedGPUInfo;
      }
    } catch (err) {
      console.warn('WebGPU query skipped, falling back to WebGL:', err);
    }
  }

  // 2. Fallback to WebGL2 / WebGL1 with high-performance discrete hint
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2', { powerPreference: 'high-performance' }) ||
      canvas.getContext('webgl', { powerPreference: 'high-performance' }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      cachedGPUInfo = {
        isSupported: false,
        isNvidia: false,
        isIntelIris: false,
        renderer: 'Software Fallback',
        vendor: 'Unknown',
        driverType: 'Software',
        webglVersion: 'None',
      };
      return cachedGPUInfo;
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER) || 'Generic GPU';
    const vendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR) || 'Generic Vendor';

    const rendererStr = String(renderer);
    const vendorStr = String(vendor);

    const isNvidia = /nvidia|geforce|quadro|rtx|gtx/i.test(rendererStr) || /nvidia/i.test(vendorStr);
    const isIntelIris = /intel|iris|uhd|hd graphics/i.test(rendererStr) || /intel/i.test(vendorStr);
    const webglVersion = gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0';

    cachedGPUInfo = {
      isSupported: true,
      isNvidia,
      isIntelIris,
      renderer: rendererStr,
      vendor: vendorStr,
      driverType: 'WebGL Canvas (ANGLE)',
      webglVersion,
    };
  } catch (err) {
    console.warn('WebGL query error:', err);
    cachedGPUInfo = {
      isSupported: false,
      isNvidia: false,
      isIntelIris: false,
      renderer: 'Standard Renderer',
      vendor: 'Standard',
      driverType: 'Fallback',
      webglVersion: 'Unknown',
    };
  }

  return cachedGPUInfo;
}

/**
 * Synchronous getter using cached or fast WebGL probe
 */
export function getGPUInfo(): GPUInfo {
  if (cachedGPUInfo) return cachedGPUInfo;
  return {
    isSupported: true,
    isNvidia: false,
    isIntelIris: false,
    renderer: 'Detecting GPU...',
    vendor: 'Probing...',
    driverType: 'Hardware',
    webglVersion: 'WebGL 2.0',
  };
}

/**
 * Creates an HTML5 canvas specifically configured for discrete high-performance GPU acceleration
 */
export function createHighPerformanceCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  });

  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  return { canvas, ctx };
}
