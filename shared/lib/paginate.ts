export const DEFAULT_PAGE_SIZE = 10;

export type PageNumber = number | "ellipsis";

export function pageCount(total: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  if (total <= 0) {
    return 1;
  }
  return Math.ceil(total / pageSize);
}

export function clampPage(page: number, total: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function paginate<T>(items: T[], page: number, pageSize: number = DEFAULT_PAGE_SIZE): T[] {
  const current = clampPage(page, items.length, pageSize);
  const start = (current - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function visiblePageNumbers(current: number, totalPages: number): PageNumber[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const candidates = new Set(
    [1, totalPages, current - 1, current, current + 1].filter((page) => page >= 1 && page <= totalPages),
  );
  const sorted = [...candidates].sort((a, b) => a - b);
  const result: PageNumber[] = [];

  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  }

  return result;
}
