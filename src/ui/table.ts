import Table from "cli-table3";
import { tableHeader } from "./colors.js";

export interface SynctaxTableOptions {
  headers: string[];
  colAligns?: Array<"left" | "center" | "right">;
  compact?: boolean;
}

const headerColors = [
  tableHeader.col1,
  tableHeader.col2,
  tableHeader.col3,
  tableHeader.col4,
  tableHeader.col5,
];

export function createTable(opts: SynctaxTableOptions): Table.Table {
  const styledHeaders = opts.headers.map((h, i) => {
    const colorFn = headerColors[i % headerColors.length] ?? ((v: string) => v);
    return colorFn(h);
  });

  const tableOpts: Table.TableConstructorOptions = {
    head: styledHeaders,
    style: {
      head: [],
      border: ["gray"],
    },
  };

  if (opts.colAligns) tableOpts.colAligns = opts.colAligns;
  if (opts.compact) {
    tableOpts.style = {
      ...(tableOpts.style || {}),
      compact: opts.compact,
    };
  }

  return new Table(tableOpts);
}
