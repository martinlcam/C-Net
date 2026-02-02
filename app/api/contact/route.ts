import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { ContactEmailTemplate } from "@/components/ContactEmailTemplate"

export async function POST(request: NextRequest) {
  console.log("Contact route called")

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set")
    return NextResponse.json(
      { success: false, error: "Email service is not configured" },
      { status: 503 }
    )
  }

  const resend = new Resend(apiKey)

  try {
    const body = await request.json()
    const { name, email, message } = body

    console.log("Received:", { name, email, messageLength: message?.length })

    if (!name || !email || !message) {
      console.log("Validation failed - missing fields")
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      )
    }

    console.log("Sending email via Resend...")

    const { data, error } = await resend.emails.send({
      from: "Contact Form <onboarding@resend.dev>",
      to: ["martinlucam@gmail.com"],
      replyTo: email,
      subject: `New Contact Form Submission from ${name}`,
      react: ContactEmailTemplate({ name, email, message }),
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send email",
        },
        { status: 500 }
      )
    }

    console.log("Email sent successfully, ID:", data?.id)

    return NextResponse.json(
      {
        success: true,
        message: "Email sent successfully",
        data: data?.id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
