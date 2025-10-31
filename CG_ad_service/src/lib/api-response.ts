/**
 * Normalized API response utilities
 */

import type { ApiResponse } from '../types/index.js';
import { randomUUID } from 'crypto';

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    requestId: requestId || randomUUID(),
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
    },
    requestId: requestId || randomUUID(),
  };
}
