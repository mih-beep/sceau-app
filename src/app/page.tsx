import Link from 'next/link';

export default function Home() {
  return (
    <div className="text-center py-20">
      <h1 className="text-5xl md:text-6xl font-bold text-[#2C1810] mb-6 leading-tight" style={{fontFamily: 'Cormorant Garamond'}}>
        Prouvez que vous l'avez<br/>créé <span className="text-[#E76F51] italic">en premier.</span>
      </h1>
      <p className="text-lg text-[#7A5A3A] max-w-2xl mx-auto mb-10 italic" style={{fontFamily: 'Cormorant Garamond'}}>
        SCEAU est la couche temps du web. Scellez vos œuvres gratuitement, avant de les publier. La preuve existe. Pour toujours.
      </p>
      <div className="flex justify-center gap-4">
        <Link href="/seal" className="bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition">
          Sceller une œuvre
        </Link>
        <Link href="/feed" className="bg-[#FFFCF7] border-2 border-[#EFE0CA] text-[#2C1810] px-8 py-3 rounded-xl font-bold hover:border-[#E76F51] transition">
          Explorer le réseau
        </Link>
      </div>
    </div>
  )
}
