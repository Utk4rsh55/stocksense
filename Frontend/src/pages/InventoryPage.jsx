import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiAlertTriangle, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const emptyProduct = {
  name: '', sku_code: '', category: 'General', price: '', cost_price: '',
  quantity: '', min_threshold: '5', expiry_date: '', description: ''
};

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchProducts = () => {
    const params = {};
    if (search) params.search = search;
    if (categoryFilter !== 'All') params.category = categoryFilter;
    api.get('/products', { params }).then(r => setProducts(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  const fetchCategories = () => {
    api.get('/products/categories').then(r => setCategories(r.data)).catch(console.error);
  };

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);
  useEffect(() => { fetchProducts(); }, [search, categoryFilter]);

  const openAddModal = () => { setEditProduct(null); setForm(emptyProduct); setShowModal(true); };
  const openEditModal = (p) => {
    setEditProduct(p);
    setForm({
      name: p.name, sku_code: p.sku_code || '', category: p.category, price: p.price,
      cost_price: p.cost_price || '', quantity: p.quantity, min_threshold: p.min_threshold,
      expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : '', description: p.description || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, form);
        toast.success('Product updated!');
      } else {
        await api.post('/products', form);
        toast.success('Product added!');
      }
      setShowModal(false);
      fetchProducts();
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product.');
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/products/${deleteConfirm.id}`);
      toast.success('Product deleted.');
    } catch (err) {
      if (err.response?.status === 404) {
        toast.success('Product is already deleted.');
      } else {
        toast.error(err.response?.data?.error || 'Delete failed.');
      }
    } finally {
      setDeleteConfirm(null);
      fetchProducts();
    }
  };

  const isExpiringSoon = (date) => {
    if (!date) return false;
    const exp = new Date(date);
    const now = new Date();
    const diff = (exp - now) / (1000 * 60 * 60 * 24);
    return diff <= 30 && diff > 0;
  };

  const isExpired = (date) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Manage your products and stock levels</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}><FiPlus /> Add Product</button>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <FiSearch style={{ color: 'var(--text-muted)' }} />
          <input
            className="search-input" placeholder="Search products..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"></div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th>
                  <th>Stock</th><th>Expiry</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No products found.</td></tr>
                ) : products.map(p => {
                  const lowStock = p.quantity <= p.min_threshold;
                  const expired = isExpired(p.expiry_date);
                  const expiringSoon = isExpiringSoon(p.expiry_date);
                  return (
                    <tr key={p.id} className={lowStock ? 'low-stock' : expired ? 'expired' : ''}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.name}
                        {lowStock && <span style={{ marginLeft: 6 }}><FiAlertTriangle color="var(--danger)" size={13} /></span>}
                      </td>
                      <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.sku_code || '—'}</code></td>
                      <td><span className="badge badge-info">{p.category}</span></td>
                      <td style={{ fontWeight: 600 }}>₹{parseFloat(p.price).toFixed(2)}</td>
                      <td>₹{parseFloat(p.cost_price || 0).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${p.quantity === 0 ? 'badge-danger' : lowStock ? 'badge-warning' : 'badge-success'}`}>
                          {p.quantity} {p.quantity === 0 ? '(Out)' : lowStock ? '(Low)' : ''}
                        </span>
                      </td>
                      <td>
                        {p.expiry_date ? (
                          <span className={`badge ${expired ? 'badge-danger' : expiringSoon ? 'badge-warning' : 'badge-success'}`}>
                            {new Date(p.expiry_date).toLocaleDateString()}
                            {expired && ' (Expired!)'}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEditModal(p)} title="Edit"><FiEdit2 /></button>
                          {isAdmin && (
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteConfirm(p)} title="Delete"><FiTrash2 /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {/* Product Form Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">SKU Code</label>
                    <input className="form-input" value={form.sku_code} onChange={e => setForm({...form, sku_code: e.target.value})} placeholder="e.g., MED-001" />
                  </div>
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Category</label>
                    <input 
                      className="form-input" 
                      value={form.category} 
                      onChange={e => setForm({...form, category: e.target.value})}
                      onFocus={() => { document.getElementById('category-dropdown').style.display = 'block'; }}
                      onBlur={() => { setTimeout(() => { const el = document.getElementById('category-dropdown'); if(el) el.style.display = 'none'; }, 150); }}
                      placeholder="Type or select..."
                    />
                    <div id="category-dropdown" style={{
                      display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, 
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: 150, overflowY: 'auto',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)', marginTop: 4
                    }}>
                      {categories.filter(c => c.toLowerCase().includes(form.category.toLowerCase())).map(c => (
                        <div 
                          key={c} 
                          onClick={() => setForm({...form, category: c})}
                          style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}
                          onMouseEnter={e => e.target.style.background = 'var(--accent-subtle)'}
                          onMouseLeave={e => e.target.style.background = 'none'}
                        >
                          {c}
                        </div>
                      ))}
                      {categories.filter(c => c.toLowerCase().includes(form.category.toLowerCase())).length === 0 && (
                        <div style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-muted)' }}>Press Enter to add new</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Selling Price *</label>
                    <input className="form-input" type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price</label>
                    <input className="form-input" type="number" step="0.01" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input className="form-input" type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Threshold</label>
                    <input className="form-input" type="number" value={form.min_threshold} onChange={e => setForm({...form, min_threshold: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input className="form-input" type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editProduct ? 'Update' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}><FiAlertTriangle style={{ verticalAlign: 'middle', marginRight: 8 }} /> Confirm Deletion</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={executeDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
