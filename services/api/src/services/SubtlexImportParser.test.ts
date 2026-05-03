import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { SubtlexImportParser } from "./SubtlexImportParser.js";

describe("SubtlexImportParser", () => {
  it("preserves SUBTLEXus word casing because uppercase carries frequency information", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Word", "FREQcount", "CDcount", "FREQlow", "Cdlow", "SUBTLWF", "Lg10WF", "SUBTLCD", "Lg10CD"],
      ["I", 2038529, 8372, 2038529, 8372, 39971.16, 6.3093, 99.81, 3.9229],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

    const result = new SubtlexImportParser().parse(buffer);

    expect(result.rows[0]?.word).toBe("I");
  });
});
