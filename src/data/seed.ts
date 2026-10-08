// Demo data: the platform registry plus one boutique ("Sharlin") with two branches and five clients in each.
// Dates are relative to today so the dashboards always have something happening.
import type {
  Account, Appointment, Branch, Client, ClientSource, DB, DressColor, ExpenseCategory, ID, Lang, Order, Payment, PaymentMethod, Platform,
  Product, ProductType, Settings, Shop, Silhouette, SmsTemplate, Staff,
} from './types'
import { addDays, addMonths, dateOf, dotDate, startOfMonth, todayStr } from '../lib/date'
import { orderPrefixOf } from '../lib/brand'
import { buildPlan, conflictsFor, isoAt, orderTotal, planRows, revenueOf } from './domain'

/**
 * Bump when the boutique data shape or demo content changes. The demo boutique is then re-seeded;
 * other boutiques are carried over by `migrateShopDb`.
 */
export const DB_VERSION = 5
export const PLATFORM_VERSION = 1
export const DEMO_PASSWORD = '123456'
export const DEMO_SHOP_ID = 'sharlin'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEFAULT_TEMPLATES: SmsTemplate[] = [
  { type: 'appointment', text: {
    uz: "Hurmatli {name}! {date} kuni soat {time} da {store} salonida sizni kutamiz. Ma'lumot uchun: {phone}",
    ru: 'Уважаемая {name}! Ждём вас {date} в {time} в салоне {store}. Справки: {phone}',
    en: 'Dear {name}, we look forward to seeing you at {store} on {date} at {time}. Questions: {phone}' } },
  { type: 'pickup', text: {
    uz: "Hurmatli {name}! Libosingiz {date} kuni olib ketishga tayyor bo'ladi. Qoldiq to'lov: {amount}. {store}, {phone}",
    ru: 'Уважаемая {name}! Ваше платье будет готово к выдаче {date}. Остаток к оплате: {amount}. {store}, {phone}',
    en: 'Dear {name}, your dress will be ready for pickup on {date}. Balance due: {amount}. {store}, {phone}' } },
  { type: 'return', text: {
    uz: "Hurmatli {name}! Libosni {date} kuni qaytarishni unutmang. Baxtli bo'ling! {store}",
    ru: 'Уважаемая {name}! Не забудьте вернуть платье {date}. Счастья вам! {store}',
    en: 'Dear {name}, a reminder to return the dress on {date}. Congratulations again! {store}' } },
  { type: 'overdue', text: {
    uz: "Hurmatli {name}! Libosni qaytarish muddati {days} kunga kechikdi. Iltimos, tezroq qaytaring — har bir kun uchun jarima hisoblanadi. {phone}",
    ru: 'Уважаемая {name}! Возврат платья просрочен на {days} дн. Пожалуйста, верните его как можно скорее — за каждый день начисляется пеня. {phone}',
    en: 'Dear {name}, the dress return is {days} days late. Please bring it back as soon as possible; a late fee applies for each day. {phone}' } },
  { type: 'balance', text: {
    uz: "Hurmatli {name}! Buyurtmangiz bo'yicha qoldiq {amount}. Iltimos, {date} gacha to'lang. {store}",
    ru: 'Уважаемая {name}! Остаток по заказу {amount}. Пожалуйста, оплатите до {date}. {store}',
    en: 'Dear {name}, your order has a balance of {amount}. Please pay by {date}. {store}' } },
  { type: 'wedding', text: {
    uz: "Hurmatli {name}! To'yingizga {days} kun qoldi! {store} jamoasi sizni oldindan tabriklaydi.",
    ru: 'Уважаемая {name}! До вашей свадьбы {days} дн.! Команда {store} заранее поздравляет вас.',
    en: 'Dear {name}, only {days} days until your wedding! Warm wishes from the {store} team.' } },
]

/** Starting product types for every new boutique; each boutique can rename them or add more. */
export function defaultProductTypes(createdAt: string): ProductType[] {
  return [
    { id: 't1', kind: 'dress', name: { uz: "Kelinlik ko'ylagi", ru: 'Свадебное платье', en: 'Wedding gown' }, createdAt },
    { id: 't2', kind: 'dress', name: { uz: 'Kechki libos', ru: 'Вечернее платье', en: 'Evening dress' }, createdAt },
    { id: 't3', kind: 'dress', name: { uz: 'Kelin salom libosi', ru: 'Платье «Келин салом»', en: 'Kelin salom dress' }, description: 'Milliy uslubdagi libos', createdAt },
    { id: 't4', kind: 'accessory', name: { uz: 'Fata', ru: 'Фата', en: 'Veil' }, createdAt },
    { id: 't5', kind: 'accessory', name: { uz: 'Poyabzal', ru: 'Обувь', en: 'Shoes' }, createdAt },
    { id: 't6', kind: 'accessory', name: { uz: 'Taqinchoqlar', ru: 'Украшения', en: 'Jewelry' }, createdAt },
    { id: 't7', kind: 'accessory', name: { uz: 'Toj va diadema', ru: 'Тиара и диадема', en: 'Tiara' }, createdAt },
    { id: 't8', kind: 'accessory', name: { uz: 'Podyubnik', ru: 'Подъюбник', en: 'Petticoat' }, createdAt },
  ]
}

export function defaultSettings(storeName: string): Settings {
  return {
    storeName,
    orderPrefix: orderPrefixOf(storeName),
    phone: '',
    instagram: '',
    telegram: '',
    legalName: '',
    inn: '',
    bankName: '',
    bankAccount: '',
    mfo: '',
    contractNote: '',
    lateFeePerDay: 300_000,
    defaultSecurityDeposit: 2_000_000,
    cleaningDays: 2,
    defaultRentalDays: 3,
    defaultDepositPercent: 30,
    defaultInstallments: 1,
    methods: ['cash', 'card', 'terminal', 'click', 'payme', 'transfer'],
    openTime: '10:00',
    closeTime: '20:00',
    appointmentMinutes: 60,
    accent: 'gold',
    sms: {
      mode: 'log',
      gatewayUrl: '',
      apiKey: '',
      sender: '4546',
      reminders: { appointment: true, pickup: true, return: true, overdue: true, balance: true, wedding: true },
      pickupDaysAhead: 2,
      weddingDaysAhead: 7,
      balanceDaysAhead: 7,
    },
  }
}

/** An empty boutique, as the platform admin creates it. */
export function createShopDb(shop: Shop, branches: Branch[]): DB {
  return {
    version: DB_VERSION,
    branches,
    productTypes: defaultProductTypes(shop.createdAt || new Date().toISOString()),
    products: [],
    clients: [],
    appointments: [],
    orders: [],
    payments: [],
    expenses: [],
    staff: [],
    documents: [],
    smsTemplates: structuredClone(DEFAULT_TEMPLATES),
    smsLog: [],
    settings: defaultSettings(shop.name),
    orderSeq: 1001,
  }
}

/**
 * Brings a boutique's saved data (or a backup file) from an older version up to date without losing records.
 * Returns null when it is too old to convert or isn't boutique data.
 */
export function migrateShopDb(data: DB): DB | null {
  if (!data || typeof data !== 'object' || !Array.isArray(data.orders) || !data.settings) return null
  let db = data
  // 4 → 5: expenses were added.
  if (db.version === 4) db = { ...db, version: 5, expenses: [] }
  return db.version === DB_VERSION ? db : null
}

export function createPlatformSeed(today: string = todayStr()): { platform: Platform; shops: Record<ID, DB> } {
  const shop: Shop = { id: DEMO_SHOP_ID, name: 'Sharlin', createdAt: isoAt(addDays(today, -400), 10), active: true }
  const accounts: Account[] = [
    { id: 'admin', name: 'Administrator', email: 'admin@oqlibos.uz', password: DEMO_PASSWORD, role: 'admin', active: true },
    { id: 'sh-founder', shopId: shop.id, name: 'Dilshoda Xaydaraliyeva', email: 'founder@sharlin.uz', password: DEMO_PASSWORD, role: 'founder', active: true },
    { id: 'sh-lola', shopId: shop.id, name: 'Sharlin Lola', email: 'lola@sharlin.uz', password: DEMO_PASSWORD, role: 'manager', branchId: 'b1', active: true },
    { id: 'sh-cola', shopId: shop.id, name: 'Sharlin Cola', email: 'cola@sharlin.uz', password: DEMO_PASSWORD, role: 'manager', branchId: 'b2', active: true },
  ]
  return {
    platform: { version: PLATFORM_VERSION, shops: [shop], accounts },
    shops: { [shop.id]: createDemoShopDb(shop, today) },
  }
}

interface ClientSpec {
  key: string
  branchId: ID
  name: string
  lang: Lang
  source: ClientSource
}

/** One order's story, in days relative to today. */
interface OrderSpec {
  client: string
  type: 'rental' | 'sale'
  /** Product type of the main piece. */
  dress: ID
  created: number
  wedding: number
  pickup: number
  ret?: number
  /** Where the order stands today: still booked, out with the client, or finished. */
  stage: 'booked' | 'out' | 'done'
  /** Days late when it came back (finished rentals). */
  late?: number
  damage?: number
  /** Share of the total paid up front. */
  deposit: number
  installments: number
  /** Installments (1-based, after the deposit) that weren't paid on their due date. */
  unpaid?: number[]
  /** Pays part of the next open installment today. */
  payToday?: { method: PaymentMethod; share: number }
  /** Method of the first payment. */
  method?: PaymentMethod
  extras?: ID[]
  /** Try-on sessions before pickup: [day offset, time]. */
  fittings?: [number, string][]
}

export function createDemoShopDb(shop: Shop, today: string = todayStr()): DB {
  const rnd = mulberry32(20261006)
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]
  const chance = (p: number) => rnd() < p
  const round = (n: number, step = 100_000) => Math.round(n / step) * step
  const weighted = <T,>(pairs: [T, number][]): T => {
    const sum = pairs.reduce((s, [, w]) => s + w, 0)
    let r = rnd() * sum
    for (const [v, w] of pairs) if ((r -= w) <= 0) return v
    return pairs[0][0]
  }
  let idn = 0
  const id = (p: string) => `${p}${(++idn).toString(36)}`
  const day = (n: number) => addDays(today, n)
  const ts = (date: string) => (date === today ? isoAt(date, int(9, 10), pick([5, 20, 35, 50])) : isoAt(date, int(10, 18), pick([0, 15, 30, 45])))
  const phone = () => `+998 ${pick(['90', '91', '93', '94', '97', '99', '88', '33', '95'])} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`

  const branches: Branch[] = [
    { id: 'b1', name: 'Sharlin Lola', address: 'Toshkent sh.', phone: '+998 71 200 11 22', createdAt: shop.createdAt },
    { id: 'b2', name: 'Sharlin Cola', address: 'Toshkent sh.', phone: '+998 71 200 33 44', createdAt: isoAt(day(-220), 10) },
  ]
  const db = createShopDb(shop, branches)
  db.settings.phone = branches[0].phone

  // ---------- staff ----------
  const staffSpec: [ID, string, Staff['role']][] = [
    ['b1', 'Nilufar Ergasheva', 'manager'], ['b1', 'Dilnoza Karimova', 'stylist'], ['b1', 'Aziza Tursunova', 'stylist'],
    ['b1', 'Shahnoza Ismoilova', 'sales'], ['b1', 'Laylo Nazarova', 'sales'], ['b1', 'Gulnora Saidova', 'makeup'],
    ['b1', "Ra'no Xasanova", 'cashier'], ['b1', 'Muhabbat Qodirova', 'cleaner'],
    ['b2', 'Feruza Mirzayeva', 'manager'], ['b2', 'Kamila Hasanova', 'stylist'], ['b2', 'Sabina Sobirova', 'hair'],
    ['b2', 'Mohira Abdullayeva', 'sales'], ['b2', "Charos Yo'ldosheva", 'sales'], ['b2', 'Zulfiya Toshmatova', 'makeup'],
    ['b2', 'Umida Rasulova', 'admin'], ['b2', 'Saodat Karimova', 'cleaner'],
  ]
  db.staff = staffSpec.map(([branchId, name, role]) => ({
    id: id('s'),
    branchId,
    name,
    phone: phone(),
    role,
    commissionRate: role === 'sales' ? pick([3, 4, 5]) : role === 'stylist' ? 2 : role === 'manager' ? 1 : 0,
    salary: { manager: 8_000_000, makeup: 6_000_000, hair: 6_000_000, cleaner: 3_000_000, cashier: 4_500_000, admin: 4_000_000 }[role as string] ?? 5_000_000,
    workDays: pick([[0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], [0, 1, 3, 4, 5, 6], [0, 2, 3, 4, 5, 6]]),
    shiftStart: pick(['09:00', '10:00']),
    shiftEnd: pick(['18:00', '19:00', '20:00']),
    hiredAt: day(-int(60, 380)),
    active: true,
    birthday: `${int(1985, 2002)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
  }))
  const staffOf = (b: ID, ...roles: Staff['role'][]) => db.staff.filter((s) => s.branchId === b && roles.includes(s.role))

  // ---------- inventory ----------
  const collections = ['Aurora', 'Seraphina', 'Lumière', 'Camelia', 'Valentina', 'Isabella', 'Grace', 'Eleganza', 'Swan', 'Milana', 'Amira', 'Bella', 'Celeste', 'Daria', 'Elise', 'Florence', 'Giselle', 'Helena', 'Iris', 'Jasmine', 'Katrin', 'Liora', 'Marisol', 'Noor', 'Odetta', 'Perla', 'Rosalie', 'Sofia', 'Tiana', 'Vivienne', 'Yasmin', 'Zara']
  const designers = ['Sharlin Atelier', 'Milano Sposa', 'Istanbul Bridal', 'Paris Couture', 'Dubai Line']
  const gownStyles: Silhouette[] = ['a_line', 'ball_gown', 'mermaid', 'sheath', 'princess', 'empire']
  let code = 100
  for (const b of branches) {
    const names = [...collections].sort(() => rnd() - 0.5)
    const gowns = b.id === 'b1' ? 22 : 18
    const created = () => isoAt(day(-int(30, 380)), 11)
    for (let i = 0; i < gowns; i++) {
      const sale = round(int(12, 42) * 1_000_000, 500_000)
      db.products.push({
        id: id('p'), code: `WD-${++code}`, name: names[i], typeId: 't1', branchId: b.id,
        size: String(pick([38, 40, 42, 42, 44, 44, 46, 48])),
        color: weighted<DressColor>([['white', 5], ['ivory', 4], ['champagne', 2], ['blush', 1]]),
        style: pick(gownStyles), designer: pick(designers),
        condition: weighted([['new', 2], ['excellent', 4], ['good', 3], ['fair', 1]]),
        status: 'available', mode: weighted<Product['mode']>([['both', 6], ['rent', 3], ['sale', 1.4]]),
        rentPrice: round(sale * (0.2 + rnd() * 0.08), 500_000), salePrice: sale, cost: round(sale * 0.52),
        securityDeposit: round(sale * 0.08, 500_000), quantity: 1, createdAt: created(),
      })
    }
    for (let i = 0; i < 6; i++) {
      const sale = round(int(3, 8) * 1_000_000, 500_000)
      db.products.push({
        id: id('p'), code: `EV-${++code}`, name: names[gowns + i] ?? `Soirée ${i + 1}`, typeId: 't2', branchId: b.id,
        size: String(pick([40, 42, 44, 46])), color: pick<DressColor>(['champagne', 'silver', 'gold', 'blush', 'red']),
        style: pick<Silhouette>(['sheath', 'mermaid', 'a_line', 'short']), designer: pick(designers),
        condition: pick(['excellent', 'good']), status: 'available', mode: 'both',
        rentPrice: round(sale * 0.25, 100_000), salePrice: sale, cost: round(sale * 0.5),
        securityDeposit: 1_000_000, quantity: 1, createdAt: created(),
      })
    }
    for (let i = 0; i < 4; i++) {
      const sale = round(int(7, 15) * 1_000_000, 500_000)
      db.products.push({
        id: id('p'), code: `KS-${++code}`, name: ['Guli', 'Oysha', 'Nodira', 'Zebo'][i], typeId: 't3', branchId: b.id,
        size: String(pick([42, 44, 46])), color: pick<DressColor>(['white', 'gold', 'red', 'ivory']), style: 'national',
        designer: 'Sharlin Atelier', condition: pick(['new', 'excellent']), status: 'available', mode: 'both',
        rentPrice: round(sale * 0.25, 100_000), salePrice: sale, cost: round(sale * 0.5),
        securityDeposit: 1_000_000, quantity: 1, createdAt: created(),
      })
    }
    const acc: [ID, string, Product['mode'], number, number][] = [
      ['t4', 'Fata «Katedral» 3 m', 'both', 400_000, 1_500_000], ['t4', 'Fata «Val» 1.5 m', 'both', 250_000, 800_000],
      ['t4', 'Fata marjonli', 'both', 350_000, 1_200_000], ['t5', 'Tufli «Crystal» 7 sm', 'sale', 0, 1_400_000],
      ['t5', 'Tufli «Satin» 5 sm', 'sale', 0, 950_000], ['t5', 'Tufli «Pearl» 9 sm', 'sale', 0, 1_800_000],
      ['t6', "Sirg'a va marjon to'plami", 'both', 300_000, 2_200_000], ['t6', 'Bilaguzuk «Swarovski»', 'sale', 0, 900_000],
      ['t6', 'Sochga taqinchoq', 'both', 150_000, 600_000], ['t7', 'Toj «Malika»', 'both', 300_000, 1_600_000],
      ['t7', 'Diadema «Perla»', 'both', 200_000, 1_000_000], ['t8', 'Podyubnik 6 halqali', 'both', 200_000, 700_000],
      ['t8', 'Podyubnik «Fatin»', 'both', 150_000, 500_000],
    ]
    for (const [typeId, name, mode, rent, sale] of acc) {
      db.products.push({
        id: id('p'), code: `AC-${++code}`, name, typeId, branchId: b.id,
        size: typeId === 't5' ? pick(['36', '37', '38', '39']) : '—',
        color: pick<DressColor>(['white', 'ivory', 'silver', 'gold']), condition: 'new', status: 'available', mode,
        rentPrice: rent, salePrice: sale, cost: round(sale * 0.45, 10_000), securityDeposit: 0,
        quantity: chance(0.15) ? 1 : int(2, 9), createdAt: created(),
      })
    }
  }

  // ---------- five clients per branch ----------
  const clientSpecs: ClientSpec[] = [
    { key: 'madina', branchId: 'b1', name: 'Madina Yusupova', lang: 'uz', source: 'instagram' },
    { key: 'nigora', branchId: 'b1', name: 'Nigora Rasulova', lang: 'uz', source: 'referral' },
    { key: 'sevinch', branchId: 'b1', name: 'Sevinch Rahimova', lang: 'uz', source: 'telegram' },
    { key: 'shahzoda', branchId: 'b1', name: 'Shahzoda Tursunova', lang: 'uz', source: 'instagram' },
    { key: 'kamola', branchId: 'b1', name: 'Kamola Saidova', lang: 'uz', source: 'walk_in' },
    { key: 'dilfuza', branchId: 'b2', name: 'Dilfuza Ergasheva', lang: 'uz', source: 'telegram' },
    { key: 'malika', branchId: 'b2', name: 'Malika Xolmatova', lang: 'ru', source: 'instagram' },
    { key: 'zarina', branchId: 'b2', name: 'Zarina Qodirova', lang: 'ru', source: 'referral' },
    { key: 'lobar', branchId: 'b2', name: 'Lobar Abdurahmonova', lang: 'uz', source: 'instagram' },
    { key: 'aziza', branchId: 'b2', name: 'Aziza Umarova', lang: 'uz', source: 'website' },
  ]
  const clients = new Map<string, Client>()
  for (const c of clientSpecs) {
    const client: Client = { id: id('c'), branchId: c.branchId, name: c.name, phone: phone(), lang: c.lang, source: c.source, createdAt: '' }
    clients.set(c.key, client)
    db.clients.push(client)
  }

  const method = (): PaymentMethod => weighted([['cash', 35], ['card', 20], ['terminal', 15], ['click', 12], ['payme', 10], ['transfer', 8]])
  const freeDress = (branchId: ID, kind: OrderSpec['type'], typeId: ID, start: string, end: string) => {
    const free = db.products.filter(
      (p) => p.branchId === branchId && p.typeId === typeId && (kind === 'rental' ? p.mode !== 'sale' : p.mode !== 'rent') &&
        !conflictsFor(db, p.id, start, end, undefined, true).length,
    )
    return free.length ? pick(free) : undefined
  }
  const accessory = (branchId: ID, typeId: ID, kind: OrderSpec['type']) =>
    db.products.find((p) => p.branchId === branchId && p.typeId === typeId && (kind === 'rental' ? p.mode !== 'sale' : p.mode !== 'rent'))

  const appointment = (client: Client, type: Appointment['type'], date: string, time: string, duration: number, productIds: ID[], staffId?: ID, status?: Appointment['status']) => {
    db.appointments.push({
      id: id('ap'), branchId: client.branchId, clientId: client.id, type, date, time, duration, productIds,
      staffId: staffId ?? pick(staffOf(client.branchId, 'stylist')).id,
      status: status ?? (date < today ? 'completed' : 'scheduled'),
      createdAt: isoAt(addDays(date, -int(1, 4)), 12),
    })
  }

  const book = (s: OrderSpec) => {
    const client = clients.get(s.client)!
    const branchId = client.branchId
    const created = day(s.created)
    const pickup = day(s.pickup)
    const ret = s.ret != null ? day(s.ret) : undefined
    const dress = s.type === 'sale'
      ? freeDress(branchId, 'sale', s.dress, created, '9999-12-31')
      : freeDress(branchId, 'rental', s.dress, pickup, addDays(ret!, db.settings.cleaningDays))
    if (!dress) return
    const items = [{ productId: dress.id, price: s.type === 'rental' ? dress.rentPrice : dress.salePrice, qty: 1 }]
    for (const typeId of s.extras ?? []) {
      const a = accessory(branchId, typeId, s.type)
      if (a) items.push({ productId: a.id, price: s.type === 'rental' ? a.rentPrice : a.salePrice, qty: 1 })
    }
    const consultant = pick(staffOf(branchId, 'sales'))
    const o: Order = {
      id: id('o'), number: '', branchId, clientId: client.id, type: s.type, status: 'booked', items, discount: 0, charges: [],
      weddingDate: day(s.wedding), pickupDate: pickup, returnDate: ret,
      securityDeposit: s.type === 'rental' ? Math.max(dress.securityDeposit, db.settings.defaultSecurityDeposit) : 0,
      lateFeePerDay: db.settings.lateFeePerDay, installments: [], staffId: consultant.id, createdAt: ts(created),
    }
    if (!client.createdAt || o.createdAt < client.createdAt) client.createdAt = isoAt(addDays(created, -3), 11)
    // The gown order sets the wedding date; other dresses are for related events (kelin salom, evening party).
    if (s.dress === 't1' || !client.weddingDate) client.weddingDate = day(s.wedding)
    for (const [d, time] of s.fittings ?? []) appointment(client, 'fitting', day(d), time, 60, [dress.id])

    const total = orderTotal(o)
    o.installments = buildPlan(total, round(total * s.deposit), s.installments, created, addDays(pickup, -1))
    const pay = (kind: Payment['kind'], amount: number, date: string, extra: Partial<Payment> = {}) => {
      if (amount <= 0) return
      db.payments.push({ id: id('y'), branchId, orderId: o.id, clientId: client.id, amount, kind, method: method(), date: ts(date), staffId: consultant.id, ...extra })
    }
    const paidSoFar = () => db.payments.filter((p) => p.orderId === o.id && p.kind !== 'security').reduce((x, p) => x + p.amount, 0)

    o.installments.forEach((ins, i) => {
      if (i === 0) return pay('advance', ins.amount, created, s.method ? { method: s.method } : {})
      if (ins.dueDate <= today && !s.unpaid?.includes(i)) pay('installment', ins.amount, ins.dueDate)
    })
    if (s.payToday) {
      const open = planRows(o, paidSoFar(), today).find((r) => r.state !== 'paid')
      if (open) pay('installment', round((open.amount - open.paid) * s.payToday.share), today, { method: s.payToday.method })
    }

    if (s.stage !== 'booked') {
      pay('balance', total - paidSoFar(), pickup)
      o.pickedUpAt = isoAt(pickup, 10, 30)
      if (s.type === 'sale') {
        o.status = 'completed'
      } else {
        pay('security', o.securityDeposit, pickup, { method: 'cash' })
        o.status = 'picked_up'
        if (s.stage === 'done') {
          const back = addDays(ret!, s.late ?? 0)
          o.returnedAt = isoAt(back, 15, 20)
          o.status = 'completed'
          let kept = 0
          if (s.late) {
            const fee = s.late * o.lateFeePerDay
            o.charges.push({ id: id('ch'), kind: 'late_fee', amount: fee, date: back })
            pay('fee', fee, back, { fromDeposit: true, method: 'cash' })
            kept += fee
          }
          if (s.damage) {
            o.charges.push({ id: id('ch'), kind: 'damage', amount: s.damage, note: "Etakda dog'", date: back })
            o.damageNotes = "Etakda dog'"
            pay('fee', s.damage, back, { fromDeposit: true, method: 'cash' })
            kept += s.damage
          }
          pay('security_return', Math.max(0, o.securityDeposit - kept), back, { method: 'cash' })
        }
      }
    }
    db.orders.push(o)

    const sameType = db.products.filter((p) => p.branchId === branchId && p.typeId === s.dress && p.id !== dress.id).slice(0, 2).map((p) => p.id)
    appointment(client, 'viewing', addDays(created, -2), '11:00', 90, [dress.id, ...sameType])
    appointment(client, 'measurement', created, '12:30', 45, [dress.id])
    appointment(client, 'pickup', pickup, '10:00', 30, items.map((i) => i.productId))
    if (ret) appointment(client, 'return', ret, '16:00', 30, items.map((i) => i.productId))
  }

  // Sharlin Lola
  book({ client: 'madina', type: 'rental', dress: 't1', created: -95, wedding: -62, pickup: -63, ret: -60, stage: 'done', deposit: 0.4, installments: 1, extras: ['t4'] })
  book({ client: 'madina', type: 'rental', dress: 't3', created: -70, wedding: -58, pickup: -59, ret: -57, stage: 'done', deposit: 0.5, installments: 0 })
  book({ client: 'nigora', type: 'sale', dress: 't1', created: -120, wedding: -30, pickup: -33, stage: 'done', deposit: 0.3, installments: 2, extras: ['t5', 't6'], fittings: [[-60, '14:00'], [-36, '16:30']] })
  book({ client: 'sevinch', type: 'rental', dress: 't1', created: -40, wedding: -2, pickup: -3, ret: 0, stage: 'out', deposit: 0.4, installments: 1, extras: ['t4', 't8'] })
  book({
    client: 'shahzoda', type: 'rental', dress: 't1', created: -25, wedding: 1, pickup: 0, ret: 3, stage: 'booked', deposit: 0.3, installments: 2,
    unpaid: [2], payToday: { method: 'transfer', share: 0.5 }, extras: ['t7'], fittings: [[-1, '16:00']],
  })
  book({ client: 'kamola', type: 'sale', dress: 't1', created: -50, wedding: 24, pickup: 20, stage: 'booked', deposit: 0.3, installments: 2, fittings: [[-10, '14:00'], [0, '15:00'], [10, '15:00']] })
  book({ client: 'kamola', type: 'rental', dress: 't2', created: 0, wedding: 30, pickup: 29, ret: 31, stage: 'booked', deposit: 0.5, installments: 0, method: 'cash' })

  // Sharlin Cola
  book({ client: 'dilfuza', type: 'rental', dress: 't1', created: -80, wedding: -41, pickup: -42, ret: -39, stage: 'done', late: 1, damage: 500_000, deposit: 0.4, installments: 1 })
  book({ client: 'malika', type: 'sale', dress: 't1', created: -150, wedding: -75, pickup: -78, stage: 'done', deposit: 0.3, installments: 3, extras: ['t5', 't4'], fittings: [[-100, '13:00'], [-82, '15:30']] })
  book({ client: 'malika', type: 'rental', dress: 't2', created: -20, wedding: -10, pickup: -11, ret: -9, stage: 'done', deposit: 1, installments: 0 })
  book({ client: 'zarina', type: 'rental', dress: 't1', created: -35, wedding: -5, pickup: -6, ret: -3, stage: 'out', deposit: 0.4, installments: 1, extras: ['t4'] })
  book({
    client: 'lobar', type: 'rental', dress: 't1', created: -30, wedding: 3, pickup: 2, ret: 5, stage: 'booked', deposit: 0.3, installments: 2,
    payToday: { method: 'card', share: 0.5 }, extras: ['t8'], fittings: [[1, '11:00']],
  })
  book({ client: 'aziza', type: 'rental', dress: 't1', created: 0, wedding: 45, pickup: 44, ret: 47, stage: 'booked', deposit: 0.3, installments: 1, method: 'click', extras: ['t4', 't7'] })

  // A second visit for Malika, who wants a kelin salom dress for her sister.
  const malika = clients.get('malika')!
  appointment(malika, 'viewing', today, '16:30', 60, db.products.filter((p) => p.branchId === 'b2' && p.typeId === 't3').slice(0, 3).map((p) => p.id))

  // Order numbers follow creation time.
  db.orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  db.orders.forEach((o, i) => (o.number = `${db.settings.orderPrefix}-${1001 + i}`))
  db.orderSeq = 1001 + db.orders.length

  // ---------- dress statuses ----------
  const dressTypes = new Set(db.productTypes.filter((t) => t.kind === 'dress').map((t) => t.id))
  for (const p of db.products) {
    if (!dressTypes.has(p.typeId)) continue
    const mine = db.orders.filter((o) => o.status !== 'cancelled' && o.items.some((i) => i.productId === p.id))
    if (mine.some((o) => o.type === 'sale' && o.status === 'completed')) {
      p.status = 'sold'
      p.quantity = 0
    } else if (mine.some((o) => o.type === 'rental' && o.status === 'picked_up')) p.status = 'rented'
    else if (mine.some((o) => o.status === 'booked')) p.status = 'reserved'
  }
  for (const b of branches) {
    const resting = db.products.find((p) => p.branchId === b.id && p.typeId === 't1' && p.status === 'available')
    if (resting) resting.status = 'cleaning'
  }

  // ---------- SMS sent yesterday for today's visits ----------
  for (const a of db.appointments.filter((x) => x.date === today && x.type !== 'pickup' && x.type !== 'return')) {
    const c = db.clients.find((x) => x.id === a.clientId)!
    const branch = branches.find((b) => b.id === a.branchId)!
    const text = DEFAULT_TEMPLATES[0].text[c.lang]
      .replace('{name}', c.name.split(' ')[0]).replace('{date}', dotDate(a.date)).replace('{time}', a.time)
      .replace('{store}', db.settings.storeName).replace('{phone}', branch.phone)
    db.smsLog.push({ id: id('sm'), branchId: a.branchId, clientId: c.id, phone: c.phone, type: 'appointment', text, refKey: `appointment:${a.id}`, status: 'logged', sentAt: isoAt(day(-1), 18), sentBy: 'auto' })
  }

  // ---------- expenses: this month and the five before it ----------
  // Kept in proportion to this demo's ten clients, so the profit figures stay believable.
  const er = mulberry32(20261008)
  const eint = (a: number, b: number) => a + Math.floor(er() * (b - a + 1))
  const epick = <T,>(arr: readonly T[]): T => arr[Math.floor(er() * arr.length)]
  const founder = 'Dilshoda Xaydaraliyeva'
  const spend = (branchId: ID, date: string, category: ExpenseCategory, amount: number, method: PaymentMethod, note: string, by?: string) => {
    if (date > today || amount <= 0) return
    const createdBy = by ?? branches.find((b) => b.id === branchId)!.name
    db.expenses.push({ id: id('e'), branchId, date, category, amount, method, note, createdAt: isoAt(date, eint(11, 18), 10), createdBy })
  }
  const revenueIn = (branchId: ID, month: string) =>
    db.payments.filter((p) => p.branchId === branchId && dateOf(p.date).slice(0, 7) === month).reduce((s, p) => s + revenueOf(p), 0)
  const costs: Record<ID, { rent: number; payroll: number; ads: [number, number] }> = {
    b1: { rent: 3_000_000, payroll: 4_000_000, ads: [8, 13] },
    b2: { rent: 2_000_000, payroll: 2_200_000, ads: [4, 7] },
  }
  const firstMonth = startOfMonth(addMonths(today, -5))
  for (let m = -5; m <= 0; m++) {
    const first = startOfMonth(addMonths(today, m))
    const on = (n: number) => addDays(first, n - 1)
    const lastMonth = addMonths(first, -1).slice(0, 7)
    for (const b of branches) {
      const c = costs[b.id]
      spend(b.id, on(2), 'rent', c.rent, 'transfer', "Do'kon ijarasi", founder)
      spend(b.id, on(5), 'salary', c.payroll + eint(-2, 2) * 100_000, 'cash', 'Hodimlar ish haqi')
      spend(b.id, on(10), 'utilities', eint(55, 85) * 10_000, 'click', 'Elektr, gaz, suv va internet')
      spend(b.id, on(15), 'marketing', eint(c.ads[0], c.ads[1]) * 100_000, 'card', 'Instagram reklama')
      spend(b.id, on(20), 'taxes', Math.round((revenueIn(b.id, lastMonth) * 0.04) / 10_000) * 10_000, 'transfer', 'Aylanmadan soliq, 4%', founder)
      spend(b.id, on(eint(6, 26)), 'transport', eint(10, 25) * 10_000, 'cash', 'Libosni yetkazish, taksi')
      spend(b.id, on(eint(8, 24)), 'other', eint(10, 30) * 10_000, 'cash', epick(['Gullar va vitrina bezagi', 'Kanselyariya', 'Mijozlar uchun choy va shirinlik']))
    }
  }
  spend('b1', addDays(startOfMonth(addMonths(today, -1)), 11), 'purchase', 2_400_000, 'transfer', 'Fata va poyabzal xaridi', founder)
  spend('b2', addDays(startOfMonth(addMonths(today, -2)), 7), 'purchase', 1_600_000, 'transfer', 'Tufli va podyubnik xaridi', founder)
  // Every returned rental goes to the dry cleaner; a stained one also needs mending.
  for (const o of db.orders) {
    if (o.type !== 'rental' || !o.returnedAt || dateOf(o.returnedAt) < firstMonth) continue
    const back = dateOf(o.returnedAt)
    spend(o.branchId, addDays(back, 1), 'cleaning', eint(30, 45) * 10_000, 'cash', `${o.number} · kimyoviy tozalash`)
    if (o.damageNotes) spend(o.branchId, addDays(back, 2), 'repair', 400_000, 'cash', `${o.number} · dog'ni ketkazish`)
  }

  db.clients.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  db.payments.sort((a, b) => b.date.localeCompare(a.date))
  db.expenses.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  return db
}
