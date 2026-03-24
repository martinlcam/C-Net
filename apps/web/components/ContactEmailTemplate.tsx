interface ContactEmailTemplateProps {
  readonly name: string
  readonly email: string
  readonly message: string
}

export function ContactEmailTemplate({
  name,
  email,
  message,
}: Readonly<ContactEmailTemplateProps>) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h1
        style={{
          color: "#1a1a1a",
          fontSize: "24px",
          marginBottom: "20px",
          borderBottom: "2px solid #bea9e9",
          paddingBottom: "10px",
        }}
      >
        New Contact Form Submission
      </h1>

      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            color: "#666",
            fontSize: "14px",
            textTransform: "uppercase",
            marginBottom: "5px",
          }}
        >
          From
        </h2>
        <p style={{ color: "#1a1a1a", fontSize: "16px", margin: 0 }}>
          {name} ({email})
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            color: "#666",
            fontSize: "14px",
            textTransform: "uppercase",
            marginBottom: "5px",
          }}
        >
          Message
        </h2>
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "15px",
            borderRadius: "8px",
            borderLeft: "4px solid #bea9e9",
          }}
        >
          <p
            style={{
              color: "#1a1a1a",
              fontSize: "16px",
              margin: 0,
              whiteSpace: "pre-wrap",
              lineHeight: "1.6",
            }}
          >
            {message}
          </p>
        </div>
      </div>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e5e5e5",
          margin: "20px 0",
        }}
      />

      <p style={{ color: "#999", fontSize: "12px", margin: 0 }}>
        This email was sent from the contact form on your portfolio website.
      </p>
    </div>
  )
}
