'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { generateCertificate } from '@/lib/pdf';
import QRCode from 'qrcode';

export default function PublicSealPage() {
  const params = useParams();
  const [seal, setSeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  useEffect(() => {
    if (!params.id) return;

    fetch(`/api/seal/${params.id}/versions`)
      .then(r => r.json())
      .then(d => {
        setVersions(d.versions || []);
        setCurrentVersion(d.current_version || 1);
      })
      .catch(() => {});

    const pubkey = localStorage.getItem('sceau_pubkey');
    const qs = pubkey ? `?viewer=${encodeURIComponent(pubkey)}` : '';
    fetch(`/api/o/${params.id}${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.seal) setSeal(d.seal);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  async function refreshOts() {
    setRefreshMsg('Interrogation des calendars Blockchain...');
    const res = await fetch(`/api/seal/${params.id}/ots/refresh`, { method: 'POST' });
    const d = await res.json();
    if (d.status === 'upgraded') setRefreshMsg('✅ Preuve upgradée avec confirmation Blockchain');
    else setRefreshMsg(d.message || '⏳ Pas encore confirmé.');
  }

  async function downloadCertificate() {
    if (!seal) return;
    const verifyUrl = `${window.location.origin}/o/${seal.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 1 });
    generateCertificate(
      seal.title,
      seal.author,
      seal.timestamp,
      seal.hash,
      qrDataUrl,
      seal.hash_hex,
      seal.id
    );
  }

  function downloadUrl() {
    if (typeof window === 'undefined') return '#';
    const pubkey = localStorage.getItem('sceau_pubkey');
    const qs = pubkey ? `?viewer=${encodeURIComponent(pubkey)}` : '';
    return `/api/download/${params.id}${qs}`;
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!seal) return <div className="p-10 text-center font-mono text-red-500">Œuvre introuvable.</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 font-serif">
      <div className="w-full max-w-xl bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-color)] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#E76F51] to-[#F4A261]"></div>

        <div className="text-center mb-6">
          <span className="inline-block bg-[#FDF8F0] border border-[#EFE0CA] text-[#A89070] text-xs font-mono font-bold px-3 py-1 rounded-full italic mb-4">
            Preuve d'antériorité
          </span>
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>{seal.title}</h1>
          <p className="text-[var(--text-muted)]">
            Créé par{' '}
            <Link href={`/u/${seal.author}`} className="font-bold text-[#E76F51] hover:underline">
              @{seal.author}
            </Link>
          </p>
        </div>

        {seal.description && (
          <p className="text-center italic mb-6 opacity-80" style={{ color: 'var(--text-main)' }}>
            "{seal.description}"
          </p>
        )}

        {versions.length > 1 && (
          <div className="mb-6 p-4 rounded-xl border-2 border-[#4A90C2] bg-[#F0F6FC]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📚</span>
              <div>
                <p className="text-sm font-bold text-[#2D6A9E]">Dossier Miroir</p>
                <p className="text-xs text-[#2D6A9E]">{versions.length} versions — celle-ci est la V{currentVersion}</p>
              </div>
            </div>
            <div className="space-y-1">
              {versions.map((v: any) => (
                <a
                  key={v.id}
                  href={`/o/${v.id}`}
                  className={`flex justify-between items-center p-2 rounded-lg text-xs ${v.id === seal.id ? 'bg-white border border-[#4A90C2] font-bold' : 'hover:bg-white'}`}
                >
                  <span style={{ color: 'var(--text-main)' }}>V{v.version_number} · {v.title}</span>
                  <span className="text-[0.6rem] font-mono text-[#2D6A9E]">
                    {new Date(v.timestamp).toLocaleDateString('fr-FR')} {v.has_ots && '⛓️'}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6 text-center">
          <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">SHA-256</p>
          <p className="text-xs font-mono break-all" style={{ color: 'var(--text-main)' }}>
            {seal.hash_hex || seal.hash}
          </p>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-2">
            Scellé le {new Date(seal.timestamp).toLocaleString('fr-FR')}
          </p>
        </div>

        <div className={`mb-6 p-4 rounded-xl border-2 ${seal.has_ots_proof ? 'border-[#7A9B5A] bg-[#F5F9EE]' : 'border-[#F4D0A8] bg-[#FCEAD6]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⛓️</span>
            <div>
              <p className={`text-sm font-bold ${seal.has_ots_proof ? 'text-[#5D7A3A]' : 'text-[#C44A2E]'}`}>
                Ancrage Blockchain (OpenTimestamps)
              </p>
              <p className={`text-xs ${seal.has_ots_proof ? 'text-[#7A9B5A]' : 'text-[#C44A2E]'}`}>
                {seal.has_ots_proof ? 'Preuve .ots disponible' : 'Indisponible'}
              </p>
            </div>
          </div>
          {seal.has_ots_proof && (
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={`/api/seal/${seal.id}/ots`} download className="bg-[#5D7A3A] text-white px-3 py-2 rounded-lg text-xs font-bold">
                ⬇️ Télécharger .ots
              </a>
              <button onClick={refreshOts} className="bg-white border-2 border-[#7A9B5A] text-[#5D7A3A] px-3 py-2 rounded-lg text-xs font-bold">
                🔄 Vérifier confirmation
              </button>
              <a href="https://opentimestamps.org/" target="_blank" rel="noopener" className="bg-white border-2 border-[#EFE0CA] text-[var(--text-main)] px-3 py-2 rounded-lg text-xs font-bold">
                🔍 Vérifier en ligne
              </a>
            </div>
          )}
          {refreshMsg && <p className="text-xs mt-2 italic text-[#5D7A3A]">{refreshMsg}</p>}
        </div>

        <button
          onClick={downloadCertificate}
          className="w-full text-center bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition mb-3"
        >
          📄 Télécharger le certificat d'antériorité (PDF)
        </button>

        {seal.is_hosted && seal.file_path && (
          <a
            href={downloadUrl()}
            className="block w-full text-center bg-[var(--text-main)] text-[var(--bg-surface)] py-3 rounded-xl font-bold shadow-md hover:opacity-80 transition mb-6"
          >
            📂 Découvrir l'œuvre originale
          </a>
        )}

        <div className="border-t border-[var(--border-color)] pt-6 mt-6 text-center">
          <Link
            href="/seal"
            className="inline-block bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition"
          >
            Sceller mon œuvre gratuitement
          </Link>
        </div>
      </div>
    </div>
  );
}
