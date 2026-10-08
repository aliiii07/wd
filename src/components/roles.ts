import type { StaffRole } from '../data/types'
import type { Tone } from './ui'

/** Staff roles in the order they are listed. */
export const ROLES: StaffRole[] = ['manager', 'stylist', 'sales', 'makeup', 'hair', 'tailor', 'photographer', 'cashier', 'admin', 'cleaner', 'driver', 'security']
/** Tag colour per role: client-facing roles stand out, back-office roles stay neutral. */
export const ROLE_TONE: Record<StaffRole, Tone> = {
  manager: 'dark', stylist: 'gold', sales: 'gold', makeup: 'info', hair: 'info', tailor: 'neutral', photographer: 'info',
  cashier: 'neutral', admin: 'neutral', cleaner: 'neutral', driver: 'neutral', security: 'neutral',
}
