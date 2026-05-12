import { useState, useEffect } from 'react';
import { FiCpu, FiTrendingUp, FiAlertTriangle, FiMessageCircle, FiSend, FiRefreshCw } from 'react-icons/fi';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AIInsightsPage() {
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [anomalies, setAnomalies] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [loadingAsk, setLoadingAsk] = useState(false);
  const [loadingReorder, setLoadingReorder] = useState(true);

  useEffect(() => {
    api.get('/products').then(r => { setProducts(r.data); if (r.data.length) setSelectedProduct(r.data[0].id); }).catch(console.error);
    api.get('/ai/reorder-suggestions').then(r => setReorderSuggestions(r.data)).catch(console.error).finally(() => setLoadingReorder(false));
    api.get('/ai/anomalies').then(r => setAnomalies(r.data)).catch(console.error);
  }, []);

  const loadForecast = async () => {
    if (!selectedProduct) return;
    setLoadingForecast(true);
    try {
      const res = await api.get(`/ai/demand-forecast/${selectedProduct}`);
      setForecast(res.data);
    } catch (err) {
      toast.error('Failed to load forecast');
    } finally {
      setLoadingForecast(false);
    }
  };

  useEffect(() => { if (selectedProduct) loadForecast(); }, [selectedProduct]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoadingAsk(true);
    setAiAnswer(null);
    try {
      const res = await api.post('/ai/ask', { question });
      setAiAnswer(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'AI query failed';
      toast.error(msg);
      if (err.response?.data?.hint) {
        setAiAnswer({ answer: msg + '\n\n💡 ' + err.response.data.hint, question });
      }
    } finally {
      setLoadingAsk(false);
    }
  };

  const forecastChartData = forecast ? {
    labels: [...forecast.historical.slice(-14).map(h => h.date.slice(5)), ...forecast.forecast.map(f => f.date.slice(5))],
    datasets: [
      {
        label: 'Actual Sales', data: [...forecast.historical.slice(-14).map(h => h.sold), ...Array(7).fill(null)],
        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.3
      },
      {
        label: 'Predicted', data: [...Array(14).fill(null), ...forecast.forecast.map(f => f.predicted_demand)],
        borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', borderDash: [6, 3], fill: true, tension: 0.3
      }
    ]
  } : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 AI Insights</h1>
          <p className="page-subtitle">AI-powered demand forecasting, anomaly detection & smart suggestions</p>
        </div>
      </div>

      {/* Demand Forecast */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><FiTrendingUp style={{ marginRight: 8 }} /> Demand Forecast (7-Day Prediction)</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select className="filter-select" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-sm btn-outline" onClick={loadForecast} disabled={loadingForecast}><FiRefreshCw /></button>
          </div>
        </div>
        {loadingForecast ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"></div></div>
        ) : forecast ? (
          <div>
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-value" style={{ fontSize: 20 }}>{forecast.current_stock}</div>
                <div className="stat-label">Current Stock</div>
              </div>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-value" style={{ fontSize: 20 }}>{forecast.avg_daily_demand}</div>
                <div className="stat-label">Avg Daily Demand</div>
              </div>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-value" style={{ fontSize: 20 }}>{forecast.total_predicted_7days}</div>
                <div className="stat-label">Predicted 7-Day Demand</div>
              </div>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-value" style={{ fontSize: 20, color: forecast.reorder_needed ? 'var(--danger)' : 'var(--success)' }}>
                  {forecast.stock_will_last_days !== null ? `${forecast.stock_will_last_days} days` : 'N/A'}
                </div>
                <div className="stat-label">Stock Will Last</div>
              </div>
            </div>
            {forecast.reorder_needed && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
                ⚠️ <strong>Reorder Needed!</strong> Predicted demand ({forecast.total_predicted_7days} units) exceeds current stock ({forecast.current_stock} units).
              </div>
            )}
            <div style={{ height: 250 }}>
              {forecastChartData && <Line data={forecastChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1 } },
                scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } } }
              }} />}
            </div>
          </div>
        ) : <p style={{ color: 'var(--text-muted)', padding: 20 }}>Select a product to view forecast.</p>}
      </div>

      <div className="ai-grid">
        {/* Reorder Suggestions */}
        <div className="ai-card">
          <div className="ai-card-header">
            <div className="ai-card-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><FiAlertTriangle /></div>
            <div>
              <h3 className="card-title">Smart Reorder Suggestions</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Products that need restocking based on demand patterns</p>
            </div>
          </div>
          {loadingReorder ? <div className="spinner"></div> : reorderSuggestions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>✅ All products have adequate stock levels.</p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {reorderSuggestions.map(s => (
                <div key={s.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span className={`badge ${s.urgency === 'CRITICAL' ? 'urgency-critical' : s.urgency === 'HIGH' ? 'urgency-high' : 'urgency-medium'}`} style={{ minWidth: 65, justifyContent: 'center', display: 'inline-flex' }}>
                    {s.urgency}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Stock: {s.current_stock} · Demand: {s.avg_daily_demand}/day
                      {s.days_of_stock_left !== null && ` · ${s.days_of_stock_left} days left`}
                    </div>
                  </div>
                  <span className="badge badge-info">Order {s.suggested_reorder_qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anomaly Detection */}
        <div className="ai-card">
          <div className="ai-card-header">
            <div className="ai-card-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}><FiCpu /></div>
            <div>
              <h3 className="card-title">Sales Anomaly Detection</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unusual sales spikes or drops (Z-score analysis)</p>
            </div>
          </div>
          {anomalies ? (
            <div>
              {anomalies.stats ? (
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Mean Daily Sales: <strong style={{ color: 'var(--text-primary)' }}>₹{anomalies.stats.mean_daily_sales}</strong></span>
                  <span>Std Dev: <strong style={{ color: 'var(--text-primary)' }}>₹{anomalies.stats.std_deviation}</strong></span>
                </div>
              ) : anomalies.message ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>ℹ️ {anomalies.message}</p>
              ) : null}
              {anomalies.anomalies.length === 0 ? (
                <p style={{ color: 'var(--success)', fontSize: 13 }}>✅ No anomalies detected in the last 30 days.</p>
              ) : anomalies.anomalies.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span className={`badge ${a.type === 'SPIKE' ? 'badge-success' : 'badge-danger'}`}>{a.type === 'SPIKE' ? '📈 Spike' : '📉 Drop'}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13 }}>{new Date(a.date).toLocaleDateString()}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>₹{a.daily_total} ({a.transaction_count} txns)</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Z: {a.z_score}</span>
                </div>
              ))}
            </div>
          ) : <div className="spinner"></div>}
        </div>
      </div>

      {/* AI Chat */}
      <div className="ai-chat-box" style={{ marginTop: 20 }}>
        <div className="ai-card-header">
          <div className="ai-card-icon" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}><FiMessageCircle /></div>
          <div>
            <h3 className="card-title">Ask AI about your inventory</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Powered by Google Gemini — Ask questions in natural language</p>
          </div>
        </div>
        <form onSubmit={handleAsk} className="ai-chat-input">
          <input
            className="form-input" placeholder='e.g., "Which products sold the most last week?"'
            value={question} onChange={e => setQuestion(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={loadingAsk}>
            {loadingAsk ? '...' : <FiSend />}
          </button>
        </form>
        {aiAnswer && (
          <div className="ai-answer">
            <p><strong>Q:</strong> {aiAnswer.question}</p>
            <p style={{ marginTop: 8 }}><strong>A:</strong> {aiAnswer.answer}</p>
            
            {aiAnswer.data && aiAnswer.data.length > 0 && (
              <div style={{ marginTop: 16, overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {Object.keys(aiAnswer.data[0]).map(k => (
                        <th key={k} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{k.replace(/_/g, ' ').toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aiAnswer.data.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i === aiAnswer.data.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} style={{ padding: '10px 12px' }}>
                            {val === null ? 'N/A' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
