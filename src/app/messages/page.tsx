'use client';
import { useEffect, useState } from 'react';

export default function Messages() {
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/messages').then(r => r.json()).then(d => setContacts(d.contacts || []));
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold font-serif mb-6">Messages.</h1>
      
      <div className="bg-white border border-[#EFE0CA] rounded-xl p-4 mb-6">
        <p className="text-sm text-[#7A5A3A] italic">La messagerie complète arrive bientôt. Voici les créateurs que vous pouvez contacter :</p>
      </div>

      <div className="space-y-4">
        {contacts.map((c, i) => (
          <div key={c.id} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-[#EFE0CA] cursor-pointer hover:bg-[#FDF8F0] transition">
            <div className="w-12 h-12 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold text-xl">
              {c.handle[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm text-[#2C1810]">@{c.handle}</div>
              <div className="text-xs text-[#A89070]">Cliquez pour discuter</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
