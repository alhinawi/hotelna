import type { ReactNode } from 'react'
import '../index.css'
export const metadata = { title: 'Hotelna', description: 'Hotel management' }
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body className="font-sans rtl:leading-loose">{children}</body></html>
  )
}
