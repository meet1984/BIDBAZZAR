export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
}

export function pagination(page = 1, pageSize = 20, maximum = 100): Pagination {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(maximum, Math.max(1, Math.trunc(pageSize)));
  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
  };
}
