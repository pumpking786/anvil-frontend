import { RotateCcw } from 'lucide-react';
import type { DocumentStyle, TableColor } from '../domain/types';
import { tablePalette, tableTextColor, TABLE_COLUMNS } from '../domain/tableAppearance';
import { TEXT_SECTIONS, textDefaults } from '../domain/appearance';
import { Field } from './ui';
const COLORS: { key: TableColor; label: string }[] = [
  { key: 'headerBackground', label: 'Table Heading Background' },
  { key: 'rowBackground', label: 'Table Row Background' },
  { key: 'stripeBackground', label: 'Alternating Row Background' },
  { key: 'borderColor', label: 'Table Border Color' },
  { key: 'columnBackground', label: 'Amount Column Background' },
  { key: 'totalBackground', label: 'Grand Total Background' },
];
export function TableAppearanceEditor({
  style,
  onChange,
}: {
  style: DocumentStyle;
  onChange: (style: DocumentStyle) => void;
}) {
  const palette = tablePalette(style);
  return (
    <section className="designer-text-section" aria-label="Table Colors">
      <div className="settings-section-title">
        <span className="eyebrow">TABLE COLORS</span>
        <h3>Color every part of your table.</h3>
      </div>
      <div className="table-color-grid">
        {COLORS.map(({ key, label }) => (
          <Field label={label} key={key}>
            <div className="color-choice">
              <input
                type="color"
                value={palette[key]}
                onChange={(event) =>
                  onChange({
                    ...style,
                    tableColors: { ...style.tableColors, [key]: event.target.value },
                  })
                }
              />
              <span>{palette[key].toUpperCase()}</span>
            </div>
          </Field>
        ))}
      </div>
      <p className="field-hint">
        Alternating rows use the Striped table style. The amount background uses Column style.
      </p>
      <div className="table-text-colors">
        <div className="table-text-color-row table-text-color-heading">
          <span>Column</span>
          <span>Heading text</span>
          <span>Item text</span>
        </div>
        {TABLE_COLUMNS.map(({ key, label }) => (
          <div className="table-text-color-row" key={key}>
            <span>{label}</span>
            {(['heading', 'body'] as const).map((part) => (
              <input
                key={part}
                type="color"
                aria-label={`${label} ${part === 'heading' ? 'heading' : 'item'} text color`}
                value={tableTextColor(style, key, part)}
                onChange={(e) =>
                  onChange({
                    ...style,
                    tableText: {
                      ...style.tableText,
                      [key]: { ...style.tableText?.[key], [part]: e.target.value },
                    },
                  })
                }
              />
            ))}
          </div>
        ))}
      </div>
      <p className="field-hint">
        Individual line-item colors take priority over these column defaults.
      </p>
      <button
        type="button"
        className="text-button"
        onClick={() => onChange({ ...style, tableColors: undefined, tableText: undefined })}
      >
        <RotateCcw size={14} /> Reset Table Colors
      </button>
      <details className="document-text-color-details">
        <summary>All Document Text Colors</summary>
        <div className="table-color-grid">
          {TEXT_SECTIONS.map(({ key, label }) => (
            <Field key={key} label={`${label} section color`}>
              <input
                type="color"
                value={style.text?.[key]?.color || textDefaults(style, key).color}
                onChange={(e) =>
                  onChange({
                    ...style,
                    text: { ...style.text, [key]: { ...style.text?.[key], color: e.target.value } },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </details>
    </section>
  );
}
