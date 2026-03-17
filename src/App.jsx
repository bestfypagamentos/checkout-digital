import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import IntegrationsPage from './pages/IntegrationsPage'
import TransactionsPage from './pages/TransactionsPage'
import CheckoutPage from './pages/CheckoutPage'
import ProductEditPage from './pages/ProductEditPage'
import CheckoutEditor from './pages/CheckoutEditor'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/checkout/:productId" element={<CheckoutPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductEditPage />} />
            <Route path="/products/:id/checkout-editor" element={<CheckoutEditor />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
