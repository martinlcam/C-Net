import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 32

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param text - Text to encrypt
 * @param password - Encryption password (should be from environment variable)
 * @returns Encrypted text with salt, iv, and auth tag
 */
export async function encrypt(text: string, password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()

  // Return salt:iv:authTag:encrypted
  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

/**
 * Decrypt sensitive data
 * @param encryptedData - Encrypted data with salt, iv, auth tag
 * @param password - Decryption password (should be from environment variable)
 * @returns Decrypted text
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  const [saltHex, ivHex, authTagHex, encrypted] = encryptedData.split(":")

  if (!saltHex || !ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted data format")
  }

  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Get encryption password from environment variable
 * Throws error if not set
 */
export function getEncryptionPassword(): string {
  const password = process.env.ENCRYPTION_PASSWORD
  if (!password) {
    throw new Error("ENCRYPTION_PASSWORD environment variable is not set")
  }
  return password
}
