export type ID = string
export type Lang = 'uz' | 'ru' | 'en'

/** Text a user enters once and may translate; `uz` is required, others fall back to it. */
export interface Localized {
  uz: string
  ru?: string
  en?: string
}

export interface Branch {
  id: ID
  name: string
  address: string
  phone: string
  createdAt: string
}

/** A bridal boutique using the ERP (a tenant). Each one has its own data. */
export interface Shop {
  id: ID
  name: string
  createdAt: string
  active: boolean
}

/** `admin` runs the ERP platform; `founder` and `manager` belong to one boutique. */
export type AccountRole = 'admin' | 'founder' | 'manager'

export interface Account {
  id: ID
  /** The boutique this login belongs to; absent only for the platform admin. */
  shopId?: ID
  name: string
  email: string
  password: string
  role: AccountRole
  /** Required for `manager`; founders see every branch of their boutique. */
  branchId?: ID
  active: boolean
}

/** Platform-wide registry: boutiques and every login. Boutique data lives in its own DB. */
export interface Platform {
  version: number
  shops: Shop[]
  accounts: Account[]
}

export type ProductKind = 'dress' | 'accessory'

export interface ProductType {
  id: ID
  name: Localized
  kind: ProductKind
  description?: string
  createdAt: string
}

export type ProductStatus = 'available' | 'reserved' | 'rented' | 'sold' | 'cleaning'
export type Condition = 'new' | 'excellent' | 'good' | 'fair' | 'damaged'
export type DealMode = 'rent' | 'sale' | 'both'
export type Silhouette = 'a_line' | 'ball_gown' | 'mermaid' | 'sheath' | 'princess' | 'empire' | 'short' | 'national'
export type DressColor = 'white' | 'ivory' | 'champagne' | 'blush' | 'silver' | 'gold' | 'red' | 'other'

export interface Product {
  id: ID
  code: string
  name: string
  typeId: ID
  branchId: ID
  size: string
  color: DressColor
  style?: Silhouette
  designer?: string
  condition: Condition
  status: ProductStatus
  mode: DealMode
  rentPrice: number
  salePrice: number
  /** Purchase / production cost, used for ROI. */
  cost: number
  /** Refundable damage deposit required when rented. */
  securityDeposit: number
  /** Stock count; dresses are unique pieces (1), accessories can have many. */
  quantity: number
  /** Stored photo ids (see lib/files); the first one is the cover. */
  photos?: ID[]
  notes?: string
  createdAt: string
}

export type ClientSource = 'instagram' | 'telegram' | 'referral' | 'walk_in' | 'website' | 'other'

export interface Client {
  id: ID
  branchId: ID
  name: string
  phone: string
  weddingDate?: string
  /** Language used for SMS. */
  lang: Lang
  source: ClientSource
  notes?: string
  createdAt: string
}

export type AppointmentType = 'viewing' | 'measurement' | 'fitting' | 'pickup' | 'return'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: ID
  branchId: ID
  clientId: ID
  type: AppointmentType
  date: string
  time: string
  duration: number
  staffId?: ID
  productIds: ID[]
  status: AppointmentStatus
  notes?: string
  createdAt: string
}

export type OrderType = 'rental' | 'sale'
export type OrderStatus = 'booked' | 'picked_up' | 'returned' | 'completed' | 'cancelled'

export interface OrderItem {
  productId: ID
  price: number
  qty: number
}

export type ChargeKind = 'late_fee' | 'damage' | 'other'

export interface Charge {
  id: ID
  kind: ChargeKind
  amount: number
  note?: string
  date: string
}

export interface Installment {
  dueDate: string
  amount: number
}

export interface Order {
  id: ID
  number: string
  branchId: ID
  clientId: ID
  type: OrderType
  status: OrderStatus
  items: OrderItem[]
  discount: number
  charges: Charge[]
  weddingDate?: string
  pickupDate: string
  /** Rentals only. */
  returnDate?: string
  securityDeposit: number
  lateFeePerDay: number
  /** Planned schedule after the first deposit, all due before pickup. */
  installments: Installment[]
  /** Sales consultant credited with the commission. */
  staffId?: ID
  pickedUpAt?: string
  returnedAt?: string
  damageNotes?: string
  notes?: string
  createdAt: string
}

export type PaymentKind = 'advance' | 'installment' | 'balance' | 'fee' | 'refund' | 'security' | 'security_return'
export type PaymentMethod = 'cash' | 'card' | 'terminal' | 'transfer' | 'click' | 'payme'

export interface Payment {
  id: ID
  branchId: ID
  orderId?: ID
  clientId?: ID
  /** Always positive; direction comes from `kind`. */
  amount: number
  kind: PaymentKind
  method: PaymentMethod
  date: string
  staffId?: ID
  /** A fee kept out of the security deposit instead of paid in new money. */
  fromDeposit?: boolean
  note?: string
}

export type StaffRole =
  | 'manager' | 'stylist' | 'sales' | 'makeup' | 'hair' | 'tailor' | 'photographer'
  | 'cashier' | 'admin' | 'cleaner' | 'driver' | 'security'

export interface Staff {
  id: ID
  branchId: ID
  name: string
  phone: string
  role: StaffRole
  /** Percent of the order subtotal credited to the consultant. */
  commissionRate: number
  salary: number
  /** 0 = Monday … 6 = Sunday */
  workDays: number[]
  shiftStart: string
  shiftEnd: string
  hiredAt: string
  active: boolean
  photo?: ID
  birthday?: string
  address?: string
  notes?: string
}

/** A file kept on a client's or staff member's profile (contract, passport copy…). */
export interface DocFile {
  id: ID
  ownerType: 'client' | 'staff'
  ownerId: ID
  branchId: ID
  /** What it is, e.g. "Shartnoma" — shown in the list. */
  name: string
  fileName: string
  mime: string
  size: number
  /** Stored file id (see lib/files). */
  fileId: ID
  uploadedAt: string
  uploadedBy?: string
}

export type ReminderType = 'appointment' | 'pickup' | 'return' | 'overdue' | 'balance' | 'wedding'

export interface SmsTemplate {
  type: ReminderType
  text: Record<Lang, string>
}

export type SmsStatus = 'logged' | 'opened' | 'sent' | 'failed'

export interface SmsLog {
  id: ID
  branchId: ID
  clientId?: ID
  phone: string
  type: ReminderType | 'custom'
  text: string
  /** Stable key of the reminder that produced it, so it isn't offered twice. */
  refKey?: string
  /** How it went out: only recorded, opened in the phone's SMS app, or sent by the gateway. */
  status?: SmsStatus
  error?: string
  sentAt: string
  sentBy?: string
}

/**
 * - `log`: only record the message (no sending)
 * - `device`: open the phone's SMS app with the text filled in
 * - `gateway`: send through the boutique's SMS server (e.g. the bundled Eskiz.uz gateway)
 */
export type SmsMode = 'log' | 'device' | 'gateway'

export interface SmsSettings {
  mode: SmsMode
  gatewayUrl: string
  /** Shared secret the gateway checks; never the Eskiz password itself. */
  apiKey: string
  /** Approved sender name ("nick") at the SMS provider. */
  sender: string
  /** Which automatic reminders the Notifications page suggests. */
  reminders: Record<ReminderType, boolean>
  pickupDaysAhead: number
  weddingDaysAhead: number
  balanceDaysAhead: number
}

export type Accent = 'gold' | 'rose' | 'emerald' | 'wine' | 'noir' | 'sage' | 'dusk' | 'mauve'

export interface Settings {
  storeName: string
  /** Letters in front of order numbers, e.g. "SH" → SH-1001. */
  orderPrefix: string
  phone: string
  instagram: string
  telegram: string
  /** Legal details printed on contracts. */
  legalName: string
  inn: string
  bankName: string
  bankAccount: string
  mfo: string
  contractNote: string
  lateFeePerDay: number
  defaultSecurityDeposit: number
  /** Days a dress is blocked after return for cleaning before it can go out again. */
  cleaningDays: number
  defaultRentalDays: number
  /** Share of the order taken as the first payment, in percent. */
  defaultDepositPercent: number
  defaultInstallments: number
  /** Payment methods offered at the till and in payment forms. */
  methods: PaymentMethod[]
  openTime: string
  closeTime: string
  appointmentMinutes: number
  accent: Accent
  sms: SmsSettings
}

/** One boutique's data. Logins live in the platform registry, not here. */
export interface DB {
  version: number
  branches: Branch[]
  productTypes: ProductType[]
  products: Product[]
  clients: Client[]
  appointments: Appointment[]
  orders: Order[]
  payments: Payment[]
  staff: Staff[]
  documents: DocFile[]
  smsTemplates: SmsTemplate[]
  smsLog: SmsLog[]
  settings: Settings
  orderSeq: number
}

export type Collection = Exclude<keyof DB, 'version' | 'settings' | 'orderSeq'>
