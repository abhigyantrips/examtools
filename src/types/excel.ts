export interface ExcelParseResult<T> {
  data: T[];
  errors: string[];
  warnings: string[];
}
