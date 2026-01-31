import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/stories/card/card'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-neutral-10">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-primary-purple-80 mb-4 text-center">Contact</h1>
          <p className="text-xl text-neutral-70 mb-12 text-center">
            Get in touch with me for collaborations, opportunities, or just to say hello!
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-primary-purple-70">Email</CardTitle>
                <CardDescription>Send me an email</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href="mailto:your.email@example.com"
                  className="text-primary-purple-50 hover:underline"
                >
                  your.email@example.com
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary-purple-70">GitHub</CardTitle>
                <CardDescription>Check out my code</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href="https://github.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-purple-50 hover:underline"
                >
                  github.com/yourusername
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary-purple-70">LinkedIn</CardTitle>
                <CardDescription>Connect on LinkedIn</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href="https://linkedin.com/in/yourprofile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-purple-50 hover:underline"
                >
                  linkedin.com/in/yourprofile
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary-purple-70">Twitter</CardTitle>
                <CardDescription>Follow me on Twitter</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href="https://twitter.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-purple-50 hover:underline"
                >
                  @yourusername
                </a>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-primary-purple-10">
            <CardHeader>
              <CardTitle className="text-primary-purple-80">Let's Work Together</CardTitle>
              <CardDescription>
                I'm always interested in new projects and opportunities. Feel free to reach out!
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
