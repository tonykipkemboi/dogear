import { Brand } from './Brand'
import { ArrowUpRightIcon, GithubIcon } from './Icons'
import { PoweredBy } from './Marks'
import { Link } from '../lib/router'

export const GITHUB_URL = 'https://github.com/tonykipkemboi/dogear'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Brand height={30} />
        <nav className="site-header__nav" aria-label="Main">
          <Link to="/settings" className="site-header__keys-link">
            Keys
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRightIcon size={12} />
          </a>
        </nav>
        <div className="site-header__partners">
          <PoweredBy />
        </div>
        <Link to="/settings" className="site-header__mobile-keys">
          Keys
        </Link>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Brand height={18} />
          <span>The video textbook.</span>
        </div>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="site-footer__github">
          <GithubIcon size={13} /> GitHub <ArrowUpRightIcon size={12} />
        </a>
      </div>
    </footer>
  )
}
