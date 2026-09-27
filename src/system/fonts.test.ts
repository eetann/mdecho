import { describe, expect, test } from "bun:test";
import { parseFcListFonts, parsePowerShellFonts, parseSystemProfilerFonts } from "./fonts.ts";

describe("parsePowerShellFonts", () => {
  test("タブ区切りの2つ目以降を別名として扱う", () => {
    const stdout =
      "Arial\r\nBIZ UDPGothic\tBIZ UDPゴシック\r\nYu Gothic\tYu Gothic\t游ゴシック\r\n";

    expect(parsePowerShellFonts(stdout)).toEqual([
      { name: "Arial", aliases: [] },
      { name: "BIZ UDPGothic", aliases: ["BIZ UDPゴシック"] },
      // Sourceと同じ名前がFamilyNamesにも入っているが、別名としては重複させない
      { name: "Yu Gothic", aliases: ["游ゴシック"] },
    ]);
  });

  test("空行を無視する", () => {
    expect(parsePowerShellFonts("\n\nArial\n\n")).toEqual([{ name: "Arial", aliases: [] }]);
  });
});

describe("parseFcListFonts", () => {
  test("カンマ区切りの2つ目以降を別名として扱う", () => {
    const stdout = "DejaVu Sans\nIPAexMincho,IPAex明朝\n";

    expect(parseFcListFonts(stdout)).toEqual([
      { name: "DejaVu Sans", aliases: [] },
      { name: "IPAexMincho", aliases: ["IPAex明朝"] },
    ]);
  });

  test("フェイスごとに重複する行を1つにまとめる", () => {
    // fc-listはフェイスごとに1行出すため、同じファミリーが名前の順序違いで複数回現れる
    const stdout = "IPAexMincho,IPAex明朝\nIPAex明朝,IPAexMincho\nIPAexMincho\n";

    expect(parseFcListFonts(stdout)).toEqual([{ name: "IPAexMincho", aliases: ["IPAex明朝"] }]);
  });

  test("名前順に並べる", () => {
    expect(parseFcListFonts("Zapfino\nArial\nMeiryo\n").map((font) => font.name)).toEqual([
      "Arial",
      "Meiryo",
      "Zapfino",
    ]);
  });
});

describe("parseSystemProfilerFonts", () => {
  test("typefacesのfamilyを重複なく拾う", () => {
    const stdout = JSON.stringify({
      SPFontsDataType: [
        { _name: "Helvetica.ttc", typefaces: [{ family: "Helvetica" }, { family: "Helvetica" }] },
        { _name: "HiraginoSans.ttc", typefaces: [{ family: "Hiragino Sans" }] },
        { _name: "broken.ttf" },
      ],
    });

    expect(parseSystemProfilerFonts(stdout)).toEqual([
      { name: "Helvetica", aliases: [] },
      { name: "Hiragino Sans", aliases: [] },
    ]);
  });

  test("SPFontsDataTypeが無ければエラーにする", () => {
    expect(() => parseSystemProfilerFonts("{}")).toThrow("SPFontsDataType");
  });
});
