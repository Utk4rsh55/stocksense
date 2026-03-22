import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import POSPage from './pages/POSPage';
import SalesPage from './pages/SalesPage';
import AIInsightsPage from './pages/AIInsightsPage';
import UsersPage from './pages/UsersPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/inventory" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<ProtectedRoute adminOnly><DashboardPage /></ProtectedRoute>} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="sales" element={<ProtectedRoute adminOnly><SalesPage /></ProtectedRoute>} />
        <Route path="ai" element={<ProtectedRoute adminOnly><AIInsightsPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#0f172a' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#0f172a' } },
        }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
