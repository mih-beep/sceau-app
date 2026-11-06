import { jsPDF } from "jspdf";

// Certificat simple (pour une seule œuvre)
export function generateCertificate(title: string, author: string, date: string, hash: string, qrCodeDataUrl: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(253, 248, 240); doc.rect(0, 0, 297, 210, 'F');
  doc.setDrawColor(231, 111, 81); doc.setLineWidth(2); doc.rect(10, 10, 277, 190);
  
  doc.setFont("helvetica", "bold"); doc.setFontSize(36); doc.setTextColor(44, 24, 16);
  doc.text("CERTIFICAT D'ANTÉRIORITÉ", 148.5, 40, { align: "center" });
  
  doc.setFontSize(16); doc.setTextColor(122, 90, 58);
  doc.text("Délivré par le protocole SCEAU", 148.5, 50, { align: "center" });
  
  doc.setFontSize(14); doc.setTextColor(44, 24, 16);
  doc.text(`Titre : ${title}`, 30, 80); 
  doc.text(`Créateur : @${author}`, 30, 90); 
  doc.text(`Date : ${new Date(date).toLocaleString('fr-FR')}`, 30, 100);
  
  doc.setFont("courier", "normal"); doc.setFontSize(10);
  doc.text(`SHA-256 :`, 30, 120); doc.text(hash.slice(0, 80), 30, 125); doc.text(hash.slice(80), 30, 130);
  
  if(qrCodeDataUrl) { doc.addImage(qrCodeDataUrl, 'PNG', 210, 70, 60, 60); doc.setFontSize(10); doc.text("Scannez pour vérifier", 240, 140, { align: "center" }); }
  doc.save(`SCEAU-${title.replace(/\s+/g, '-')}.pdf`);
}

// Portfolio Global (Le vrai document pour les clients)
export function generatePortfolioPDF(author: string, seals: any[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Page de garde
  doc.setFillColor(245, 233, 216); doc.rect(0, 0, 210, 297, 'F');
  doc.setFont("helvetica", "bold"); doc.setFontSize(40); doc.setTextColor(231, 111, 81);
  doc.text("PORTFOLIO", 105, 120, { align: "center" });
  doc.setFontSize(20); doc.setTextColor(44, 24, 16);
  doc.text(`@${author}`, 105, 140, { align: "center" });
  doc.setFontSize(12); doc.setTextColor(122, 90, 58);
  doc.text(`Généré par SCEAU le ${new Date().toLocaleDateString('fr-FR')}`, 105, 160, { align: "center" });
  doc.text(`${seals.length} œuvres protégées et horodatées`, 105, 170, { align: "center" });

  // Pages des œuvres
  doc.addPage();
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(44, 24, 16);
  doc.text("Registre des œuvres", 20, 30);
  
  let y = 45;
  seals.forEach((seal, index) => {
    if (y > 260) { doc.addPage(); y = 30; } // Nouvelle page si on arrive en bas
    
    doc.setFontSize(14); doc.setTextColor(44, 24, 16);
    doc.text(`${index + 1}. ${seal.title}`, 20, y);
    
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(122, 90, 58);
    doc.text(`Scellé le : ${new Date(seal.timestamp).toLocaleString('fr-FR')} | Type : ${seal.work_type || 'Fichier'} | Visibilité : ${seal.visibility || 'public'}`, 25, y + 6);
    
    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    const hash = seal.hash || "Hash non disponible";
    doc.text(`Hash : ${hash.slice(0, 75)}...`, 25, y + 11);
    
    doc.setDrawColor(200, 180, 160); doc.line(20, y + 15, 190, y + 15);
    y += 25;
  });

  doc.save(`Portfolio-${author}.pdf`);
}
