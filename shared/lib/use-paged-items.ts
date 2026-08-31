"use client";

import { useState } from "react";
import { clampPage, DEFAULT_PAGE_SIZE, pageCount, paginate } from "@/shared/lib/paginate";

export function usePagedItems<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = pageCount(items.length, pageSize);
  const currentPage = clampPage(page, items.length, pageSize);

  return {
    page: currentPage,
    setPage,
    totalPages,
    pageItems: paginate(items, currentPage, pageSize),
  };
}
