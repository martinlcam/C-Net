import { Resend } from 'resend'

let resendClient: Resend | null = null

/**
 * Get or create the Resend email client singleton.
 */
export function getResendClient(): Resend {
  if (resendClient) {
    return resendClient
  }

  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  resendClient = new Resend(apiKey)
  return resendClient
}

/**
 * Send an email via Resend.
 */
export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  const client = getResendClient()

  // Ensure we have at least text or html content
  const text = options.text || options.html?.replace(/<[^>]*>/g, '') || ''

  const result = await client.emails.send({
    from: options.from || 'C-Net Dashboard <noreply@yourdomain.com>',
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
    text,
  })

  if (result.error) {
    throw new Error(`Failed to send email: ${result.error.message}`)
  }

  return { id: result.data?.id || 'unknown' }
}
