import './globals.css'
import Link from 'next/link'

export const metadata = { title: 'SCEAU', description: 'Le réseau de la preuve.' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-[#F5E9D8] min-h-screen pb-20">
        <nav className="bg-[#FFFCF7] border-b border-[#EFE0CA] px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <Link href="/" className="text-2xl font-bold text-[#2C1810] tracking-tight font-serif">SCEAU<span className="text-[#E76F51]">.</span></Link>
          <div className="text-xl cursor-pointer">🔔</div>
        </nav>
        <main className="max-w-2xl mx-auto">{children}</main>
        <div className="fixed bottom-0 left-0 right-0 bg-[#FFFCF7] border-t border-[#EFE0CA] flex justify-around py-3 z-50">
          <Link href="/feed" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">🌐</span><span className="text-[0.6rem] font-bold font-mono">Réseau</span></Link>
          <Link href="/seal" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">✍️</span><span className="text-[0.6rem] font-bold font-mono">Sceller</span></Link>
          <Link href="/verify" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">🔍</span><span className="text-[0.6rem] font-bold font-mono">Vérifier</span></Link>
          <Link href="/messages" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">💬</span><span className="text-[0.6rem] font-bold font-mono">Messages</span></Link>
          <Link href="/profil" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">👤</span><span className="text-[0.6rem] font-bold font-mono">Profil</span></Link>
        </div>
      </body>
    </html>
  )
}
