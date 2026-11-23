import { useState } from 'react'
import { AccountPage } from './shopper.jsx'
import { ActionForm, api, Field, money, Notice, orderStatuses, stock, useResource, useStore } from './shared.jsx'

function Metrics({ entries }) {
  return <div className="metric-grid">{entries.map(([label, value]) =>
    <section className="panel metric" key={label}><h2>{label}</h2><strong>{value}</strong></section>)}</div>
}

function Dashboard() {
  const { user } = useStore()
  const { data, error } = useResource('/admin/dashboard')
  return <main className="photo-screen dashboard-screen"><div className="page dashboard">
    <h1 className="panel">Welcome to Dashboard, {user.username}</h1>
    <Notice>{error}</Notice>
    {!data && !error && <p className="panel">Loading dashboard…</p>}
    {data && <>
      <Metrics entries={[[ 'Total Orders', data.stats.order_count ], [ 'Total Products', data.stats.products ],
        [ 'Total Registered Users', data.stats.users ], [ 'Total Revenue', money(data.stats.revenue) ]]} />
      <div className="metric-grid dashboard-lists">
        <section className="panel"><h2>Latest Orders</h2>
          {!data.orders.length && <p>No orders yet.</p>}
          {data.orders.map((order) => <div key={order.id}>
            <a href={`/admin/orders?q=${order.id}`}>Order #{order.id}</a><small>{order.full_name} · {money(order.total)}</small>
          </div>)}
        </section>
        <section className="panel"><h2>Products Available</h2>
          {data.products.map((product) => <div key={product.id}>
            <a href={`/admin/products/${product.id}`}>{product.name}</a><small>{stockStatus(product)} · Stock {stock(product)}</small>
          </div>)}
        </section>
        <section className="panel"><h2>New Registered Users</h2>
          {data.users.map((entry) => <div key={entry.id}><strong>{entry.username}</strong><small>{entry.email} · {entry.role}</small></div>)}
        </section>
        <section className="panel"><h2>Best Selling Products</h2>
          {!data.best.length && <p>No received orders yet.</p>}
          {data.best.map((entry) => <div key={entry.product_name}><strong>{entry.product_name}</strong><small>{entry.sold} sold</small></div>)}
        </section>
      </div>
    </>}
  </div></main>
}

function stockStatus(product) {
  if (!product.active) return 'Inactive'
  const total = stock(product)
  if (!total) return 'Out of Stock'
  if (total <= 5) return 'Low Stock'
  return 'Active'
}

function Inventory() {
  const { data, error, reload } = useResource('/admin/products')
  const { loadCatalog } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = data?.filter((product) => `${product.name} ${product.color} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (!filter || stockStatus(product) === filter))
  async function deactivate(id) {
    setBusy(true)
    setActionError('')
    try {
      await api(`/admin/products/${id}`, 'DELETE')
      setConfirm(null)
      reload()
      loadCatalog()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return <main className="page staff-page">
    <h1>Inventory</h1>
    <Notice>{error || actionError}</Notice>
    {data && <Metrics entries={[
      ['Total Products', data.length],
      ['Low Stock', data.filter((item) => stockStatus(item) === 'Low Stock').length],
      ['Out of Stock', data.filter((item) => stockStatus(item) === 'Out of Stock').length],
      ['Active Listings', data.filter((item) => item.active).length],
    ]} />}
    <div className="staff-tools">
      <label className="field">Search inventory<input type="search" placeholder="Product name" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="field">Listing status<select value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="">All statuses</option>{['Active', 'Low Stock', 'Out of Stock', 'Inactive'].map((status) => <option key={status}>{status}</option>)}
      </select></label>
      <a className="button primary" href="/admin/products/new">Add Product</a>
    </div>
    {matches?.length === 0 && <p>No products match your search.</p>}
    <div className="table-scroll"><table className="data-table">
      <thead><tr>{['Product Name', 'Category', 'Color', 'Sizes', 'Price', 'Stock', 'Status', 'Actions'].map((item) => <th scope="col" key={item}>{item}</th>)}</tr></thead>
      <tbody>{matches?.map((product) => <tr key={product.id}>
        <th scope="row">{product.name}</th><td>{product.category}</td><td>{product.color}</td>
        <td>{product.variants.map((variant) => `${variant.size} (${variant.stock})`).join(', ')}</td>
        <td>{money(product.price)}</td><td>{stock(product)}</td>
        <td><span className={`status ${product.active && stock(product) > 5 ? 'positive' : 'negative'}`}>{stockStatus(product)}</span></td>
        <td><div className="button-row">
          {Boolean(product.active) && <a className="button light" href={`/products/${product.slug}`}>View</a>}
          <a className="button primary" href={`/admin/products/${product.id}`}>Edit</a>
          {Boolean(product.active) && (confirm === product.id ? <>
            <button className="button danger" disabled={busy} onClick={() => deactivate(product.id)}>Confirm</button>
            <button className="button light" disabled={busy} onClick={() => setConfirm(null)}>Keep</button>
          </> : <button className="button light" onClick={() => setConfirm(product.id)}>Deactivate</button>)}
        </div></td>
      </tr>)}</tbody>
    </table></div>
  </main>
}

function ProductFields({ product }) {
  const { navigate, loadCatalog } = useStore()
  const [photos, setPhotos] = useState(product?.images || [])
  const [variants, setVariants] = useState(() => (product?.variants || [{ size: 'S', stock: 0 }])
    .map((variant, index) => ({ ...variant, key: index })))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  function changeVariant(key, name, value) {
    setVariants((items) => items.map((entry) => entry.key === key ? { ...entry, [name]: value } : entry))
  }
  async function upload(event) {
    const input = event.currentTarget
    const files = Array.from(input.files).slice(0, 8 - photos.length)
    input.value = ''
    setUploading(true)
    setUploadError('')
    try {
      for (const photo of files) {
        const form = new FormData()
        form.append('file', photo)
        const { url } = await api('/admin/media', 'POST', form)
        setPhotos((current) => [...current, url])
      }
    } catch (failure) {
      setUploadError(failure.message)
    } finally {
      setUploading(false)
    }
  }
  return <ActionForm className="product-editor" button="Save Product" disabled={uploading} onSubmit={async (data) => {
    if (!photos.length) throw new Error('Add at least one product photo.')
    const body = {
      ...data, images: photos, variants: variants.map(({ size, stock }) => ({ size, stock: Number(stock) })),
      active: Boolean(data.active), featured: Boolean(data.featured),
    }
    if (product) body.original_variants = product.variants.map(({ size, stock }) => ({ size, stock }))
    await api(product ? `/admin/products/${product.id}` : '/admin/products', product ? 'PUT' : 'POST', body)
    await loadCatalog()
    navigate('/admin/inventory')
  }}>
    <section className="panel photo-editor">
      <h2>Product Photos</h2>
      <p>The first photo appears in the catalog.</p>
      <div className="upload-previews">{photos.map((url, index) => <figure key={url}>
        <img src={url} alt={`Product photo ${index + 1}`} />
        {index > 0 && <button type="button" className="button light" disabled={uploading}
          onClick={() => setPhotos([url, ...photos.filter((item) => item !== url)])}>Make cover</button>}
        <button type="button" className="text-button" disabled={uploading} onClick={() => setPhotos(photos.filter((item) => item !== url))}>Remove photo</button>
      </figure>)}</div>
      <label className="field">Upload photos
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} disabled={uploading || photos.length >= 8} />
      </label>
      <Notice>{uploadError}</Notice>{uploading && <p role="status">Uploading photos…</p>}
    </section>
    <section className="panel product-fields">
      <Field label="Product Name" name="name" value={product?.name} maxLength="120" />
      <Field label="Price (PHP)" name="price" type="number" value={product?.price} min="0" max="99999999.99" step="0.01" />
      <Field label="Category" name="category" value={product?.category} maxLength="50" />
      <Field label="Color" name="color" value={product?.color} maxLength="50" />
      <fieldset className="variant-editor"><legend>Sizes and Stock</legend>
        {variants.map((variant) => <div className="variant-row" key={variant.key}>
          <label className="field">Size<input maxLength="20" required value={variant.size} onChange={(event) => changeVariant(variant.key, 'size', event.target.value)} /></label>
          <label className="field">Stock<input type="number" min="0" max="999999" required value={variant.stock} onChange={(event) => changeVariant(variant.key, 'stock', event.target.value)} /></label>
          <button type="button" className="button light" disabled={variants.length === 1}
            onClick={() => setVariants(variants.filter((entry) => entry.key !== variant.key))}>Remove</button>
        </div>)}
        <button type="button" className="button light" disabled={variants.length >= 30}
          onClick={() => setVariants([...variants, { key: Math.max(...variants.map((entry) => entry.key)) + 1, size: '', stock: 0 }])}>Add Size</button>
      </fieldset>
      <Field label="Description" name="description" type="textarea" value={product?.description} rows="4" optional maxLength="5000" />
      <label className="checkbox"><input name="active" type="checkbox" defaultChecked={product ? Boolean(product.active) : true} /> Active listing</label>
      <label className="checkbox"><input name="featured" type="checkbox" defaultChecked={Boolean(product?.featured)} /> Feature on Home</label>
    </section>
  </ActionForm>
}

function ProductEditor({ id }) {
  const { data, error } = useResource(id ? '/admin/products' : null)
  const product = id && data?.find((item) => String(item.id) === id)
  return <main className="page staff-page">
    <a className="back" href="/admin/inventory">‹ Back to Inventory</a>
    <h1>{id ? 'Edit Product' : 'Upload Product'}</h1>
    <Notice>{error}</Notice>
    {(!id || product) && <ProductFields product={product} />}
    {id && !data && !error && <p>Loading product…</p>}
    {id && data && !product && <p>Product not found.</p>}
  </main>
}

function StaffOrders() {
  const { location } = useStore()
  const { data, error, reload } = useResource('/admin/orders')
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('q') || '')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [cancelling, setCancelling] = useState(null)
  const matches = data?.filter((order) => `${order.id} ${order.full_name} ${order.username} ${order.email}`.toLowerCase().includes(search.trim().toLowerCase()))
  async function change(id, action) {
    setBusy(true)
    setActionError('')
    try {
      await api(`/admin/orders/${id}`, 'POST', { action })
      setCancelling(null)
      reload()
    } catch (failure) {
      setActionError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  return <main className="orders-screen"><div className="page staff-page">
    <div className="staff-tools"><h1>Orders</h1>
      <label className="field">Search orders<input type="search" placeholder="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    <Notice>{error || actionError}</Notice>
    {Object.entries(orderStatuses).map(([status, label]) => {
      const orders = matches?.filter((order) => order.status === status)
      return <section className="panel orders-group" key={status}>
        <h2>{label} Orders</h2>
        {!orders && !error && <p>Loading orders…</p>}
        {orders?.length === 0 && <p>No {label.toLowerCase()} orders.</p>}
        {Boolean(orders?.length) && <div className="table-scroll"><table className="data-table">
          <thead><tr>{['Order ID', 'Customer', 'Email', 'Items and delivery', 'Status', 'Date Created', 'Total', 'Actions'].map((item) =>
            <th scope="col" key={item}>{item}</th>)}</tr></thead>
          <tbody>{orders.map((order) => <tr key={order.id}>
            <th scope="row">#{order.id}</th><td>{order.full_name}</td><td>{order.email}</td>
            <td><details><summary>Order details</summary>
              <ul>{order.items.map((item) => <li key={item.variant_id}>{item.product_name} ({item.color}, {item.size}) × {item.quantity}</li>)}</ul>
              <span>{order.address} · {order.phone}{order.note && ` · ${order.note}`}</span>
            </details></td>
            <td>{status === 'active' && order.confirmed ? 'Confirmed' : label}</td>
            <td>{order.created_at.slice(0, 10)}</td><td>{money(order.total)}</td>
            <td>{status === 'active' && <div className="button-row">
              {cancelling === order.id ? <>
                <button className="button danger" disabled={busy} onClick={() => change(order.id, 'cancel')}>Confirm cancellation</button>
                <button className="button light" disabled={busy} onClick={() => setCancelling(null)}>Keep order</button>
              </> : <>
                <button className="button primary" disabled={busy}
                  onClick={() => change(order.id, order.confirmed ? 'ship' : 'confirm')}>{order.confirmed ? 'Mark In Transit' : 'Confirm'}</button>
                <button className="button light" disabled={busy} onClick={() => setCancelling(order.id)}>Cancel order</button>
              </>}
            </div>}
              {status === 'in_transit' && <button className="button primary" disabled={busy} onClick={() => change(order.id, 'receive')}>Mark Received</button>}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    })}
  </div></main>
}

function ManageUsers() {
  const { user } = useStore()
  const { data, error, reload } = useResource('/admin/users')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState('')
  const [deactivating, setDeactivating] = useState(null)
  const [busy, setBusy] = useState(false)
  const matches = data?.filter((entry) => `${entry.username} ${entry.email} ${entry.role}`.toLowerCase().includes(search.trim().toLowerCase()))
  async function deactivate(entry) {
    setBusy(true)
    setActionError('')
    try {
      await api(`/admin/users/${entry.id}`, 'DELETE')
      setDeactivating(null)
      if (editing?.id === entry.id) setEditing(null)
      reload()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return <main className="page staff-page">
    <h1>Manage Users</h1>
    <Notice>{error || actionError}</Notice>
    <div className="user-layout">
      <section className="panel">
        <label className="field">Search users<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{matches?.map((entry) => <tr key={entry.id}>
            <th scope="row">{entry.username}</th><td>{entry.email}</td><td>{entry.role}</td><td>{entry.active ? 'Active' : 'Inactive'}</td>
            <td>{entry.id === user.id ? <a href="/admin/profile">Your profile</a> : <div className="button-row">
              <button className="button light" onClick={() => setEditing(entry)}>Edit</button>
              {Boolean(entry.active) && (deactivating === entry.id ? <>
                <button className="button danger" disabled={busy} onClick={() => deactivate(entry)}>Confirm</button>
                <button className="button light" disabled={busy} onClick={() => setDeactivating(null)}>Keep</button>
              </> : <button className="button light" onClick={() => setDeactivating(entry.id)}>Deactivate</button>)}
            </div>}</td>
          </tr>)}</tbody>
        </table></div>
        {matches?.length === 0 && <p>No users match your search.</p>}
      </section>
      <ActionForm key={editing?.id || 'new'} className="panel" button={editing ? 'Save User' : 'Add User'}
        onSubmit={async ({ active, ...body }, form) => {
          await api(editing ? `/admin/users/${editing.id}` : '/admin/users', editing ? 'PUT' : 'POST', { ...body, active: Boolean(active) })
          if (!editing) form.reset()
          reload()
          return editing ? 'User updated.' : 'User added.'
        }}>
        <h2>{editing ? 'Edit User' : 'Add New User'}</h2>
        <Field name="username" label="Username" value={editing?.username} minLength="2" maxLength="60" />
        <Field name="email" label="Email" type="email" value={editing?.email} maxLength="254" />
        <Field name="password" label={editing ? 'New password (optional)' : 'Password'} type="password"
          optional={Boolean(editing)} minLength="8" maxLength="128" autoComplete="new-password" />
        <label className="field">Role<select name="role" defaultValue={editing?.role || 'shopper'}>
          <option value="shopper">Shopper</option><option value="admin">Admin</option>
        </select></label>
        <label className="checkbox"><input name="active" type="checkbox" defaultChecked={editing ? Boolean(editing.active) : true} /> Active account</label>
        {editing && <button className="button light" type="button" onClick={() => setEditing(null)}>Add a different user</button>}
      </ActionForm>
    </div>
  </main>
}

function Messages() {
  const { data, error } = useResource('/admin/messages')
  return <main className="page staff-page">
    <h1>Contact &amp; Support Messages</h1><Notice>{error}</Notice>
    {!data && !error && <p>Loading messages…</p>}
    {data?.length === 0 && <p>No messages yet.</p>}
    <div className="message-list">{data?.map((message) => <article className="panel" key={message.id}>
      <h2>{message.name}</h2><p><strong>{message.kind}</strong> · {message.email} · {message.created_at.slice(0, 10)}</p>
      <p className="message-body">{message.message}</p>
    </article>)}</div>
  </main>
}

export function AdminPage({ path }) {
  if (path === '/admin') return <Dashboard />
  if (path === '/admin/inventory') return <Inventory />
  if (path === '/admin/orders') return <StaffOrders />
  if (path === '/admin/users') return <ManageUsers />
  if (path === '/admin/profile') return <AccountPage staff />
  if (path === '/admin/messages') return <Messages />
  if (path === '/admin/products/new') return <ProductEditor />
  if (path.startsWith('/admin/products/')) return <ProductEditor id={path.slice('/admin/products/'.length)} />
  return <main className="page"><h1>Page not found</h1><a href="/admin">Back to Dashboard</a></main>
}
