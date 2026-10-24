import { IMeta } from './common.interface.js';

export interface PaginationResult<T> {
  data: T[];
  meta: IMeta;
}
