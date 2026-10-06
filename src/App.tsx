import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './data/store'
import { AppLayout } from './components/Layout'
import Login from './pages/Login'
import Today from './pages/Today'
import Analytics from './pages/Analytics'
import CalendarPage from './pages/Calendar'
import Orders from './pages/Orders'
import OrderNew from './pages/OrderNew'
import OrderDetail from './pages/OrderDetail'
import Contract from './pages/Contract'
import Appointments from './pages/Appointments'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Payments from './pages/Payments'
import StaffPage from './pages/Staff'
import StaffDetail from './pages/StaffDetail'
import Notifications from './pages/Notifications'
import Branches from './pages/Branches'
import SettingsPage from './pages/Settings'
import Admin from './pages/Admin'

export default function App() {
  const { user, isFounder, isAdmin } = useStore()
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  if (isAdmin) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/today" element={<Today />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/new" element={<OrderNew />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/orders/:id/contract" element={<Contract />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/:id" element={<StaffDetail />} />
        <Route path="/notifications" element={<Notifications />} />
        {isFounder && <Route path="/branches" element={<Branches />} />}
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
