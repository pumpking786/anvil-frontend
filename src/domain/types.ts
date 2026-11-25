export const CATEGORIES = [
  'Government',
  'Banking',
  'Insurance',
  'Enterprise',
  'Education',
] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Company {
  name: string;
  address: string;
  phone: string;
  email: string;
  pan: string;
  logo: string;
  signature: string;
  stamp: string;
  accent: string;
  terms: string;
  signatory: string;
  slogan?: string;
}
export interface Customer {
  id: string;
  name: string;
  pan: string;
  address: string;
  email: string;
  contactName?: string;
  contactEmail?: string;
  phone: string;
  category: Category;
  photo: string;
}
export type DocumentFont = 'dm-sans' | 'open-sans' | 'newsreader';
export interface TextAppearance {
  color?: string;
  font?: DocumentFont;
  size?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
}
export type TextSection =
  | 'headerTitle'
  | 'headerSubtitle'
  | 'registration'
  | 'contact'
  | 'slogan'
  | 'documentTitle'
  | 'reference'
  | 'status'
  | 'sectionLabels'
  | 'customerName'
  | 'customerDetails'
  | 'metadataLabels'
  | 'metadataValues'
  | 'tableHeaders'
  | 'itemDescription'
  | 'itemNumbers'
  | 'totalsLabels'
  | 'totalsValues'
  | 'grandTotalLabel'
  | 'grandTotalValue'
  | 'amountWords'
  | 'terms'
  | 'signature'
  | 'footer'
  | 'pageNumber';
export interface ImageFrame {
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  position: 'left' | 'center' | 'right' | 'top' | 'bottom';
}
export interface BrandAppearance {
  loginLayout?: 'classic' | 'split' | 'banner' | 'minimal';
  loginAccent?: string;
  loginHeading?: string;
  loginMessage?: string;
  loginTagline?: string;
  navigationText?: string;
  navigationTextStyle?: TextAppearance;
  navigationLogo?: ImageFrame;
  loginTitle?: string;
  loginSubtitle?: string;
  loginTitleStyle?: TextAppearance;
  loginSubtitleStyle?: TextAppearance;
  loginLogo?: string;
  loginLogoFrame?: ImageFrame;
  faviconFit?: 'contain' | 'cover';
  faviconPadding?: number;
  backgroundFit?: 'cover' | 'contain';
  backgroundPosition?: ImageFrame['position'];
}
export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  appearance?: TextAppearance;
}
export interface HeaderContent {
  registration?: string;
  contact?: string;
  slogan?: string;
}
export type TableColumn = 'index' | 'description' | 'quantity' | 'unitPrice' | 'amount';
export type TableColor =
  | 'headerBackground'
  | 'rowBackground'
  | 'stripeBackground'
  | 'borderColor'
  | 'columnBackground'
  | 'totalBackground';
export interface PageLetterhead {
  fit: 'contain' | 'cover' | 'fill';
  position: ImageFrame['position'];
  top: number;
  bottom: number;
  left: number;
  right: number;
  showFooter: boolean;
}
export interface DocumentStyle {
  letterheadMode?: 'header' | 'page';
  headerLetterhead?: {
    edgeToEdge: boolean;
    fit: 'contain' | 'cover' | 'fill';
  };
  pageLetterhead?: PageLetterhead;
  tableColors?: Partial<Record<TableColor, string>>;
  tableText?: Partial<Record<TableColumn, { heading?: string; body?: string }>>;
  headerContent?: HeaderContent;
  text?: Partial<Record<TextSection, TextAppearance>>;
  images?: Partial<Record<'logo' | 'letterhead' | 'signature' | 'stamp', ImageFrame>>;
  header:
    | 'light'
    | 'bubble'
    | 'wave'
    | 'folder'
    | 'center'
    | 'dual'
    | 'lines'
    | 'executive'
    | 'ribbon'
    | 'architect'
    | 'horizon'
    | 'frame'
    | 'ledger'
    | 'mesh'
    | 'spotlight';
  table: 'light' | 'boxed' | 'bold' | 'striped' | 'bubble' | 'column';
  font: 'dm-sans' | 'open-sans' | 'newsreader';
  fontSize: number;
  primaryColor: string;
  textColor: string;
  headerImage: string;
  tagline: string;
  subtitle?: string;
  titleSize?: number;
  footer: string;
}
export interface Quotation {
  id: string;
  preparedBy?: { userId: string; name: string };
  number: string;
  date: string;
  validUntil: string;
  customer: Customer;
  company: Company;
  items: LineItem[];
  discount: number;
  vatEnabled: boolean;
  vatRate?: number;
  terms: string;
  createdAt: string;
  updatedAt: string;
  status: 'Valid' | 'Sent' | 'Accepted' | 'Cancelled' | 'Draft';
  layout: {
    design: 'classic' | 'bordered' | 'minimal';
    logoWidth: number;
    document?: DocumentStyle;
  };
}
export type WorkspaceRole = 'super_admin' | 'user';
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  message: string;
  signature: string;
  logo: string;
  color: string;
  align: 'left' | 'center' | 'right';
  font: 'Arial' | 'Georgia' | 'Verdana';
}
export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  active: boolean;
  createdAt: string;
  photo?: string;
  phone?: string;
  jobTitle?: string;
  contactEmail?: string;
  emailTemplates?: EmailTemplate[];
  defaultEmailTemplateId?: string;
}
export interface Product {
  id: string;
  name: string;
  topic: string;
  salesDescription: string;
  sku: string;
  salePrice: number;
  trackInventory: boolean;
  quantityOnHand: number;
  reorderLevel: number;
  updatedAt: string;
}
export type LeadStage = 'New' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
export type LeadPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export interface LeadActivity {
  id: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Task' | 'Note';
  subject: string;
  notes: string;
  dueDate: string;
  status: 'Planned' | 'Done';
  createdAt: string;
  completedAt?: string;
  createdBy: string;
}
export interface LeadHistory {
  id: string;
  at: string;
  by: string;
  message: string;
}
export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  stage: LeadStage;
  ownerId?: string;
  priority?: LeadPriority;
  probability?: number;
  expectedClose?: string;
  lostReason?: string;
  customerId?: string;
  address?: string;
  activities?: LeadActivity[];
  history?: LeadHistory[];
  createdAt?: string;
  expectedValue: number;
  nextAction: string;
  notes: string;
  updatedAt: string;
}
export interface AdminSettings {
  brand?: BrandAppearance;
  quotePrefix: string;
  validityDays: number;
  defaultVat: boolean;
  defaultVatRate?: number;
  defaultDesign: 'classic' | 'bordered' | 'minimal';
  lowStockThreshold: number;
  defaultLogoWidth: number;
  appLogo: string;
  favicon: string;
  loginLogoWidth: number;
  loginBackground: string;
  loginBackgroundColor: string;
  fiscalYearOverride: string;
  fiscalYearOverrideFor: string;
  document?: DocumentStyle;
  appLogoSize?: number;
  appTextSize?: number;
}
export interface Workspace {
  schemaVersion: 1;
  company: Company;
  customers: Customer[];
  quotations: Quotation[];
  nextNumber: number;
  sequenceYear: string;
  products: Product[];
  leads: Lead[];
  users: WorkspaceUser[];
  settings: AdminSettings;
}
export interface CompanyWorkspace {
  id: string;
  name: string;
  logo: string;
  revision: number;
  prefix: string;
  createdAt: string | null;
  memberIds?: string[];
}
export interface Connection {
  workspaceId?: string;
  mode: 'local' | 'remote';
  url: string;
  token: string;
}
export interface VaultData {
  mustChangePassword?: boolean;
  email: string;
  workspace: Workspace;
  connection: Connection;
}
export interface Branding {
  ownerAppName?: string;
  ownerAppSubtitle?: string;
  appearance?: BrandAppearance;
  name: string;
  logo: string;
  accent: string;
  appLogo: string;
  favicon: string;
  loginLogoWidth: number;
  loginBackground: string;
  loginBackgroundColor: string;
}

export type AccountAccess = { lockedUntil: number; manual: boolean; ownerLocked: boolean };
export type UserAction =
  | { type: 'create'; user: WorkspaceUser; password: string }
  | { type: 'update'; id: string; role?: WorkspaceRole; active?: boolean }
  | { type: 'delete'; id: string }
  | { type: 'unlock'; id: string }
  | { type: 'lock'; id: string }
  | { type: 'reset'; id: string };
