import { KeyIcon, LibraryIcon, PasteIcon } from './Icons'
import { Link } from '../lib/router'

export type TabId = 'paste' | 'library' | 'keys'

export function MobileTabBar({ active }: { active: TabId }) {
  return (
    <nav className="mobile-tabs" aria-label="Dogear sections">
      <Link to="/" className={`mobile-tabs__item ${active === 'paste' ? 'is-active' : ''}`} aria-current={active === 'paste' ? 'page' : undefined}>
        <span className="mobile-tabs__icon">
          <PasteIcon size={15} />
        </span>
        <span>Paste</span>
      </Link>
      <Link
        to="/library"
        className={`mobile-tabs__item ${active === 'library' ? 'is-active' : ''}`}
        aria-current={active === 'library' ? 'page' : undefined}
      >
        <LibraryIcon size={18} />
        <span>Library</span>
      </Link>
      <Link
        to="/settings"
        className={`mobile-tabs__item ${active === 'keys' ? 'is-active' : ''}`}
        aria-current={active === 'keys' ? 'page' : undefined}
      >
        <KeyIcon size={18} />
        <span>Keys</span>
      </Link>
    </nav>
  )
}
