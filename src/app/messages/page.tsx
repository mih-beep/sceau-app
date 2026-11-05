export default function Messages() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold font-serif mb-6">Messages.</h1>
      <div className="space-y-4">
        {['Fatou', 'Karim', 'Sarah'].map((n, i) => (
          <div key={n} className="flex items-center gap-4 border-b border-[#EFE0CA] pb-4">
            <div className="w-12 h-12 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold text-xl">{n[0]}</div>
            <div className="flex-1"><div className="font-bold text-sm flex justify-between">{n} <span className="text-xs text-[#A89070] font-normal">10:42</span></div><div className="text-sm text-[#7A5A3A]">Merci pour le scellement !</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
