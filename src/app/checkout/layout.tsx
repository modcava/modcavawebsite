import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </>
  )
}
