// import jsPDF from "jspdf";

// export interface CertificateData {
//   candidateName: string;
//   assessmentTitle: string;
//   scoreDisplay: string;
//   percentageValue: number;
//   completionDate: string;
//   assessmentType: "ai" | "normal";
//   totalQuestions?: number;
// }

// // Helper to load an image as base64 data URL
// function loadImageAsBase64(url: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.crossOrigin = "anonymous";
//     img.onload = () => {
//       const canvas = document.createElement("canvas");
//       canvas.width = img.naturalWidth;
//       canvas.height = img.naturalHeight;
//       const ctx = canvas.getContext("2d");
//       if (!ctx) return reject(new Error("Canvas context failed"));
//       ctx.drawImage(img, 0, 0);
//       resolve(canvas.toDataURL("image/png"));
//     };
//     img.onerror = () => reject(new Error("Image load failed"));
//     img.src = url;
//   });
// }

// // Try to load image, return null on failure
// async function tryLoadImage(url: string): Promise<string | null> {
//   try {
//     return await loadImageAsBase64(url);
//   } catch {
//     return null;
//   }
// }

// export async function generateCertificatePDF(data: CertificateData): Promise<void> {
//   const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
//   const pageWidth = 297;
//   const pageHeight = 210;

//   // Load all images in parallel
//   const [logoImg, cmmiImg, isoImg, clutchImg] = await Promise.all([
//     tryLoadImage("https://www.SkilTechy.com/assets/SkilTechylogo.webp"),
//     tryLoadImage("https://www.SkilTechy.com/assets/cmmi-level-3-certificationlogo.webp"),
//     tryLoadImage("https://www.SkilTechy.com/assets/ISO27001log.webp"),
//     tryLoadImage("https://www.SkilTechy.com/assets/clutchlogo.webp"),
//   ]);

//   // ------ Background ------
//   doc.setFillColor(255, 253, 248);
//   doc.rect(0, 0, pageWidth, pageHeight, "F");

//   // ------ Borders ------
//   doc.setDrawColor(0, 51, 135);
//   doc.setLineWidth(3);
//   doc.rect(6, 6, pageWidth - 12, pageHeight - 12);

//   doc.setDrawColor(0, 71, 171);
//   doc.setLineWidth(0.5);
//   doc.rect(11, 11, pageWidth - 22, pageHeight - 22);

//   // Corner accents
//   const cs = 5;
//   doc.setFillColor(0, 51, 135);
//   doc.rect(11, 11, cs, cs, "F");
//   doc.rect(pageWidth - 11 - cs, 11, cs, cs, "F");
//   doc.rect(11, pageHeight - 11 - cs, cs, cs, "F");
//   doc.rect(pageWidth - 11 - cs, pageHeight - 11 - cs, cs, cs, "F");

//   // ------ Top decorative line ------
//   doc.setDrawColor(180, 155, 50);
//   doc.setLineWidth(0.8);
//   doc.line(40, 25, pageWidth - 40, 25);

//   // ------ Logo ------
//   let contentStartY: number;
//   if (logoImg) {
//     const logoW = 50;
//     const logoH = 14;
//     doc.addImage(logoImg, "PNG", pageWidth / 2 - logoW / 2, 28, logoW, logoH);
//     contentStartY = 48;
//   } else {
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(28);
//     doc.setTextColor(0, 51, 135);
//     doc.text("SkilTechy", pageWidth / 2, 38, { align: "center" });
//     contentStartY = 38;
//   }

//   // Divider under logo
//   doc.setDrawColor(0, 71, 171);
//   doc.setLineWidth(0.5);
//   doc.line(pageWidth / 2 - 50, contentStartY + 2, pageWidth / 2 + 50, contentStartY + 2);

//   // ------ "Certificate of Completion" ------
//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(24);
//   doc.setTextColor(80, 80, 80);
//   doc.text("Certificate of Completion", pageWidth / 2, contentStartY + 16, { align: "center" });

//   // ------ "This is to certify that" ------
//   doc.setFontSize(11);
//   doc.setTextColor(100, 100, 100);
//   doc.text("This is to certify that", pageWidth / 2, contentStartY + 30, { align: "center" });

//   // ------ Candidate Name ------
//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(26);
//   doc.setTextColor(30, 30, 30);
//   const name = data.candidateName || "Candidate";
//   doc.text(name, pageWidth / 2, contentStartY + 44, { align: "center" });

//   // Gold underline under name
//   const nameWidth = doc.getTextWidth(name);
//   doc.setDrawColor(180, 155, 50);
//   doc.setLineWidth(0.5);
//   doc.line(
//     pageWidth / 2 - nameWidth / 2 - 5,
//     contentStartY + 47,
//     pageWidth / 2 + nameWidth / 2 + 5,
//     contentStartY + 47
//   );

//   // ------ "has successfully completed the course" ------
//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(11);
//   doc.setTextColor(100, 100, 100);
//   doc.text("has successfully completed the course", pageWidth / 2, contentStartY + 58, {
//     align: "center",
//   });

//   // ------ Assessment Title ------
//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(18);
//   doc.setTextColor(0, 71, 171);
//   const maxTitleWidth = pageWidth - 80;
//   const titleLines = doc.splitTextToSize(data.assessmentTitle, maxTitleWidth);
//   doc.text(titleLines, pageWidth / 2, contentStartY + 70, { align: "center" });

//   // ------ Score ------
//   const scoreY = contentStartY + 70 + titleLines.length * 8 + 6;
//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(13);
//   doc.setTextColor(60, 60, 60);
//   doc.text(`Score: ${data.scoreDisplay}`, pageWidth / 2, scoreY, { align: "center" });

//   if (data.totalQuestions !== undefined) {
//     doc.setFontSize(11);
//     doc.setTextColor(90, 90, 90);
//     doc.text(`Total Questions: ${data.totalQuestions}`, pageWidth / 2, scoreY + 10, {
//       align: "center",
//     });
//   }

//   // ------ Date ------
//   doc.setFontSize(11);
//   doc.setTextColor(90, 90, 90);
//   doc.text(`Date of Completion: ${data.completionDate}`, pageWidth / 2, scoreY + 22, {
//     align: "center",
//   });

//   // ------ Footer divider ------
//   doc.setDrawColor(0, 71, 171);
//   doc.setLineWidth(0.3);
//   doc.line(30, 162, pageWidth - 30, 162);

//   // ------ "SkilTechy Technologies" ------
//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(11);
//   doc.setTextColor(0, 51, 135);
//   doc.text("SkilTechy Technologies", pageWidth / 2, 170, { align: "center" });

//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(7);
//   doc.setTextColor(120, 120, 120);
//   doc.text("www.SkilTechy.com", pageWidth / 2, 175, { align: "center" });

//   // ------ Certification Badges (below SkilTechy) ------
//   const badgeSize = 16;
//   const badgeY = 180;
//   const badgeSpacing = 30;
//   const badgeCenterX = pageWidth / 2;

//   if (cmmiImg) {
//     doc.addImage(cmmiImg, "PNG", badgeCenterX - badgeSpacing - badgeSize / 2, badgeY, badgeSize, badgeSize);
//   }
//   if (isoImg) {
//     doc.addImage(isoImg, "PNG", badgeCenterX - badgeSize / 2, badgeY, badgeSize, badgeSize);
//   }
//   if (clutchImg) {
//     doc.addImage(clutchImg, "PNG", badgeCenterX + badgeSpacing - badgeSize / 2, badgeY, badgeSize, badgeSize);
//   }

//   // ------ Bottom decorative line ------
//   doc.setDrawColor(180, 155, 50);
//   doc.setLineWidth(0.8);
//   doc.line(40, pageHeight - 12, pageWidth - 40, pageHeight - 12);

//   // ------ Download ------
//   const safeName = data.candidateName.replace(/[^a-zA-Z0-9]/g, "_");
//   const safeTitle = data.assessmentTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
//   doc.save(`Certificate_${safeName}_${safeTitle}.pdf`);
// }




import jsPDF from "jspdf";

export interface CertificateData {
  candidateName: string;
  assessmentTitle: string;
  scoreDisplay: string;
  percentageValue: number;
  completionDate: string;
  assessmentType: "ai" | "normal";
  totalQuestions?: number;
  returnBlob?: boolean;
}

function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
        return res.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}


async function tryLoadImage(url: string): Promise<string | null> {
  try {
    return await loadImageAsBase64(url);
  } catch (err) {
    console.error("Image load failed:", err);
    return null;
  }
}

export async function generateCertificatePDF(data: CertificateData): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = 297;
  const pageHeight = 210;

  // ── Canva template background ──
  const bgImg = await tryLoadImage("/certificate-template.png"); // ✅ / added
  if (bgImg) {
    doc.addImage(bgImg, "PNG", 0, 0, pageWidth, pageHeight);
  } else {
    console.warn("Background image load nahi hui!");
  }

  // ── Candidate Name ──
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(36);
  doc.setTextColor(184, 134, 11);
  doc.text(data.candidateName, pageWidth / 2, 100, { align: "center" });

  // ── Assessment Title ──
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(32);
  doc.setTextColor(184, 134, 11);
  const maxTitleWidth = pageWidth - 100;
  const titleLines = doc.splitTextToSize(data.assessmentTitle, maxTitleWidth);
  doc.text(titleLines, pageWidth / 2, 132, { align: "center" });

  // ── Score ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(data.scoreDisplay, 75, 144, { align: "center" });

  // ── Date ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(data.completionDate, 207, 144, { align: "center" });

  // ── Brand Name (Dynamic) ──
const brandName = "TechnomancerAI"; 

doc.setFont("helvetica", "normal");  // same clean font
doc.setFontSize(20);                 // size adjust 
doc.setTextColor(80, 80, 80);        // dark grey (not pure black)

doc.text(brandName, pageWidth / 2, 185, { align: "center" });

  // ── Download ──
  // const safeName = data.candidateName.replace(/[^a-zA-Z0-9]/g, "_");
  // const safeTitle = data.assessmentTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  // doc.save(`Certificate_${safeName}_${safeTitle}.pdf`);
  const safeName = data.candidateName.replace(/[^a-zA-Z0-9]/g, "_");
  const safeTitle = data.assessmentTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);

  if (data.returnBlob) {
    return doc.output("blob");
  }

  doc.save(`Certificate_${safeName}_${safeTitle}.pdf`);
}
