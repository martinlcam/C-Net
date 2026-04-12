import { ContactEmailTemplate, getResendClient } from "@cnet/engine"
import { Body, Controller, Post, Response, Route } from "tsoa"

interface ContactRequest {
  name: string
  email: string
  message: string
}

interface ContactSuccessResponse {
  success: true
  message: string
  data?: string
}

interface ContactErrorResponse {
  success: false
  error: string
}

@Route("contact")
export class ContactController extends Controller {
  /* POST /contact — public contact form submission */
  @Post()
  @Response<ContactErrorResponse>(400, "Missing required fields")
  @Response<ContactErrorResponse>(503, "Email service not configured")
  @Response<ContactErrorResponse>(500, "Internal server error")
  public async submitContact(
    @Body() body: ContactRequest
  ): Promise<ContactSuccessResponse | ContactErrorResponse> {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error("RESEND_API_KEY is not set")
      this.setStatus(503)
      return { success: false, error: "Email service is not configured" }
    }

    try {
      const { name, email, message } = body

      if (!name || !email || !message) {
        this.setStatus(400)
        return { success: false, error: "Missing required fields" }
      }

      const resend = getResendClient()

      const { data, error } = await resend.emails.send({
        from: "Contact Form <onboarding@resend.dev>",
        to: ["martinlucam@gmail.com"],
        replyTo: email,
        subject: `New Contact Form Submission from ${name}`,
        react: ContactEmailTemplate({ name, email, message }),
      })

      if (error) {
        console.error("Resend error:", error)
        this.setStatus(500)
        return { success: false, error: "Failed to send email" }
      }

      return {
        success: true,
        message: "Email sent successfully",
        data: data?.id,
      }
    } catch (error) {
      console.error("API error:", error)
      this.setStatus(500)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }
    }
  }
}
