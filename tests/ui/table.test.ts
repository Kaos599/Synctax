import { describe, it, expect } from "vitest";
import { createTable } from "../../src/ui/table.js";

describe("UI Table", () => {
  it("creates a table with styled headers", () => {
    const table = createTable({ headers: ["Name", "Status", "Count"] });
    expect(table).toBeDefined();
    expect(typeof table.push).toBe("function");
    expect(typeof table.toString).toBe("function");
  });

  it("table renders with data rows", () => {
    const table = createTable({ headers: ["Client", "Installed"] });
    table.push(["Claude", "Yes"] as any);
    table.push(["Cursor", "No"] as any);
    const output = table.toString();
    expect(output).toContain("Claude");
    expect(output).toContain("Yes");
    expect(output).toContain("Cursor");
  });

  it("header colors cycle for more than 5 columns", () => {
    const table = createTable({
      headers: ["A", "B", "C", "D", "E", "F", "G"],
    });
    table.push(["1", "2", "3", "4", "5", "6", "7"] as any);
    const output = table.toString();
    expect(output).toContain("1");
    expect(output).toContain("7");
  });
});
