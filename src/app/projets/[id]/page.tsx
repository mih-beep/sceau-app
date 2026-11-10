'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { generateProjectCertificate } from '@/lib/pdf';

export default function ProjetDetail() {
  const params = useParams();
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/projects/${params.id}`).then(r => r.json()).then(d => {
      if (!d.error) setProject(d);
    });
  }, [params.id]);

  if (!project) return <div className="p-10 text-center">Chargement...</div>;

  const isPending = !project.ots_proof;

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans">
      <Link href="/projets" className="text-sm font-bold text-gray-500 hover:underline mb-4 inline-block">← Retour aux projets</Link>
      
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-6">
        <div className="bg-[#1E1E1E] p-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold font-serif">{project.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Dossier Miroir (Arbre de Merkle) 
              {project.parent_title && <span className="text-orange-400 font-bold ml-2">• Version de {project.parent_title}</span>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-[0.65rem] font-mono uppercase text-gray-400">Hash Racine</p>
              <p className="text-xs font-mono bg-gray-800 px-2 py-1 rounded mt-1 break-all max-w-[200px]">{project.merkle_root}</p>
            </div>
            <Link href={`/seal?parent_project_id=${project.id}&title=${encodeURIComponent(project.title)}`} className="bg-white text-black px-3 py-1 rounded text-xs font-bold hover:bg-gray-200 transition">+ Nouvelle Version</Link>
          </div>
        </div>

        <div className="p-6">
          <div className="flex gap-4 mb-6">
            {isPending ? (
              <div className="flex-1 bg-orange-50 border border-orange-200 p-4 rounded-xl text-center">
                <p className="font-bold text-orange-700">⏳ Ancrage en attente</p>
                <p className="text-xs text-orange-600 mt-1">OpenTimestamps compile le lot (cela peut prendre quelques heures).</p>
              </div>
            ) : (
              <div className="flex-1 bg-green-50 border border-green-200 p-4 rounded-xl text-center">
                <p className="font-bold text-green-700">✅ Ancré sur Bitcoin</p>
                <a href={`/api/projects/${project.id}/ots`} download className="text-xs font-bold text-green-600 underline mt-1 inline-block">Télécharger la preuve .ots</a>
              </div>
            )}
            
            <button 
              onClick={() => generateProjectCertificate(project.title, project.author, project.merkle_root, project.files, project.created_at)}
              className="flex-1 bg-[#E76F51] text-white p-4 rounded-xl font-bold shadow hover:bg-[#C75A22] transition"
            >
              📄 Télécharger le Certificat PDF
            </button>
          </div>

          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg">Fichiers inclus ({project.files.length})</h3>
            <div className="flex gap-2 text-xs font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Nouveau</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Modifié</span>
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            {project.files.map((f: any, index: number) => {
              // Simulation : On marque les 2 premiers fichiers comme "Nouveaux" si c'est une V2
              // Dans une vraie app, on comparerait les hashs avec le parent_id
              const isNew = project.parent_id && index < 2; 
              return (
                <div key={f.id} className={`flex justify-between items-center p-3 border-b last:border-0 ${isNew ? 'bg-green-50/50' : 'bg-gray-50'} hover:bg-gray-100 transition`}>
                  <div className="flex items-center gap-3">
                    {project.parent_id && (
                      <span className={`w-2 h-2 rounded-full ${isNew ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    )}
                    <div>
                      <p className="font-bold text-sm text-gray-800">{f.file_name}</p>
                      <p className="text-[0.65rem] font-mono text-gray-500">{f.file_hash}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-400">{(f.file_size / 1024).toFixed(0)} Ko</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
