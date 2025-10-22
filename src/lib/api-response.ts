import { nanoid } from 'nanoid'

/**
 * Standardized API response wrapper for payment service
 * Ensures consistent response format across all endpoints
 */
export interface ApiResponse<T = any> {
  code: number
  message: string
  date: string
  requestId: string
  data: T
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${nanoid(12)}`
}

/**
 * Create standardized API response
 */
export function apiResponse<T = any>(
  code: number,
  message: string,
  data: T = {} as T,
  requestId?: string
): ApiResponse<T> {
  return {
    code,
    message,
    date: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    data
  }
}

/**
 * Success response helper
 */
export function successResponse<T = any>(
  message: string,
  data: T = {} as T,
  requestId?: string
): ApiResponse<T> {
  return apiResponse(200, message, data, requestId)
}

/**
 * Error response helper
 */
export function errorResponse(
  code: number,
  message: string,
  requestId?: string
): ApiResponse {
  return apiResponse(code, message, {}, requestId)
}

/**
 * Validation error response helper
 */
export function validationErrorResponse(
  message: string,
  requestId?: string
): ApiResponse {
  return apiResponse(400, message, {}, requestId)
}

/**
 * Unauthorized error response helper
 */
export function unauthorizedResponse(
  message: string = 'Unauthorized',
  requestId?: string
): ApiResponse {
  return apiResponse(401, message, {}, requestId)
}

/**
 * Forbidden error response helper
 */
export function forbiddenResponse(
  message: string = 'Forbidden',
  requestId?: string
): ApiResponse {
  return apiResponse(403, message, {}, requestId)
}

/**
 * Not found error response helper
 */
export function notFoundResponse(
  message: string = 'Not found',
  requestId?: string
): ApiResponse {
  return apiResponse(404, message, {}, requestId)
}

/**
 * Internal server error response helper
 */
export function internalErrorResponse(
  message: string = 'Internal server error',
  requestId?: string
): ApiResponse {
  return apiResponse(500, message, {}, requestId)
}
