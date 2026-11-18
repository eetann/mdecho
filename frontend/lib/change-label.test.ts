import { describe, expect, test } from "bun:test";
import { formatChangeBadge, formatChangeSummary } from "./change-label.ts";

describe("formatChangeBadge", () => {
  test("新規か、追加・削除の行数を返す", () => {
    expect(formatChangeBadge({ status: "added", added: 10, deleted: 0 })).toBe("新規");
    expect(formatChangeBadge({ status: "modified", added: 3, deleted: 1 })).toBe("+3 −1");
    expect(formatChangeBadge({ status: "unchanged", added: 0, deleted: 0 })).toBeNull();
  });
});

describe("formatChangeSummary", () => {
  test("新規ファイルは行数を添える", () => {
    expect(formatChangeSummary({ status: "added", added: 48, deleted: 0 }, 1)).toBe(
      "新規ファイル(48行)",
    );
  });

  test("変更は行数とか所数を出し、削除だけなら削除のみと伝える", () => {
    expect(formatChangeSummary({ status: "modified", added: 12, deleted: 3 }, 5)).toBe(
      "+12 −3行・変更5か所",
    );
    expect(formatChangeSummary({ status: "modified", added: 0, deleted: 2 }, 0)).toBe(
      "+0 −2行(削除のみ)",
    );
  });

  test("変わっていなければ変更なし", () => {
    expect(formatChangeSummary({ status: "unchanged", added: 0, deleted: 0 }, 0)).toBe("変更なし");
  });
});
