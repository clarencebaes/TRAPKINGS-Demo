import { useState } from 'react'
import { ActionForm, api, Field, image, money, Notice, orderStatuses, useResource, useStore } from './shared.jsx'

export function AuthPage({ path }) {
  const { location, navigate, setUser } = useStore()
  const registration = path === '/register'
  const forgot = path === '/forgot-password'
  const reset = path === '/reset-password'
  const next = new URLSearchParams(location.search).get('next') || ''
  async function submit(data) {
    if (forgot) {
      await api('/password/forgot', 'POST', data)
      return 'If an account exists for this email, a reset link will be sent.'
    }
    if (reset) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
      await api('/password/reset', 'POST', { ...data, token })
      setUser(null)
      navigate('/sign-in?reset=success')
      return
    }
    const user = await api(registration ? '/register' : '/login', 'POST', data)
    setUser(user)
    const destination = new URL(next, window.location.origin)
    navigate(next.startsWith('/') && destination.origin === window.location.origin
      ? destination.pathname + destination.search : user.role === 'admin' ? '/admin' : '/')
  }
  const title = registration ? 'Create Account' : forgot ? 'Forgot Password' : reset ? 'Reset Password' : 'Sign In'
  const style = registration ? 'registration-screen' : forgot || reset ? 'login-screen recovery-screen' : 'login-screen'
  return <main className={`photo-screen auth-screen ${style}`}>
    <img className="auth-wordmark" src={image('wordmark')} alt="TRAPKINGS — Live the life you want" />
    <ActionForm className="panel auth-form" button={registration ? 'Submit' : forgot ? 'Send reset link' : reset ? 'Reset password' : 'Sign In'} onSubmit={submit}>
      <h1>{title}</h1>
      {path === '/sign-in' && new URLSearchParams(location.search).has('reset') && <Notice error={false}>Your password has been updated.</Notice>}
      {registration && <Field label="Username" name="username" autoComplete="username" minLength="2" maxLength="60" />}
      {!reset && (path === '/sign-in'
        ? <Field label="Email or username" name="email" autoComplete="username" maxLength="254" />
        : <Field label="Email" name="email" type="email" autoComplete="email" maxLength="254" />)}
      {!forgot && <Field label={reset ? 'New password' : 'Password'} name="password" type="password"
        autoComplete={registration || reset ? 'new-password' : 'current-password'} minLength={registration || reset ? 8 : 1} maxLength="128" />}
      {!registration && !forgot && !reset && <div className="auth-links">
        <a href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>Create an account</a>
        <a href="/forgot-password">Forgot password?</a>
      </div>}
    </ActionForm>
  </main>
}

function ShippingFields({ user }) {
  return <>
    <Field label="Full Name" name="full_name" value={user.full_name} autoComplete="name" minLength="2" maxLength="120" />
    <Field label="Shipping Address" name="address" type="textarea" rows="2" value={user.address}
      autoComplete="street-address" minLength="5" maxLength="500" />
    <Field label="Phone" name="phone" type="tel" value={user.phone} autoComplete="tel" minLength="5" maxLength="40" />
    <Field label="Delivery Note" name="note" value={user.note} optional maxLength="250" />
  </>
}

export function Cart() {
  const { user, navigate, loadCatalog } = useStore()
  const { data, error } = useResource('/cart')
  const [updated, setUpdated] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const basket = updated || data
  async function change(variantId, quantity) {
    setBusy(true)
    setActionError('')
    try {
      setUpdated(await api(`/cart/${variantId}`, 'PUT', { quantity }))
    } catch (failure) {
      setActionError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  return <main className="cart-screen">
    <div className="page cart-layout">
      <section className="cart-items">
        <h1>Shopping Cart</h1>
        <Notice>{error || actionError}</Notice>
        {!basket && !error && <p>Loading cart…</p>}
        {basket && !basket.items.length && <p>Your cart is empty. <a href="/products">Browse products</a>.</p>}
        {basket?.items.map((item) => <article className="cart-row" key={item.variant_id}>
          <a href={`/products/${item.slug}`}><img src={item.image} alt="" /></a>
          <div><a href={`/products/${item.slug}`}><strong>{item.name}</strong></a><small>{item.color} · Size {item.size}</small>
            {(!item.available || item.quantity > item.stock) && <small className="negative">Update quantity to match availability</small>}</div>
          <div className="quantity">
            <button aria-label={`Decrease ${item.name} quantity`} disabled={busy || item.quantity <= 1 || !item.available} onClick={() => change(item.variant_id, item.quantity - 1)}>−</button>
            <span aria-label="Quantity">{item.quantity}</span>
            <button aria-label={`Increase ${item.name} quantity`} disabled={busy || !item.available || item.quantity >= Math.min(item.stock, 99)}
              onClick={() => change(item.variant_id, item.quantity + 1)}>+</button>
          </div>
          <span>{money(Number(item.price) * item.quantity)}</span>
          <button className="text-button negative" disabled={busy} onClick={() => change(item.variant_id, 0)}>Remove</button>
        </article>)}
        {Boolean(basket?.items.length) && <p className="cart-subtotal"><strong>Subtotal {money(basket.subtotal)}</strong></p>}
      </section>
      <ActionForm className="panel checkout" button="Check Out"
        disabled={busy || !basket?.items.length || basket.items.some((item) => !item.available || item.quantity > item.stock)}
        onSubmit={async ({ accept_terms, ...data }) => {
          const order = await api('/checkout', 'POST', { ...data, accept_terms: Boolean(accept_terms) })
          loadCatalog()
          navigate(`/account?tab=orders&placed=${order.id}`)
        }}>
        <h2>Checkout</h2>
        <ShippingFields user={user} />
        <dl className="order-totals">
          <div><dt>Subtotal</dt><dd>{money(basket?.subtotal)}</dd></div>
          <div><dt>Shipping</dt><dd>{money(basket?.shipping)}</dd></div>
          <div><dt>Order Total</dt><dd>{money(basket?.total)}</dd></div>
        </dl>
        <p><strong>Payment</strong><br />Cash on Delivery</p>
        <label className="checkbox"><input type="checkbox" name="accept_terms" required /><span>I accept the <a href="/policies/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.</span></label>
      </ActionForm>
    </div>
  </main>
}

const accountTabs = [['orders', 'My Orders'], ['transit', 'In Transit'], ['profile', 'Profile Info'], ['password', 'Change Password'],
  ['shipping', 'Shipping Address'], ['history', 'Order History'], ['support', 'Support/Returns']]

function ShopperOrders({ tab }) {
  const { data, error, reload } = useResource('/orders')
  const { loadCatalog } = useStore()
  const [failure, setFailure] = useState('')
  const [cancel, setCancel] = useState(null)
  const [working, setWorking] = useState(false)
  const matches = data?.filter((order) => tab === 'orders' ? order.status === 'active'
    : tab === 'transit' ? order.status === 'in_transit' : ['received', 'cancelled'].includes(order.status))
  async function updateOrder(id, action) {
    setWorking(true)
    setFailure('')
    try {
      await api(`/orders/${id}/${action}`, 'POST')
      setCancel(null)
      reload()
      if (action === 'cancel') loadCatalog()
    } catch (error) {
      setFailure(error.message)
    } finally {
      setWorking(false)
    }
  }
  return <>
    <Notice>{error || failure}</Notice>
    {!data && !error && <p>Loading orders…</p>}
    {matches?.length === 0 && <p>No orders in this section.</p>}
    {matches?.map((order) => <article className="account-order" key={order.id}>
      <h3>Order #{order.id}</h3>
      <p><strong>{orderStatuses[order.status]}{order.status === 'active' && (order.confirmed ? ' · Confirmed' : ' · Awaiting confirmation')}</strong></p>
      <p>{order.full_name}<br />{order.address}</p>
      <p>Cash on Delivery · {money(order.total)}</p>
      <ul>{order.items.map((item) => <li key={item.variant_id}>{item.product_name} ({item.color}, {item.size}) × {item.quantity}</li>)}</ul>
      {order.status === 'active' && (cancel === order.id ? <div className="button-row">
        <button className="button danger" disabled={working} onClick={() => updateOrder(order.id, 'cancel')}>Confirm cancellation</button>
        <button className="button light" disabled={working} onClick={() => setCancel(null)}>Keep order</button>
      </div> : <button className="button danger" onClick={() => setCancel(order.id)}>Cancel order</button>)}
      {order.status === 'in_transit' && <button className="button primary" disabled={working}
        onClick={() => updateOrder(order.id, 'receive')}>Order Received</button>}
    </article>)}
  </>
}

export function AccountPage({ staff = false }) {
  const { user, setUser, location } = useStore()
  const query = new URLSearchParams(location.search)
  const requestedTab = query.get('tab')
  const tabs = staff ? accountTabs.filter(([key]) => ['profile', 'password'].includes(key)) : accountTabs
  const tab = tabs.some(([key]) => key === requestedTab) ? requestedTab : 'profile'
  const title = tabs.find(([key]) => key === tab)[1]
  const base = staff ? '/admin/profile' : '/account'
  return <main className={`account-screen ${staff ? 'staff-profile' : ''}`}>
    <div className="page account-page">
      <h1>Welcome Back, {user.username}!</h1>
      <div className="account-layout">
        <aside>
          {!staff && <div className="account-shortcuts">{tabs.slice(0, 2).map(([key, label]) =>
            <a className="panel" href={`${base}?tab=${key}`} key={key} aria-current={tab === key ? 'page' : undefined}>{label}</a>)}</div>}
          <nav className="panel account-menu" aria-label="Account settings">
            <h2>Account Settings</h2>
            {(staff ? tabs : tabs.slice(2)).map(([key, label]) =>
              <a key={key} href={`${base}?tab=${key}`} aria-current={tab === key ? 'page' : undefined}>{label}</a>)}
          </nav>
        </aside>
        <section className="panel account-panel" key={tab}>
          <h2>{title}</h2>
          {query.has('placed') && <Notice error={false}>Order #{query.get('placed')} placed successfully.</Notice>}
          {['orders', 'transit', 'history'].includes(tab) && <ShopperOrders tab={tab} />}
          {tab === 'profile' && <ActionForm button="Save Profile Information" success="Profile updated." onSubmit={async (data) => {
            setUser(await api('/me', 'PUT', data))
          }}>
            <Field label="Username" name="username" value={user.username} minLength="2" maxLength="60" />
            <Field label="Email" name="email" type="email" value={user.email} maxLength="254" />
          </ActionForm>}
          {tab === 'shipping' && <ActionForm button="Save Shipping Information" success="Shipping information saved." onSubmit={async (data) => {
            setUser(await api('/me/shipping', 'PUT', data))
          }}><ShippingFields user={user} /></ActionForm>}
          {tab === 'password' && <ActionForm button="Change Password" success="Password updated." onSubmit={async (data, form) => {
            await api('/me/password', 'PUT', data)
            form.reset()
          }}>
            <Field label="Current password" name="current" type="password" autoComplete="current-password" maxLength="128" />
            <Field label="New password" name="password" type="password" autoComplete="new-password" minLength="8" maxLength="128" />
          </ActionForm>}
          {tab === 'support' && <ActionForm button="Send Request" onSubmit={async (data, form) => {
            const response = await api('/support', 'POST', data)
            form.reset()
            return response.message
          }}>
            <p><a href="/policies/returns">Return &amp; Exchange Policy</a></p>
            <label className="field">Request type<select name="kind"><option value="support">Support</option><option value="return">Return or exchange</option></select></label>
            <Field label="Message" name="message" type="textarea" rows="5" minLength="5" maxLength="3500" />
          </ActionForm>}
        </section>
      </div>
    </div>
  </main>
}
