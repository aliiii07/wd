// Deterministic demo data, generated relative to "today" so the dashboards always look alive.
import type {
  Account, Alteration, Appointment, Branch, Client, DB, DressColor, ID, Lead, LeadSource, Order, Payment,
  PaymentMethod, Product, ProductType, Silhouette, SmsLog, SmsTemplate, Staff,
} from './types'
import { addDays, diffDays, dotDate, parseDate, toDateStr, todayStr } from '../lib/date'
import { buildPlan, conflictsFor, isoAt, orderTotal } from './domain'

export const DB_VERSION = 2
export const DEMO_PASSWORD = '123456'

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
  { type: 'alteration_ready', text: {
    uz: "Hurmatli {name}! Libosingizdagi tikuv ishlari tayyor. Primerkaga kelishingiz mumkin. {phone}",
    ru: 'Уважаемая {name}! Подгонка вашего платья готова. Ждём вас на примерку. {phone}',
    en: 'Dear {name}, the alterations on your dress are done. Come in for a fitting any time. {phone}' } },
]

export function createSeed(today: string = todayStr()): DB {
  const rnd = mulberry32(20260928)
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]
  const chance = (p: number) => rnd() < p
  const round = (n: number, step = 100_000) => Math.round(n / step) * step
  let idn = 0
  const id = (p: string) => `${p}${(++idn).toString(36)}`
  const weighted = <T,>(pairs: [T, number][]): T => {
    const sum = pairs.reduce((s, [, w]) => s + w, 0)
    let r = rnd() * sum
    for (const [v, w] of pairs) if ((r -= w) <= 0) return v
    return pairs[0][0]
  }
  const ts = (date: string) => isoAt(date, int(10, 18), pick([0, 10, 15, 20, 30, 40, 45, 50]))

  // ---------- branches & accounts ----------
  const branches: Branch[] = [
    { id: 'b1', name: 'Chilonzor', address: "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi, 12", phone: '+998 71 200 11 22', createdAt: isoAt(addDays(today, -540), 10) },
    { id: 'b2', name: 'Yunusobod', address: "Toshkent sh., Yunusobod tumani, Amir Temur shoh ko'chasi, 108", phone: '+998 71 200 33 44', createdAt: isoAt(addDays(today, -300), 10) },
  ]
  const accounts: Account[] = [
    { id: 'a0', name: 'Kamola Rahimova', email: 'founder@oqlibos.uz', password: DEMO_PASSWORD, role: 'founder', active: true },
    { id: 'a1', name: 'Madina Yusupova', email: 'filial1@oqlibos.uz', password: DEMO_PASSWORD, role: 'manager', branchId: 'b1', active: true },
    { id: 'a2', name: 'Sevara Aliyeva', email: 'filial2@oqlibos.uz', password: DEMO_PASSWORD, role: 'manager', branchId: 'b2', active: true },
  ]

  // ---------- product types ----------
  const typeCreated = isoAt(addDays(today, -540), 11)
  const productTypes: ProductType[] = [
    { id: 't1', kind: 'dress', name: { uz: "Kelinlik ko'ylagi", ru: 'Свадебное платье', en: 'Wedding gown' }, createdAt: typeCreated },
    { id: 't2', kind: 'dress', name: { uz: 'Kechki libos', ru: 'Вечернее платье', en: 'Evening dress' }, createdAt: typeCreated },
    { id: 't3', kind: 'dress', name: { uz: 'Kelin salom libosi', ru: 'Платье «Келин салом»', en: 'Kelin salom dress' }, description: 'Milliy uslubdagi libos', createdAt: typeCreated },
    { id: 't4', kind: 'accessory', name: { uz: 'Fata', ru: 'Фата', en: 'Veil' }, createdAt: typeCreated },
    { id: 't5', kind: 'accessory', name: { uz: 'Poyabzal', ru: 'Обувь', en: 'Shoes' }, createdAt: typeCreated },
    { id: 't6', kind: 'accessory', name: { uz: 'Taqinchoqlar', ru: 'Украшения', en: 'Jewelry' }, createdAt: typeCreated },
    { id: 't7', kind: 'accessory', name: { uz: 'Toj va diadema', ru: 'Тиара и диадема', en: 'Tiara' }, createdAt: typeCreated },
    { id: 't8', kind: 'accessory', name: { uz: 'Podyubnik', ru: 'Подъюбник', en: 'Petticoat' }, createdAt: typeCreated },
  ]

  // ---------- staff ----------
  const staffSpec: [ID, string, Staff['role']][] = [
    ['b1', 'Nilufar Ergasheva', 'manager'], ['b1', 'Dilnoza Karimova', 'stylist'], ['b1', 'Aziza Tursunova', 'stylist'],
    ['b1', 'Gulnora Saidova', 'tailor'], ['b1', 'Muhabbat Qodirova', 'tailor'], ['b1', 'Shahnoza Ismoilova', 'sales'],
    ['b1', 'Laylo Nazarova', 'sales'],
    ['b2', 'Feruza Mirzayeva', 'manager'], ['b2', 'Kamila Hasanova', 'stylist'], ['b2', 'Sabina Sobirova', 'stylist'],
    ['b2', 'Zulfiya Toshmatova', 'tailor'], ['b2', 'Mohira Abdullayeva', 'sales'], ['b2', "Charos Yo'ldosheva", 'sales'],
    ['b2', 'Umida Rasulova', 'admin'],
  ]
  const phone = () => `+998 ${pick(['90', '91', '93', '94', '97', '99', '88', '33', '95'])} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`
  const staff: Staff[] = staffSpec.map(([branchId, name, role]) => ({
    id: id('s'),
    branchId,
    name,
    phone: phone(),
    role,
    commissionRate: role === 'sales' ? pick([3, 4, 5]) : role === 'stylist' ? 2 : role === 'manager' ? 1 : 0,
    salary: role === 'manager' ? 8_000_000 : role === 'tailor' ? 6_000_000 : role === 'admin' ? 4_000_000 : 5_000_000,
    workDays: pick([[0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], [0, 1, 3, 4, 5, 6], [0, 2, 3, 4, 5, 6]]),
    shiftStart: pick(['09:00', '10:00']),
    shiftEnd: pick(['18:00', '19:00', '20:00']),
    hiredAt: addDays(today, -int(60, 520)),
    active: true,
  }))
  const staffOf = (b: ID, ...roles: Staff['role'][]) => staff.filter((s) => s.branchId === b && roles.includes(s.role))

  // ---------- products ----------
  const collections = ['Aurora', 'Seraphina', 'Lumière', 'Camelia', 'Valentina', 'Isabella', 'Grace', 'Eleganza', 'Swan', 'Milana', 'Amira', 'Bella', 'Celeste', 'Daria', 'Elise', 'Florence', 'Giselle', 'Helena', 'Iris', 'Jasmine', 'Katrin', 'Liora', 'Marisol', 'Noor', 'Odetta', 'Perla', 'Rosalie', 'Sofia', 'Tiana', 'Vivienne', 'Yasmin', 'Zara']
  const designers = ['Oq Libos Atelier', 'Milano Sposa', 'Istanbul Bridal', 'Paris Couture', 'Dubai Line']
  const gownStyles: Silhouette[] = ['a_line', 'ball_gown', 'mermaid', 'sheath', 'princess', 'empire']
  const products: Product[] = []
  let code = 100
  for (const b of branches) {
    const names = [...collections].sort(() => rnd() - 0.5)
    const gowns = b.id === 'b1' ? 28 : 22
    const created = (d: number) => isoAt(addDays(today, -int(d, 520)), 11)
    for (let i = 0; i < gowns; i++) {
      const sale = round(int(12, 42) * 1_000_000, 500_000)
      products.push({
        id: id('p'), code: `WD-${++code}`, name: names[i], typeId: 't1', branchId: b.id,
        size: String(pick([38, 40, 42, 42, 44, 44, 46, 48])),
        color: weighted<DressColor>([['white', 5], ['ivory', 4], ['champagne', 2], ['blush', 1]]),
        style: pick(gownStyles), designer: pick(designers),
        condition: weighted([['new', 2], ['excellent', 4], ['good', 3], ['fair', 1]]),
        status: 'available', mode: weighted<Product['mode']>([['both', 6], ['rent', 3], ['sale', 1.4]]),
        rentPrice: round(sale * (0.2 + rnd() * 0.08), 500_000), salePrice: sale, cost: round(sale * 0.52),
        securityDeposit: round(sale * 0.08, 500_000), quantity: 1, createdAt: created(100),
      })
    }
    for (let i = 0; i < 6; i++) {
      const sale = round(int(3, 8) * 1_000_000, 500_000)
      products.push({
        id: id('p'), code: `EV-${++code}`, name: names[gowns + i] ?? `Soirée ${i + 1}`, typeId: 't2', branchId: b.id,
        size: String(pick([40, 42, 44, 46])), color: pick<DressColor>(['champagne', 'silver', 'gold', 'blush', 'red']),
        style: pick<Silhouette>(['sheath', 'mermaid', 'a_line', 'short']), designer: pick(designers),
        condition: pick(['excellent', 'good']), status: 'available', mode: 'both',
        rentPrice: round(sale * 0.25, 100_000), salePrice: sale, cost: round(sale * 0.5),
        securityDeposit: 1_000_000, quantity: 1, createdAt: created(60),
      })
    }
    for (let i = 0; i < 4; i++) {
      const sale = round(int(7, 15) * 1_000_000, 500_000)
      products.push({
        id: id('p'), code: `KS-${++code}`, name: ['Guli', 'Oysha', 'Nodira', 'Zebo'][i], typeId: 't3', branchId: b.id,
        size: String(pick([42, 44, 46])), color: pick<DressColor>(['white', 'gold', 'red', 'ivory']), style: 'national',
        designer: 'Oq Libos Atelier', condition: pick(['new', 'excellent']), status: 'available', mode: pick(['both', 'rent']),
        rentPrice: round(sale * 0.25, 100_000), salePrice: sale, cost: round(sale * 0.5),
        securityDeposit: 1_000_000, quantity: 1, createdAt: created(60),
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
      products.push({
        id: id('p'), code: `AC-${++code}`, name, typeId, branchId: b.id,
        size: typeId === 't5' ? pick(['36', '37', '38', '39']) : '—',
        color: pick<DressColor>(['white', 'ivory', 'silver', 'gold']), condition: 'new', status: 'available', mode,
        rentPrice: rent, salePrice: sale, cost: round(sale * 0.45, 10_000), securityDeposit: 0,
        quantity: chance(0.12) ? 1 : int(2, 9), createdAt: created(30),
      })
    }
  }

  // ---------- clients ----------
  const firstNames = ['Madina', 'Dilnoza', 'Shahzoda', 'Nigora', 'Malika', 'Sevara', 'Gulnoza', 'Kamola', 'Zarina', 'Feruza', 'Nilufar', 'Aziza', 'Mohira', 'Laylo', 'Sabina', 'Umida', 'Yulduz', 'Charos', 'Munisa', 'Durdona', 'Shahnoza', 'Dildora', 'Gulchehra', 'Hilola', 'Iroda', 'Jasmina', 'Komila', 'Lola', 'Marjona', 'Nargiza', 'Ozoda', 'Parizoda', 'Rayhona', 'Sitora', 'Tamanno', 'Xurshida', 'Zilola', 'Anora', 'Barno', 'Diyora', 'Anna', 'Elina', 'Kristina', 'Alina', 'Viktoriya']
  const russianNames = ['Anna', 'Elina', 'Kristina', 'Alina', 'Viktoriya']
  const lastNames = ['Karimova', 'Rahimova', 'Tursunova', 'Yusupova', 'Aliyeva', 'Ismoilova', 'Saidova', 'Nazarova', 'Qodirova', 'Abdullayeva', 'Mirzayeva', 'Hasanova', 'Ergasheva', 'Toshmatova', 'Sobirova', 'Rasulova', 'Umarova', 'Xolmatova', 'Jurayeva', 'Normatova', 'Salimova', 'Hamidova', 'Ahmedova', 'Bakirova', 'Fayzullayeva']
  const sources: [LeadSource, number][] = [['instagram', 5], ['telegram', 3], ['referral', 3], ['walk_in', 2], ['website', 1], ['other', 0.5]]
  const clients: Client[] = []
  const newClient = (branchId: ID, createdDate: string, weddingDate?: string): Client => {
    const first = pick(firstNames)
    const c: Client = {
      id: id('c'), branchId, name: `${first} ${pick(lastNames)}`, phone: phone(), weddingDate,
      lang: russianNames.includes(first) || chance(0.15) ? 'ru' : 'uz',
      source: weighted(sources),
      measurements: {
        bust: int(80, 98), waist: int(58, 78), hips: int(86, 106), height: int(155, 178),
        shoulder: int(36, 42), sleeve: int(56, 62), length: int(140, 160), shoe: int(36, 40),
        updatedAt: createdDate,
      },
      createdAt: ts(createdDate),
    }
    clients.push(c)
    return c
  }

  // ---------- orders ----------
  const settings = { storeName: 'Oq Libos', lateFeePerDay: 300_000, defaultSecurityDeposit: 2_000_000, cleaningDays: 2, defaultRentalDays: 3 }
  const orders: Order[] = []
  const payments: Payment[] = []
  const alterations: Alteration[] = []
  const appointments: Appointment[] = []
  const season = [0.5, 0.5, 0.6, 0.9, 1.0, 1.0, 0.8, 1.1, 1.3, 1.4, 1.1, 0.6]
  const method = (): PaymentMethod => weighted([['cash', 35], ['card', 20], ['terminal', 15], ['click', 12], ['payme', 10], ['transfer', 8]])

  const freeDress = (branchId: ID, kind: 'rental' | 'sale', typeId: ID, start: string, end: string) => {
    const pool = products.filter(
      (p) => p.branchId === branchId && p.typeId === typeId && (kind === 'rental' ? p.mode !== 'sale' : p.mode !== 'rent'),
    )
    for (let tries = 0; tries < 25 && pool.length; tries++) {
      const p = pick(pool)
      if (!conflictsFor({ orders, settings }, p.id, start, end, undefined, true).length) return p
    }
    return undefined
  }
  const accessory = (branchId: ID, typeId: ID, kind: 'rental' | 'sale') => {
    const pool = products.filter((p) => p.branchId === branchId && p.typeId === typeId && (kind === 'rental' ? p.mode !== 'sale' : p.mode !== 'rent'))
    return pool.length ? pick(pool) : undefined
  }

  /** New gowns arrive through the year, so sales don't exhaust the rack. */
  const restock = (branchId: ID, before: string): Product => {
    const sale = round(int(14, 45) * 1_000_000, 500_000)
    const p: Product = {
      id: id('p'), code: `WD-${++code}`, name: `${pick(collections)} ${pick(['Royal', 'Classic', 'Luxe', 'Bloom', 'Étoile'])}`, typeId: 't1', branchId,
      size: String(pick([38, 40, 42, 44, 46])), color: weighted<DressColor>([['white', 5], ['ivory', 4], ['champagne', 2]]),
      style: pick(gownStyles), designer: pick(designers), condition: 'new', status: 'available', mode: pick(['sale', 'both']),
      rentPrice: round(sale * 0.22, 500_000), salePrice: sale, cost: round(sale * 0.52), securityDeposit: round(sale * 0.08, 500_000),
      quantity: 1, createdAt: isoAt(addDays(before, -int(3, 20)), 11),
    }
    products.push(p)
    return p
  }

  interface Forced { type?: 'rental' | 'sale'; pickupOffset?: number; returnOffset?: number; overdue?: boolean; keepBooked?: boolean }

  /** Builds one order with its payments, appointments and alteration; its status follows from today's date. */
  const makeOrder = (branchId: ID, wedding: string, forced: Forced = {}) => {
    const type = forced.type ?? (chance(0.7) ? 'rental' : 'sale')
    const pickupDate = addDays(wedding, forced.pickupOffset ?? (type === 'rental' ? -int(1, 2) : -int(3, 7)))
    const returnDate = type === 'rental' ? addDays(wedding, forced.returnOffset ?? int(1, 3)) : undefined
    let created = addDays(wedding, -(type === 'sale' ? int(45, 110) : int(14, 75)))
    if (created > today) created = addDays(today, -int(0, 3))
    if (created >= pickupDate) created = addDays(pickupDate, -2)
    const typeId = weighted([['t1', 8], ['t3', 1.2], ['t2', 1]])
    let dress = type === 'sale'
      ? freeDress(branchId, type, typeId, created, '9999-12-31')
      : freeDress(branchId, type, typeId, pickupDate, addDays(returnDate!, settings.cleaningDays))
    if (!dress && type === 'sale' && typeId === 't1') dress = restock(branchId, created)
    if (!dress) return undefined
    const items = [{ productId: dress.id, price: type === 'rental' ? dress.rentPrice : dress.salePrice, qty: 1 }]
    const extras: [ID, number][] = type === 'rental' ? [['t4', 0.5], ['t7', 0.25], ['t8', 0.3]] : [['t5', 0.6], ['t6', 0.4], ['t4', 0.45]]
    for (const [t, p] of extras) {
      if (!chance(p)) continue
      const a = accessory(branchId, t, type)
      if (a && !items.some((i) => i.productId === a.id)) items.push({ productId: a.id, price: type === 'rental' ? a.rentPrice : a.salePrice, qty: 1 })
    }
    const client = newClient(branchId, addDays(created, -int(0, 10)), wedding)
    const consultant = pick(staffOf(branchId, 'sales', 'manager'))
    const subtotal = items.reduce((s, i) => s + i.price, 0)
    const discount = chance(0.2) ? round(subtotal * pick([0.05, 0.1])) : 0
    const o: Order = {
      id: id('o'), number: '', branchId, clientId: client.id, type, status: 'booked', items, discount, charges: [],
      weddingDate: wedding, pickupDate, returnDate,
      securityDeposit: type === 'rental' ? Math.max(dress.securityDeposit, settings.defaultSecurityDeposit) : 0,
      lateFeePerDay: settings.lateFeePerDay, installments: [], staffId: consultant.id, createdAt: ts(created),
    }
    const cancelled = !forced.type && created < addDays(today, -20) && chance(0.04)

    // Alterations happen mostly on bought gowns, sometimes a temporary hem on a rental.
    let alt: Alteration | undefined
    if (!cancelled && (type === 'sale' ? chance(0.85) : chance(0.3))) {
      const tailor = pick(staffOf(branchId, 'tailor'))
      const due = addDays(pickupDate, -int(1, 2))
      const price = type === 'sale' ? round(int(3, 12) * 100_000) : round(int(2, 5) * 100_000)
      const first = addDays(created, int(4, 12))
      const dates = [first < due ? first : addDays(due, -1), addDays(due, -1)].filter((d, i, a) => a.indexOf(d) === i && d > created)
      const fittings = dates.map((d) => ({ id: id('f'), date: d, time: pick(['11:00', '14:00', '16:30']), done: d < today }))
      const status: Alteration['status'] =
        pickupDate <= today && !forced.keepBooked ? 'delivered'
          : due < today ? 'ready'
          : fittings.some((f) => f.done) ? pick(['fitting', 'in_progress'])
          : diffDays(today, due) < 20 ? 'in_progress' : 'pending'
      alt = {
        id: id('al'), branchId, clientId: client.id, productId: dress.id, orderId: o.id, tailorId: tailor.id,
        tasks: type === 'sale'
          ? pick(['Belini 2 sm toraytirish, etakni 4 sm qisqartirish', 'Korsetni moslash, yengini qisqartirish', "Ko'krak qismini moslash, shleyfga ilgak tikish", "Etakni qisqartirish, marjon qo'shish"])
          : pick(["Etakni vaqtincha 3 sm ko'tarish", 'Belini vaqtincha toraytirish', "Bog'ichlarni moslash"]),
        measurements: { ...client.measurements }, fittings, dueDate: due, price, status, createdAt: ts(addDays(created, 1)),
      }
      alterations.push(alt)
      o.charges.push({ id: id('ch'), kind: 'alteration', amount: price, date: addDays(created, 1) })
    }

    const total = orderTotal(o)
    const deposit = round(total * pick([0.3, 0.4, 0.5]))
    o.installments = buildPlan(total, deposit, type === 'sale' ? int(1, 3) : int(0, 1), created, addDays(pickupDate, -1))

    const pay = (kind: Payment['kind'], amount: number, date: string, extra?: Partial<Payment>) => {
      if (amount <= 0) return
      payments.push({ id: id('y'), branchId, orderId: o.id, clientId: client.id, amount, kind, method: method(), date: ts(date), staffId: consultant.id, ...extra })
    }
    o.installments.forEach((ins, i) => {
      if (ins.dueDate > today) return
      if (i === 0) return pay('advance', ins.amount, created)
      if (cancelled) return
      const skipped = pickupDate > today && ins.dueDate > addDays(today, -12) && chance(0.3)
      if (!skipped) pay('installment', ins.amount, ins.dueDate)
    })

    const handedOver = pickupDate < today || (pickupDate === today && !forced.keepBooked)
    if (cancelled) {
      o.status = 'cancelled'
    } else if (handedOver) {
      const paidSoFar = payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + p.amount, 0)
      pay('balance', total - paidSoFar, pickupDate)
      o.pickedUpAt = isoAt(pickupDate, int(10, 13))
      if (type === 'sale') {
        o.status = 'completed'
      } else {
        pay('security', o.securityDeposit, pickupDate, { method: 'cash' })
        if (returnDate! < today && !forced.overdue) {
          const late = chance(0.06) ? int(1, 2) : 0
          const back = addDays(returnDate!, late) < today ? addDays(returnDate!, late) : returnDate!
          o.returnedAt = isoAt(back, int(11, 17))
          o.status = 'completed'
          let deducted = 0
          if (late) {
            const fee = late * o.lateFeePerDay
            o.charges.push({ id: id('ch'), kind: 'late_fee', amount: fee, date: back })
            pay('fee', fee, back, { fromDeposit: true, method: 'cash' })
            deducted += fee
          }
          if (chance(0.07)) {
            const dmg = round(int(3, 9) * 100_000)
            const note = pick(["Etakda dog'", 'Marjon uzilgan', 'Fatin yirtilgan'])
            o.charges.push({ id: id('ch'), kind: 'damage', amount: dmg, note, date: back })
            o.damageNotes = note
            pay('fee', dmg, back, { fromDeposit: true, method: 'cash' })
            deducted += dmg
          }
          pay('security_return', Math.max(0, o.securityDeposit - deducted), back, { method: 'cash' })
        } else {
          o.status = 'picked_up'
        }
      }
    }
    orders.push(o)

    // Appointments around this order.
    const stylist = pick(staffOf(branchId, 'stylist'))
    const appt = (kind: Appointment['type'], date: string, time: string, dur: number, productIds: ID[], staffId = stylist.id) => {
      const status: Appointment['status'] = cancelled && date > created ? 'cancelled' : date < today ? 'completed' : 'scheduled'
      appointments.push({ id: id('ap'), branchId, clientId: client.id, type: kind, date, time, duration: dur, staffId, productIds, status, createdAt: ts(addDays(date, -int(1, 6))) })
    }
    const alsoShown = products.filter((p) => p.branchId === branchId && p.typeId === typeId && p.id !== dress.id).slice(0, 2).map((p) => p.id)
    appt('viewing', addDays(created, -int(0, 6)), pick(['10:30', '11:00', '12:00', '14:00', '15:30', '17:00']), 90, [dress.id, ...alsoShown])
    appt('measurement', created, pick(['11:30', '13:00', '16:00']), 45, [dress.id])
    if (Math.abs(diffDays(today, wedding)) < 75) {
      if (alt) for (const f of alt.fittings) appt('fitting', f.date, f.time ?? '14:00', 60, [dress.id], alt.tailorId)
      appt('pickup', pickupDate, pick(['10:00', '11:00', '12:00', '16:00']), 30, items.map((i) => i.productId))
      if (returnDate) appt('return', returnDate, pick(['11:00', '12:00', '15:00', '17:00']), 30, items.map((i) => i.productId))
    }
    return o
  }

  // A year of history plus bookings for the coming months.
  for (const b of branches) {
    const base = b.id === 'b1' ? 7.5 : 5.2
    const opened = b.createdAt.slice(0, 10)
    for (let m = -12; m <= 4; m++) {
      const first = parseDate(today)
      first.setDate(1)
      first.setMonth(first.getMonth() + m)
      const horizon = m > 0 ? Math.max(0.2, 1 - m * 0.22) : 1
      const n = Math.round(base * season[first.getMonth()] * horizon * (0.85 + rnd() * 0.3))
      const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
      for (let i = 0; i < n; i++) {
        const wedding = toDateStr(new Date(first.getFullYear(), first.getMonth(), int(1, daysInMonth)))
        if (Math.abs(diffDays(today, wedding)) <= 4) continue // near-today cases are crafted below
        if (addDays(wedding, -40) < opened) continue
        makeOrder(b.id, wedding)
      }
    }
    // Crafted near-today cases so "Today" always has pickups, returns and an overdue rental.
    makeOrder(b.id, addDays(today, 1), { type: 'rental', pickupOffset: -1, keepBooked: true }) // pickup today
    makeOrder(b.id, addDays(today, 2), { type: 'rental', pickupOffset: -1 }) // pickup tomorrow
    makeOrder(b.id, addDays(today, 3), { type: 'sale', pickupOffset: -2 }) // sale handover tomorrow
    makeOrder(b.id, addDays(today, -2), { type: 'rental', pickupOffset: -1, returnOffset: 2 }) // return today
    makeOrder(b.id, addDays(today, -1), { type: 'rental', pickupOffset: -1, returnOffset: 2 }) // return tomorrow
    makeOrder(b.id, addDays(today, -5), { type: 'rental', pickupOffset: -1, returnOffset: 2, overdue: true }) // 3 days late
    makeOrder(b.id, today, { type: 'rental', pickupOffset: -1, returnOffset: 2 }) // wedding today
    makeOrder(b.id, addDays(today, 6), { type: 'rental' })
    makeOrder(b.id, addDays(today, 10), { type: 'sale' })
  }

  // Order numbers follow creation time.
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  orders.forEach((o, i) => (o.number = `OL-${1001 + i}`))

  // ---------- product statuses ----------
  const kindOf = new Map(productTypes.map((t) => [t.id, t.kind]))
  for (const p of products) {
    if (kindOf.get(p.typeId) === 'accessory') continue
    const mine = orders.filter((o) => o.status !== 'cancelled' && o.items.some((i) => i.productId === p.id))
    if (mine.some((o) => o.type === 'sale' && o.status === 'completed')) {
      p.status = 'sold'
      p.quantity = 0
    } else if (mine.some((o) => o.type === 'rental' && o.status === 'picked_up')) p.status = 'rented'
    else if (alterations.some((a) => a.productId === p.id && ['pending', 'in_progress', 'fitting'].includes(a.status))) p.status = 'alteration'
    else if (mine.some((o) => o.status === 'booked')) p.status = 'reserved'
    else if (mine.some((o) => o.returnedAt && diffDays(o.returnedAt.slice(0, 10), today) < settings.cleaningDays)) p.status = 'cleaning'
  }
  products.filter((p) => p.status === 'available' && p.typeId === 't1').slice(0, 2).forEach((p) => (p.status = 'cleaning'))

  // ---------- walk-in viewings (not every visit turns into an order) ----------
  for (const b of branches) {
    for (let d = -56; d <= 14; d++) {
      const date = addDays(today, d)
      const count = d === 0 ? 3 : chance(0.45) ? 1 : 0
      for (let i = 0; i < count; i++) {
        const c = newClient(b.id, addDays(date, -int(0, 4)), chance(0.6) ? addDays(date, int(30, 160)) : undefined)
        const status: Appointment['status'] = date < today ? weighted([['completed', 8], ['no_show', 1.5], ['cancelled', 1]]) : 'scheduled'
        const dresses = products.filter((p) => p.branchId === b.id && p.typeId === 't1' && p.status !== 'sold').sort(() => rnd() - 0.5).slice(0, int(2, 4)).map((p) => p.id)
        appointments.push({
          id: id('ap'), branchId: b.id, clientId: c.id, type: chance(0.8) ? 'viewing' : 'measurement', date,
          time: d === 0 ? ['10:00', '13:30', '16:00'][i] : pick(['10:00', '11:30', '13:00', '14:30', '16:00', '17:30']),
          duration: 60, staffId: pick(staffOf(b.id, 'stylist')).id, productIds: dresses, status, createdAt: ts(addDays(date, -int(1, 7))),
        })
      }
    }
  }

  // ---------- leads ----------
  const leads: Lead[] = []
  for (const b of branches) {
    const stages: Lead['stage'][] = ['new', 'new', 'new', 'new', 'contacted', 'contacted', 'contacted', 'appointment', 'appointment', 'appointment', 'won', 'won', 'lost', 'lost']
    for (const stage of stages) {
      const created = addDays(today, -(stage === 'new' ? int(0, 3) : int(2, 28)))
      const lead: Lead = {
        id: id('l'), branchId: b.id, name: `${pick(firstNames)} ${pick(lastNames)}`, phone: phone(), source: weighted(sources),
        interest: weighted([['rent', 5], ['buy', 3], ['undecided', 2]]),
        weddingDate: chance(0.8) ? addDays(today, int(20, 200)) : undefined,
        budget: chance(0.6) ? round(int(3, 30) * 1_000_000, 1_000_000) : undefined,
        stage, staffId: pick(staffOf(b.id, 'sales', 'stylist')).id,
        notes: pick([undefined, "Instagram'dagi reklamadan yozdi", "Pishiq ko'ylak qidiryapti", 'Dugonasi tavsiya qildi', "Narxlarni so'radi", "Kechqurun qo'ng'iroq qilish kerak"]),
        createdAt: ts(created),
      }
      if (stage === 'won') {
        const c = newClient(b.id, addDays(created, 1), lead.weddingDate)
        c.name = lead.name
        c.phone = lead.phone
        c.source = lead.source
        lead.clientId = c.id
      }
      leads.push(lead)
    }
  }

  // ---------- SMS already sent this week ----------
  const smsLog: SmsLog[] = []
  const clientById = new Map(clients.map((c) => [c.id, c]))
  const recent = appointments.filter((x) => x.date > addDays(today, -6) && x.date <= today && x.status !== 'cancelled').slice(0, 30)
  for (const a of recent) {
    const c = clientById.get(a.clientId)!
    const branch = branches.find((b) => b.id === a.branchId)!
    const text = DEFAULT_TEMPLATES[0].text[c.lang]
      .replace('{name}', c.name.split(' ')[0]).replace('{date}', dotDate(a.date)).replace('{time}', a.time)
      .replace('{store}', settings.storeName).replace('{phone}', branch.phone)
    smsLog.push({ id: id('sm'), branchId: a.branchId, clientId: c.id, phone: c.phone, type: 'appointment', text, refKey: `appointment:${a.id}`, sentAt: isoAt(addDays(a.date, -1), 18), sentBy: 'auto' })
  }

  clients.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  payments.sort((a, b) => b.date.localeCompare(a.date))

  return {
    version: DB_VERSION, branches, accounts, productTypes, products, clients, leads, appointments, orders, payments,
    alterations, staff, smsTemplates: structuredClone(DEFAULT_TEMPLATES), smsLog, settings, orderSeq: 1001 + orders.length,
  }
}
