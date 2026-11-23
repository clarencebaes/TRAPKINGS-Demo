import { createContext, useContext, useEffect, useState } from 'react'

export const Store = createContext(null)
export const useStore = () => useContext(Store)
export const image = (name) => `/images/${name}.webp`
export const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(Number(value || 0))
export const orderStatuses = { active: 'Active', in_transit: 'In Transit', received: 'Received', cancelled: 'Cancelled' }
export const stock = (product) => product.variants.reduce((count, variant) => count + variant.stock, 0)

export async function api(path, method = 'GET', data) {
  const headers = data && !(data instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: headers ? JSON.stringify(data) : data,
  })
  if (response.status === 204) return null
  const body = await response.json().catch(() => null)
  if (!response.ok || body === null) {
    const detail = body?.detail
    throw Object.assign(new Error(typeof detail === 'string' ? detail :
      Array.isArray(detail) ? detail.map((issue) => `${issue.loc.at(-1).replaceAll('_', ' ')} — ${issue.msg}`).join('. ') :
      'The store could not be reached. Please try again.'), { status: response.status })
  }
  return body
}

export function useResource(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!path) return
    let current = true
    api(path).then((result) => {
      if (current) {
        setData(result)
        setError('')
      }
    }).catch((failure) => {
      if (current) setError(failure.message)
    })
    return () => { current = false }
  }, [path, revision])
  return { data, error, reload: () => setRevision((value) => value + 1) }
}

export function ActionForm({ onSubmit, children, className, button = 'Save changes', success = '', disabled = false }) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState(null)
  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    setPending(true)
    setMessage(null)
    try {
      const result = await onSubmit(Object.fromEntries(new FormData(form)), form)
      if (result || success) setMessage({ text: result || success })
    } catch (error) {
      setMessage({ text: error.message, error: true })
    } finally {
      setPending(false)
    }
  }
  return <form className={className} onSubmit={submit}>
    {children}
    {message && <Notice error={message.error}>{message.text}</Notice>}
    <button className="button primary" disabled={pending || disabled}>{pending ? 'Please wait…' : button}</button>
  </form>
}

export function Notice({ children, error = true }) {
  if (!children) return null
  return <p className={error ? 'notice error' : 'notice success'} role={error ? 'alert' : 'status'}>{children}</p>
}

export function Field({ label, name, value, type = 'text', optional = false, ...props }) {
  const Control = type === 'textarea' ? 'textarea' : 'input'
  return <label className="field"><span>{label}</span>
    <Control name={name} type={Control === 'input' ? type : undefined} defaultValue={value}
      required={!optional} {...props} />
  </label>
}

export function AuthRequired({ children, staff = false }) {
  const { user, ready, location } = useStore()
  if (!ready) return <main className="page"><p>Loading account…</p></main>
  if (!user) return <main className="page"><h1>Sign in to continue</h1>
    <a className="button primary" href={`/sign-in?next=${encodeURIComponent(location.path + location.search)}`}>Sign in</a>
  </main>
  if (staff && user.role !== 'admin') return <main className="page"><h1>Staff access required</h1><a href="/">Back to Home</a></main>
  return children
}
