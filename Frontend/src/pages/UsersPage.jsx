import { useState, useEffect } from 'react';
import { FiUserPlus, FiTrash2, FiShield, FiUser } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'staff' });

  const fetchUsers = () => {
    api.get('/auth/users').then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      toast.success('User created!');
      setShowForm(false);
      setForm({ username: '', email: '', password: '', full_name: '', role: 'staff' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user.');
    }
  };

  const handleDelete = async (id, username) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      await api.delete(`/auth/users/${id}`);
      toast.success('User deleted.');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage admin and staff accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <FiUserPlus /> {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>Create New User</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className="form-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff (Cashier)</option>
                <option value="admin">Admin (Owner)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Create User</button>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"></div></div>
        ) : (
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{u.full_name?.[0] || 'U'}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.email || '–'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                      {u.role === 'admin' ? <><FiShield size={10} /> Admin</> : <><FiUser size={10} /> Staff</>}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(u.id, u.username)} title="Delete">
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
