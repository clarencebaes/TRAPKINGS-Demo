import { useState } from 'react'
import { api, image, money, Notice, stock, useStore } from './shared.jsx'

function ProductCard({ product, home = false }) {
  const href = `/products/${product.slug}`
  const photo = <img src={product.images[0]} alt={`${product.name} in ${product.color}`} loading="lazy" />
  if (home) return <article className="product-card home-card">
    <a href={href} className="card-image">{photo}</a>
    <h3>{product.name}</h3><p>{money(product.price)}</p>
    <a className="button light" href={href} aria-label={`View ${product.name}`}>View</a>
  </article>
  return <a className="product-card catalog-card" href={href}>
    <div className="card-image">{photo}</div>
    <h2>{product.name}</h2><strong>{money(product.price)}</strong>
  </a>
}

export function Home() {
  const { products } = useStore()
  const featured = products.filter((product) => product.featured)
  return <main className="home">
    <h1 className="sr-only">TRAPKINGS</h1>
    <img className="home-hero" src={image('hero')} alt="TRAPKINGS wordmark on cracked concrete" fetchPriority="high" />
    <section className="home-products">
      <h2>PRODUCTS</h2>
      <div className="home-grid">{featured.slice(0, 3).map((product) => <ProductCard key={product.slug} product={product} home />)}</div>
    </section>
    <img className="home-banner" src={image('hero')} alt="TRAPKINGS wordmark on a textured background" loading="lazy" />
    <section className="home-products home-more">
      <div className="home-grid">{featured.slice(3, 6).map((product) => <ProductCard key={product.slug} product={product} home />)}</div>
      <a className="button primary view-more" href="/products">View More</a>
    </section>
    <img className="home-banner" src={image('exclusive-white-back')} alt="Front and back views of a white TRAPKINGS tee" loading="lazy" />
    <section className="brand-intro">
      <p>Explore a sample collection of TRAPKINGS streetwear.</p>
      <a className="button primary" href="/about">Learn More</a>
    </section>
  </main>
}

const pageSize = 6
const sizes = ['S', 'M', 'L', 'XL', 'XXL']
const modes = [['new', 'New'], ['asc', 'Price ascending'], ['desc', 'Price descending']]

export function Catalog() {
  const { products, catalogError } = useStore()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('new')
  const [colors, setColors] = useState([])
  const [selectedSizes, setSizes] = useState([])
  const [page, setPage] = useState(1)
  const availableColors = [...new Set(products.map((product) => product.color))]
  const filters = (options, selected, setter) => options.map((option) =>
    <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => {
      setter(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])
      setPage(1)
    }} /> {option}</label>)
  const query = search.trim().toLowerCase()
  const matching = products.filter((product) => {
    if (!`${product.name} ${product.category}`.toLowerCase().includes(query)) return false
    if (colors.length && !colors.includes(product.color)) return false
    return !selectedSizes.length || product.variants.some((variant) => selectedSizes.includes(variant.size) && variant.stock > 0)
  })
  if (sort !== 'new') matching.sort((a, b) => sort === 'asc' ? a.price - b.price : b.price - a.price)
  const count = Math.max(1, Math.ceil(matching.length / pageSize))
  const selectedPage = Math.min(page, count)
  return <main className="catalog-screen">
    <h1 className="sr-only">Products</h1>
    <div className="catalog-layout">
      <aside className="filters">
        <fieldset><legend>Color</legend>{filters(availableColors, colors, setColors)}</fieldset>
        <fieldset><legend>Size</legend>{filters(sizes, selectedSizes, setSizes)}</fieldset>
      </aside>
      <section className="catalog-results" aria-label="Catalog results">
        <div className="catalog-tools">
          <label className="search"><span className="sr-only">Search products</span><input type="search" placeholder="Search"
            value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
          <div className="sort-buttons" aria-label="Sort products">{modes.map(([value, label]) =>
            <button className={`button ${value === sort ? 'primary' : 'muted'}`} aria-pressed={value === sort} key={value}
              onClick={() => { setSort(value); setPage(1) }}>{label}</button>)}</div>
        </div>
        {catalogError && <Notice>Showing the sample catalog. Live availability is unavailable.</Notice>}
        <div className="catalog-grid">
          {matching.slice((selectedPage - 1) * pageSize, selectedPage * pageSize)
            .map((product) => <ProductCard key={product.slug} product={product} />)}
        </div>
        {!matching.length && <p role="status">No products match your search.</p>}
        {count > 1 && <nav className="pagination" aria-label="Catalog pages">
          <button disabled={selectedPage === 1} onClick={() => setPage(selectedPage - 1)}>Previous</button>
          <span aria-live="polite">{selectedPage} / {count}</span>
          <button disabled={selectedPage === count} onClick={() => setPage(selectedPage + 1)}>Next</button>
        </nav>}
      </section>
    </div>
  </main>
}

export function ProductDetail({ slug }) {
  const { products, user, ready, location, navigate, catalogError } = useStore()
  const product = products.find((item) => item.slug === slug)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [size, setSize] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  if (!product) return <main className="page"><h1>Product unavailable</h1><a href="/products">Back to Products</a></main>
  const photos = product.images
  const index = photoIndex % photos.length
  const variant = product.variants.find((item) => item.size === size)
  const available = variant?.stock ?? stock(product)
  async function add() {
    setPending(true)
    setError('')
    try {
      await api(`/cart/${variant.id}/add`, 'POST')
      navigate('/cart')
    } catch (failure) {
      setError(failure.message)
    } finally {
      setPending(false)
    }
  }
  return <main className="product-screen">
    <div className="page product-page">
      <a className="back" href="/products">‹ Back</a>
      <div className="product-layout">
        <section className="gallery" aria-label="Product photos">
          <div className="gallery-image">
            <img src={photos[index]} alt={`${product.name}, ${product.color}, ${['front', 'back'][index] || `photo ${index + 1}`}`} />
            {photos.length > 1 && <>
              <button aria-label="Previous photo" className="previous" onClick={() => setPhotoIndex((index - 1 + photos.length) % photos.length)}>‹</button>
              <button aria-label="Next photo" className="next" onClick={() => setPhotoIndex((index + 1) % photos.length)}>›</button>
            </>}
          </div>
          <div className="gallery-dots">{photos.length > 1 && photos.map((_, i) =>
            <button key={i} aria-label={`Show photo ${i + 1}`} aria-pressed={i === index} onClick={() => setPhotoIndex(i)} />)}</div>
        </section>
        <section className="panel product-info">
          <h1>{product.name}</h1><p className="product-price">{money(product.price)}</p>
          <p className="product-meta"><span>{product.color.toUpperCase()}</span><span>Stock {catalogError ? 'unavailable' : available}</span></p>
          {ready && (user ? <>
            <label className="field">Size
              <select aria-label="Size" value={size} onChange={(event) => setSize(event.target.value)}>
                <option value="">Choose size</option>
                {product.variants.map((item) => <option key={item.size} value={item.size}>{item.size}{item.stock === 0 ? ' — Out of stock' : ''}</option>)}
              </select>
            </label>
            <button className="button primary wide" disabled={!variant?.id || !available || pending || Boolean(catalogError)} onClick={add}>
              {available ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </> : <a className="button primary wide" href={`/sign-in?next=${encodeURIComponent(location.path)}`}>Sign In to Buy</a>)}
          <Notice>{error}</Notice>
          <details open><summary>Description</summary><p>{product.description}</p></details>
        </section>
      </div>
    </div>
  </main>
}
