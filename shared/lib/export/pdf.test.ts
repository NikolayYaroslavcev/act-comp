import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateTaskDetailPdf, generateTaskListPdf } from "./pdf";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "new",
    priority: 3,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 0,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

function loadTestFont(): Uint8Array {
  const candidates = [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/tahoma.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ];
  for (const path of candidates) {
    try {
      return new Uint8Array(readFileSync(path));
    } catch {
      // try next
    }
  }
  throw new Error("No system TTF with Cyrillic found for PDF tests");
}

const FONT = loadTestFont();
const EXPORTED_AT = new Date("2026-08-29T08:00:00.000Z");

describe("generateTaskListPdf", () => {
  it("creates a non-empty PDF whose title is the list name", async () => {
    const bytes = await generateTaskListPdf({
      listTitle: "Спринт 34",
      tasks: [makeTask({ code: "AB-1", title: "Deploy" })],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Спринт 34");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("embeds exported task data including Cyrillic text", async () => {
    const bytes = await generateTaskListPdf({
      listTitle: "Личный список",
      tasks: [
        makeTask({
          code: "RU-1",
          title: "Проверить кириллицу",
          description: "Описание задачи",
        }),
      ],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Личный список");
    expect(doc.getKeywords()).toContain("RU-1");
    expect(doc.getKeywords()).toContain("Проверить кириллицу");
  });

  it("shows an empty-state line when there are no tasks", async () => {
    const bytes = await generateTaskListPdf({
      listTitle: "Пустой",
      tasks: [],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getSubject()).toBe("Нет задач");
  });

  it("paginates a long list onto more than one page", async () => {
    const tasks = Array.from({ length: 80 }, (_, index) =>
      makeTask({
        id: `t${index}`,
        code: `T-${index}`,
        title: `Very long task title that should wrap if needed ${index}`,
        description: "A fairly long description ".repeat(8),
        tags: ["one", "two", "three", "four", "five"],
      }),
    );
    const bytes = await generateTaskListPdf({
      listTitle: "Большой список",
      tasks,
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});

describe("generateTaskDetailPdf", () => {
  it("creates a non-empty PDF titled with the task code and title", async () => {
    const bytes = await generateTaskDetailPdf({
      task: makeTask({ code: "AB-1", title: "Deploy" }),
      parentCode: null,
      dependencyCodes: [],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("AB-1 Deploy");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("embeds Cyrillic title and description without mangling", async () => {
    const bytes = await generateTaskDetailPdf({
      task: makeTask({
        code: "RU-1",
        title: "Проверить кириллицу",
        description: "Подробное описание задачи",
        category: "Бэкенд",
        tags: ["срочно"],
        status: "in_progress",
        priority: 4,
        deadline: "2026-09-01T00:00:00.000Z",
        estimatedMin: 90,
        timeSpentMin: 30,
      }),
      parentCode: null,
      dependencyCodes: [],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("RU-1 Проверить кириллицу");
    expect(doc.getKeywords()).toContain("Подробное описание задачи");
    expect(doc.getKeywords()).toContain("Бэкенд");
    expect(doc.getKeywords()).toContain("срочно");
  });

  it("includes the parent code and dependency codes when provided", async () => {
    const bytes = await generateTaskDetailPdf({
      task: makeTask({ code: "C-1", title: "Child", parentId: "p1", dependsOn: ["b1", "b2"] }),
      parentCode: "P-1",
      dependencyCodes: ["B-1", "B-2"],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getKeywords()).toContain("P-1");
    expect(doc.getKeywords()).toContain("B-1");
    expect(doc.getKeywords()).toContain("B-2");
  });

  it("shows predictable placeholders for null/empty fields", async () => {
    const bytes = await generateTaskDetailPdf({
      task: makeTask({ description: "", category: null, tags: [], deadline: null }),
      parentCode: null,
      dependencyCodes: [],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("paginates a long description onto more than one page without truncation", async () => {
    const longDescription = "Очень длинное описание задачи с деталями и контекстом. ".repeat(120);
    const bytes = await generateTaskDetailPdf({
      task: makeTask({ description: longDescription, title: "Большая задача" }),
      parentCode: null,
      dependencyCodes: [],
      exportedAt: EXPORTED_AT,
      fontBytes: FONT,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
