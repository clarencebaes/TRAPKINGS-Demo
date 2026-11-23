import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import catalogSeed from '../../database/catalog.json'
import { api, AuthRequired, image, Notice, Store, useStore } from './shared.jsx'
import { Catalog, Home, ProductDetail } from './storefront.jsx'
import { About, Contact, FAQ, Policy, SizeChart, TKBot } from './information.jsx'
import { AccountPage, AuthPage, Cart } from './shopper.jsx'
import { AdminPage } from './staff.jsx'
import './styles.css'

const shopNavigation = [['⌂', 'Home', '/'], ['▦', 'Products', '/products'], ['✉', 'Contact', '/contact'],
  ['ⓘ', 'About', '/about'], ['?', 'FAQs', '/faq'], ['▰', 'Size Chart', '/size-chart']]
const staffNavigation = [['⌂', 'Home', '/admin'], ['▤', 'Order', '/admin/orders'],
  ['＋', 'Upload Product', '/admin/products/new'], ['▦', 'Inventory', '/admin/inventory'],
  ['♙', 'Manage Users', '/admin/users'], ['✉', 'Messages', '/admin/messages']]

function Header({ staff }) {
  const { user, setUser, navigate, location } = useStore()
  const [error, setError] = useState('')
  async function logout() {
    try {
      await api('/logout', 'POST')
      setUser(null)
      navigate('/')
    } catch (failure) {
      setError(failure.message)
    }
  }
  return <header className="site-header">
    <a href={staff ? '/admin' : '/'} className="monogram" aria-label="TRAPKINGS home">𝕿𝕶</a>
    <nav aria-label={staff ? 'Staff navigation' : 'Main navigation'}>
      {(staff ? staffNavigation : shopNavigation).map(([icon, label, href]) =>
        <a key={href} href={href} aria-current={location.path === href ? 'page' : undefined}>
          <span aria-hidden="true">{icon}</span> {label}
        </a>)}
    </nav>
    <div className="account-nav">
      {user ? <>
        {user.role === 'admin' && !staff && <a className="button light" href="/admin">Dashboard</a>}
        <button className="button light" onClick={logout}>Log Out</button>
        <a className="nav-icon" href={staff ? '/admin/profile' : '/account'} aria-label="Account">◎</a>
        {!staff && <a className="nav-icon" href="/cart" aria-label="Shopping cart">🛒</a>}
      </> : <>
        <a className="button light" href="/sign-in">Sign in</a>
        <a className="button primary" href="/register">Register</a>
      </>}
    </div>
    <Notice>{error}</Notice>
  </header>
}

function Footer() {
  return <footer>
    <div className="footer-body">
      <section><img src={image('wordmark')} alt="TRAPKINGS — Live the life you want" />
        <p>TRAPKINGS streetwear storefront demo.</p></section>
      <section><h2>Shopping Support</h2><a href="/contact">Send a message</a></section>
      <section><h2>Customer Care</h2><a href="/faq">Frequently asked questions</a><a href="/size-chart">Size chart</a>
        <a href="/policies/returns">Return &amp; Exchange Policy</a></section>
    </div>
    <div className="footer-bar"><span>© TRAPKINGS</span><div>
      <a href="/policies/privacy">Privacy Policy</a><a href="/policies/terms">Terms &amp; Conditions</a><a href="/policies/service">Terms of Service</a>
    </div></div>
  </footer>
}

function View({ path }) {
  if (path === '/') return <Home />
  if (path === '/products') return <Catalog />
  if (path.startsWith('/products/')) return <ProductDetail key={path} slug={path.slice(10)} />
  if (path === '/about') return <About />
  if (path === '/contact') return <Contact />
  if (path === '/faq') return <FAQ />
  if (path === '/size-chart') return <SizeChart />
  if (path.startsWith('/policies/')) return <Policy key={path} policy={path.slice(10)} />
  if (['/sign-in', '/register', '/forgot-password', '/reset-password'].includes(path)) return <AuthPage key={path} path={path} />
  if (path === '/cart') return <AuthRequired><Cart /></AuthRequired>
  if (path === '/account') return <AuthRequired><AccountPage /></AuthRequired>
  if (path === '/admin' || path.startsWith('/admin/')) return <AuthRequired staff><AdminPage key={path} path={path} /></AuthRequired>
  return <main className="page"><h1>Page not found</h1><a href="/">Return to home</a></main>
}

function readLocation() {
  return { path: window.location.pathname.replace(/\/$/, '') || '/', search: window.location.search }
}

function App() {
  const [location, setLocation] = useState(readLocation)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [products, setProducts] = useState(catalogSeed)
  const [catalogError, setCatalogError] = useState('')
  function navigate(href) {
    const previous = window.location.pathname
    window.history.pushState({}, '', href)
    setLocation(readLocation())
    if (window.location.pathname !== previous) window.scrollTo(0, 0)
  }
  async function loadCatalog() {
    try {
      setProducts(await api('/products'))
      setCatalogError('')
    } catch (failure) {
      setCatalogError(failure.message)
    }
  }
  useEffect(() => {
    api('/me').then(setUser).catch(() => setUser(null)).finally(() => setReady(true))
    loadCatalog()
    const pop = () => setLocation(readLocation())
    const click = (event) => {
      const link = event.target.closest('a[href]')
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return
      const url = new URL(link.href)
      if (url.origin !== window.location.origin || !link.getAttribute('href').startsWith('/')) return
      event.preventDefault()
      navigate(url.pathname + url.search + url.hash)
    }
    window.addEventListener('popstate', pop)
    document.addEventListener('click', click)
    return () => {
      window.removeEventListener('popstate', pop)
      document.removeEventListener('click', click)
    }
  }, [])
  const staff = location.path === '/admin' || location.path.startsWith('/admin/')
  const auth = ['/sign-in', '/register', '/forgot-password', '/reset-password'].includes(location.path)
  return <Store.Provider value={{ user, ready, setUser, location, navigate, products, catalogError, loadCatalog }}>
    <a className="skip" href="#main">Skip to content</a>
    <Header staff={staff && user?.role === 'admin'} />
    <div id="main" tabIndex="-1"><View path={location.path} /></div>
    {!staff && !auth && location.path !== '/products' && <Footer />}
    {!staff && !auth && <TKBot />}
  </Store.Provider>
}

createRoot(document.getElementById('root')).render(<App />)
