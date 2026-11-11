import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { type Schedule, type Event, type Assisted } from "./domain";
import { parishLogo } from "./pdf-brand";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 28,
  GAP = 18,
  TOP = 757,
  BOTTOM = 46;
const LEFT = 349,
  RIGHT = A4[0] - MARGIN * 2 - GAP - LEFT;
const SIZE = 7.4,
  LINE = 8.6,
  PAD = 1.5,
  HEADER = 16;
const INK = rgb(0, 0, 0),
  GRID = rgb(0.18, 0.18, 0.18);
const GREY = rgb(0.91, 0.91, 0.91),
  HEAD = rgb(0.83, 0.86, 0.89);
const YELLOW = rgb(1, 0.96, 0.38),
  BLUE = rgb(0.86, 0.93, 0.97);
const GREEN = rgb(0.85, 0.92, 0.77),
  AMBER = rgb(1, 0.83, 0.35);
const safe = (s: unknown) =>
  String(s ?? "").replace(/[^\x20-\x7e\xa0-\xff\n]/g, " ");
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const dateParts = (date: string) => {
  const d = new Date(date + "T12:00:00Z");
  const month = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(d)
    .replace(".", "");
  return [
    `${Number(date.slice(8))}/${month}`,
    ["Dom", "2ª", "3ª", "4ª", "5ª", "6ª", "Sáb"][d.getUTCDay()],
  ];
};
function wrap(value: string, width: number, font: PDFFont, size = SIZE) {
  const lines: string[] = [];
  for (const paragraph of safe(value).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (
        current &&
        font.widthOfTextAtSize(current + " " + word, size) > width
      ) {
        lines.push(current);
        current = "";
      }
      if (font.widthOfTextAtSize(word, size) <= width)
        current += (current ? " " : "") + word;
      else
        for (const char of word) {
          if (font.widthOfTextAtSize(current + char, size) > width) {
            lines.push(current);
            current = "";
          }
          current += char;
        }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}
type Row = { cells: string[]; fill?: RGB; group?: string };
type Prepared = {
  cells: string[][];
  fill?: RGB;
  group?: string;
  height: number;
};
type Table = {
  widths: number[];
  headers: string[];
  rows: Prepared[];
  mergedDates?: boolean;
};
function prepare(rows: Row[], widths: number[], font: PDFFont): Prepared[] {
  const maxLines = Math.floor((TOP - BOTTOM - HEADER - PAD * 2) / LINE);
  return rows.flatMap((row) => {
    const cells = row.cells.map((value, index) =>
      wrap(value, widths[index] - PAD * 2, font),
    );
    const count = Math.max(...cells.map((cell) => cell.length));
    return Array.from(
      { length: Math.max(1, Math.ceil(count / maxLines)) },
      (_, fragment) => {
        const parts = cells.map((cell, index) => {
          const part = cell.slice(
            fragment * maxLines,
            (fragment + 1) * maxLines,
          );
          return fragment && index < 2 && !part.length
            ? cell.slice(0, 1)
            : part;
        });
        return {
          ...row,
          cells: parts,
          height:
            Math.max(1, ...parts.map((cell) => cell.length)) * LINE + PAD * 2,
        };
      },
    );
  });
}
function box(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  fill?: RGB,
) {
  page.drawRectangle({
    x,
    y: top - height,
    width,
    height,
    borderColor: GRID,
    borderWidth: 0.45,
    ...(fill ? { color: fill } : {}),
  });
}
function cell(
  page: PDFPage,
  lines: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  font: PDFFont,
  center = false,
  fill?: RGB,
) {
  box(page, x, top, width, height, fill);
  const start = center
    ? top - (height - lines.length * LINE) / 2 - SIZE
    : top - PAD - SIZE;
  lines.forEach((line, index) =>
    page.drawText(line, {
      x: center
        ? x + (width - font.widthOfTextAtSize(line, SIZE)) / 2
        : x + PAD,
      y: start - index * LINE,
      size: SIZE,
      font,
      color: INK,
    }),
  );
}
function drawTable(
  page: PDFPage,
  table: Table,
  x: number,
  top: number,
  bottom: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const consumed: Prepared[] = [];
  let available = top - HEADER;
  while (table.rows.length && available - table.rows[0].height >= bottom) {
    const row = table.rows.shift()!;
    consumed.push(row);
    available -= row.height;
  }
  let offset = x;
  table.headers.forEach((title, index) => {
    if (table.mergedDates && index === 1) return;
    const width =
      table.mergedDates && index === 0
        ? table.widths[0] + table.widths[1]
        : table.widths[index];
    cell(page, [title], offset, top, width, HEADER, bold, true, HEAD);
    offset += width;
  });
  let y = top - HEADER;
  consumed.forEach((row, index) => {
    let start = x;
    row.cells.forEach((lines, col) => {
      if (table.mergedDates && col < 2) {
        if (!index || consumed[index - 1].group !== row.group) {
          let height = row.height;
          for (
            let next = index + 1;
            next < consumed.length && consumed[next].group === row.group;
            next++
          )
            height += consumed[next].height;
          cell(
            page,
            lines,
            start,
            y,
            table.widths[col],
            height,
            bold,
            true,
            row.fill === GREY ? GREY : undefined,
          );
        }
      } else
        cell(
          page,
          lines,
          start,
          y,
          table.widths[col],
          row.height,
          font,
          col === 2 && !!table.mergedDates,
          row.fill,
        );
      start += table.widths[col];
    });
    y -= row.height;
  });
  return y;
}
const sorted = (events: Event[]) =>
  [...events].sort((a, b) =>
    (a.date + a.time + a.id).localeCompare(b.date + b.time + b.id),
  );
function fill(event: Event) {
  if (event.kind === "WEDDING" || event.kind === "SPECIAL") return AMBER;
  if (event.kind === "ADORATION") return GREEN;
  if (normalized(event.location).includes("carmelo")) return YELLOW;
  if (normalized(event.location).includes("capela")) return BLUE;
  const day = new Date(event.date + "T12:00:00Z").getUTCDay();
  return day === 0 || day === 6 ? GREY : undefined;
}
const namesFor = (s: Schedule, e: Event) =>
  s.assignments
    .filter((a) => a.eventId === e.id)
    .map(
      (a) => s.ministers.find((m) => m.id === a.ministerId)?.name ?? "Ministro",
    )
    .join(", ") || "Vagas em aberto";
function celebrationNotes(event: Event) {
  // The reference leaves habitual masses at the Matriz blank, reserving this
  // column for meaningful location changes and extraordinary instructions.
  const ordinary =
    /^(missa|missa semanal|missa dominical|missa habitual)$/i.test(
      event.title.trim(),
    );
  return [
    ordinary ? "" : event.title,
    normalized(event.location).trim() === "matriz" ? "" : event.location,
    event.notes,
  ]
    .filter(Boolean)
    .join(" | ");
}
function contact(person: Assisted) {
  return [
    [
      person.address,
      person.neighborhood,
      [person.city, person.state].filter(Boolean).join("/"),
    ]
      .filter(Boolean)
      .join(", "),
    person.postalCode ? `CEP: ${person.postalCode}` : "",
    [
      person.landline ? `Fixo: ${person.landline}` : "",
      person.mobile ? `Móvel: ${person.mobile}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    [
      person.familyName ? `Familiar: ${person.familyName}` : "",
      person.familyPhone ? `Contato: ${person.familyPhone}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  ]
    .filter(Boolean)
    .join("\n");
}
async function render(
  schedule: Schedule,
  restricted = false,
  ministerId?: string,
) {
  const doc = await PDFDocument.create();
  doc.setTitle(
    `MESCE - ${schedule.month} - v${schedule.revision}${restricted ? " - Restrito" : ""}`,
  );
  doc.setAuthor("MESCE");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(Buffer.from(parishLogo, "base64"));
  const title =
    "Escala dos Ministros Extraordinários da Sagrada Comunhão Eucarística (MESCE)";
  const month = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(schedule.month + "-01T12:00:00Z"))
    .replace(" de ", "/");
  const page = () => {
    const p = doc.addPage(A4);
    p.drawImage(logo, { x: MARGIN, y: 792, width: 49, height: 32 });
    const size = Math.min(10.1, 458 / bold.widthOfTextAtSize(title, 1));
    p.drawText(title, {
      x: 88 + (A4[0] - MARGIN - 88 - bold.widthOfTextAtSize(title, size)) / 2,
      y: 809,
      font: bold,
      size,
      color: INK,
    });
    const label = month.charAt(0).toUpperCase() + month.slice(1);
    p.drawText(label, {
      x: (A4[0] - bold.widthOfTextAtSize(label, 11)) / 2,
      y: 792,
      font: bold,
      size: 11,
    });
    const mode = restricted ? "Guia restrito de visitas" : "Escala geral";
    p.drawText(
      `${mode} | ${schedule.status === "PUBLISHED" ? "Publicada" : "Aprovada"}`,
      { x: MARGIN, y: 775, font, size: 7.5 },
    );
    p.drawText(
      "Amarelo: Carmelo | Azul: capela | Verde: adoração | Âmbar: especial",
      { x: MARGIN + 180, y: 775, font, size: 6.5 },
    );
    return p;
  };
  const visits = sorted(
    schedule.events.filter(
      (e) =>
        e.kind === "VISIT" &&
        !e.cancelled &&
        (!ministerId ||
          schedule.assignments.some(
            (a) => a.eventId === e.id && a.ministerId === ministerId,
          )),
    ),
  );
  const celebrationEvents = ministerId
    ? []
    : sorted(schedule.events.filter((e) => e.kind !== "VISIT" && !e.cancelled));
  const visitCodes = new Map<string, string>();
  visits.forEach((e) => {
    if (!visitCodes.has(e.assistedId))
      visitCodes.set(
        e.assistedId,
        `Visita dominical ${String(visitCodes.size + 1).padStart(2, "0")}`,
      );
  });
  const leftWidths = [35, 25, 30, 139, 120];
  const rightWidths = ministerId
    ? [35, 230, A4[0] - MARGIN * 2 - 265]
    : [23, 79, RIGHT - 102];
  const left: Table = {
    widths: leftWidths,
    headers: ["Dia", "", "Hora", "Ministro(s)", "Observações"],
    mergedDates: true,
    rows: prepare(
      celebrationEvents.map((e) => ({
        group: e.date,
        fill: fill(e),
        cells: [
          ...dateParts(e.date),
          e.time,
          namesFor(schedule, e),
          celebrationNotes(e),
        ],
      })),
      leftWidths,
      font,
    ),
  };
  const right: Table = {
    widths: rightWidths,
    headers: ["Dia", "Ministro(s)", "Assistido(s)"],
    rows: prepare(
      visits.map((e) => ({
        fill: Number(e.date.slice(8)) % 2 ? GREY : undefined,
        cells: [
          String(Number(e.date.slice(8))),
          namesFor(schedule, e),
          restricted
            ? (schedule.assistedSnapshot?.find((p) => p.id === e.assistedId)
                ?.name ?? "Assistido não informado")
            : visitCodes.get(e.assistedId)!,
        ],
      })),
      rightWidths,
      font,
    ),
  };
  let current = page(),
    bottomLeft = TOP,
    bottomRight = TOP;
  const leftX = MARGIN,
    rightX = ministerId ? MARGIN : MARGIN + LEFT + GAP;
  do {
    bottomLeft = left.rows.length
      ? drawTable(current, left, leftX, TOP, BOTTOM, font, bold)
      : TOP;
    bottomRight = right.rows.length
      ? drawTable(current, right, rightX, TOP, BOTTOM, font, bold)
      : TOP;
    if (left.rows.length || right.rows.length) current = page();
    else break;
  } while (true);
  if (!celebrationEvents.length && !ministerId)
    current.drawText("Nenhuma celebração nesta versão.", {
      x: leftX,
      y: TOP - 15,
      font,
      size: SIZE,
    });
  if (!visits.length)
    current.drawText("Nenhuma visita dominical nesta versão.", {
      x: rightX,
      y: TOP - 15,
      font,
      size: SIZE,
    });
  // A small operational note below the visits table, as in the reference.
  const note = restricted
    ? "Contatos de uso restrito aos responsáveis pelas visitas. Consulte a versão vigente antes do atendimento."
    : "Dados dos assistidos disponíveis somente no guia restrito. Consulte a versão vigente da escala.";
  const noteLines = wrap(note, ministerId ? A4[0] - MARGIN * 2 : RIGHT, font);
  const noteHeight = noteLines.length * LINE + 20;
  if (bottomRight - noteHeight < BOTTOM) {
    current = page();
    bottomLeft = bottomRight = TOP;
  }
  current.drawText("Observações:", {
    x: rightX,
    y: bottomRight - 13,
    font: bold,
    size: 8,
  });
  noteLines.forEach((line, index) =>
    current.drawText(line, {
      x: rightX,
      y: bottomRight - 26 - index * LINE,
      font,
      size: SIZE,
    }),
  );
  bottomRight -= noteHeight;
  if (restricted) {
    const ids = new Set(visits.map((e) => e.assistedId));
    const people = (schedule.assistedSnapshot ?? []).filter((p) =>
      ids.has(p.id),
    );
    const width = (A4[0] - MARGIN * 2 - 14) / 2;
    const widths = [79, width - 79];
    const middle = Math.ceil(people.length / 2);
    const tables = [people.slice(0, middle), people.slice(middle)].map(
      (items) => ({
        widths,
        headers: ["Assistido", "Endereço e contatos"],
        rows: prepare(
          items.map((person) => ({
            cells: [person.name, contact(person)],
            fill: GREY,
          })),
          widths,
          font,
        ),
      }),
    );
    let top = Math.min(bottomLeft, bottomRight) - 20;
    const firstHeight =
      Math.max(...tables.map((table) => table.rows[0]?.height ?? 0)) +
      HEADER +
      15;
    if (top - firstHeight < BOTTOM) {
      current = page();
      top = TOP;
    }
    if (people.length) {
      current.drawText("Guia de visitas - endereços e contatos", {
        x: MARGIN,
        y: top,
        font: bold,
        size: 8,
      });
      top -= 9;
      while (tables.some((table) => table.rows.length)) {
        tables.forEach((table, index) => {
          if (table.rows.length)
            drawTable(
              current,
              table,
              MARGIN + index * (width + 14),
              top,
              BOTTOM,
              font,
              bold,
            );
        });
        if (tables.some((table) => table.rows.length)) {
          current = page();
          top = TOP;
        }
      }
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    const stamp = ` | Emissão: ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
    p.drawText(
      `${restricted ? "Uso restrito" : "Uso interno"} | ${schedule.month}${stamp}`,
      { x: MARGIN, y: 25, font, size: 6.8 },
    );
    const version = `Versão: ${schedule.revision} | ${index + 1}/${pages.length}`;
    p.drawText(version, {
      x: A4[0] - MARGIN - font.widthOfTextAtSize(version, 7),
      y: 25,
      font: bold,
      size: 7,
    });
  });
  return doc.save();
}
/** General report never includes identifiable assisted-person fields. */
export async function schedulePdf(schedule: Schedule) {
  return render(schedule);
}
/** Coordinator gets the full reference layout; minister gets only assigned visits. */
export async function visitGuidePdf(schedule: Schedule, ministerId?: string) {
  return render(schedule, true, ministerId);
}
