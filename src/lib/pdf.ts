import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Schedule } from "./domain";
export async function schedulePdf(schedule: Schedule) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([595, 842]);
  let y = 795;
  const safe = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, " ");
  const line = (text: string, size = 11, strong = false) => {
    page.drawText(safe(text), {
      x: 38,
      y,
      size,
      font: strong ? bold : font,
      color: rgb(0.09, 0.19, 0.15),
    });
    y -= size + 7;
  };
  const header = () => {
    line("MESCE - Escala dos Ministros Extraordinários", 16, true);
    line("da Sagrada Comunhão Eucarística", 13);
    line(
      `${schedule.month} | Revisão ${schedule.revision} | ${schedule.status === "PUBLISHED" ? "Publicada" : "Aprovada"}`,
      11,
    );
    y -= 12;
  };
  const newPage = () => {
    page = document.addPage([595, 842]);
    y = 795;
    header();
  };
  const wrap = (text: string, width: number, size: number) => {
    const words = safe(text).split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (
        font.widthOfTextAtSize(current + " " + word, size) > width &&
        current
      ) {
        lines.push(current);
        current = "";
      }
      if (font.widthOfTextAtSize(word, size) > width) {
        let part = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(part + char, size) > width) {
            lines.push(part);
            part = "";
          }
          part += char;
        }
        current = part;
      } else current += (current ? " " : "") + word;
    }
    if (current) lines.push(current);
    return lines;
  };
  header();
  for (const visit of [false, true]) {
    if (y < 150) newPage();
    line(visit ? "VISITAS DOMINICAIS" : "CELEBRAÇÕES E MISSAS", 13, true);
    y -= 6;
    const events = schedule.events.filter(
      (e) => (e.kind === "VISIT") === visit,
    );
    if (!events.length) line("Nenhum encontro nesta modalidade.");
    for (const event of events) {
      const names = schedule.assignments
        .filter((a) => a.eventId === event.id)
        .map(
          (a) =>
            schedule.ministers.find((m) => m.id === a.ministerId)?.name ??
            "Ministro",
        )
        .join(", ");
      const lines = [
        ...wrap(
          `${event.date} - ${event.time} | ${event.title} | ${event.location}`,
          515,
          11,
        ),
        ...wrap(`Ministros: ${names}`, 515, 11),
      ];
      for (let i = 0; i < lines.length; i++) {
        if (y < 80) {
          newPage();
          line(
            visit
              ? "VISITAS DOMINICAIS (continuação)"
              : "CELEBRAÇÕES (continuação)",
            12,
            true,
          );
        }
        line(lines[i], 11, i === 0);
      }
      y -= 12;
    }
  }
  const pages = document.getPages();
  for (let i = 0; i < pages.length; i++)
    pages[i].drawText(
      `MESCE | ${schedule.month} | v${schedule.revision} | ${i + 1}/${pages.length} | Uso interno`,
      { x: 38, y: 30, size: 9, font },
    );
  return document.save();
}
