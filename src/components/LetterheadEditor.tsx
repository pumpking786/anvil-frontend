import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ScanLine } from 'lucide-react';
import type { DocumentStyle } from '../domain/types';
import { fitLetterhead } from '../domain/appearance';
import { Field, ImageUpload, NumberInput } from './ui';
import {
  A4_WIDTH_PX,
  headerLetterheadSettings,
  headerLetterheadFrame,
  pageLetterheadSettings,
} from '../domain/letterhead';
import type { PageLetterhead } from '../domain/types';

export function LetterheadEditor({
  style,
  onChange,
}: {
  style: DocumentStyle;
  onChange: Dispatch<SetStateAction<DocumentStyle>>;
}) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [locked, setLocked] = useState(true);
  useEffect(() => {
    setNatural(null);
    if (!style.headerImage) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      setNatural(size);
      onChange((previous) =>
        previous.images?.letterhead
          ? previous
          : {
              ...previous,
              images: { ...previous.images, letterhead: fitLetterhead(size.width, size.height) },
            },
      );
    };
    image.src = style.headerImage;
    return () => {
      active = false;
    };
  }, [style.headerImage, onChange]);
  const frame = headerLetterheadFrame(style);
  const header = headerLetterheadSettings(style);
  const ratio = natural ? natural.width / natural.height : frame.width / frame.height;
  const updateFrame = (value: Partial<typeof frame>) =>
    onChange((previous) => {
      const next = { ...headerLetterheadFrame(previous), ...value };
      return {
        ...previous,
        headerLetterhead: { ...headerLetterheadSettings(previous), fit: next.fit },
        images: {
          ...previous.images,
          letterhead: { ...next, fit: next.fit === 'fill' ? 'contain' : next.fit },
        },
      };
    });
  const resize = (dimension: 'width' | 'height', value: number) => {
    if (header.edgeToEdge || !locked) return updateFrame({ [dimension]: value });
    const width = Math.min(
      A4_WIDTH_PX,
      360 * ratio,
      Math.max(16, 16 * ratio, dimension === 'width' ? value : value * ratio),
    );
    updateFrame({ width, height: width / ratio });
  };
  const fullPage = style.letterheadMode === 'page';
  const page = pageLetterheadSettings(style);
  const setPage = <K extends keyof PageLetterhead>(key: K, value: PageLetterhead[K]) =>
    onChange((previous) => ({
      ...previous,
      pageLetterhead: { ...pageLetterheadSettings(previous), [key]: value },
    }));
  return (
    <section
      className={`letterhead-editor ${style.headerImage ? 'active' : ''}`}
      aria-label="Uploaded Letterhead"
    >
      <div className="letterhead-heading">
        <span className="eyebrow">YOUR LETTERHEAD</span>
        {style.headerImage && (
          <span className="letterhead-badge">{fullPage ? 'Whole A4 page' : 'Primary header'}</span>
        )}
      </div>
      <ImageUpload
        label="Full Letterhead Image"
        maxDimension={2400}
        value={style.headerImage}
        onChange={(value) => {
          setLocked(true);
          onChange((previous) => ({
            ...previous,
            headerImage: value,
            headerLetterhead: { edgeToEdge: true, fit: 'fill' },
            images: { ...previous.images, letterhead: undefined },
          }));
        }}
      />
      <p className="field-hint">
        Upload a header strip or a complete A4 letterhead with your logo and company details. It
        replaces the built-in header design, artwork and contact text.
      </p>
      {style.headerImage && (
        <>
          <Field label="Letterhead Placement">
            <select
              value={style.letterheadMode || 'header'}
              onChange={(event) =>
                onChange((previous) => ({
                  ...previous,
                  letterheadMode: event.target.value as 'header' | 'page',
                }))
              }
            >
              <option value="header">Header only</option>
              <option value="page">Whole A4 page · 210 × 297 mm</option>
            </select>
          </Field>
          {fullPage ? (
            <div className="page-letterhead-controls">
              <p className="field-hint">
                Your image sits behind the quotation and repeats on every A4 page. Use a portrait A4
                image for the best fit.
              </p>
              <div className="form-grid">
                <Field label="Full-Page Image Fit">
                  <select
                    value={page.fit}
                    onChange={(event) =>
                      setPage('fit', event.target.value as PageLetterhead['fit'])
                    }
                  >
                    <option value="contain">Fit entire image (no cropping)</option>
                    <option value="cover">Fill entire A4 (crop edges)</option>
                    <option value="fill">Stretch to A4 (no empty edges)</option>
                  </select>
                </Field>
                <Field label="Full-Page Image Position">
                  <select
                    value={page.position}
                    onChange={(event) =>
                      setPage('position', event.target.value as PageLetterhead['position'])
                    }
                  >
                    {['left', 'center', 'right', 'top', 'bottom'].map((value) => (
                      <option value={value} key={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="settings-section-title">
                <h3>Quotation Content Margins</h3>
              </div>
              <p className="field-hint">
                Leave room for the header, footer and borders in your image. These margins apply to
                every page; the image still fills the A4 canvas.
              </p>
              <div className="form-grid">
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                  <Field
                    key={side}
                    label={`${side[0].toUpperCase() + side.slice(1)} content margin · mm`}
                  >
                    <NumberInput
                      value={page[side]}
                      min={side === 'left' || side === 'right' ? 8 : 10}
                      max={side === 'top' ? 90 : side === 'bottom' ? 65 : 35}
                      step={1}
                      onValueChange={(value) =>
                        setPage(
                          side,
                          Math.min(
                            side === 'top' ? 90 : side === 'bottom' ? 65 : 35,
                            Math.max(
                              side === 'left' || side === 'right' ? 8 : 10,
                              Number.isFinite(value) ? value : page[side],
                            ),
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={page.showFooter}
                  onChange={(event) => setPage('showFooter', event.target.checked)}
                />
                Show Quotation Footer Slogan
              </label>
              <p className="field-hint">
                Page numbers are always included. The exact PDF preview updates automatically. Fit
                preserves proportions; Fill crops; Stretch changes the image proportions to match
                A4.
              </p>
            </div>
          ) : (
            <>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={header.edgeToEdge}
                  onChange={(event) =>
                    onChange((previous) => ({
                      ...previous,
                      headerLetterhead: { ...header, edgeToEdge: event.target.checked },
                      images: {
                        ...previous.images,
                        letterhead: {
                          ...frame,
                          fit: frame.fit === 'fill' ? 'contain' : frame.fit,
                        },
                      },
                    }))
                  }
                />
                Extend Header To Both A4 Edges
              </label>
              {header.edgeToEdge ? (
                <p className="field-hint">
                  Width is fixed at 210 mm. Adjust the height below; the left and right edges stay
                  flush with the page.
                </p>
              ) : (
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={locked}
                    onChange={(event) => {
                      setLocked(event.target.checked);
                      if (event.target.checked) {
                        const width = Math.min(frame.width, 360 * ratio);
                        updateFrame({ width, height: Math.max(16, width / ratio) });
                      }
                    }}
                  />
                  Keep Letterhead Proportions
                </label>
              )}
              <div className="form-grid">
                {!header.edgeToEdge && (
                  <Field label={`Letterhead width · ${Math.round(frame.width)}px`}>
                    <input
                      type="range"
                      min={locked ? Math.ceil(Math.max(16, 16 * ratio)) : 16}
                      max={
                        locked
                          ? Math.floor(Math.min(A4_WIDTH_PX, 360 * ratio))
                          : Math.floor(A4_WIDTH_PX)
                      }
                      step="1"
                      value={frame.width}
                      onChange={(event) => resize('width', Number(event.target.value))}
                    />
                  </Field>
                )}
                <Field label={`Letterhead height · ${Math.round(frame.height)}px`}>
                  <input
                    type="range"
                    min="16"
                    max={
                      !header.edgeToEdge && locked
                        ? Math.floor(Math.min(360, A4_WIDTH_PX / ratio))
                        : 360
                    }
                    step="1"
                    value={frame.height}
                    onChange={(event) => resize('height', Number(event.target.value))}
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Letterhead Image Fit">
                  <select
                    value={frame.fit}
                    onChange={(event) =>
                      updateFrame({ fit: event.target.value as typeof frame.fit })
                    }
                  >
                    <option value="fill">Stretch to frame (no empty edges)</option>
                    <option value="cover">Fill frame (crop, keep proportions)</option>
                    <option value="contain">Fit entire image (may leave space)</option>
                  </select>
                </Field>
                <Field label="Letterhead Position">
                  <select
                    value={frame.position}
                    onChange={(event) =>
                      updateFrame({ position: event.target.value as typeof frame.position })
                    }
                  >
                    {['left', 'center', 'right', 'top', 'bottom'].map((value) => (
                      <option key={value} value={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                className="button small"
                disabled={!natural}
                onClick={() => {
                  if (!natural) return;
                  setLocked(true);
                  onChange((previous) => ({
                    ...previous,
                    headerLetterhead: { ...headerLetterheadSettings(previous), fit: 'fill' },
                    images: {
                      ...previous.images,
                      letterhead: fitLetterhead(natural.width, natural.height),
                    },
                  }));
                }}
              >
                <ScanLine size={15} />
                Auto-Fit Letterhead
              </button>
              <p className="field-hint">
                The PDF preview updates automatically. Auto-fit restores the original proportions of
                a header strip. Stretch follows both dimensions; Fill crops without distortion; Fit
                may leave empty edges.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
