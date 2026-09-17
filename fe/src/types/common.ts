export type Value = string | number | boolean | null;
export type Row = Record<string, Value>;

export interface PageRequest {
  page_no: number;
  page_size: number;
}

export interface PageResult<T> {
  total: number;
  items: T[];
}
