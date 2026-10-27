import { Link } from '../lib/router'
import { ArrowRightIcon } from './Icons'
import { SiteFooter, SiteHeader } from './SiteHeader'

export function NotFound() {
  return (
    <div className="page">
      <SiteHeader />
      <main className="not-found">
        <p className="eyebrow">
          <span className="square-dot" aria-hidden="true" />
          404
        </p>
        <h1>This page slipped out.</h1>
        <p>The guide is still where you left it.</p>
        <Link to="/library" className="button button--dark">
          Open the library <ArrowRightIcon size={14} />
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
