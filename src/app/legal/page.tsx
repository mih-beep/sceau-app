'use client';
import Link from 'next/link';

export default function Legal() {
  return (
    <div className="p-6 pb-32 max-w-3xl mx-auto font-sans w-full" style={{color: 'var(--text-main)'}}>
      <div className="mb-8">
        <Link href="/feed" className="text-sm font-bold opacity-50 hover:opacity-100">← Retour</Link>
      </div>

      <h1 className="text-3xl font-bold mb-8 font-serif">Cadre Juridique & Légal</h1>

      <div className="space-y-8 text-sm leading-relaxed">
        
        {/* CGU */}
        <section className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
          <h2 className="text-xl font-bold mb-4">1. Conditions Générales d'Utilisation (CGU)</h2>
          <p className="mb-4"><strong>SCEAU n'est pas un juge.</strong> SCEAU est un protocole technique qui permet d'ancrer l'empreinte cryptographique (hash SHA-256) d'un fichier ou d'une page web sur la blockchain Bitcoin via OpenTimestamps. SCEAU fournit une preuve d'existence et d'intégrité, mais ne garantit en aucun cas la véracité, la légalité ou la qualité du contenu scellé.</p>
          <p className="mb-4"><strong>Responsabilité de l'utilisateur.</strong> Vous êtes seul responsable des contenus que vous scellez. Il est strictement interdit de sceller des contenus illicites, diffamatoires, ou portant atteinte à la vie privée d'autrui.</p>
          <p className="mb-4"><strong>SCEAU Archive.</strong> L'outil d'archivage respecte scrupuleusement le protocole <code>robots.txt</code> des sites web. Il n'archive que les contenus publiquement accessibles. L'utilisateur s'engage à ne pas utiliser SCEAU Archive pour contourner des paywalls ou violer le droit d'auteur.</p>
          <p><strong>Disponibilité.</strong> Le service est fourni "en l'état". SCEAU ne peut être tenu responsable d'une indisponibilité temporaire du service ou d'un retard dans la confirmation de l'ancrage Bitcoin (qui peut prendre jusqu'à 24h).</p>
        </section>

        {/* Confidentialité */}
        <section className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
          <h2 className="text-xl font-bold mb-4">2. Politique de Confidentialité (RGPD)</h2>
          <p className="mb-4"><strong>Ce que nous collectons :</strong></p>
          <ul className="list-disc pl-5 mb-4 space-y-1">
            <li>Votre adresse email (pour la connexion).</li>
            <li>Votre clé publique (pour vous identifier).</li>
            <li>Les textes et fichiers que vous scellez (stockés si vous choisissez l'option "Hébergé").</li>
            <li>Les logs de connexion (adresse IP) pour prévenir les attaques.</li>
          </ul>
          <p className="mb-4"><strong>Ce que nous NE faisons PAS :</strong></p>
          <ul className="list-disc pl-5 mb-4 space-y-1">
            <li>Nous ne vendons pas vos données à des tiers.</li>
            <li>Nous ne lisons pas vos messages privés (chiffrement de bout en bout en cours de déploiement).</li>
            <li>Vos clés privées ne quittent jamais votre navigateur.</li>
          </ul>
          <p><strong>Droit à l'oubli :</strong> Vous pouvez supprimer vos œuvres à tout moment. Notez cependant que si une œuvre a été ancrée sur la blockchain Bitcoin, le hash est immuable et public par nature (mais il ne contient aucune donnée personnelle lisible).</p>
        </section>

        {/* Mentions Légales */}
        <section className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
          <h2 className="text-xl font-bold mb-4">3. Mentions Légales</h2>
          <p className="mb-4"><strong>Éditeur du site :</strong> SCEAU App (Projet en phase de lancement).</p>
          <p className="mb-4"><strong>Hébergement :</strong> Vercel Inc. (San Francisco, USA) et Neon Inc. (Base de données).</p>
          <p className="mb-4"><strong>Propriété Intellectuelle :</strong> Le code source de l'application SCEAU est la propriété de son créateur. Les œuvres scellées restent la propriété exclusive de leurs auteurs respectifs.</p>
          <p><strong>Contact :</strong> Pour toute question juridique ou demande de suppression, contactez l'administrateur du site.</p>
        </section>

      </div>
    </div>
  );
}
