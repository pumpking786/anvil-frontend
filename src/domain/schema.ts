import { validImageData } from '../lib/imagePolicy.mjs';
import { z } from 'zod';
import { quotationErrors, draftQuotationErrors, isValidVatRate, VAT_RATE_ERROR } from './quotation';
import { CATEGORIES } from './types';
const text = z.string().max(10_000);
const vatRate = z.number().finite().refine(isValidVatRate, VAT_RATE_ERROR);
const crmDate = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Enter a valid date.');
const image = z
  .string()
  .max(2_000_000)
  .refine(validImageData, 'Upload a valid PNG, JPG or WebP image with supported dimensions.');
const fontName = z.enum(['dm-sans', 'open-sans', 'newsreader']);
const textAppearance = z.object({
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  font: fontName.optional(),
  size: z.number().finite().min(7).max(28).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});
const imageFrame = z.object({
  width: z.number().finite().min(16).max(700),
  height: z.number().finite().min(16).max(240),
  fit: z.enum(['contain', 'cover']),
  position: z.enum(['left', 'center', 'right', 'top', 'bottom']),
});
const brandAppearance = z.object({
  loginLayout: z.enum(['classic', 'split', 'banner', 'minimal']).optional(),
  loginAccent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  loginHeading: z.string().max(80).optional(),
  loginMessage: z.string().max(240).optional(),
  loginTagline: z.string().max(120).optional(),
  navigationText: z.string().max(100).optional(),
  navigationTextStyle: textAppearance.optional(),
  navigationLogo: imageFrame.optional(),
  loginTitle: z.string().max(100).optional(),
  loginSubtitle: z.string().max(100).optional(),
  loginTitleStyle: textAppearance.optional(),
  loginSubtitleStyle: textAppearance.optional(),
  loginLogo: image.optional(),
  loginLogoFrame: imageFrame.optional(),
  faviconFit: z.enum(['contain', 'cover']).optional(),
  faviconPadding: z.number().finite().int().min(0).max(25).optional(),
  backgroundFit: z.enum(['cover', 'contain']).optional(),
  backgroundPosition: imageFrame.shape.position.optional(),
});
const textSections = z.enum([
  'headerTitle',
  'headerSubtitle',
  'registration',
  'contact',
  'slogan',
  'documentTitle',
  'reference',
  'status',
  'sectionLabels',
  'customerName',
  'customerDetails',
  'metadataLabels',
  'metadataValues',
  'tableHeaders',
  'itemDescription',
  'itemNumbers',
  'totalsLabels',
  'totalsValues',
  'grandTotalLabel',
  'grandTotalValue',
  'amountWords',
  'terms',
  'signature',
  'footer',
  'pageNumber',
]);
const documentStyle = z.object({
  tableColors: z
    .record(
      z.enum([
        'headerBackground',
        'rowBackground',
        'stripeBackground',
        'borderColor',
        'columnBackground',
        'totalBackground',
      ]),
      z.string().regex(/^#[0-9a-fA-F]{6}$/),
    )
    .optional(),
  tableText: z
    .record(
      z.enum(['index', 'description', 'quantity', 'unitPrice', 'amount']),
      z.object({
        heading: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        body: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .optional(),
  headerContent: z
    .object({
      registration: z.string().max(500).optional(),
      contact: z.string().max(500).optional(),
      slogan: z.string().max(120).optional(),
    })
    .optional(),
  text: z.record(textSections, textAppearance).optional(),
  images: z
    .object({
      logo: imageFrame.optional(),
      letterhead: imageFrame
        .extend({
          width: z.number().finite().min(16).max(794),
          height: z.number().finite().min(16).max(360),
        })
        .optional(),
      signature: imageFrame.optional(),
      stamp: imageFrame.optional(),
    })
    .optional(),
  header: z.enum([
    'light',
    'bubble',
    'wave',
    'folder',
    'center',
    'dual',
    'lines',
    'executive',
    'ribbon',
    'architect',
    'horizon',
    'frame',
    'ledger',
    'mesh',
    'spotlight',
  ]),
  table: z.enum(['light', 'boxed', 'bold', 'striped', 'bubble', 'column']),
  font: z.enum(['dm-sans', 'open-sans', 'newsreader']),
  fontSize: z.number().finite().min(9).max(11),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  headerImage: image,
  letterheadMode: z.enum(['header', 'page']).optional(),
  headerLetterhead: z
    .object({
      edgeToEdge: z.boolean(),
      fit: z.enum(['contain', 'cover', 'fill']),
    })
    .optional(),
  pageLetterhead: z
    .object({
      fit: z.enum(['contain', 'cover', 'fill']),
      position: imageFrame.shape.position,
      top: z.number().finite().min(10).max(90),
      bottom: z.number().finite().min(10).max(65),
      left: z.number().finite().min(8).max(35),
      right: z.number().finite().min(8).max(35),
      showFooter: z.boolean(),
    })
    .optional(),
  tagline: z.string().max(120),
  subtitle: z.string().max(120).optional(),
  titleSize: z.number().finite().min(12).max(26).optional(),
  footer: z.string().max(100),
});
const company = z.object({
  name: text.refine((value) => !!value.trim()),
  address: text,
  phone: text,
  email: text,
  pan: text,
  logo: image,
  signature: image,
  stamp: image,
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  terms: text,
  signatory: text,
  slogan: z.string().max(120).optional(),
});
const customer = z.object({
  id: z.string().uuid(),
  name: text.refine((value) => !!value.trim()),
  pan: text,
  address: text,
  email: text,
  contactName: z.string().trim().max(150).optional(),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .pipe(z.union([z.string().email(), z.literal('')]))
    .optional(),
  phone: text,
  category: z.enum(CATEGORIES),
  photo: image,
});
const quotation = z
  .object({
    id: z.string().uuid(),
    preparedBy: z.object({ userId: z.string().min(1).max(100), name: text.min(1) }).optional(),
    number: text.min(1),
    date: text,
    validUntil: text,
    status: z.enum(['Valid', 'Sent', 'Accepted', 'Cancelled', 'Draft']).default('Valid'),
    customer: customer.extend({ id: z.union([z.string().uuid(), z.literal('')]), name: text }),
    company,
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          appearance: textAppearance.optional(),
          description: text,
          quantity: z.number().finite().positive().max(1_000_000),
          unitPrice: z.number().finite().nonnegative(),
        }),
      )
      .max(200),
    discount: z.number().finite().nonnegative(),
    vatEnabled: z.boolean(),
    vatRate: vatRate.optional(),
    terms: text,
    layout: z
      .object({
        design: z.enum(['classic', 'bordered', 'minimal']).default('classic'),
        logoWidth: z.number().finite().int().min(70).max(260).default(132),
        document: documentStyle.optional(),
      })
      .default({ design: 'classic', logoWidth: 132 }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .refine(
    (q) =>
      Object.keys(q.status === 'Draft' ? draftQuotationErrors(q) : quotationErrors(q)).length ===
        0 &&
      (q.status === 'Draft' || !!q.customer.id),
    'Invalid quotation',
  );
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    company,
    customers: z.array(customer).max(10_000),
    quotations: z.array(quotation).max(10_000),
    nextNumber: z.number().finite().int().positive(),
    sequenceYear: z.string().max(5).default(''),
    products: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: text.min(1),
          topic: text,
          salesDescription: text,
          sku: text,
          salePrice: z.number().finite().nonnegative(),
          trackInventory: z.boolean(),
          quantityOnHand: z.number().finite().nonnegative(),
          reorderLevel: z.number().finite().nonnegative(),
          updatedAt: z.string().datetime(),
        }),
      )
      .default([]),
    leads: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: text.min(1),
          company: text,
          email: text,
          phone: text,
          source: text,
          stage: z.enum(['New', 'Qualified', 'Proposal', 'Won', 'Lost']),
          ownerId: z.string().max(100).optional(),
          priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional(),
          probability: z.number().finite().min(0).max(100).optional(),
          expectedClose: crmDate.optional(),
          lostReason: text.optional(),
          customerId: z.union([z.string().uuid(), z.literal('')]).optional(),
          address: text.optional(),
          createdAt: z.string().datetime().optional(),
          activities: z
            .array(
              z
                .object({
                  id: z.string().uuid(),
                  type: z.enum(['Call', 'Email', 'Meeting', 'Task', 'Note']),
                  subject: z.string().trim().min(1).max(200),
                  notes: text,
                  dueDate: crmDate,
                  status: z.enum(['Planned', 'Done']),
                  createdAt: z.string().datetime(),
                  completedAt: z.string().datetime().optional(),
                  createdBy: text,
                })
                .refine(
                  (activity) => activity.status !== 'Planned' || !!activity.dueDate,
                  'Planned activities need a due date',
                ),
            )
            .max(200)
            .optional(),
          history: z
            .array(
              z.object({
                id: z.string().uuid(),
                at: z.string().datetime(),
                by: text,
                message: text,
              }),
            )
            .max(200)
            .optional(),
          expectedValue: z.number().finite().nonnegative(),
          nextAction: text,
          notes: text,
          updatedAt: z.string().datetime(),
        }),
      )
      .default([]),
    users: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: text.min(1),
          email: z.string().email(),
          role: z.enum(['super_admin', 'user']),
          photo: image.optional(),
          phone: text.optional(),
          jobTitle: text.optional(),
          defaultEmailTemplateId: z.string().uuid().optional(),
          emailTemplates: z
            .array(
              z.object({
                id: z.string().uuid(),
                name: z.string().trim().min(1).max(80),
                subject: z.string().min(1).max(160),
                message: z.string().min(1).max(10000),
                signature: z.string().max(3000),
                logo: image,
                color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
                align: z.enum(['left', 'center', 'right']),
                font: z.enum(['Arial', 'Georgia', 'Verdana']),
              }),
            )
            .max(20)
            .optional(),
          contactEmail: z.union([z.string().email(), z.literal('')]).optional(),
          active: z.boolean(),
          createdAt: z.string().datetime(),
        }),
      )
      .default([]),
    settings: z
      .object({
        brand: brandAppearance.optional(),
        quotePrefix: z
          .string()
          .min(1)
          .max(12)
          .regex(/^[a-zA-Z0-9_-]+$/),
        validityDays: z.number().finite().int().min(1).max(365),
        defaultVat: z.boolean(),
        defaultVatRate: vatRate.optional(),
        defaultDesign: z.enum(['classic', 'bordered', 'minimal']),
        lowStockThreshold: z.number().finite().nonnegative().max(1000000),
        defaultLogoWidth: z.number().finite().int().min(70).max(260).default(132),
        appLogo: image.default(''),
        appLogoSize: z.number().finite().int().min(24).max(64).optional(),
        appTextSize: z.number().finite().int().min(10).max(16).optional(),
        document: documentStyle.optional(),
        favicon: image.default(''),
        loginLogoWidth: z.number().finite().int().min(48).max(260).default(150),
        loginBackground: image.default(''),
        loginBackgroundColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default('#174A78'),
        fiscalYearOverride: z
          .string()
          .regex(/^(\d{2}-\d{2})?$/)
          .default(''),
        fiscalYearOverrideFor: z.string().max(5).default(''),
      })
      .default({
        quotePrefix: 'ANV',
        validityDays: 30,
        defaultVat: true,
        defaultDesign: 'classic',
        lowStockThreshold: 5,
        defaultLogoWidth: 132,
        appLogo: '',
        favicon: '',
        loginLogoWidth: 150,
        loginBackground: '',
        loginBackgroundColor: '#174A78',
        fiscalYearOverride: '',
        fiscalYearOverrideFor: '',
      }),
  })
  .refine(
    (w) =>
      [w.customers, w.products, w.leads, w.users].every(
        (records) => new Set(records.map((record) => record.id)).size === records.length,
      ) &&
      new Set(w.quotations.map((q) => q.id)).size === w.quotations.length &&
      new Set(w.quotations.map((q) => q.number.trim().toLowerCase())).size === w.quotations.length,
    'Duplicate record identifiers or quotation numbers',
  );
