'use client'

export function MessengerButton() {
  return (
    <a
      href="https://m.me/Modcavashop"
      target="_blank"
      rel="noopener noreferrer"
      title="Chat with us on Messenger"
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.1)'
        ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 20px rgba(0,106,255,0.55)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'
        ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 14px rgba(0,106,255,0.45)'
      }}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        width: 52, height: 52, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00B2FF 0%, #006AFF 100%)',
        boxShadow: '0 4px 14px rgba(0,106,255,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textDecoration: 'none', transition: 'transform .18s, box-shadow .18s',
      }}
    >
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2C7.373 2 2 7.057 2 13.333c0 3.386 1.515 6.42 3.926 8.52V26l4.018-2.207A12.73 12.73 0 0014 24c6.627 0 12-5.057 12-10.667C26 7.057 20.627 2 14 2z" fill="white"/>
        <path d="M15.03 17.016l-3.057-3.262-5.966 3.262 6.567-6.972 3.131 3.262 5.892-3.262-6.567 6.972z" fill="url(#msggrad)"/>
        <defs>
          <linearGradient id="msggrad" x1="6" y1="14" x2="22" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00B2FF"/>
            <stop offset="1" stopColor="#006AFF"/>
          </linearGradient>
        </defs>
      </svg>
    </a>
  )
}
