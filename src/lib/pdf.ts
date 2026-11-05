import { jsPDF } from "jspdf";

export function generateCertificate(title: string, author: string, date: string, hash: string, qrCodeDataUrl: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Fond
  doc.setFillColor(253, 248, 240);
  doc.rect(0, 0, 297, 210, 'F');

  // Bordure
  doc.setDrawColor(231, 111, 81);
  doc.setLineWidth(2);
  doc.rect(10, 10, 277, 190);

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT D'ANTÉRIORITÉ", 148.5, 40, { align: "center" });

  doc.setFontSize(16);
  doc.setTextColor(122, 90, 58);
  doc.text("Délivré par le protocole SCEAU", 148.5, 50, { align: "center" });

  // Infos
  doc.setFontSize(14);
  doc.setTextColor(44, 24, 16);
  doc.text(`Titre : ${title}`, 30, 80);
  doc.text(`Créateur : @${author}`, 30, 90);
  doc.text(`Date de scellement : ${new Date(date).toLocaleString('fr-FR')}`, 30, 100);

  // Hash (coupé pour pas déborder)
  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  doc.text(`Empreinte SHA-256 :`, 30, 120);
  doc.text(hash.slice(0, 80), 30, 125);
  doc.text(hash.slice(80), 30, 130);

  // QR Code (à droite)
  doc.addImage(qrCodeDataUrl, 'PNG', 210, 70, 60, 60);

  doc.setFontSize(10);
  doc.text("Scannez pour vérifier", 240, 140, { align: "center" });

  doc.save(`SCEAU-${title.replace(/\s+/g, '-')}.pdf`);
}
