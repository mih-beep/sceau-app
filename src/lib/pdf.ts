import { jsPDF } from "jspdf";

export function generateCertificate(title: string, author: string, date: string, hash: string, qrCodeDataUrl: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(253, 248, 240); doc.rect(0, 0, 297, 210, 'F');
  doc.setDrawColor(231, 111, 81); doc.setLineWidth(2); doc.rect(10, 10, 277, 190);
  doc.setFont("helvetica", "bold"); doc.setFontSize(36); doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT D'ANTÉRIORITÉ", 148.5, 40, { align: "center" });
  doc.setFontSize(16); doc.setTextColor(122, 90, 58); doc.text("Délivré par le protocole SCEAU", 148.5, 50, { align: "center" });
  doc.setFontSize(14); doc.setTextColor(44, 24, 16);
  doc.text(`Titre : ${title}`, 30, 80); doc.text(`Créateur : @${author}`, 30, 90); doc.text(`Date : ${new Date(date).toLocaleString('fr-FR')}`, 30, 100);
  doc.setFont("courier", "normal"); doc.setFontSize(10); doc.text(`SHA-256 :`, 30, 120); doc.text(hash.slice(0, 80), 30, 125); doc.text(hash.slice(80), 30, 130);
  if(qrCodeDataUrl) { doc.addImage(qrCodeDataUrl, 'PNG', 210, 70, 60, 60); doc.setFontSize(10); doc.text("Scannez pour vérifier", 240, 140, { align: "center" }); }
  doc.save(`SCEAU-${title.replace(/\s+/g, '-')}.pdf`);
}

// LA CORRECTION EST ICI : on accepte un 5ème argument optionnel
export function generatePortfolioPDF(author: string, seals: any[], startDate?: string, endDate?: string, isPro: boolean = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  doc.setFillColor(245, 233, 216); doc.rect(0, 0, 210, 297, 'F');
  doc.setFont("helvetica", "bold"); doc.setFontSize(40); doc.setTextColor(231, 111, 81);
  doc.text("PORTFOLIO", 105, 120, { align: "center" });
  doc.setFontSize(24); doc.setTextColor(44, 24, 16);
  doc.text(`@${author}`, 105, 140, { align: "center" });
  doc.setFontSize(12); doc.setTextColor(122, 90, 58);
  
  let dateText = `Généré le ${new Date().toLocaleDateString('fr-FR')}`;
  if (startDate && endDate) dateText += ` | Période : du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`;
  
  doc.text(dateText, 105, 155, { align: "center" });
  doc.text(`${seals.length} œuvre(s) certifiée(s)`, 105, 165, { align: "center" });

  doc.addPage();
  let y = 20;
  
  seals.forEach((seal, index) => {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setDrawColor(239, 224, 202); doc.setLineWidth(1); doc.rect(15, y, 180, 60);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(44, 24, 16);
    doc.text(seal.title, 20, y + 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(122, 90, 58);
    const category = seal.category || 'Art';
    const dateStr = new Date(seal.timestamp).toLocaleString('fr-FR');
    doc.text(`Catégorie : ${category} | Scellé le : ${dateStr}`, 20, y + 17);
    doc.text(`❤️ ${seal.likes_count || 0} J'aime   |   💬 ${seal.comments_count || 0} Commentaires`, 20, y + 23);
    if (seal.description) {
      doc.setFont("helvetica", "italic");
      const splitDesc = doc.splitTextToSize(`"${seal.description}"`, 170);
      doc.text(splitDesc, 20, y + 30);
    }
    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`Hash : ${seal.hash ? seal.hash.slice(0, 80) + '...' : 'Non disponible'}`, 20, y + 50);
    if (seal.is_hosted && seal.file_path) {
      doc.setTextColor(74, 144, 194);
      doc.textWithLink(`[ Cliquez ici pour ouvrir l'œuvre originale ]`, 130, y + 50, { url: seal.file_path });
    } else if (seal.is_flash) {
       doc.setTextColor(196, 74, 46);
       doc.text(`[ ⚡ Sceau Flash - Fichier local ]`, 130, y + 50);
    }
    y += 70;
  });

  if (!isPro) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(60);
      doc.setTextColor(200, 180, 160);
      doc.text("SCEAU FREE", 50, 150, { angle: 45 });
      doc.text("Passez PRO pour retirer", 50, 170, { angle: 45 });
    }
  }

  doc.save(`Portfolio-${author}.pdf`);
}
