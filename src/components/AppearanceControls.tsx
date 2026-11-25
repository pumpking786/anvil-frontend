import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, RotateCcw } from 'lucide-react';
import type { ImageFrame, TextAppearance } from '../domain/types';
import { DOCUMENT_FONTS } from '../domain/document';
import { Field } from './ui';
export function TextStyleControls({
  label,
  value = {},
  defaults,
  onChange,
  compact = false,
  maxSize = 28,
  unit = 'pt',
  shortLabels = false,
}: {
  label: string;
  value?: TextAppearance;
  defaults: Required<TextAppearance>;
  onChange: (value: TextAppearance) => void;
  compact?: boolean;
  maxSize?: number;
  unit?: 'pt' | 'px';
  shortLabels?: boolean;
}) {
  const effective = { ...defaults, ...value };
  const update = (key: keyof TextAppearance, val: TextAppearance[keyof TextAppearance]) =>
    onChange({ ...value, [key]: val });
  return (
    <div className={`text-style-controls ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="text-style-fields">
          <Field label={shortLabels ? 'Font' : `${label} font`}>
            <select
              aria-label={`${label} font`}
              value={value.font || ''}
              onChange={(e) =>
                update(
                  'font',
                  e.target.value ? (e.target.value as TextAppearance['font']) : undefined,
                )
              }
            >
              <option value="">Use document font</option>
              {Object.entries(DOCUMENT_FONTS).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={shortLabels ? 'Size' : `${label} size`}>
            <select
              aria-label={`${label} size`}
              value={value.size ?? ''}
              onChange={(e) => update('size', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">
                {shortLabels ? `Auto · ${defaults.size}` : `Auto · ${defaults.size} ${unit}`}
              </option>
              {[7, 8, 9, 9.5, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28]
                .filter((n) => n <= maxSize)
                .map((n) => (
                  <option value={n} key={n}>
                    {n} {unit}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      )}
      <div className="format-toolbar" role="group" aria-label={`${label} formatting`}>
        <div className="format-segment" role="group" aria-label={`${label} emphasis`}>
          <button
            type="button"
            aria-label={`${label} normal`}
            title="Normal Text"
            aria-pressed={!effective.bold && !effective.italic}
            onClick={() => onChange({ ...value, bold: false, italic: false })}
          >
            Aa
          </button>
          <button
            type="button"
            aria-label={`${label} bold`}
            title="Bold"
            aria-pressed={effective.bold}
            onClick={() => update('bold', !effective.bold)}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            aria-label={`${label} italic`}
            title="Italic"
            aria-pressed={effective.italic}
            onClick={() => update('italic', !effective.italic)}
          >
            <Italic size={15} />
          </button>
        </div>
        <div className="format-segment" role="group" aria-label={`${label} alignment`}>
          {(
            [
              ['left', AlignLeft],
              ['center', AlignCenter],
              ['right', AlignRight],
            ] as const
          ).map(([align, Icon]) => (
            <button
              key={align}
              type="button"
              aria-label={`${label} align ${align}`}
              title={`Align ${align}`}
              aria-pressed={effective.align === align}
              onClick={() => update('align', align)}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        <label className="format-color" title="Text Color">
          <input
            type="color"
            aria-label={`${label} color`}
            value={effective.color}
            onChange={(e) => update('color', e.target.value)}
          />
          {!compact && <span>{effective.color.toUpperCase()}</span>}
        </label>
        <button
          type="button"
          className="format-reset"
          aria-label={`Reset ${label} styling`}
          title="Use Default Styling"
          onClick={() => onChange({})}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
export function ImageFrameControls({
  label,
  value,
  onChange,
  minWidth = 16,
  maxWidth = 260,
  maxHeight = 180,
  hideWidth = false,
  lockAspect = false,
  onLockAspectChange,
}: {
  label: string;
  value: ImageFrame;
  onChange: (value: ImageFrame) => void;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  hideWidth?: boolean;
  lockAspect?: boolean;
  onLockAspectChange?: (locked: boolean) => void;
}) {
  const ratio = value.width / value.height;
  const widthMin = lockAspect ? Math.ceil(Math.max(minWidth, 16 * ratio)) : minWidth;
  const widthMax = lockAspect ? Math.floor(Math.min(maxWidth, maxHeight * ratio)) : maxWidth;
  const heightMin = lockAspect ? Math.ceil(Math.max(16, minWidth / ratio)) : 16;
  const heightMax = lockAspect ? Math.floor(Math.min(maxHeight, maxWidth / ratio)) : maxHeight;
  return (
    <div className="image-frame-controls">
      {onLockAspectChange && (
        <label className="checkbox-line image-proportion-toggle">
          <input
            type="checkbox"
            checked={lockAspect}
            onChange={(e) => onLockAspectChange(e.target.checked)}
          />
          Keep {label.toLowerCase()} proportions
        </label>
      )}
      <div className="form-grid">
        {!hideWidth && (
          <Field label={`${label} width · ${Math.round(value.width)}px`}>
            <input
              type="range"
              min={widthMin}
              max={widthMax}
              step={1}
              value={value.width}
              onChange={(e) => {
                const width = Number(e.target.value);
                onChange({ ...value, width, ...(lockAspect ? { height: width / ratio } : {}) });
              }}
            />
          </Field>
        )}
        <Field label={`${label} height · ${Math.round(value.height)}px`}>
          <input
            type="range"
            min={heightMin}
            max={heightMax}
            step={1}
            value={value.height}
            onChange={(e) => {
              const height = Number(e.target.value);
              onChange({ ...value, height, ...(lockAspect ? { width: height * ratio } : {}) });
            }}
          />
        </Field>
      </div>
      <div className="form-grid">
        <Field label={`${label} ${label.endsWith('image') ? 'fit' : 'image fit'}`}>
          <select
            value={value.fit}
            onChange={(e) => onChange({ ...value, fit: e.target.value as ImageFrame['fit'] })}
          >
            <option value="contain">Fit entire image</option>
            <option value="cover">Fill frame (crop)</option>
          </select>
        </Field>
        <Field label={`${label} position`}>
          <select
            value={value.position}
            onChange={(e) =>
              onChange({ ...value, position: e.target.value as ImageFrame['position'] })
            }
          >
            {['left', 'center', 'right', 'top', 'bottom'].map((p) => (
              <option value={p} key={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
