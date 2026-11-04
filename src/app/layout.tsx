import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'SCEAU — Preuve d\'antériorité',
  description: 'Scellez vos œuvres pour toujours.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-100 min-h-screen">
        <nav className="bg-black text-white p-4 flex gap-6">
          <Link href="/" className="font-bold">SCEAU</Link>
          <Link href="/signup">Inscription</Link>
          <Link href="/seal">Sceller</Link>
          <Link href="/verify">Vérifier</Link>
          <Link href="/feed">Réseau</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
