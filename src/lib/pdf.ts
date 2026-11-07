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
  const hash = hashHex || (() => {
    try {
      return Buffer.from(hashBase64, 'base64').toString('hex');
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

export function generatePactCertificate(
  title: string,
  description: string,
  creator: string,
  signataires: string[],
  hash: string,
  qrCodeDataUrl: string,
  pactId: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Fond crème
  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, 210, 297, 'F');

  // Cadre doré
  doc.setDrawColor(233, 196, 106);
  doc.setLineWidth(2);
  doc.rect(10, 10, 190, 277);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, 182, 269);

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT DE PACTE", 105, 40, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(168, 134, 32); // Or foncé
  doc.text("SCEAU · La poignée de main numérique", 105, 50, { align: 'center' });

  // Ligne de séparation
  doc.setDrawColor(233, 196, 106);
  doc.line(60, 55, 150, 55);

  // Titre du pacte
  doc.setFontSize(20);
  doc.setTextColor(44, 24, 16);
  doc.text(title, 105, 75, { align: 'center' });

  // Description
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(90, 75, 68);
  const splitDesc = doc.splitTextToSize(`"${description}"`, 150);
  doc.text(splitDesc, 105, 90, { align: 'center' });

  // Créateur
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(122, 90, 58);
  doc.text(`Proposé par : @${creator}`, 105, 115, { align: 'center' });

  // Signatures
  doc.setFontSize(14);
  doc.setTextColor(44, 24, 16);
  doc.text("Signataires", 105, 135, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(74, 144, 194);
  const sigsText = signataires.map(s => `@${s}`).join('  ·  ');
  doc.text(sigsText, 105, 145, { align: 'center' });

  // Hash
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const hashChunks = hash.match(/.{1,40}/g) || [hash];
  hashChunks.forEach((chunk, i) => {
    doc.text(chunk, 105, 170 + (i * 5), { align: 'center' });
  });

  // QR Code
  if (qrCodeDataUrl) {
    doc.addImage(qrCodeDataUrl, 'PNG', 80, 195, 50, 50);
    doc.setFontSize(9);
    doc.setTextColor(122, 90, 58);
    doc.text("Scannez pour vérifier l'authenticité", 105, 255, { align: 'center' });
  }

  // Mention Blockchain
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(93, 122, 58);
  doc.text("Preuve ancrée via OpenTimestamps (Bitcoin)", 105, 265, { align: 'center' });

  doc.save(`Pacte-${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}
