import crypto from 'crypto'
import { logger } from './logger.js'

/**
 * Encryption utility for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionManager {
  private readonly algorithm = 'aes-256-gcm'
  private readonly keyLength = 32 // 256 bits
  private readonly ivLength = 16 // 128 bits
  private readonly tagLength = 16 // 128 bits
  private readonly key: Buffer

  constructor(secretKey: string) {
    if (!secretKey || secretKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long')
    }
    
    // Derive key from secret using PBKDF2
    this.key = crypto.pbkdf2Sync(secretKey, 'classguru-payment-salt', 100000, this.keyLength, 'sha256')
    
    logger.info('Encryption manager initialized', {
      algorithm: this.algorithm,
      keyLength: this.keyLength
    })
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength)
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.key)
      cipher.setAAD(Buffer.from('classguru-payment', 'utf8'))
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      // Get authentication tag
      const tag = cipher.getAuthTag()
      
      // Combine IV + tag + encrypted data
      const result = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted
      
      logger.debug('Data encrypted successfully', {
        plaintextLength: plaintext.length,
        encryptedLength: result.length
      })
      
      return result
    } catch (error: any) {
      logger.error('Encryption failed', { error: error.message })
      throw new Error(`Encryption failed: ${error.message}`)
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    try {
      // Split IV, tag, and encrypted data
      const parts = encryptedData.split(':')
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format')
      }
      
      const iv = Buffer.from(parts[0], 'hex')
      const tag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.key)
      decipher.setAAD(Buffer.from('classguru-payment', 'utf8'))
      decipher.setAuthTag(tag)
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      logger.debug('Data decrypted successfully', {
        encryptedLength: encryptedData.length,
        decryptedLength: decrypted.length
      })
      
      return decrypted
    } catch (error: any) {
      logger.error('Decryption failed', { error: error.message })
      throw new Error(`Decryption failed: ${error.message}`)
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Encrypt user ID for database storage
   */
  encryptUserId(userId: string): string {
    return this.encrypt(userId)
  }

  /**
   * Decrypt user ID from database
   */
  decryptUserId(encryptedUserId: string): string {
    return this.decrypt(encryptedUserId)
  }

  /**
   * Encrypt email for database storage
   */
  encryptEmail(email: string): string {
    return this.encrypt(email)
  }

  /**
   * Decrypt email from database
   */
  decryptEmail(encryptedEmail: string): string {
    return this.decrypt(encryptedEmail)
  }

  /**
   * Encrypt payment amount for database storage
   */
  encryptAmount(amount: number): string {
    return this.encrypt(amount.toString())
  }

  /**
   * Decrypt payment amount from database
   */
  decryptAmount(encryptedAmount: string): number {
    return parseFloat(this.decrypt(encryptedAmount))
  }
}

/**
 * Global encryption manager instance
 */
let encryptionManager: EncryptionManager | null = null

/**
 * Initialize encryption manager
 */
export function initializeEncryption(secretKey: string): void {
  encryptionManager = new EncryptionManager(secretKey)
  logger.info('Encryption manager initialized globally')
}

/**
 * Get encryption manager instance
 */
export function getEncryptionManager(): EncryptionManager {
  if (!encryptionManager) {
    throw new Error('Encryption manager not initialized. Call initializeEncryption() first.')
  }
  return encryptionManager
}
