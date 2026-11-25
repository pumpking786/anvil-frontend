import {
  quotationFlow,
  approvalImagePosition,
  splitDescriptionAcrossPages,
  breakLongTokens,
  type QuotationDensity,
} from '../domain/quotationFlow';
import { documentPageGeometry, headerLetterheadFrame } from '../domain/letterhead';
import { splitItemDescription } from '../domain/products';
import { tablePalette, tableTextColor, totalTextColor } from '../domain/tableAppearance';
import {
  appearanceStyle,
  textOverrides,
  documentImageFrame,
  itemTypography,
} from '../domain/appearance';
import type { TextSection, TextAppearance, TableColumn } from '../domain/types';
import { companyContactRows, companySlogan } from '../domain/company';
import {
  Canvas,
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  type TextProps,
} from '@react-pdf/renderer';
import type { Quotation } from '../domain/types';
import { amountInWords, calculateTotals, formatDate, money, vatLabel } from '../domain/quotation';
import { DOCUMENT_FONTS, documentTypography, renderedDocumentStyle } from '../domain/document';
import { contrastText } from '../lib/theme';
import { DOCUMENT_LAYOUT, documentArtwork, documentTheme } from './design';
function localizedText(value: string) {
  return value.split(/([\u0900-\u097f\ua8e0-\ua8ff\u200c\u200d]+)/g).map((run, i) =>
    /[\u0900-\u097f\ua8e0-\ua8ff]/.test(run) ? (
      <Text key={i} style={{ fontFamily: 'Noto Devanagari', fontStyle: 'normal' }}>
        {run}
      </Text>
    ) : (
      run
    ),
  );
}
// The PDF line breaker recognizes ordinary spaces, but treats zero-width spaces as
// part of an unbroken word. A near-zero-width space run creates a clean line break
// without inserting a visible hyphen into a model code or URL.
function wrappableText(value: string) {
  const parts = breakLongTokens(value).split('\u200b');
  if (parts.length === 1) return localizedText(value);
  return parts.flatMap((part, index) => [
    ...(index
      ? [
          <Text key={`break-${index}`} style={{ fontSize: 0.01 }}>
            {' '}
          </Text>,
        ]
      : []),
    <Text key={`part-${index}`}>{localizedText(part)}</Text>,
  ]);
}
function Copy({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  return <Text {...props}>{wrappableText(children)}</Text>;
}
export function QuotationPdf({
  quote,
  density = 'regular',
  fitScale = 1,
}: {
  quote: Quotation;
  density?: QuotationDensity;
  fitScale?: number;
}) {
  const { company, customer } = quote;
  const style = renderedDocumentStyle(quote);
  const type = documentTypography(style, fitScale);
  const flow = quotationFlow(quote, density, fitScale);
  const theme = documentTheme(style.primaryColor, style.textColor);
  const text = (section: TextSection, item?: TextAppearance) => {
    const result = appearanceStyle(textOverrides(style, section, item));
    return result.fontSize
      ? { ...result, fontSize: Math.max(5.5, result.fontSize * fitScale) }
      : result;
  };
  const palette = tablePalette(style);
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
  });
  const picture = (slot: 'logo' | 'letterhead' | 'signature' | 'stamp') => {
    const f = documentImageFrame(quote, slot);
    return {
      width: f.width * 0.75,
      height: f.height * 0.75,
      objectFit: f.fit,
      objectPosition:
        slot === 'signature' || slot === 'stamp' ? approvalImagePosition(quote, slot) : f.position,
      maxWidth: '100%' as const,
    };
  };
  // Stationery dimensions and safe areas are physical measurements. Fitting the
  // quotation text must never shrink its letterhead or move text into the artwork.
  const page = documentPageGeometry(style, quote.number);
  const letterhead = headerLetterheadFrame(style);
  const totals = calculateTotals(quote.items, quote.discount, quote.vatEnabled, quote.vatRate);
  const centered = ['center', 'spotlight'].includes(style.header);
  const executive = style.header === 'executive' && !style.headerImage;
  const headerColor = executive ? '#ffffff' : theme.accent;
  const boxed = style.table === 'boxed';
  const darkHead = style.table === 'bold';
  const headInk = darkHead ? contrastText(theme.accent) : theme.accent;
  const cell = {
    // React PDF resolves unitless leading before inherited fonts; specify the size
    // here so numeric cells use the same physical line height as descriptions.
    fontSize: type.body,
    lineHeight: flow.lineHeight,
    paddingVertical: flow.rowPadding,
    paddingHorizontal: 7 * fitScale,
    borderRightWidth: boxed ? 0.5 : 0,
    borderColor: palette.borderColor,
  };
  const s = StyleSheet.create({
    page: {
      paddingTop: page.top,
      paddingLeft: page.left,
      paddingRight: page.right,
      paddingBottom: page.bottom,
      fontFamily: DOCUMENT_FONTS[style.font],
      fontSize: type.body,
      color: theme.ink,
    },
    artwork: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: DOCUMENT_LAYOUT.pageWidth,
      height: 116,
    },
    header: {
      flexDirection: centered ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: (executive ? 14 : 12) * flow.sectionScale,
      minHeight: (density === 'regular' ? 68 : 0) * fitScale,
      paddingTop: (executive ? 14 : 6) * flow.sectionScale,
      paddingHorizontal: (executive ? 12 : 0) * fitScale,
      marginBottom: executive ? 12 : 0,
      backgroundColor: executive ? theme.accent : '#ffffff',
      borderBottomWidth: ['horizon', 'ledger'].includes(style.header) ? 2 : 0,
      borderBottomColor: theme.accent,
    },
    company: {
      width: centered || !company.logo ? '100%' : '57%',
      borderLeftWidth:
        company.logo && !centered && ['dual', 'lines', 'architect', 'frame'].includes(style.header)
          ? 1.5
          : 0,
      borderColor: theme.accent,
      paddingLeft: centered ? 0 : 14,
      textAlign: centered ? 'center' : 'left',
    },
    logoBox: {
      width: centered ? '100%' : '40%',
      paddingRight: centered ? 0 : 10,
      alignItems: centered ? 'center' : 'flex-start',
      marginBottom: centered ? 8 : 0,
      backgroundColor: executive ? '#ffffff' : 'transparent',
      padding: executive ? 8 : 0,
      borderRadius: executive ? 3 : 0,
    },
    logo: {
      width: (quote.layout?.logoWidth || 132) * 0.75,
      maxWidth: '100%',
      height: Math.max(38, (quote.layout?.logoWidth || 132) * 0.3),
      objectFit: 'contain',
      objectPosition: centered ? 'center' : 'left',
    },
    detail: { color: theme.muted, fontSize: type.detail, lineHeight: 1.5 },
    tagline: {
      fontSize: style.titleSize || 18,
      fontWeight: 700,
      color: headerColor,
      lineHeight: 1.2,
      marginBottom: 5,
    },
    headerSubtitle: {
      fontSize: type.small,
      letterSpacing: 1.3,
      color: executive ? '#e7eff7' : theme.ink,
      fontWeight: 600,
      lineHeight: 1.45,
      marginBottom: 7,
    },
    quoteBand: {
      flexDirection: centered ? 'column' : 'row',
      alignItems: centered ? 'center' : 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: 9 * flow.sectionScale,
      paddingHorizontal:
        (['light', 'ledger', 'frame'].includes(style.header) || centered ? 0 : 12) * fitScale,
      marginBottom: 13 * flow.sectionScale,
      backgroundColor: page.fullPage
        ? 'transparent'
        : ['light', 'center', 'spotlight', 'ledger', 'frame'].includes(style.header)
          ? '#ffffff'
          : theme.tint,
      borderLeftWidth: ['light', 'center', 'spotlight', 'ledger', 'frame'].includes(style.header)
        ? 0
        : 3,
      borderLeftColor: theme.accent,
      borderBottomWidth: style.header === 'light' ? 1 : 0.5,
      borderBottomColor: theme.line,
      borderTopRightRadius: style.header === 'folder' ? 12 : 0,
    },
    title: {
      width: centered ? '100%' : '42%',
      fontSize: type.heading,
      letterSpacing: 0.1,
      color: theme.accent,
      fontWeight: 600,
    },
    quoteReference: {
      width: centered ? '100%' : '56%',
      textAlign: centered ? 'center' : 'right',
      marginTop: centered ? 5 : 0,
    },
    eyebrow: { color: theme.muted, fontSize: type.small, letterSpacing: 0.7, fontWeight: 600 },
    number: {
      fontSize: type.reference,
      color: theme.ink,
      marginBottom: 3,
      lineHeight: 1.25,
      fontWeight: 600,
    },
    parties: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 13 * flow.sectionScale,
    },
    customer: { width: '55%' },
    customerName: { fontSize: type.body + 0.5, fontWeight: 600, marginTop: 4, marginBottom: 3 },
    dates: { width: '39%', paddingTop: 4 },
    pair: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5 * flow.sectionScale,
      fontSize: type.detail,
      lineHeight: 1.5,
    },
    label: { color: theme.muted },
    tableHead: {
      flexDirection: 'row',
      backgroundColor: palette.headerBackground,
      borderTopWidth: boxed ? 0.5 : 0,
      borderBottomWidth: 0.7,
      borderLeftWidth: boxed ? 0.5 : 0,
      borderColor: palette.borderColor,
      borderRadius: style.table === 'bubble' ? 7 : 0,
      fontWeight: 600,
      color: headInk,
    },
    row: {
      flexDirection: 'row',
      borderBottomWidth: 0.4,
      borderLeftWidth: boxed ? 0.5 : 0,
      borderColor: palette.borderColor,
    },
    index: {
      ...cell,
      width: `${flow.columns.index}%`,
      paddingLeft: 5,
      paddingRight: 3,
      fontSize: type.small,
    },
    description: {
      ...cell,
      width: `${flow.columns.description}%`,
      fontSize: type.body,
      lineHeight: flow.lineHeight,
    },
    qty: {
      ...cell,
      width: `${flow.columns.quantity}%`,
      textAlign: 'right',
      paddingHorizontal: 4 * fitScale,
    },
    unit: { ...cell, width: `${flow.columns.unitPrice}%`, textAlign: 'right' },
    amount: { ...cell, width: `${flow.columns.amount}%`, textAlign: 'right' },
    columnAmount: {
      backgroundColor: style.table === 'column' ? palette.columnBackground : 'transparent',
    },
    tableLabel: {
      fontSize: type.detail,
      paddingVertical: Math.max(3, 6 * flow.sectionScale),
      color: headInk,
    },
    summary: { flexDirection: 'row', justifyContent: 'space-between', marginTop: flow.gap },
    words: { width: flow.sideTerms ? '51%' : '49%', paddingTop: 2 },
    wordText: {
      fontSize: type.body,
      fontWeight: 700,
      lineHeight: 1.5,
      marginTop: 6 * fitScale,
    },
    totals: { width: '44%' },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      lineHeight: 1.45,
      paddingVertical: flow.totalPadding,
      paddingHorizontal: 8 * fitScale,
      fontSize: type.detail,
    },
    grand: {
      backgroundColor: palette.totalBackground,
      borderTopWidth: 0.6,
      borderColor: palette.borderColor,
      paddingVertical: flow.grandPadding,
      marginTop: 4,
      alignItems: 'center',
    },
    grandLabel: { fontWeight: 700, fontSize: type.body, color: totalTextColor(style) },
    grandValue: { fontWeight: 700, fontSize: type.total, color: totalTextColor(style) },
    terms: {
      borderTopWidth: 0.5,
      borderColor: theme.line,
      paddingTop: flow.gap * 0.6,
      marginTop: flow.gap,
    },
    termsText: {
      fontSize: type.detail,
      lineHeight: flow.lineHeight,
      marginTop: 4,
      color: theme.muted,
    },
    signatures: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: flow.gap + 3 * fitScale,
    },
    preparedBy: { width: flow.approval.preparerWidth, paddingBottom: 1 },
    preparerName: { marginTop: 4, fontWeight: 600, fontSize: type.body, lineHeight: 1.5 },
    approvalImages: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: flow.approval.gap,
      marginBottom: 6,
    },
    stampEmpty: {
      ...flow.approval.stamp,
      borderWidth: 0.5,
      borderStyle: 'dashed',
      borderColor: theme.line,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stampLabel: { fontSize: type.small, color: theme.muted },
    signature: { width: flow.approval.width },
    signatureLine: {
      borderTopWidth: 0.5,
      borderColor: theme.line,
      width: '100%',
      paddingTop: 6 * fitScale,
      lineHeight: 1.5,
      textAlign: 'center',
      fontSize: type.detail,
    },
    footerRule: {
      position: 'absolute',
      bottom: page.ruleBottom,
      left: page.left,
      width: page.contentWidth,
      height: 1,
    },
    // Let embedded font metrics size dynamic footer text; fixed line boxes can clip glyphs.
    footerCompany: {
      fontFamily: [DOCUMENT_FONTS[style.font], 'Noto Devanagari'],
      position: 'absolute',
      bottom: page.footerBottom,
      left: page.left,
      width: page.fullPage ? page.contentWidth * 0.54 : '50%',
      fontSize: 7 * fitScale,
      color: theme.accent,
      fontWeight: 600,
    },
    footerPage: {
      position: 'absolute',
      bottom: page.footerBottom,
      right: page.right,
      width: page.fullPage ? page.contentWidth * 0.4 : '35%',
      fontSize: 7 * fitScale,
      color: theme.muted,
      textAlign: 'right',
    },
  });
  const terms = (
    <View style={s.terms}>
      <Text style={[s.eyebrow, text('sectionLabels')]} minPresenceAhead={25}>
        TERMS & CONDITIONS
      </Text>
      <Copy style={[s.termsText, text('terms')]} orphans={2} widows={2}>
        {breakLongTokens(quote.terms || 'No additional terms.')}
      </Copy>
    </View>
  );
  const totalRows = [
    ['Subtotal', money(totals.subtotal)],
    ['Discount', `− ${money(totals.discount)}`],
    ['Taxable amount', money(totals.taxable)],
    [vatLabel(quote), money(totals.vat)],
  ];
  return (
    <Document
      title={`${quote.number} · ${customer.name}`}
      author={company.name}
      subject="Business quotation"
      creator="Anvil Technologies Business Forge Platform"
      language="en-NP"
    >
      <Page size="A4" style={s.page} wrap>
        {page.fullPage && (
          <Image
            fixed
            src={style.headerImage}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DOCUMENT_LAYOUT.pageWidth,
              height: DOCUMENT_LAYOUT.pageHeight,
              objectFit: page.settings.fit,
              objectPosition: page.settings.position,
            }}
          />
        )}
        {!style.headerImage && (
          <Canvas
            style={s.artwork}
            fixed
            paint={(painter) => {
              documentArtwork(style.header).forEach(({ d, fill, opacity }) => {
                painter.save().path(d).opacity(opacity);
                if (fill) painter.fillColor(theme.accent).fill();
                else painter.lineWidth(0.45).strokeColor(theme.accent).stroke();
                painter.restore();
              });
              return null;
            }}
          />
        )}
        {!page.fullPage && (
          <View
            style={
              style.headerImage
                ? {
                    marginLeft: -page.left,
                    marginRight: -page.right,
                    paddingTop: 0,
                    paddingBottom: 12,
                    flexDirection: 'row',
                    justifyContent:
                      letterhead.position === 'left'
                        ? 'flex-start'
                        : letterhead.position === 'right'
                          ? 'flex-end'
                          : 'center',
                  }
                : s.header
            }
            wrap={false}
          >
            {style.headerImage ? (
              <Image
                src={style.headerImage}
                style={{
                  width: letterhead.width * 0.75,
                  height: letterhead.height * 0.75,
                  objectFit: letterhead.fit,
                  objectPosition: letterhead.position,
                }}
              />
            ) : (
              <>
                {company.logo && (
                  <View style={s.logoBox}>
                    <Image src={company.logo} style={[s.logo, picture('logo')]} />
                  </View>
                )}
                <View style={s.company}>
                  {style.tagline && (
                    <Copy style={[s.tagline, text('headerTitle')]}>{style.tagline}</Copy>
                  )}
                  {style.subtitle && (
                    <Copy style={[s.headerSubtitle, text('headerSubtitle')]}>{style.subtitle}</Copy>
                  )}
                  {companyContactRows(company, style.headerContent).map(({ text: line, key }) => (
                    <Copy
                      key={key}
                      style={[s.detail, { color: executive ? '#e7eff7' : theme.muted }, text(key)]}
                    >
                      {line}
                    </Copy>
                  ))}
                  {companySlogan(company, style.headerContent) && (
                    <Copy
                      style={[
                        s.detail,
                        {
                          fontWeight: 700,
                          marginTop: 5,
                          color: executive ? '#ffffff' : theme.accent,
                        },
                        text('slogan'),
                      ]}
                    >
                      {companySlogan(company, style.headerContent)}
                    </Copy>
                  )}
                </View>
              </>
            )}
          </View>
        )}
        <View style={s.quoteBand} wrap={false}>
          <Text style={[s.title, text('documentTitle')]}>Quotation</Text>
          <View style={s.quoteReference}>
            <Copy style={[s.number, text('reference')]}>{quote.number}</Copy>
            <Text style={[s.detail, text('status')]}>
              {quote.status || 'Valid'} · All amounts in NPR
            </Text>
          </View>
        </View>
        <View style={s.parties} wrap={false}>
          <View style={s.customer}>
            <Text style={[s.eyebrow, text('sectionLabels')]}>PREPARED FOR</Text>
            <Copy style={[s.customerName, text('customerName')]}>{customer.name}</Copy>
            {[
              customer.address,
              customer.pan && `VAT / PAN: ${customer.pan}`,
              customer.email,
              customer.phone,
            ]
              .filter(Boolean)
              .map((line, index) => (
                <Copy style={[s.detail, text('customerDetails')]} key={index}>
                  {line}
                </Copy>
              ))}
          </View>
          <View style={s.dates}>
            {[
              ['Quotation date', formatDate(quote.date)],
              ['Valid until', formatDate(quote.validUntil)],
              ['Currency', 'Nepali Rupees (NPR)'],
            ].map(([label, value]) => (
              <View style={s.pair} key={label}>
                <Text style={[s.label, { width: '48%' }, text('metadataLabels')]}>{label}</Text>
                <Text style={[{ width: '52%', textAlign: 'right' }, text('metadataValues')]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View>
          <View style={s.tableHead} fixed>
            <Text style={[s.index, s.tableLabel, cellText('index', 'heading')]}>#</Text>
            <Text style={[s.description, s.tableLabel, cellText('description', 'heading')]}>
              Description
            </Text>
            <Text style={[s.qty, s.tableLabel, cellText('quantity', 'heading')]}>Qty</Text>
            <Text style={[s.unit, s.tableLabel, cellText('unitPrice', 'heading')]}>Unit price</Text>
            <Text style={[s.amount, s.tableLabel, cellText('amount', 'heading')]}>Amount</Text>
          </View>
          {quote.items.map((item, index) => (
            <View
              style={[
                s.row,
                {
                  backgroundColor:
                    style.table === 'striped' && index % 2 === 0
                      ? palette.stripeBackground
                      : palette.rowBackground,
                },
              ]}
              key={item.id}
              wrap={splitDescriptionAcrossPages(item, style, flow.descriptionWidth)}
            >
              <Text
                style={[
                  s.index,
                  { color: theme.muted },
                  cellText('index', 'body', item.appearance),
                ]}
              >
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text
                orphans={2}
                widows={2}
                style={[s.description, cellText('description', 'body', item.appearance)]}
              >
                <Text
                  style={{ fontSize: itemTypography(style, item.appearance, fitScale).titleSize }}
                >
                  {wrappableText(splitItemDescription(item.description).title)}
                </Text>
                {splitItemDescription(item.description).details && (
                  <Text
                    style={{
                      fontSize: itemTypography(style, item.appearance, fitScale).detailSize,
                      color: itemTypography(style, item.appearance, fitScale).detailColor,
                      fontWeight: 400,
                    }}
                  >
                    {'\n'}
                    {wrappableText(splitItemDescription(item.description).details)}
                  </Text>
                )}
              </Text>
              <Text style={[s.qty, cellText('quantity', 'body', item.appearance)]}>
                {String(item.quantity)}
              </Text>
              <Text style={[s.unit, cellText('unitPrice', 'body', item.appearance)]}>
                {money(item.unitPrice)}
              </Text>
              <Text style={[s.amount, s.columnAmount, cellText('amount', 'body', item.appearance)]}>
                {money(totals.lines[index])}
              </Text>
            </View>
          ))}
        </View>
        {/* Allow totals, terms and approvals to flow independently. Grouping the
            entire closing section could move all of it to a fresh page when only
            the signature block needed more room. */}
        <View>
          <View style={s.summary} wrap={false}>
            <View style={s.words}>
              <Text style={[s.eyebrow, text('sectionLabels')]}>
                AMOUNT IN WORDS · NEPALI RUPEES
              </Text>
              <Copy style={[s.wordText, text('amountWords')]}>{amountInWords(totals.total)}</Copy>
              {flow.sideTerms && terms}
            </View>
            <View style={s.totals}>
              {totalRows.map(([label, value]) => (
                <View style={s.totalRow} key={label}>
                  <Text style={[s.label, { width: '52%' }, text('totalsLabels')]}>{label}</Text>
                  <Text style={[{ width: '48%', textAlign: 'right' }, text('totalsValues')]}>
                    {value}
                  </Text>
                </View>
              ))}
              <View style={[s.totalRow, s.grand]}>
                <Text style={[s.grandLabel, { width: '42%' }, text('grandTotalLabel')]}>
                  Grand total
                </Text>
                <Text
                  style={[
                    s.grandValue,
                    { width: '58%', textAlign: 'right' },
                    text('grandTotalValue'),
                  ]}
                >
                  <Text style={{ fontSize: type.small }}>NPR </Text>
                  {money(totals.total)}
                </Text>
              </View>
            </View>
          </View>
          {!flow.sideTerms && terms}
          <View style={s.signatures} wrap={false}>
            <View style={s.preparedBy}>
              {quote.preparedBy && (
                <>
                  <Text
                    style={[{ fontSize: type.detail, color: theme.muted }, text('metadataLabels')]}
                  >
                    Prepared by
                  </Text>
                  <Copy style={s.preparerName}>{quote.preparedBy.name}</Copy>
                </>
              )}
            </View>
            <View style={s.signature}>
              <View style={s.approvalImages}>
                {company.signature ? (
                  <Image
                    src={company.signature}
                    style={[picture('signature'), flow.approval.signature]}
                  />
                ) : (
                  <View style={flow.approval.signature} />
                )}
                {company.stamp ? (
                  <Image src={company.stamp} style={[picture('stamp'), flow.approval.stamp]} />
                ) : (
                  <View style={s.stampEmpty}>
                    <Text style={s.stampLabel}>Company stamp</Text>
                  </View>
                )}
              </View>
              <Copy style={[s.signatureLine, text('signature')]}>
                {company.signatory || 'Authorized signatory'}
              </Copy>
            </View>
          </View>
        </View>
        {page.showFooter && (
          <>
            <Canvas
              style={s.footerRule}
              fixed
              paint={(painter, width) => {
                painter
                  .moveTo(0, 0)
                  .lineTo(width, 0)
                  .strokeColor(theme.accent)
                  .lineWidth(0.75)
                  .stroke();
                return null;
              }}
            />
            <Text
              style={[
                s.footerCompany,
                text('footer'),
                {
                  fontFamily: [
                    DOCUMENT_FONTS[style.text?.footer?.font || style.font],
                    'Noto Devanagari',
                  ],
                },
              ]}
              fixed
              render={() => style.footer}
            />
          </>
        )}
        <Text
          style={[s.footerPage, text('pageNumber')]}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${quote.number}\nPage ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
