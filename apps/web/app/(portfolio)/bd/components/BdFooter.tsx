export function BdFooter() {
  return (
    <footer className="border-t border-bd-rule py-8 px-6 sm:px-10 md:px-12 lg:px-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-bd-cream/45 text-sm font-bd-mono uppercase tracking-[0.12em]">
          © {new Date().getFullYear()} Martin Cam. All rights reserved.
        </p>
        <div className="flex gap-6">
          <a
            href="https://github.com/martinlcam"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bd-cream/45 hover:text-bd-live text-sm font-bd-mono uppercase tracking-[0.1em]"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/martin-xoku"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bd-cream/45 hover:text-bd-live text-sm font-bd-mono uppercase tracking-[0.1em]"
          >
            LinkedIn
          </a>
          <a
            href="https://www.instagram.com/_martincam_/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bd-cream/45 hover:text-bd-live text-sm font-bd-mono uppercase tracking-[0.1em]"
          >
            Instagram
          </a>
        </div>
      </div>
    </footer>
  )
}
