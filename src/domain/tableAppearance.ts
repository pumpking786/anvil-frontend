import type { DocumentStyle, TableColumn, TextAppearance } from './types';
import { documentTheme } from '../pdf/design';
import { contrastText } from '../lib/theme';
export const TABLE_COLUMNS: { key: TableColumn; label: string }[] = [
  { key: 'index', label: 'Item Number' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'amount', label: 'Amount' },
];
export function tablePalette(style: DocumentStyle) {
  const theme = documentTheme(style.primaryColor, style.textColor);
  return {
    headerBackground:
      style.table === 'bold' ? theme.accent : style.table === 'light' ? '#ffffff' : theme.tint,
    rowBackground: '#ffffff',
    stripeBackground: theme.tint,
    borderColor: theme.line,
    columnBackground: theme.tint,
    totalBackground: style.table === 'bold' ? theme.accent : theme.tint,
    ...style.tableColors,
  };
}
export function tableTextColor(
  style: DocumentStyle,
  column: TableColumn,
  part: 'heading' | 'body',
  item?: TextAppearance,
) {
  const theme = documentTheme(style.primaryColor, style.textColor);
  const section =
    part === 'heading'
      ? 'tableHeaders'
      : column === 'description'
        ? 'itemDescription'
        : 'itemNumbers';
  const fallback =
    part === 'heading'
      ? style.tableColors?.headerBackground
        ? contrastText(tablePalette(style).headerBackground)
        : style.table === 'bold'
          ? contrastText(theme.accent)
          : theme.accent
      : column === 'index'
        ? theme.muted
        : theme.ink;
  return (
    item?.color ?? style.tableText?.[column]?.[part] ?? style.text?.[section]?.color ?? fallback
  );
}
export function totalTextColor(style: DocumentStyle) {
  const theme = documentTheme(style.primaryColor, style.textColor);
  return style.tableColors?.totalBackground
    ? contrastText(tablePalette(style).totalBackground)
    : style.table === 'bold'
      ? contrastText(theme.accent)
      : theme.accent;
}
