/**
 * Security utilities for input sanitization, rate limiting, and validation
 */

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - User input string
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input
  
  // Remove potentially dangerous characters and HTML tags
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim()
}

/**
 * Sanitize HTML content (for rich text)
 * @param {string} html - HTML string
 * @returns {string} - Sanitized HTML
 */
export const sanitizeHTML = (html) => {
  if (typeof html !== 'string') return html
  
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
}

/**
 * Rate limiting for authentication attempts
 * Uses localStorage to track attempts per IP/email
 */
export class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) { // 5 attempts per 15 minutes
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  /**
   * Check if an action is allowed
   * @param {string} key - Unique key (e.g., email or IP)
   * @returns {Object} - { allowed: boolean, remaining: number, resetAt: Date }
   */
  checkLimit(key) {
    const storageKey = `rate_limit_${key}`
    const now = Date.now()
    
    try {
      const data = localStorage.getItem(storageKey)
      if (!data) {
        // First attempt
        this.recordAttempt(key)
        return { allowed: true, remaining: this.maxAttempts - 1, resetAt: new Date(now + this.windowMs) }
      }

      const { attempts, firstAttempt } = JSON.parse(data)
      const timeSinceFirst = now - firstAttempt

      if (timeSinceFirst > this.windowMs) {
        // Window expired, reset
        this.recordAttempt(key)
        return { allowed: true, remaining: this.maxAttempts - 1, resetAt: new Date(now + this.windowMs) }
      }

      if (attempts >= this.maxAttempts) {
        // Rate limit exceeded
        const resetAt = new Date(firstAttempt + this.windowMs)
        return { 
          allowed: false, 
          remaining: 0, 
          resetAt,
          message: `تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد ${Math.ceil((resetAt - now) / 60000)} دقيقة`
        }
      }

      // Record attempt and return
      this.recordAttempt(key)
      return { 
        allowed: true, 
        remaining: this.maxAttempts - attempts - 1, 
        resetAt: new Date(firstAttempt + this.windowMs) 
      }
    } catch (error) {
      console.error('Rate limiter error:', error)
      // On error, allow the request (fail open)
      return { allowed: true, remaining: this.maxAttempts, resetAt: null }
    }
  }

  /**
   * Record an attempt
   * @param {string} key - Unique key
   */
  recordAttempt(key) {
    const storageKey = `rate_limit_${key}`
    const now = Date.now()
    
    try {
      const data = localStorage.getItem(storageKey)
      if (!data) {
        localStorage.setItem(storageKey, JSON.stringify({
          attempts: 1,
          firstAttempt: now
        }))
        return
      }

      const { attempts, firstAttempt } = JSON.parse(data)
      const timeSinceFirst = now - firstAttempt

      if (timeSinceFirst > this.windowMs) {
        // Reset window
        localStorage.setItem(storageKey, JSON.stringify({
          attempts: 1,
          firstAttempt: now
        }))
      } else {
        // Increment attempts
        localStorage.setItem(storageKey, JSON.stringify({
          attempts: attempts + 1,
          firstAttempt
        }))
      }
    } catch (error) {
      console.error('Error recording attempt:', error)
    }
  }

  /**
   * Reset rate limit for a key
   * @param {string} key - Unique key
   */
  reset(key) {
    const storageKey = `rate_limit_${key}`
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error('Error resetting rate limit:', error)
    }
  }
}

/**
 * Validate file upload
 * @param {File} file - File object
 * @param {Object} options - Validation options
 * @returns {Object} - { valid: boolean, error?: string }
 */
export const validateFileUpload = (file, options = {}) => {
  const {
    maxSize = 50 * 1024 * 1024, // 50MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
    allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']
  } = options

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    return { 
      valid: false, 
      error: `حجم الملف كبير جداً. الحد الأقصى: ${maxSizeMB} ميجابايت` 
    }
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `نوع الملف غير مدعوم. الأنواع المدعومة: ${allowedExtensions.join(', ')}` 
    }
  }

  // Check file extension
  const fileExt = file.name.split('.').pop()?.toLowerCase()
  if (!allowedExtensions.includes(fileExt)) {
    return { 
      valid: false, 
      error: `امتداد الملف غير مدعوم. الامتدادات المدعومة: ${allowedExtensions.join(', ')}` 
    }
  }

  // Check for dangerous file names
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { 
      valid: false, 
      error: 'اسم الملف غير صالح' 
    }
  }

  return { valid: true }
}

/**
 * Validate video file upload
 * @param {File} file - File object
 * @returns {Object} - { valid: boolean, error?: string }
 */
export const validateVideoUpload = (file) => {
  const maxSize = 500 * 1024 * 1024 // 500MB for videos
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
  const allowedExtensions = ['mp4', 'webm', 'ogg', 'mov']

  return validateFileUpload(file, {
    maxSize,
    allowedTypes,
    allowedExtensions
  })
}

/**
 * Validate image file upload
 * @param {File} file - File object
 * @returns {Object} - { valid: boolean, error?: string }
 */
export const validateImageUpload = (file) => {
  const maxSize = 10 * 1024 * 1024 // 10MB for images
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']

  return validateFileUpload(file, {
    maxSize,
    allowedTypes,
    allowedExtensions
  })
}

