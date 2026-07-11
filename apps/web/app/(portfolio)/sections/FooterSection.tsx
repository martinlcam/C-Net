import Link from "next/link"

export function FooterSection() {
  return (
    <footer className="py-8 px-12 lg:px-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-gray-500 text-sm">
          © {new Date().getFullYear()} Martin Cam. All rights reserved.
        </p>
        <div className="flex gap-6">
          <Link href="/attributions" className="text-gray-500 hover:text-black text-sm">
            Attributions
          </Link>
          <a
            href="https://github.com/martinlcam"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-black text-sm"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/martin-xoku"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-black text-sm"
          >
            LinkedIn
          </a>
          <a
            href="https://www.instagram.com/_martincam_/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-black text-sm"
          >
            Instagram
          </a>
        </div>
      </div>
    </footer>
  )
}
