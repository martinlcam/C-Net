"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/stories/button/button"

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus("idle")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        setSubmitStatus("success")
        setFormData({ name: "", email: "", message: "" })
      } else {
        setSubmitStatus("error")
      }
    } catch {
      setSubmitStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      id="contact"
      className="border-b border-black relative min-h-[calc(100vh-65px)] flex flex-col"
    >
      {/* Center divider that touches section borders */}
      <div
        className="hidden md:block absolute inset-y-0 left-1/2 w-px bg-black pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-12 lg:px-20 w-full flex-1 flex items-center py-24 md:py-0">
        <div className="flex flex-col md:grid md:grid-cols-2 w-full md:py-24">
          {/* Left side - Get in Touch info */}
          <div className="md:pr-12 md:flex md:flex-col md:justify-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-black mb-4 tracking-tight">
                Get in Touch
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                I'm looking forward to hearing from you! If you prefer not to fill out forms, feel
                free to email me directly.
              </p>
              <a
                href="mailto:martin@futurity.work"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-black underline hover:text-gray-600 transition-colors"
              >
                martin@futurity.work
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 17L17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </a>
            </div>
          </div>

          {/* Divider - horizontal on mobile only */}
          <div className="border-t border-black my-8 md:hidden" aria-hidden="true" />

          {/* Right side - Form */}
          <div className="md:pl-12 md:flex md:flex-col md:justify-center">
            <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl mx-auto">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="name" className="text-sm font-medium text-black">
                    Name <span className="text-gray-400">*</span>
                  </label>
                  <span className="text-sm text-gray-400">{formData.name.length}/100</span>
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  maxLength={100}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex. Toby Fox"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#bea9e9] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="email" className="text-sm font-medium text-black">
                    Email <span className="text-gray-400">*</span>
                  </label>
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="waddle-doo@website.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#bea9e9] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="message" className="text-sm font-medium text-black">
                    Share More Details <span className="text-gray-400">*</span>
                  </label>
                  <span className="text-sm text-gray-400">{formData.message.length}/5000</span>
                </div>
                <textarea
                  id="message"
                  name="message"
                  required
                  maxLength={5000}
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe what you need..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#bea9e9] focus:border-transparent transition-all resize-none"
                />
              </div>

              {submitStatus === "success" && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 text-sm">
                    Message sent successfully! I'll get back to you soon.
                  </p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">
                    Something went wrong. Please try again or email me directly.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-lg text-base font-medium h-auto disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending..." : "Submit"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
