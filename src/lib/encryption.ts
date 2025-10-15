import crypto from 'crypto'

// Get encryption key from environment or generate a fallback
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'sociallyhub-default-key-32bytes!!'
const ALGORITHM = 'aes-256-gcm'

// Ensure the key is exactly 32 bytes for AES-256
function getEncryptionKey(): Buffer {
  const key = ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')
  return Buffer.from(key, 'utf8')
}

export function encryptCredentials(data: any): any {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(ALGORITHM, key)

    const jsonString = JSON.stringify(data)
    let encrypted = cipher.update(jsonString, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Store IV with encrypted data for decryption
    return {
      encrypted,
      iv: iv.toString('hex'),
      algorithm: ALGORITHM
    }
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt credentials')
  }
}

export function decryptCredentials(encryptedData: any): any {
  try {
    if (!encryptedData || !encryptedData.encrypted) {
      throw new Error('Invalid encrypted data format')
    }

    const key = getEncryptionKey()
    const decipher = crypto.createDecipher(ALGORITHM, key)

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return JSON.parse(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt credentials')
  }
}

// Utility to mask sensitive values for display
export function maskCredentials(credentials: any): any {
  const masked = { ...credentials }

  // Common sensitive field patterns
  const sensitiveFields = [
    'secret', 'token', 'key', 'password', 'pass',
    'clientSecret', 'apiSecret', 'bearerToken', 'accessToken',
    'refreshToken', 'webhookSecret'
  ]

  for (const [key, value] of Object.entries(masked)) {
    if (typeof value === 'string' && value.length > 0) {
      const isFieldSensitive = sensitiveFields.some(pattern =>
        key.toLowerCase().includes(pattern.toLowerCase())
      )

      if (isFieldSensitive) {
        // Show first 4 and last 4 characters, mask the middle
        if (value.length > 8) {
          masked[key] = `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`
        } else {
          masked[key] = '*'.repeat(value.length)
        }
      }
    }
  }

  return masked
}