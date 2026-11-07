import { firstString } from "./text.js";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const parsePagination = (
  query: Record<string, unknown> = {},
  defaultLimit = DEFAULT_PAGE_SIZE,
): Pagination => {
  const requestedPage = Number(firstString(query.page) ?? 1);
  const requestedLimit = Number(firstString(query.limit) ?? defaultLimit);

  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.trunc(requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) && requestedLimit >= 1
    ? Math.min(MAX_PAGE_SIZE, Math.trunc(requestedLimit))
    : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = (total: number, pagination: Pagination): PaginationMeta => {
  const { page, limit } = pagination;
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};
