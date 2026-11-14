import { jsPDF } from 'jspdf';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sceau-app.vercel.app';

export function generateCertificate(
  title: string,
  author: string,
  date: string,
  hashBase64: string,
  qrCodeDataUrl: string,
  hashHex?: string,
  sealId?: string
) {
  // Convertir en hex si non fourni
  // Sécurisation côté client (pas de Buffer.from)
  const hash = hashHex || (() => {
    try {
      const raw = atob(hashBase64);
      let hex = '';
      for (let i = 0; i < raw.length; i++) {
        hex += raw.charCodeAt(i).toString(16).padStart(2, '0');
      }
      return hex;
    } catch {
      return hashBase64;
    }
  })();

  const hashChunks = hash.toUpperCase().match(/.{1,32}/g) || [hash];

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Fond et cadre
  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, 297, 210, 'F');
  doc.setDrawColor(231, 111, 81);
  doc.setLineWidth(2);
  doc.rect(10, 10, 277, 190);

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT D'ANTÉRIORITÉ", 148.5, 38, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(122, 90, 58);
  doc.text("Délivré par le protocole SCEAU", 148.5, 48, { align: 'center' });

  // Métadonnées
  doc.setFontSize(13);
  doc.setTextColor(44, 24, 16);
  doc.text(`Titre : ${title}`, 25, 68);
  doc.text(`Créateur : @${author}`, 25, 76);
  doc.text(`Date de scellement : ${new Date(date).toLocaleString('fr-FR')}`, 25, 84);

  // Hash hex complet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(44, 24, 16);
  doc.text("EMPREINTE SHA-256 (hexadécimal) :", 25, 96);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 75, 68);
  hashChunks.forEach((chunk: string, i: number) => {
    doc.text(chunk, 25, 104 + i * 5);
  });

  // Mention OTS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(93, 122, 58);
  doc.text("Ancrage temporel : OpenTimestamps (blockchain Bitcoin)", 25, 145);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(122, 90, 58);
  doc.text("La preuve .ots est téléchargeable depuis la page publique de l'œuvre", 25, 152);
  doc.text("et vérifiable indépendamment sur https://opentimestamps.org", 25, 158);

  // QR code
  if (qrCodeDataUrl) {
    doc.addImage(qrCodeDataUrl, 'PNG', 215, 60, 60, 60);
    doc.setFontSize(8);
    doc.setTextColor(122, 90, 58);
    doc.text("Scannez pour vérifier en ligne", 245, 125, { align: 'center' });
  }

  // Lien de vérification
  if (sealId) {
    doc.setFontSize(8);
    doc.setTextColor(74, 144, 194);
    const url = `${APP_URL}/o/${sealId}`;
    doc.textWithLink(`Vérifier : ${url}`, 25, 175, { url });
  }

  // Mention légale
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Document généré par SCEAU. Le hash SHA-256 est infalsifiable : toute modification, même d'un seul bit, change le hash.",
    25,
    188
  );

  doc.save(`SCEAU-${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}

export function generatePortfolioPDF(
  author: string,
  seals: any[],
  startDate?: string,
  endDate?: string,
  isPro: boolean = false
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(245, 233, 216);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(231, 111, 81);
  doc.text('PORTFOLIO DE PREUVE', 105, 110, { align: 'center' });

  doc.setFontSize(22);
  doc.setTextColor(44, 24, 16);
  doc.text(`@${author}`, 105, 128, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(122, 90, 58);
  let dateText = `Généré le ${new Date().toLocaleDateString('fr-FR')}`;
  if (startDate && endDate) {
    dateText += ` | Période : du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`;
  }
  doc.text(dateText, 105, 142, { align: 'center' });
  doc.text(`${seals.length} œuvre(s) certifiée(s)`, 105, 150, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Vérification : ${APP_URL}/o/[id]`, 105, 162, { align: 'center' });

  doc.addPage();
  let y = 20;

  seals.forEach((seal) => {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(239, 224, 202);
    doc.setLineWidth(0.5);
    doc.rect(15, y, 180, 65);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(44, 24, 16);
    doc.text(seal.title || 'Sans titre', 20, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(122, 90, 58);
    const dateStr = new Date(seal.timestamp).toLocaleString('fr-FR');
    doc.text(`Scellé le : ${dateStr}`, 20, y + 18);

    if (seal.description) {
      doc.setFont('helvetica', 'italic');
      const splitDesc = doc.splitTextToSize(`"${seal.description}"`, 170);
      doc.text(splitDesc.slice(0, 2), 20, y + 26);
    }

    if (seal.has_ots_proof || seal.ots_proof) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(93, 122, 58);
      doc.text('✓ Ancré via OpenTimestamps (Bitcoin)', 20, y + 42);
    }

    doc.setTextColor(74, 144, 194);
    doc.setFontSize(8);
    doc.textWithLink('[ Vérifier en ligne ]', 20, y + 52, { url: `${APP_URL}/o/${seal.id}` });

    if (seal.is_hosted && seal.file_path) {
      doc.textWithLink('[ Ouvrir le fichier original ]', 110, y + 52, { url: seal.file_path });
    }

    y += 75;
  });

  if (!isPro) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(50);
      doc.setTextColor(220, 200, 180);
      doc.text('SCEAU FREE', 40, 150, { angle: 45 });
    }
  }

  doc.save(`Portfolio-${author}.pdf`);
}

export interface PactFileInfo {
  name: string;
  size: number;
  hash: string;
  downloadUrl?: string;
}

export interface PactCertificateData {
  title: string;
  description: string;
  creator: string;
  creatorSignedAt: string;
  signataires: { handle: string; signedAt: string }[];
  pactHash: string;
  merkleRoot: string;
  files: PactFileInfo[];
  otsProof: string | null;
  sealedAt: string;
  pactId: string;
  theme?: string;
  qrCodeDataUrl: string;
  verifyUrl: string;
}

export function generatePactCertificate(data: PactCertificateData) {
  const {
    title, description, creator, signataires,
    pactHash, merkleRoot, files, otsProof, sealedAt,
    theme = 'serieux', qrCodeDataUrl,
  } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const colors = {
    serieux: { border: [233, 196, 106], bg: [253, 250, 245], title: [44, 24, 16], accent: [168, 134, 32] },
    amour: { border: [244, 114, 182], bg: [253, 242, 248], title: [131, 24, 67], accent: [219, 39, 119] },
    famille: { border: [134, 239, 172], bg: [240, 253, 244], title: [20, 83, 45], accent: [22, 163, 74] },
    amitie: { border: [147, 197, 253], bg: [239, 246, 255], title: [30, 58, 138], accent: [37, 99, 235] },
  };
  const c = colors[theme as keyof typeof colors] || colors.serieux;

  // PAGE 1
  doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
  doc.setLineWidth(1.2);
  doc.rect(10, 10, 190, 277);
  doc.rect(12, 12, 186, 273);

  doc.setFont('times', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(c.title[0], c.title[1], c.title[2]);
  doc.text('CERTIFICAT DE PACTE', 105, 30, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(c.accent[0], c.accent[1], c.accent[2]);
  doc.text('SCEAU - La poignee de main numerique', 105, 38, { align: 'center' });

  doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
  doc.line(60, 43, 150, 43);

  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(c.title[0], c.title[1], c.title[2]);
  doc.text(title, 105, 58, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(90, 75, 68);
  const descLines = doc.splitTextToSize('"' + description + '"', 150);
  doc.text(descLines, 105, 70, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(122, 90, 58);
  doc.text('Propose par : @' + creator, 105, 85, { align: 'center' });
  doc.text('Scelle le : ' + new Date(sealedAt).toLocaleString('fr-FR'), 105, 90, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(c.title[0], c.title[1], c.title[2]);
  doc.text('SIGNATAIRES OFFICIELS', 105, 102, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(63, 143, 92);
  let y = 110;
  signataires.forEach((s, i) => {
    if (y > 145) return;
    doc.text((i + 1) + '. @' + s.handle + ' - ' + new Date(s.signedAt).toLocaleString('fr-FR'), 40, y);
    y += 6;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(44, 24, 16);
  doc.text('EMPREINTE SHA-256 DU PACTE', 20, 160);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 75, 68);
  const pactChunks = pactHash.match(/.{1,64}/g) || [pactHash];
  pactChunks.forEach((chunk, i) => {
    if (160 + 6 + i * 4 > 185) return;
    doc.text(chunk, 20, 166 + i * 4);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(44, 24, 16);
  doc.text('RACINE MERKLE DES FICHIERS JOINTS', 20, 195);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 75, 68);
  const mChunks = merkleRoot.match(/.{1,64}/g) || [merkleRoot];
  mChunks.forEach((chunk, i) => {
    if (195 + 6 + i * 4 > 215) return;
    doc.text(chunk, 20, 201 + i * 4);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  if (otsProof) {
    doc.setTextColor(93, 122, 58);
    doc.text('ANCRAGE OPENTIMESTAMPS (Bitcoin) : CONFIRME', 20, 225);
  } else {
    doc.setTextColor(196, 74, 46);
    doc.text('ANCRAGE OPENTIMESTAMPS : EN ATTENTE (confirmation sous 24h)', 20, 225);
  }

  if (qrCodeDataUrl) {
    doc.addImage(qrCodeDataUrl, 'PNG', 160, 230, 35, 35);
    doc.setFontSize(7);
    doc.setTextColor(122, 90, 58);
    doc.text('Verifier en ligne', 177, 270, { align: 'center' });
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Ce certificat atteste l\'existence, l\'integrite et l\'horodatage du pacte ci-dessus. Toute modification, meme d\'un seul caractere, invaliderait le hash SHA-256. La preuve OTS est verifiable sur https://opentimestamps.org',
    20, 282, { maxWidth: 170 }
  );

  if (files.length > 0) {
    doc.addPage();
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(c.title[0], c.title[1], c.title[2]);
    doc.text('FICHIERS JOINTS AU PACTE', 105, 25, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 75, 68);
    let fy = 40;

    files.forEach((f, i) => {
      if (fy > 270) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(44, 24, 16);
      doc.text((i + 1) + '. ' + f.name, 20, fy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 100, 90);
      doc.text('Taille : ' + (f.size / 1024).toFixed(1) + ' Ko', 20, fy + 4);
      doc.text('SHA-256 : ' + f.hash, 20, fy + 8);
      if (f.downloadUrl) {
        doc.setTextColor(74, 144, 194);
        doc.textWithLink('Telecharger via SCEAU', 20, fy + 12, { url: f.downloadUrl });
      }
      fy += 18;
    });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Chaque fichier peut etre verifie individuellement : recalculer son SHA-256 et le comparer a celui-ci-dessus.',
      20, 285, { maxWidth: 170 }
    );
  }

  doc.save('Pacte-' + title.replace(/[^a-zA-Z0-9]/g, '-') + '.pdf');
}


export function generateProjectCertificate(title: string, author: string, merkleRoot: string, files: any[], date: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Fond
  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, 210, 297, 'F');
  
  // Cadre
  doc.setDrawColor(232, 120, 60);
  doc.setLineWidth(2);
  doc.rect(10, 10, 190, 277);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT D'INTÉGRITÉ", 105, 30, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(122, 90, 58);
  doc.text("Dossier Miroir (Arbre de Merkle)", 105, 40, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(44, 24, 16);
  doc.text(`Projet : ${title}`, 20, 55);
  doc.text(`Créateur : @${author}`, 20, 63);
  doc.text(`Date de scellement : ${new Date(date).toLocaleString('fr-FR')}`, 20, 71);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text("EMPREINTE RACINE (MERKLE ROOT) :", 20, 85);
  
  const chunks = merkleRoot.match(/.{1,50}/g) || [merkleRoot];
  doc.setFont('courier', 'normal');
  chunks.forEach((chunk, i) => {
    doc.text(chunk, 20, 91 + i * 5);
  });

  // Liste des fichiers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("FICHIERS INCLUS :", 20, 115);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let y = 122;
  files.slice(0, 30).forEach((f) => {
    if (y > 270) return; // Limite de page
    doc.text(`- ${f.file_name}`, 20, y);
    doc.text(`  Hash: ${f.file_hash.slice(0, 20)}...`, 25, y + 4);
    y += 10;
  });

  if (files.length > 30) {
    doc.text(`... et ${files.length - 30} autres fichiers.`, 20, y + 5);
  }

  doc.save(`Projet-${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}
