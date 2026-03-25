import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 32

export async function encrypt(text: string, password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()

  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

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

export function getEncryptionPassword(): string {
  const password = process.env.ENCRYPTION_PASSWORD
  if (!password) {
    throw new Error("ENCRYPTION_PASSWORD environment variable is not set")
  }
  return password
}
