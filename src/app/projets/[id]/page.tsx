'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { generateProjectCertificate } from '@/lib/pdf';

export default function ProjetDetail() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteHandle, setInviteHandle] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [updating, setUpdating] = useState(false);

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;

  const loadProject = async () => {
    if (!params.id) return;
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      const d = await res.json();
      if (d && d.id) setProject(d);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadProject(); }, [params.id]);

  const amIOwner = project?.author === myHandle;
  const amIMember = project?.members?.some((m: any) => m.handle === myHandle);

  async function handleUpdate() {
    if (!project || !pubkey) return;
    setUpdating(true);
    try {
      const filesToKeep = project.files.filter((f: any) => !filesToDelete.includes(f.file_name)).map((f: any) => f.file_name);
      const fd = new FormData();
      fd.append('pubkey', pubkey);
      fd.append('files_to_keep', JSON.stringify(filesToKeep));
      newFiles.forEach(f => fd.append('new_files', f));
      const res = await fetch(`/api/projects/${project.id}/update`, { method: 'POST', body: fd });
      const d = await res.json();
      if (res.ok) router.push(`/projets/${d.project_id}`);
      else alert('Erreur : ' + d.error);
    } catch (e) { alert('Erreur réseau'); }
    setUpdating(false);
  }

  async function handleInvite() {
    if (!project || !pubkey || !inviteHandle) return;
    setInviteError('');
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, handle: inviteHandle }),
      });
      const d = await res.json();
      if (res.ok) { setInviteHandle(''); setShowInvite(false); loadProject(); }
      else setInviteError(d.error || 'Erreur');
    } catch (e) { setInviteError('Erreur réseau'); }
  }

  async function handleRollback() {
    if (!project || !pubkey) return;
    if (!confirm('Créer une nouvelle version basée sur celle-ci ?')) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey }),
      });
      const d = await res.json();
      if (res.ok) router.push(`/projets/${d.project_id}`);
      else alert('Erreur : ' + d.error);
    } catch (e) { alert('Erreur réseau'); }
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  
  if (errorMsg || !project) {
    return (
      <div className="p-10 text-center font-sans flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Oups...</h2>
        <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">{errorMsg || "Ce projet n'existe pas."}</p>
        <Link href="/projets" className="bg-[#1A1513] text-white px-6 py-2 rounded-xl font-bold">
          Retour aux projets
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-4xl mx-auto font-sans w-full">
      <Link href="/projets" className="text-sm font-bold text-gray-500 hover:underline mb-4 inline-block">← Retour aux projets</Link>
      
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-6">
        <div className="bg-[#1E1E1E] p-6 text-white flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold font-serif">{project.title}</h1>
            <p className="text-sm text-gray-400 mt-1">Version {project.version_number || 1} · Dossier Miroir (Merkle)</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[0.65rem] font-mono uppercase text-gray-400">Hash Racine</p>
            <p className="text-xs font-mono bg-gray-800 px-2 py-1 rounded mt-1 break-all max-w-full md:max-w-[200px]">{project.merkle_root}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {amIOwner && (
              <button 
                onClick={async () => {
                  if (!confirm("⚠️ Supprimer définitivement ce projet et TOUS ses fichiers ? Cette action est irréversible.")) return;
                  const res = await fetch(`/api/projects/${project.id}?pubkey=${encodeURIComponent(pubkey!)}`, { method: 'DELETE' });
                  if (res.ok) router.push('/projets');
                  else alert("Erreur lors de la suppression");
                }} 
                className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-100 transition"
              >
                🗑️ Supprimer
              </button>
            )}
            {project.is_latest && (amIOwner || amIMember) && (
              <button onClick={() => setShowUpdate(true)} className="bg-[#4A90C2] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#2D6A9E]">✏️ Mettre à jour</button>
            )}
            {!project.is_latest && amIOwner && (
              <button onClick={handleRollback} className="bg-[#E76F51] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#C75A22]">🔄 Revenir à cette version</button>
            )}
            {amIOwner && (
              <button onClick={() => setShowInvite(true)} className="bg-white border-2 border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:border-[#4A90C2]">👥 Inviter</button>
            )}
            <button onClick={() => generateProjectCertificate(project.title, project.author, project.merkle_root, project.files, project.created_at)} className="bg-white border-2 border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:border-[#E76F51]">📄 PDF</button>
          </div>

          {project.members && project.members.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-2">👥 Membres ({project.members.length})</h3>
              <div className="flex flex-wrap gap-2">
                {project.members.map((m: any) => (
                  <span key={m.handle} className="bg-[#F0F6FC] border border-[#C9D8E8] text-[#2D6A9E] px-3 py-1 rounded-lg text-xs font-bold">@{m.handle}</span>
                ))}
              </div>
            </div>
          )}

          <h3 className="font-bold text-lg mb-3">📁 Fichiers ({project.files.length})</h3>
          <div className="border rounded-xl overflow-hidden mb-6">
            {project.files.map((f: any) => (
              <div key={f.id} className="flex justify-between items-center p-3 border-b last:border-0 bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-gray-800 truncate">{f.file_name}</p>
                  <p className="text-[0.65rem] font-mono text-gray-500 truncate">Hash : {f.file_hash.slice(0, 20)}...</p>
                  {f.uploaded_by_handle && <p className="text-[0.65rem] text-[#4A90C2] font-bold mt-1">Ajouté par @{f.uploaded_by_handle}</p>}
                </div>
                <span className="text-xs font-bold text-gray-400 shrink-0 ml-3">{(f.file_size / 1024).toFixed(0)} Ko</span>
              </div>
            ))}
          </div>

          {project.versions && project.versions.length > 1 && (
            <div>
              <h3 className="font-bold text-sm mb-2">📜 Historique ({project.versions.length} versions)</h3>
              <div className="space-y-1">
                {project.versions.map((v: any, idx: number) => (
                  <Link key={v.id} href={`/projets/${v.id}`} className={`block p-2 rounded-lg text-xs transition ${v.id === project.id ? 'bg-[#F0F6FC] border border-[#C9D8E2] font-bold' : 'hover:bg-gray-50'}`}>
                    <span className="font-mono">V{idx + 1}</span> · {v.title} · {new Date(v.created_at).toLocaleString('fr-FR')}
                    {v.id === project.id && ' ← actuel'}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpdate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowUpdate(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Mettre à jour</h2>
            <h3 className="text-sm font-bold mb-2">Fichiers actuels (cocher pour supprimer)</h3>
            <div className="space-y-1 mb-4 max-h-60 overflow-y-auto border rounded-lg p-2">
              {project.files.map((f: any) => (
                <label key={f.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input type="checkbox" checked={filesToDelete.includes(f.file_name)} onChange={e => { if (e.target.checked) setFilesToDelete([...filesToDelete, f.file_name]); else setFilesToDelete(filesToDelete.filter(n => n !== f.file_name)); }} className="accent-red-500" />
                  <span className="text-xs truncate">{f.file_name}</span>
                </label>
              ))}
            </div>
            <h3 className="text-sm font-bold mb-2">Ajouter des fichiers</h3>
            <input type="file" multiple onChange={e => setNewFiles(Array.from(e.target.files || []))} className="w-full text-sm mb-2" />
            <button 
              onClick={() => {
                const emptyFile = new File([""], `dossier_vide_${Date.now()}.txt`, { type: "text/plain" });
                setNewFiles([...newFiles, emptyFile]);
              }} 
              className="w-full border-2 border-dashed border-gray-300 text-gray-500 py-2 rounded-lg text-xs font-bold hover:border-[#4A90C2] hover:text-[#4A90C2] transition mb-2"
            >
              + Ajouter un fichier vide (marqueur)
            </button>
            {newFiles.length > 0 && <p className="text-xs text-green-600 font-bold mb-4">+{newFiles.length} nouveau(x)</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowUpdate(false)} className="flex-1 py-2 rounded-lg bg-gray-100 font-bold">Annuler</button>
              <button onClick={handleUpdate} disabled={updating} className="flex-1 py-2 rounded-lg bg-[#4A90C2] text-white font-bold disabled:opacity-50">{updating ? '...' : 'Créer version'}</button>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Inviter</h2>
            <input type="text" placeholder="@pseudo" className="w-full border-2 border-gray-200 p-3 rounded-xl mb-2" value={inviteHandle} onChange={e => setInviteHandle(e.target.value)} />
            {inviteError && <p className="text-xs text-red-500 mb-2">{inviteError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2 rounded-lg bg-gray-100 font-bold">Annuler</button>
              <button onClick={handleInvite} className="flex-1 py-2 rounded-lg bg-[#4A90C2] text-white font-bold">Inviter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
