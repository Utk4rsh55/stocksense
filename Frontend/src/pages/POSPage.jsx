import { useState, useEffect } from 'react';
import { FiShoppingCart, FiTrash2, FiPlus, FiMinus, FiSearch, FiDownload } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [taxPercent, setTaxPercent] = useState(10);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [lastSaleId, setLastSaleId] = useState(null);

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data)).catch(console.error);
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku_code && p.sku_code.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (product) => {
    if (product.quantity <= 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} in stock`);
          return prev;
        }
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: product.id, name: product.name, price: parseFloat(product.price), quantity: 1, maxQty: product.quantity }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev
      .map(i => {
        if (i.product_id !== productId) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > i.maxQty) { toast.error(`Only ${i.maxQty} in stock`); return i; }
        return { ...i, quantity: newQty };
      })
      .filter(Boolean)
    );
  };

  const removeItem = (productId) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const netTotal = afterDiscount + taxAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    setProcessing(true);
    try {
      const res = await api.post('/sales', {
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        tax_percent: taxPercent,
        discount_percent: discountPercent,
        payment_method: 'cash'
      });
      toast.success(`Sale #${res.data.id} completed!`);
      setLastSaleId(res.data.id);
      setCart([]);
      // Refresh products to update stock
      api.get('/products').then(r => setProducts(r.data));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadInvoice = async () => {
    if (!lastSaleId) return;
    try {
      const toastId = toast.loading('Opening invoice...');
      const res = await api.get(`/sales/${lastSaleId}/invoice`, { responseType: 'blob' });
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
          <h1 className="page-title">Point of Sale</h1>
          <p className="page-subtitle">Select products to create a sale</p>
        </div>
        {lastSaleId && (
          <button className="btn btn-success" onClick={downloadInvoice}>
            <FiDownload /> Download Invoice #{lastSaleId}
          </button>
        )}
      </div>

      <div className="pos-layout">
        {/* Products Grid */}
        <div className="pos-products">
          <div className="pos-products-header">
            <FiSearch style={{ color: 'var(--text-muted)' }} />
            <input
              className="search-input" style={{ flex: 1 }}
              placeholder="Search products by name or SKU..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="pos-products-grid">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                className={`pos-product-card ${p.quantity <= 0 ? 'out-of-stock' : ''}`}
                onClick={() => addToCart(p)}
              >
                <div className="product-name">{p.name}</div>
                <div className="product-price">${parseFloat(p.price).toFixed(2)}</div>
                <div className="product-stock">
                  {p.quantity <= 0 ? 'Out of stock' : `${p.quantity} in stock`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <span><FiShoppingCart /> Cart</span>
            <span className="badge badge-info">{cart.length} items</span>
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <div>
                <FiShoppingCart size={40} style={{ opacity: 0.3, marginBottom: 10 }} /><br />
                Click products to add them to cart
              </div>
            </div>
          ) : (
            <div className="pos-cart-items">
              {cart.map(item => (
                <div key={item.product_id} className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">${item.price.toFixed(2)} each</div>
                  </div>
                  <div className="cart-item-qty">
                    <button onClick={() => updateQty(item.product_id, -1)}><FiMinus /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, 1)}><FiPlus /></button>
                  </div>
                  <div className="cart-item-total">${(item.price * item.quantity).toFixed(2)}</div>
                  <button className="btn btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => removeItem(item.product_id)}>
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pos-cart-summary">
            <div className="summary-inputs">
              <div className="form-group">
                <label className="form-label">Tax %</label>
                <input className="form-input" type="number" value={taxPercent} onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)} min="0" max="100" />
              </div>
              <div className="form-group">
                <label className="form-label">Discount %</label>
                <input className="form-input" type="number" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} min="0" max="100" />
              </div>
            </div>
            <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {discountPercent > 0 && <div className="summary-row"><span>Discount ({discountPercent}%)</span><span>-${discountAmount.toFixed(2)}</span></div>}
            {taxPercent > 0 && <div className="summary-row"><span>Tax ({taxPercent}%)</span><span>${taxAmount.toFixed(2)}</span></div>}
            <div className="summary-row total"><span>Total</span><span>${netTotal.toFixed(2)}</span></div>
          </div>

          <div className="pos-cart-actions">
            <button className="btn btn-outline" onClick={() => setCart([])} disabled={cart.length === 0}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={handleCheckout} disabled={cart.length === 0 || processing}>
              {processing ? 'Processing...' : `Checkout $${netTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
