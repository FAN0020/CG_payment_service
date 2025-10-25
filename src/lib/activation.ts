export class ActivationManager {
  private static isEnabledFlag = true; // Enable activation codes by default

  /**
   * Check if activation code system is enabled
   */
  static isEnabled(): boolean {
    return this.isEnabledFlag;
  }

  /**
   * Sanitize activation code input
   */
  static sanitizeCode(code: string): string {
    if (!code) return '';
    return code.trim().toUpperCase();
  }

  /**
   * Validate activation code format
   */
  static validateFormat(code: string): boolean {
    if (!code) return false;
    
    // Basic format validation - alphanumeric, 6-20 characters
    const formatRegex = /^[A-Z0-9]{6,20}$/;
    return formatRegex.test(code);
  }

  /**
   * Get default test plan for activation codes
   */
  static getDefaultTestPlan(): string {
    return 'test-plan';
  }

  /**
   * Get default test amount for activation codes (free)
   */
  static getDefaultTestAmount(): number {
    return 0;
  }

  /**
   * Validate activation code against database or external service
   */
  static async validateCode(code: string): Promise<boolean> {
    if (!this.validateFormat(code)) {
      return false;
    }

    // For now, accept any properly formatted code
    // In production, this would check against a database or external service
    return true;
  }

  /**
   * Disable activation code system
   */
  static disable(): void {
    this.isEnabledFlag = false;
  }

  /**
   * Enable activation code system
   */
  static enable(): void {
    this.isEnabledFlag = true;
  }
}
