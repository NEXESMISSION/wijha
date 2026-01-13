/**
 * Device Fingerprinting Utility
 * Creates a unique device identifier using browser fingerprinting
 */

/**
 * Generate a device fingerprint based on browser characteristics
 * This combines multiple browser properties to create a unique identifier
 */
export function generateDeviceId() {
  // Try to get from localStorage first (persists across sessions)
  const storedDeviceId = localStorage.getItem('device_id')
  if (storedDeviceId) {
    return storedDeviceId
  }

  // Generate a new device ID
  const fingerprint = createFingerprint()
  
  // Store it for future use
  localStorage.setItem('device_id', fingerprint)
  
  return fingerprint
}

/**
 * Create a browser fingerprint
 * Combines user agent, screen properties, timezone, language, and other browser characteristics
 */
function createFingerprint() {
  const components = []

  // User Agent
  if (navigator.userAgent) {
    components.push(navigator.userAgent)
  }

  // Screen properties
  if (screen.width && screen.height) {
    components.push(`${screen.width}x${screen.height}`)
  }
  if (screen.colorDepth) {
    components.push(`cd${screen.colorDepth}`)
  }

  // Timezone
  if (Intl && Intl.DateTimeFormat) {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      components.push(timezone)
    } catch (e) {
      // Ignore timezone errors
    }
  }

  // Language
  if (navigator.language) {
    components.push(navigator.language)
  }
  if (navigator.languages && navigator.languages.length > 0) {
    components.push(navigator.languages.join(','))
  }

  // Platform
  if (navigator.platform) {
    components.push(navigator.platform)
  }

  // Hardware concurrency
  if (navigator.hardwareConcurrency) {
    components.push(`hc${navigator.hardwareConcurrency}`)
  }

  // Device memory (if available)
  if (navigator.deviceMemory) {
    components.push(`dm${navigator.deviceMemory}`)
  }

  // Canvas fingerprint (simplified - just check if canvas is available)
  try {
    const canvas = document.createElement('canvas')
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('Device fingerprint', 2, 2)
        // Get canvas data URL as a simple hash
        const canvasData = canvas.toDataURL()
        if (canvasData) {
          // Use a simple hash of the canvas data
          components.push(`canvas${simpleHash(canvasData)}`)
        }
      }
    }
  } catch (e) {
    // Canvas fingerprinting not available
  }

  // WebGL fingerprint (simplified)
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        if (vendor) components.push(`webgl_v${simpleHash(vendor)}`)
        if (renderer) components.push(`webgl_r${simpleHash(renderer)}`)
      }
    }
  } catch (e) {
    // WebGL not available
  }

  // Combine all components
  const fingerprintString = components.join('|')
  
  // Create a hash of the fingerprint
  return hashString(fingerprintString)
}

/**
 * Simple hash function for strings
 */
function hashString(str) {
  let hash = 0
  if (str.length === 0) return hash.toString()
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to positive hex string
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Simple hash for canvas/WebGL data
 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).substring(0, 8)
}

/**
 * Get user agent string
 */
export function getUserAgent() {
  return navigator.userAgent || 'unknown'
}

/**
 * Get device info for logging/debugging
 */
export function getDeviceInfo() {
  return {
    deviceId: generateDeviceId(),
    userAgent: getUserAgent(),
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    },
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'unknown'
  }
}

