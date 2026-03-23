import { Link } from '@tanstack/react-router'
import { siteTheme } from '../lib/site-theme'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer id="contact" className="site-footer">
      <div className="page-wrap footer-inner">
        <div>
          <p className="eyebrow mb-3">{siteTheme.brand.name}</p>
          <p className="footer-summary">{siteTheme.footer.summary}</p>
        </div>
        <div className="footer-links">
          {siteTheme.footer.links.map((link) => (
            <Link key={link.href} to={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <p className="footer-meta">
          &copy; {year} {siteTheme.brand.name}. Replace branding before shipping.
        </p>
      </div>
    </footer>
  )
}
