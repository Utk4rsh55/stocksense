import { useState, useEffect } from 'react';
import { FiEye, FiDownload } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetail, setSaleDetail] = useState(null);

  useEffect(() => {
    api.get('/sales').then(r => setSales(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const viewSale = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      setSaleDetail(res.data);
      setSelectedSale(id);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadInvoice = async (id) => {
    try {
      const toastId = toast.loading('Opening invoice...');
      const res = await api.get(`/sales/${id}/invoice`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      toast.success('Invoice opened', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to open invoice');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales History</h1>
          <p className="page-subtitle">View all completed transactions</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSale ? '1fr 400px' : '1fr', gap: 20 }}>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"></div></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Date</th><th>Cashier</th><th>Subtotal</th>
                    <th>Discount</th><th>Tax</th><th>Net Total</th><th>Payment</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sales yet.</td></tr>
                  ) : sales.map(s => (
                    <tr key={s.id} style={{ background: selectedSale === s.id ? 'var(--accent-subtle)' : undefined }}>
                      <td style={{ fontWeight: 600 }}>#{s.id}</td>
                      <td>{new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{s.cashier || '–'}</td>
                      <td>${parseFloat(s.total_amount).toFixed(2)}</td>
                      <td>{parseFloat(s.discount_amount) > 0 ? `-$${parseFloat(s.discount_amount).toFixed(2)}` : '–'}</td>
                      <td>${parseFloat(s.tax_amount).toFixed(2)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>${parseFloat(s.net_amount).toFixed(2)}</td>
                      <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{s.payment_method}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline btn-sm btn-icon" onClick={() => viewSale(s.id)} title="View"><FiEye /></button>
                          <button className="btn btn-outline btn-sm btn-icon" onClick={() => downloadInvoice(s.id)} title="Invoice"><FiDownload /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sale Detail Panel */}
        {selectedSale && saleDetail && (
          <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div className="card-header">
              <h3 className="card-title">Sale #{saleDetail.id}</h3>
              <button className="btn btn-sm btn-outline" onClick={() => { setSelectedSale(null); setSaleDetail(null); }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {new Date(saleDetail.created_at).toLocaleString()} · {saleDetail.cashier}
            </div>

            <table style={{ width: '100%', marginBottom: 16 }}>
              <thead>
                <tr><th style={{ fontSize: 11 }}>Item</th><th style={{ fontSize: 11 }}>Qty</th><th style={{ fontSize: 11, textAlign: 'right' }}>Total</th></tr>
              </thead>
              <tbody>
                {saleDetail.items?.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13 }}>{item.product_name}</td>
                    <td style={{ fontSize: 13 }}>{item.quantity_sold} × ${parseFloat(item.price_at_sale).toFixed(2)}</td>
                    <td style={{ fontSize: 13, textAlign: 'right', fontWeight: 600 }}>${parseFloat(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="summary-row"><span>Subtotal</span><span>${parseFloat(saleDetail.total_amount).toFixed(2)}</span></div>
            {parseFloat(saleDetail.discount_amount) > 0 && (
              <div className="summary-row"><span>Discount ({saleDetail.discount_percent}%)</span><span>-${parseFloat(saleDetail.discount_amount).toFixed(2)}</span></div>
            )}
            <div className="summary-row"><span>Tax ({saleDetail.tax_percent}%)</span><span>${parseFloat(saleDetail.tax_amount).toFixed(2)}</span></div>
            <div className="summary-row total"><span>Net Total</span><span>${parseFloat(saleDetail.net_amount).toFixed(2)}</span></div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={() => downloadInvoice(saleDetail.id)}>
              <FiDownload /> Download PDF Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
