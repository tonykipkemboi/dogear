interface MarkProps {
  size?: number
  showWordmark?: boolean
  className?: string
}

export function YouTubeMark({ size = 24, className = '' }: MarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * 18) / 26}
      viewBox="0 0 26 18"
      fill="none"
      aria-hidden="true"
    >
      <rect width="26" height="18" rx="5" fill="#FF3131" />
      <path d="M11 5.6 16.2 9 11 12.4V5.6Z" fill="#fff" />
    </svg>
  )
}

export function TavilyMark({ size = 20, showWordmark = true, className = '' }: MarkProps) {
  return (
    <span className={`tavily-mark ${className}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#161616" />
        <path
          d="M12 14.5V6M9.2 8.8 12 6l2.8 2.8M12 14.5h7M16.2 11.7 19 14.5l-2.8 2.8M12 14.5l-4.2 4.2M8.2 15.2 7 19l3.8-1.2"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark ? <span className="tavily-mark__word">tavily</span> : null}
    </span>
  )
}

export function NebiusMark({ height = 20, className = '' }: { height?: number; className?: string }) {
  return (
    <a
      className={`nebius-link ${className}`}
      href="https://tokenfactory.nebius.com"
      target="_blank"
      rel="noreferrer"
      aria-label="Nebius Token Factory"
      title="Nebius Token Factory"
    >
      <img
        src="/nebius-token-factory.svg"
        alt="Nebius Token Factory"
        height={height}
        style={{ height, width: 'auto' }}
      />
    </a>
  )
}

export function PoweredBy({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`powered-by ${compact ? 'powered-by--compact' : ''}`}>
      <span className="powered-by__label">Powered by</span>
      <NebiusMark height={compact ? 17 : 20} />
      <span className="powered-by__label">Models</span>
      <span className="powered-by__dot" aria-hidden="true" />
      <a
        className="powered-by__tavily"
        href="https://www.tavily.com"
        target="_blank"
        rel="noreferrer"
        aria-label="Tavily search"
      >
        <TavilyMark size={compact ? 18 : 20} />
      </a>
      <span className="powered-by__label">Search</span>
    </div>
  )
}
