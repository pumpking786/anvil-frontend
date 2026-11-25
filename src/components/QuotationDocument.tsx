import { approvalImagePosition, quotationFlow } from '../domain/quotationFlow';
import { documentPageGeometry, headerLetterheadFrame } from '../domain/letterhead';
import { splitItemDescription } from '../domain/products';
import { tablePalette, tableTextColor, totalTextColor } from '../domain/tableAppearance';
import { textCss, imageFrameStyle, documentImageFrame, itemTypography } from '../domain/appearance';
import type { TextSection, TextAppearance, TableColumn } from '../domain/types';
import { companyContactRows, companySlogan } from '../domain/company';
import { documentTheme, documentArtwork, DOCUMENT_LAYOUT } from '../pdf/design';
import { DOCUMENT_FONTS, documentTypography, renderedDocumentStyle } from '../domain/document';
import { contrastText } from '../lib/theme';
import { amountInWords, calculateTotals, formatDate, money, vatLabel } from '../domain/quotation';
import type { Quotation } from '../domain/types';
export function QuotationDocument({
  quote,
  id = 'quotation-document',
}: {
  quote: Quotation;
  id?: string;
}) {
  const { company, customer } = quote;
  const style = renderedDocumentStyle(quote);
  const type = documentTypography(style);
  const flow = quotationFlow(quote);
  const page = documentPageGeometry(style, quote.number);
  const letterhead = headerLetterheadFrame(style);
  const theme = documentTheme(style.primaryColor, style.textColor);
  const palette = tablePalette(style);
  const text = (section: TextSection, item?: TextAppearance) => ({
    ...(['grandTotalLabel', 'grandTotalValue'].includes(section)
      ? { color: totalTextColor(style) }
      : {}),
    ...textCss(style, section, item),
  });
  const cellText = (column: TableColumn, part: 'heading' | 'body', item?: TextAppearance) => ({
    ...text(
      part === 'heading'
        ? 'tableHeaders'
        : column === 'description'
          ? 'itemDescription'
          : 'itemNumbers',
      item,
    ),
    color: tableTextColor(style, column, part, item),
    ...(part === 'heading' ? { width: `${flow.columns[column]}%` } : {}),
  });
  const picture = (slot: 'logo' | 'letterhead' | 'signature' | 'stamp') =>
    imageFrameStyle(documentImageFrame(quote, slot));
  const totals = calculateTotals(quote.items, quote.discount, quote.vatEnabled, quote.vatRate);
  const terms = (
    <section className="document-terms">
      <span className="document-label" style={text('sectionLabels')}>
        TERMS & CONDITIONS
      </span>
      <p style={text('terms')}>{quote.terms || 'No additional terms.'}</p>
    </section>
  );
  return (
    <article
      className={`quotation-document header-${style.headerImage ? 'uploaded' : style.header} table-${style.table} ${page.fullPage ? 'page-letterhead' : ''}`}
      id={id}
      style={
        {
          width: `${DOCUMENT_LAYOUT.pageWidth}pt`,
          minHeight: `${DOCUMENT_LAYOUT.pageHeight}pt`,
          paddingTop: `${page.top}pt`,
          paddingLeft: `${page.left}pt`,
          paddingRight: `${page.right}pt`,
          paddingBottom: `${page.bottom}pt`,
          '--table-header': palette.headerBackground,
          '--table-row': palette.rowBackground,
          '--table-stripe': palette.stripeBackground,
          '--table-border': palette.borderColor,
          '--table-column': palette.columnBackground,
          '--table-total': palette.totalBackground,
          '--doc-accent': theme.accent,
          '--doc-tint': theme.tint,
          '--doc-ink': theme.ink,
          '--doc-muted': theme.muted,
          '--doc-line': theme.line,
          '--logo-width': `${quote.layout?.logoWidth || 132}px`,
          '--doc-font': DOCUMENT_FONTS[style.font],
          '--header-title-size': `${style.titleSize || 18}pt`,
          '--doc-body': `${type.body}pt`,
          '--doc-detail': `${type.detail}pt`,
          '--doc-small': `${type.small}pt`,
          '--doc-heading': `${type.heading}pt`,
          '--doc-reference': `${type.reference}pt`,
          '--doc-total': `${type.total}pt`,
          '--doc-accent-ink': contrastText(theme.accent),
        } as React.CSSProperties
      }
    >
      {page.fullPage && (
        <img
          src={style.headerImage}
          alt="Full A4 letterhead"
          className="document-page-letterhead"
          style={{
            width: `${DOCUMENT_LAYOUT.pageWidth}pt`,
            height: `${DOCUMENT_LAYOUT.pageHeight}pt`,
            objectFit: page.settings.fit,
            objectPosition: page.settings.position,
          }}
        />
      )}
      {!style.headerImage && (
        <svg className="document-curves" viewBox="0 0 595.28 116" aria-hidden="true">
          {documentArtwork(style.header).map(({ d, fill, opacity }) => (
            <path
              key={d}
              d={d}
              fill={fill ? theme.accent : 'none'}
              stroke="var(--doc-accent)"
              strokeWidth=".45"
              opacity={opacity}
            />
          ))}
        </svg>
      )}
      {!page.fullPage && (
        <header
          className="document-header"
          style={
            style.headerImage
              ? {
                  marginLeft: `${-page.left}pt`,
                  marginRight: `${-page.right}pt`,
                }
              : undefined
          }
        >
          {style.headerImage ? (
            <img
              className="document-letterhead"
              style={{
                ...imageFrameStyle({ ...letterhead, fit: 'contain' }),
                objectFit: letterhead.fit,
                marginLeft: letterhead.position === 'left' ? 0 : 'auto',
                marginRight: letterhead.position === 'right' ? 0 : 'auto',
              }}
              src={style.headerImage}
              alt="Company letterhead"
            />
          ) : (
            <>
              {company.logo && (
                <div className="document-logo-block">
                  <img
                    className="document-logo"
                    style={picture('logo')}
                    src={company.logo}
                    alt="Company logo"
                  />
                </div>
              )}
              <div className={`document-company ${company.logo ? 'with-logo' : ''}`}>
                {style.tagline && (
                  <h2 className="document-tagline" style={text('headerTitle')}>
                    {style.tagline}
                  </h2>
                )}
                {style.subtitle && (
                  <p className="document-header-subtitle" style={text('headerSubtitle')}>
                    {style.subtitle}
                  </p>
                )}
                {companyContactRows(company, style.headerContent).map(({ text: line, key }) => (
                  <p
                    className="document-contact-line"
                    key={key}
                    data-text-section={key}
                    style={text(key)}
                  >
                    {line}
                  </p>
                ))}
                {companySlogan(company, style.headerContent) && (
                  <p className="document-slogan" style={text('slogan')}>
                    {companySlogan(company, style.headerContent)}
                  </p>
                )}
              </div>
            </>
          )}
        </header>
      )}
      <div className="document-title-band">
        <h1 style={text('documentTitle')}>Quotation</h1>
        <div className="document-title">
          <h2 style={text('reference')}>{quote.number}</h2>
          <p style={text('status')}>{quote.status || 'Valid'} · All amounts in NPR</p>
        </div>
      </div>
      <div className="document-parties">
        <div>
          <span className="document-label" style={text('sectionLabels')}>
            PREPARED FOR
          </span>
          <h3 style={text('customerName')}>{customer.name}</h3>
          <p style={text('customerDetails')}>{customer.address}</p>
          {customer.pan && <p style={text('customerDetails')}>VAT / PAN: {customer.pan}</p>}
          <p style={text('customerDetails')}>{customer.email}</p>
          <p style={text('customerDetails')}>{customer.phone}</p>
        </div>
        <dl>
          <div>
            <dt style={text('metadataLabels')}>Quotation date</dt>
            <dd style={text('metadataValues')}>{formatDate(quote.date)}</dd>
          </div>
          <div>
            <dt style={text('metadataLabels')}>Valid until</dt>
            <dd style={text('metadataValues')}>{formatDate(quote.validUntil)}</dd>
          </div>
          <div>
            <dt style={text('metadataLabels')}>Currency</dt>
            <dd style={text('metadataValues')}>Nepali Rupees (NPR)</dd>
          </div>
        </dl>
      </div>
      <table className="document-items">
        <thead>
          <tr>
            <th style={cellText('index', 'heading')} className="item-index">
              #
            </th>
            <th style={cellText('description', 'heading')}>Description</th>
            <th style={cellText('quantity', 'heading')} className="numeric">
              Qty
            </th>
            <th style={cellText('unitPrice', 'heading')} className="numeric">
              Unit price
            </th>
            <th style={cellText('amount', 'heading')} className="numeric">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item, i) => (
            <tr key={item.id}>
              <td className="item-index" style={cellText('index', 'body', item.appearance)}>
                {String(i + 1).padStart(2, '0')}
              </td>
              <td style={cellText('description', 'body', item.appearance)}>
                <span
                  className="document-item-title"
                  style={{ fontSize: `${itemTypography(style, item.appearance).titleSize}pt` }}
                >
                  {splitItemDescription(item.description).title}
                </span>
                {splitItemDescription(item.description).details && (
                  <span
                    className="document-item-details"
                    style={{
                      fontSize: `${itemTypography(style, item.appearance).detailSize}pt`,
                      color: itemTypography(style, item.appearance).detailColor,
                    }}
                  >
                    {splitItemDescription(item.description).details}
                  </span>
                )}
              </td>
              <td className="numeric" style={cellText('quantity', 'body', item.appearance)}>
                {item.quantity}
              </td>
              <td className="numeric" style={cellText('unitPrice', 'body', item.appearance)}>
                {money(item.unitPrice)}
              </td>
              <td className="numeric" style={cellText('amount', 'body', item.appearance)}>
                {money(totals.lines[i])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`document-summary ${flow.sideTerms ? 'side-terms' : ''}`}>
        <div className="document-words">
          <span className="document-label" style={text('sectionLabels')}>
            AMOUNT IN WORDS · NEPALI RUPEES
          </span>
          <p>
            <strong style={text('amountWords')}>{amountInWords(totals.total)}</strong>
          </p>
          {flow.sideTerms && terms}
        </div>
        <dl className="document-totals">
          <div>
            <dt style={text('totalsLabels')}>Subtotal</dt>
            <dd style={text('totalsValues')}>{money(totals.subtotal)}</dd>
          </div>
          <div>
            <dt style={text('totalsLabels')}>Discount</dt>
            <dd style={text('totalsValues')}>− {money(totals.discount)}</dd>
          </div>
          <div>
            <dt style={text('totalsLabels')}>Taxable amount</dt>
            <dd style={text('totalsValues')}>{money(totals.taxable)}</dd>
          </div>
          <div>
            <dt style={text('totalsLabels')}>{vatLabel(quote)}</dt>
            <dd style={text('totalsValues')}>{money(totals.vat)}</dd>
          </div>
          <div className="grand-total">
            <dt style={text('grandTotalLabel')}>Grand total</dt>
            <dd style={text('grandTotalValue')}>
              <small>NPR</small> {money(totals.total)}
            </dd>
          </div>
        </dl>
      </div>
      {!flow.sideTerms && terms}
      <div className="document-approval">
        <div className="document-prepared-by" style={{ width: `${flow.approval.preparerWidth}pt` }}>
          {quote.preparedBy && (
            <>
              <span style={text('metadataLabels')}>Prepared by</span>
              <strong>{quote.preparedBy.name}</strong>
            </>
          )}
        </div>
        <div className="document-authorization" style={{ width: `${flow.approval.width}pt` }}>
          <div className="document-approval-images" style={{ gap: `${flow.approval.gap}pt` }}>
            {company.signature ? (
              <img
                style={{
                  ...picture('signature'),
                  objectPosition: approvalImagePosition(quote, 'signature'),
                  width: `${flow.approval.signature.width}pt`,
                  height: `${flow.approval.signature.height}pt`,
                }}
                src={company.signature}
                alt="Authorized signature"
              />
            ) : (
              <div
                style={{
                  width: `${flow.approval.signature.width}pt`,
                  height: `${flow.approval.signature.height}pt`,
                }}
              />
            )}
            {company.stamp ? (
              <img
                style={{
                  ...picture('stamp'),
                  objectPosition: approvalImagePosition(quote, 'stamp'),
                  width: `${flow.approval.stamp.width}pt`,
                  height: `${flow.approval.stamp.height}pt`,
                }}
                src={company.stamp}
                alt="Company stamp"
              />
            ) : (
              <div
                className="document-approval-stamp"
                style={{
                  width: `${flow.approval.stamp.width}pt`,
                  height: `${flow.approval.stamp.height}pt`,
                }}
              >
                Company stamp
              </div>
            )}
          </div>
          <div className="document-authorization-name" style={text('signature')}>
            {company.signatory || 'Authorized signatory'}
          </div>
        </div>
      </div>
      <footer
        className="document-footer"
        style={
          page.fullPage
            ? {
                borderTop: page.showFooter ? undefined : 'none',
                bottom: `${page.footerBottom}pt`,
                left: `${page.left}pt`,
                right: `${page.right}pt`,
              }
            : undefined
        }
      >
        <strong style={text('footer')}>{page.showFooter ? style.footer : ''}</strong>
        <span style={text('pageNumber')}>
          {quote.number}
          <br />
          Page 1
        </span>
      </footer>
    </article>
  );
}
