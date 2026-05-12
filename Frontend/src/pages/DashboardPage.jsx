import { useState, useEffect } from 'react';
import { FiPackage, FiTrendingUp, FiAlertTriangle, FiShoppingBag, FiClock } from 'react-icons/fi';
import { Bar, Pie, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import api from '../services/api';

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
    tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1 }
  },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }
  }
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [profit, setProfit] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/top-products'),
      api.get('/dashboard/revenue'),
      api.get('/dashboard/profit'),
      api.get('/dashboard/category-breakdown')
    ]).then(([s, tp, r, p, c]) => {
      setSummary(s.data);
      setTopProducts(tp.data);
      setRevenue(r.data);
      setProfit(p.data);
      setCategoryData(c.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  const revenueChart = {
    labels: revenue.map(r => r.month),
    datasets: [{
      label: 'Revenue (₹)',
      data: revenue.map(r => parseFloat(r.revenue)),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.15)',
      fill: true, tension: 0.4, pointRadius: 4,
      pointBackgroundColor: '#6366f1'
    }]
  };

  const profitChart = {
    labels: profit.map(p => p.month),
    datasets: [
      { label: 'Revenue', data: profit.map(p => p.revenue), backgroundColor: 'rgba(99,102,241,0.7)', borderRadius: 6 },
      { label: 'Cost', data: profit.map(p => p.cost), backgroundColor: 'rgba(239,68,68,0.5)', borderRadius: 6 },
      { label: 'Profit', data: profit.map(p => p.profit), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 6 }
    ]
  };

  const topProductsChart = {
    labels: topProducts.map(p => p.name),
    datasets: [{
      data: topProducts.map(p => parseInt(p.total_sold)),
      backgroundColor: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'],
      borderWidth: 0
    }]
  };

  const categoryChart = {
    labels: categoryData.map(c => c.category),
    datasets: [{
      data: categoryData.map(c => parseFloat(c.revenue)),
      backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
      borderWidth: 0
    }]
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Business overview at a glance</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><FiPackage /></div>
          <div className="stat-value">{summary?.total_products || 0}</div>
          <div className="stat-label">Total Products</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green" style={{ fontSize: 18, fontWeight: 700 }}>₹</div>
          <div className="stat-value">₹{(summary?.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><FiTrendingUp /></div>
          <div className="stat-value">₹{(summary?.total_profit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="stat-label">Total Profit</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiAlertTriangle /></div>
          <div className="stat-value">{summary?.low_stock_count || 0}</div>
          <div className="stat-label">Low Stock Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FiShoppingBag /></div>
          <div className="stat-value">{summary?.today_sales_count || 0}</div>
          <div className="stat-label">Today's Sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FiClock /></div>
          <div className="stat-value">{summary?.expiring_soon || 0}</div>
          <div className="stat-label">Expiring Soon</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="card-title">📈 Monthly Revenue Trend</h3>
          <div style={{ height: 280 }}>
            <Line data={revenueChart} options={{ ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }} />
          </div>
        </div>
        <div className="chart-card">
          <h3 className="card-title">🏆 Top 5 Selling Products</h3>
          <div style={{ height: 280 }}>
            <Pie data={topProductsChart} options={{
              ...chartDefaults, scales: undefined,
              plugins: { ...chartDefaults.plugins, legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } }
            }} />
          </div>
        </div>
        <div className="chart-card">
          <h3 className="card-title">💰 Profit vs Cost vs Revenue</h3>
          <div style={{ height: 280 }}>
            <Bar data={profitChart} options={chartDefaults} />
          </div>
        </div>
        <div className="chart-card">
          <h3 className="card-title">📊 Sales by Category</h3>
          <div style={{ height: 280 }}>
            <Pie data={categoryChart} options={{
              ...chartDefaults, scales: undefined,
              plugins: { ...chartDefaults.plugins, legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } }
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
