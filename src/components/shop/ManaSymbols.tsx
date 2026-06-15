export function ManaSymbols() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }} aria-hidden="true">
      <defs>
        {/* White */}
        <symbol id="mana-w" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="#f5edbc" stroke="#c8a030" strokeWidth="2"/>
          <g fill="#1a1a1a">
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(0   50 50)"/>
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(45  50 50)"/>
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(90  50 50)"/>
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(135 50 50)"/>
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(180 50 50)"/>
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(225 50 50)"/>
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(270 50 50)"/>
            <path d="M38 29 C26 11 42 2 52 3 C62 4 66 19 60 28 C55 20 45 20 38 29Z" transform="rotate(315 50 50)"/>
          </g>
          <circle cx="50" cy="50" r="22" fill="#f5edbc"/>
          <circle cx="50" cy="50" r="19" fill="none" stroke="#1a1a1a" strokeWidth="1.5"/>
          <circle cx="50" cy="50" r="15" fill="#1a1a1a"/>
        </symbol>
        {/* Blue */}
        <symbol id="mana-u" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="13" fill="#1a4f9c" stroke="#0e2f60" strokeWidth="2"/>
          <path d="M14 6.5 C14 6.5 8.5 12.5 8.5 16.5 A5.5 5.5 0 0 0 19.5 16.5 C19.5 12.5 14 6.5 14 6.5Z" fill="#c8e0ff"/>
          <path d="M11 16.5 Q14 18 17 16.5" stroke="#a0c4f8" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
        </symbol>
        {/* Black */}
        <symbol id="mana-b" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="13" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="2"/>
          <ellipse cx="14" cy="12" rx="5.5" ry="5" fill="#c0c0c0"/>
          <rect x="10.5" y="16.2" width="2.8" height="3.8" rx="1.4" fill="#c0c0c0"/>
          <rect x="14.7" y="16.2" width="2.8" height="3.8" rx="1.4" fill="#c0c0c0"/>
          <circle cx="11.5" cy="11.5" r="1.5" fill="#1a1a1a"/>
          <circle cx="16.5" cy="11.5" r="1.5" fill="#1a1a1a"/>
          <line x1="10.5" y1="16.2" x2="17.5" y2="16.2" stroke="#1a1a1a" strokeWidth="1"/>
        </symbol>
        {/* Red */}
        <symbol id="mana-r" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="13" fill="#c0392b" stroke="#7d1a0f" strokeWidth="2"/>
          <path d="M14.5 5 L10 14.5 L13.2 14.5 L8.5 23.5 L20 12.5 L15.5 12.5 Z" fill="#ffcc88" stroke="#f59300" strokeWidth="0.5" strokeLinejoin="round"/>
        </symbol>
        {/* Green */}
        <symbol id="mana-g" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="13" fill="#1e6e3e" stroke="#0d3d20" strokeWidth="2"/>
          <polygon points="14,5.5 20.5,15.5 7.5,15.5" fill="#7ec87e"/>
          <polygon points="14,9.5 21.5,20 6.5,20" fill="#5cb85c"/>
          <rect x="12.5" y="19.5" width="3" height="4" rx="1" fill="#5cb85c"/>
        </symbol>
        {/* Colorless */}
        <symbol id="mana-c" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="13" fill="#8a8a8a" stroke="#555" strokeWidth="2"/>
          <polygon points="14,5.5 21,14 14,22.5 7,14" fill="#e0e0e0"/>
          <polygon points="14,5.5 21,14 14,14" fill="#f4f4f4"/>
          <polygon points="14,14 21,14 14,22.5" fill="#b8b8b8"/>
          <polygon points="7,14 14,14 14,22.5" fill="#c8c8c8"/>
        </symbol>
      </defs>
    </svg>
  )
}
