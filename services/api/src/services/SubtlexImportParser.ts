import * as XLSX from "xlsx";
import { AppError } from "../domain/AppError.js";

export interface SubtlexImportRow {
  word: string;
  freqCount: number | null;
  cdCount: number | null;
  freqLow: number | null;
  cdLow: number | null;
  subtlWf: string | null;
  lg10Wf: string | null;
  subtlCd: string | null;
  lg10Cd: string | null;
}

export interface SubtlexParseResult {
  rows: SubtlexImportRow[];
  skippedRows: number;
  totalRows: number;
}

const REQUIRED_HEADERS = ["word", "freqcount", "cdcount", "freqlow", "cdlow", "subtlwf", "lg10wf", "subtlcd", "lg10cd"];

export class SubtlexImportParser {
  parse(buffer: Buffer, limit?: number): SubtlexParseResult {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new AppError("validation_failed", "Workbook has no sheets");
    }

    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
      throw new AppError("validation_failed", "Workbook first sheet is missing");
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: null, blankrows: false });
    const [headerRow, ...dataRows] = rows;
    if (!headerRow) {
      throw new AppError("validation_failed", "Workbook first sheet has no header row");
    }

    const headerMap = this.headerMap(headerRow);
    for (const header of REQUIRED_HEADERS) {
      if (headerMap.get(header) === undefined) {
        throw new AppError("validation_failed", `SUBTLEXus header is missing: ${header}`);
      }
    }

    const parsedRows: SubtlexImportRow[] = [];
    let skippedRows = 0;
    for (const row of dataRows) {
      if (limit !== undefined && parsedRows.length >= limit) {
        break;
      }

      const word = this.cell(row, headerMap, "word").trim();
      if (!word) {
        skippedRows += 1;
        continue;
      }

      parsedRows.push({
        cdCount: this.intCell(row, headerMap, "cdcount"),
        cdLow: this.intCell(row, headerMap, "cdlow"),
        freqCount: this.intCell(row, headerMap, "freqcount"),
        freqLow: this.intCell(row, headerMap, "freqlow"),
        lg10Cd: this.decimalCell(row, headerMap, "lg10cd"),
        lg10Wf: this.decimalCell(row, headerMap, "lg10wf"),
        subtlCd: this.decimalCell(row, headerMap, "subtlcd"),
        subtlWf: this.decimalCell(row, headerMap, "subtlwf"),
        word,
      });
    }

    return { rows: parsedRows, skippedRows, totalRows: dataRows.length };
  }

  private headerMap(headerRow: unknown[]): Map<string, number> {
    const map = new Map<string, number>();
    headerRow.forEach((value, index) => {
      if (typeof value === "string") {
        map.set(this.normalizeHeader(value), index);
      }
    });
    return map;
  }

  private normalizeHeader(value: string): string {
    return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  }

  private cell(row: unknown[], headerMap: Map<string, number>, header: string): string {
    const index = headerMap.get(header);
    if (index === undefined) return "";
    const value = row[index];
    return value === null || value === undefined ? "" : String(value);
  }

  private intCell(row: unknown[], headerMap: Map<string, number>, header: string): number | null {
    const value = Number(this.cell(row, headerMap, header));
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  private decimalCell(row: unknown[], headerMap: Map<string, number>, header: string): string | null {
    const raw = this.cell(row, headerMap, header);
    const value = Number(raw);
    return Number.isFinite(value) ? String(value) : null;
  }

}
