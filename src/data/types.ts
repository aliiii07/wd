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

export type AccountRole = 'founder' | 'manager'

export interface Account {
  id: ID
  name: string
  email: string
  password: string
  role: AccountRole
  /** Required for `manager`; founders see every branch. */
  branchId?: ID
  active: boolean
}

export type ProductKind = 'dress' | 'accessory'

export interface ProductType {
  id: ID
  name: Localized
  kind: ProductKind
  description?: string
  createdAt: string
}

export type ProductStatus = 'available' | 'reserved' | 'rented' | 'sold' | 'alteration' | 'cleaning'
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
  notes?: string
  createdAt: string
}

export interface Measurements {
  bust?: number
  waist?: number
  hips?: number
  height?: number
  shoulder?: number
  sleeve?: number
  length?: number
  shoe?: number
  updatedAt?: string
}

export type LeadSource = 'instagram' | 'telegram' | 'referral' | 'walk_in' | 'website' | 'other'

export interface Client {
  id: ID
  branchId: ID
  name: string
  phone: string
  weddingDate?: string
  /** Language used for SMS reminders. */
  lang: Lang
  source: LeadSource
  measurements: Measurements
  notes?: string
  createdAt: string
}

export type LeadStage = 'new' | 'contacted' | 'appointment' | 'won' | 'lost'
export type LeadInterest = 'rent' | 'buy' | 'undecided'

export interface Lead {
  id: ID
  branchId: ID
  name: string
  phone: string
  source: LeadSource
  interest: LeadInterest
  weddingDate?: string
  budget?: number
  stage: LeadStage
  staffId?: ID
  clientId?: ID
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

export type ChargeKind = 'late_fee' | 'damage' | 'alteration' | 'other'

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

export type AlterationStatus = 'pending' | 'in_progress' | 'fitting' | 'ready' | 'delivered'

export interface Fitting {
  id: ID
  date: string
  time?: string
  notes?: string
  done: boolean
}

export interface Alteration {
  id: ID
  branchId: ID
  clientId: ID
  productId: ID
  orderId?: ID
  tailorId?: ID
  tasks: string
  measurements: Measurements
  fittings: Fitting[]
  dueDate: string
  price: number
  status: AlterationStatus
  createdAt: string
}

export type StaffRole = 'manager' | 'stylist' | 'tailor' | 'sales' | 'admin'

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
}

export type ReminderType = 'appointment' | 'pickup' | 'return' | 'overdue' | 'balance' | 'wedding' | 'alteration_ready'

export interface SmsTemplate {
  type: ReminderType
  text: Record<Lang, string>
}

export interface SmsLog {
  id: ID
  branchId: ID
  clientId?: ID
  phone: string
  type: ReminderType | 'custom'
  text: string
  /** Stable key of the reminder that produced it, so it isn't offered twice. */
  refKey?: string
  sentAt: string
  sentBy?: string
}

export interface Settings {
  storeName: string
  lateFeePerDay: number
  defaultSecurityDeposit: number
  /** Days a dress is blocked after return for cleaning before it can go out again. */
  cleaningDays: number
  defaultRentalDays: number
}

export interface DB {
  version: number
  branches: Branch[]
  accounts: Account[]
  productTypes: ProductType[]
  products: Product[]
  clients: Client[]
  leads: Lead[]
  appointments: Appointment[]
  orders: Order[]
  payments: Payment[]
  alterations: Alteration[]
  staff: Staff[]
  smsTemplates: SmsTemplate[]
  smsLog: SmsLog[]
  settings: Settings
  orderSeq: number
}

export type Collection = Exclude<keyof DB, 'version' | 'settings' | 'orderSeq'>
