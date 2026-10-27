import { Link } from '../lib/router'

interface BrandProps {
  height?: number
  className?: string
  asLink?: boolean
}

export function Brand({ height = 26, className = '', asLink = true }: BrandProps) {
  const image = (
    <img
      className={`brand__image ${className}`}
      src="/dogear-lockup.png"
      alt="Dogear"
      height={height}
      style={{ height, width: 'auto' }}
    />
  )
  return asLink ? (
    <Link to="/" className="brand" aria-label="Dogear home">
      {image}
    </Link>
  ) : (
    <span className="brand">{image}</span>
  )
}
