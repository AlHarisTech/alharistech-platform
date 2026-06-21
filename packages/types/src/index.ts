export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export type { Validated } from './validated';

export interface ApiError {
  error: {
    code: string;
    message: string;
    message_en?: string;
    statusCode: number;
    details?: Record<string, unknown>;
  };
  meta: ResponseMeta;
}
