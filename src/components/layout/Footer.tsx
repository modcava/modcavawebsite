export function Footer() {
  return (
    <footer style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--divider)', padding: '24px 24px' }}>
      <div style={{ maxWidth: 1340, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ fontSize: '.68rem', color: 'var(--ink-3)' }}>© 2026 Modcava. All rights reserved.</p>
          <a
            href="https://www.facebook.com/Modcavashop"
            target="_blank"
            rel="noopener noreferrer"
            title="Facebook"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: '#1877F2', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.85rem', fontWeight: 700, textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            f
          </a>
          <a
            href="mailto:modcava@gmail.com"
            title="Email"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: '#EA4335', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.75rem', fontWeight: 700, textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            ✉
          </a>
        </div>
        <address style={{ fontStyle: 'normal', textAlign: 'right', lineHeight: 1.7 }}>
          <span className="en-text">
            <span style={{ fontFamily: "'Lora', serif", fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', letterSpacing: '.04em' }}>Modcava</span><br />
            <span style={{ fontSize: '.68rem', color: 'var(--ink-3)' }}>337/1 Reumrom Road, Nai Mueang Subdistrict<br />Mueang District, Khon Kaen, Thailand 40000</span>
          </span>
          <span className="th-text">
            <span style={{ fontFamily: "'Lora', serif", fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', letterSpacing: '.04em' }}>Modcava</span><br />
            <span style={{ fontSize: '.68rem', color: 'var(--ink-3)' }}>337/1 ถ.รื่นรมย์ ต.ในเมือง<br />อ.เมือง จ.ขอนแก่น 40000</span>
          </span>
        </address>
      </div>
    </footer>
  )
}
