import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiPackage, FiShoppingCart, FiBarChart2, FiCpu, FiUsers, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    ...(isAdmin ? [{ to: '/', icon: <FiHome />, label: 'Dashboard' }] : []),
    { to: '/inventory', icon: <FiPackage />, label: 'Inventory' },
    { to: '/pos', icon: <FiShoppingCart />, label: 'Point of Sale' },
    ...(isAdmin ? [
      { to: '/sales', icon: <FiBarChart2 />, label: 'Sales History' },
      { to: '/ai', icon: <FiCpu />, label: 'AI Insights' },
      { to: '/users', icon: <FiUsers />, label: 'Users' },
    ] : []),
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">S</div>
            <span className="logo-text">StockSense</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><FiX /></button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.full_name?.[0] || 'U'}</div>
            <div className="user-details">
              <span className="user-name">{user?.full_name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <FiLogOut /> <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <header className="top-bar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}><FiMenu /></button>
          <div className="top-bar-right">
            <span className="greeting">Welcome, <strong>{user?.full_name}</strong></span>
            <span className={`role-badge ${user?.role}`}>{user?.role}</span>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
