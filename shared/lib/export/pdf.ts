import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Task } from "@/entities/task/schema";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const TITLE_SIZE = 16;
const META_SIZE = 10;
const BODY_SIZE = 10;
const LINE_GAP = 1.35;
const BLOCK_GAP = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface GenerateTaskListPdfInput {
  listTitle: string;
  tasks: Task[];
  exportedAt: Date;
  fontBytes: Uint8Array;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.length === 0 ? [""] : text.split(/\r?\n/);

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      for (const piece of splitToWidth(word, font, size, maxWidth)) {
        const next = current.length === 0 ? piece : `${current} ${piece}`;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          current = next;
        } else {
          if (current.length > 0) {
            lines.push(current);
          }
          current = piece;
        }
      }
    }
    if (current.length > 0) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : [""];
}

function splitToWidth(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) {
    return [word];
  }

  const parts: string[] = [];
  let current = "";
  for (const char of word) {
    const next = current + char;
    if (current.length > 0 && font.widthOfTextAtSize(next, size) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts;
}

function taskLines(task: Task, font: PDFFont): string[] {
  const headline = `${task.code}  ${task.title}`;
  const details = [
    `Статус: ${task.status}  Приоритет: ${task.priority}`,
    task.category ? `Категория: ${task.category}` : null,
    task.tags.length > 0 ? `Теги: ${task.tags.join(", ")}` : null,
    task.deadline ? `Дедлайн: ${task.deadline}` : null,
    `Оценка: ${task.estimatedMin} мин  Потрачено: ${task.timeSpentMin} мин`,
  ].filter((line): line is string => line !== null);

  return [
    ...wrapText(headline, font, BODY_SIZE, CONTENT_WIDTH),
    ...(task.description ? wrapText(task.description, font, BODY_SIZE, CONTENT_WIDTH) : []),
    ...details.flatMap((line) => wrapText(line, font, BODY_SIZE, CONTENT_WIDTH)),
  ];
}

export async function generateTaskListPdf(input: GenerateTaskListPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(input.fontBytes, { subset: true });
  pdf.setTitle(input.listTitle);
  pdf.setLanguage("ru");
  pdf.setSubject(input.tasks.length === 0 ? "Нет задач" : `Задач: ${input.tasks.length}`);
  pdf.setKeywords(input.tasks.flatMap((task) => [task.code, task.title]));

  const exportedLabel = new Intl.DateTimeFormat("ru", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(input.exportedAt);

  const headerLines = [
    input.listTitle,
    `Экспорт: ${exportedLabel} UTC`,
    `Задач: ${input.tasks.length}`,
  ];

  const bodyBlocks =
    input.tasks.length === 0
      ? [wrapText("Нет задач", font, BODY_SIZE, CONTENT_WIDTH)]
      : input.tasks.map((task) => taskLines(task, font));

  let page: PDFPage | null = null;
  let y = 0;

  const lineHeight = (size: number) => size * LINE_GAP;

  function drawHeader(target: PDFPage) {
    let cursor = PAGE_HEIGHT - MARGIN;
    const sizes = [TITLE_SIZE, META_SIZE, META_SIZE];
    headerLines.forEach((text, index) => {
      const size = sizes[index] ?? META_SIZE;
      const wrapped = wrapText(text, font, size, CONTENT_WIDTH);
      for (const line of wrapped) {
        target.drawText(line, {
          x: MARGIN,
          y: cursor - size,
          size,
          font,
          color: rgb(0.1, 0.1, 0.12),
        });
        cursor -= lineHeight(size);
      }
    });
    cursor -= 8;
    target.drawLine({
      start: { x: MARGIN, y: cursor },
      end: { x: PAGE_WIDTH - MARGIN, y: cursor },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.72),
    });
    y = cursor - 16;
  }

  function ensurePage() {
    if (page === null || y < MARGIN + BODY_SIZE) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeader(page);
    }
  }

  ensurePage();

  for (const block of bodyBlocks) {
    for (const line of block) {
      ensurePage();
      page!.drawText(line.length > 0 ? line : " ", {
        x: MARGIN,
        y: y - BODY_SIZE,
        size: BODY_SIZE,
        font,
        color: rgb(0.15, 0.15, 0.18),
      });
      y -= lineHeight(BODY_SIZE);
    }
    y -= BLOCK_GAP;
  }

  return pdf.save();
}

export interface GenerateTaskDetailPdfInput {
  task: Task;
  parentCode: string | null;
  dependencyCodes: string[];
  exportedAt: Date;
  fontBytes: Uint8Array;
}

export async function generateTaskDetailPdf(input: GenerateTaskDetailPdfInput): Promise<Uint8Array> {
  const { task, parentCode, dependencyCodes, exportedAt, fontBytes } = input;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const titleText = `${task.code} ${task.title}`;
  pdf.setTitle(titleText);
  pdf.setLanguage("ru");
  pdf.setSubject(`Задача ${task.code}`);
  pdf.setKeywords(
    [task.code, task.title, task.description, task.category, parentCode, ...task.tags, ...dependencyCodes].filter(
      (value): value is string => value !== null && value.length > 0,
    ),
  );

  const exportedLabel = new Intl.DateTimeFormat("ru", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(exportedAt);

  const headerLines = [titleText, `Экспорт: ${exportedLabel} UTC`];

  const detailLines = [
    `Статус: ${task.status}  Приоритет: ${task.priority}`,
    `Категория: ${task.category ?? "Без категории"}`,
    `Теги: ${task.tags.length > 0 ? task.tags.join(", ") : "Без тегов"}`,
    `Дедлайн: ${task.deadline ?? "Без дедлайна"}`,
    `Оценка: ${task.estimatedMin} мин  Потрачено: ${task.timeSpentMin} мин`,
    `Родительская задача: ${parentCode ?? "Нет"}`,
    `Зависит от: ${dependencyCodes.length > 0 ? dependencyCodes.join(", ") : "Нет зависимостей"}`,
  ];

  const descriptionLines = wrapText(
    task.description.length > 0 ? task.description : "Без описания",
    font,
    BODY_SIZE,
    CONTENT_WIDTH,
  );

  let page: PDFPage | null = null;
  let y = 0;

  const lineHeight = (size: number) => size * LINE_GAP;

  function drawHeader(target: PDFPage) {
    let cursor = PAGE_HEIGHT - MARGIN;
    const sizes = [TITLE_SIZE, META_SIZE];
    headerLines.forEach((text, index) => {
      const size = sizes[index] ?? META_SIZE;
      const wrapped = wrapText(text, font, size, CONTENT_WIDTH);
      for (const line of wrapped) {
        target.drawText(line, {
          x: MARGIN,
          y: cursor - size,
          size,
          font,
          color: rgb(0.1, 0.1, 0.12),
        });
        cursor -= lineHeight(size);
      }
    });
    cursor -= 8;
    target.drawLine({
      start: { x: MARGIN, y: cursor },
      end: { x: PAGE_WIDTH - MARGIN, y: cursor },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.72),
    });
    y = cursor - 16;
  }

  function ensurePage() {
    if (page === null || y < MARGIN + BODY_SIZE) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeader(page);
    }
  }

  function drawLine(line: string) {
    ensurePage();
    page!.drawText(line.length > 0 ? line : " ", {
      x: MARGIN,
      y: y - BODY_SIZE,
      size: BODY_SIZE,
      font,
      color: rgb(0.15, 0.15, 0.18),
    });
    y -= lineHeight(BODY_SIZE);
  }

  ensurePage();

  for (const line of detailLines.flatMap((line) => wrapText(line, font, BODY_SIZE, CONTENT_WIDTH))) {
    drawLine(line);
  }

  y -= BLOCK_GAP;
  drawLine("Описание:");
  for (const line of descriptionLines) {
    drawLine(line);
  }

  return pdf.save();
}
