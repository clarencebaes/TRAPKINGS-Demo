import { useState } from 'react'
import { ActionForm, api, Field, image, useStore } from './shared.jsx'

export function About() {
  return <main className="photo-screen about-screen">
    <div className="about-content">
      <h1 className="panel">ABOUT TRAPKINGS</h1>
      <section className="panel">
        <p>This storefront demo shows how shoppers browse streetwear and how store staff manage the catalog and fulfill orders.</p>
        <p>The debut Gothic Cross collection established the brand’s look. The Reflective collection explores light-reactive designs, drawing on street culture and entrepreneurial ambition.</p>
        <p className="about-tagline">Live the life you want.</p>
      </section>
    </div>
  </main>
}

export function Contact() {
  return <main className="photo-screen contact-screen">
    <div className="contact-layout">
      <ActionForm className="panel" button="Send Message" onSubmit={async (data, form) => {
        const result = await api('/contact', 'POST', data)
        form.reset()
        return result.message
      }}>
        <h1>Contact</h1>
        <Field label="Name" name="name" maxLength="120" />
        <Field label="Email" name="email" type="email" maxLength="254" />
        <Field label="Message" name="message" type="textarea" rows="4" minLength="5" maxLength="3500" />
      </ActionForm>
      <section className="panel contact-info">
        <h2>Shopping Support</h2>
        <p>Use the form to send a test message to this demo's staff dashboard.</p>
        <p><a href="/faq">FAQs and shopping support</a></p>
        <p><a href="/policies/returns">Return &amp; Exchange Policy</a></p>
      </section>
    </div>
  </main>
}

const faqs = [
  ['Account & Profile', [
    ['How do I register for an account?', 'Select Register and enter a username, email address, and password.'],
    ['How do I sign in?', 'Select Sign in and enter your email address or username, then your password.'],
    ['I forgot my password. What should I do?', 'Use Forgot password on the sign-in screen to request a reset link.'],
    ['How do I update my profile information?', 'Sign in and open Profile Info to change your username or email address.'],
    ['How do I change my password?', 'Open Change Password from Account Settings. Enter your current password and choose a new one.'],
  ]],
  ['Orders & Shopping', [
    ['How do I add products to my cart?', 'Sign in, select an available size from the product page, and choose Add to Cart.'],
    ["Why can't I add items to my cart or choose a size?", 'Size selection and cart are available after sign-in. Sold-out sizes are marked on the product page.'],
    ['How do I check out?', 'Review your cart, fill in your delivery details, and accept the terms before placing the order.'],
    ['What payment methods do you accept?', 'Cash on Delivery (COD).'],
    ['How do I view my orders or order status?', 'Open your account and choose My Orders, In Transit, or Order History.'],
    ['Can I cancel or change my order?', 'You can cancel an active order from My Orders before it ships.'],
  ]],
  ['Shipping, Returns & Support', [
    ['How do I update my shipping address?', 'Save your address under Account Settings or enter the delivery details when you check out.'],
    ['How much is the shipping fee?', 'Your cart displays the shipping charge before you submit your order.'],
    ['How do I request a return or exchange?', 'Open Support/Returns in your account. Include your order number and describe the item and issue.'],
    ['Where can I review the exchange policy?', 'Open Return & Exchange Policy in the footer.'],
  ]],
  ['Policies & Terms', [
    ['Where can I read the store policies?', 'Find the Privacy Policy, Terms & Conditions, and Terms of Service in the footer.'],
    ['Where can I find garment measurements?', 'Open Size Chart from the navigation.'],
  ]],
]

export function FAQ() {
  return <main className="photo-screen faq-screen">
    <article className="panel faq-panel">
      <h1>FREQUENTLY ASKED QUESTIONS</h1>
      {faqs.map(([group, questions]) => <section key={group}>
        <h2>{group}</h2>
        <div className="faq-grid">{questions.map(([question, answer]) =>
          <div key={question}><h3>{question}</h3><p>{answer}</p></div>)}</div>
      </section>)}
    </article>
  </main>
}

const teeSizes = [['S', 27, 20, 7.5], ['M', 28, 21, 8], ['L', 29, 22, 8.5], ['XL', 30, 23, 9.5], ['XXL', 31, 24, 9.5]]
const shortsSizes = [['S', 15, '28–30', 12], ['M', 16, '31–33', 13.75], ['L', 17, '34–36', 13.75], ['XL', 17, '37–39', 14.5]]
const centimeters = (value) => String(value).split('–').map((number) => Number((Number(number) * 2.54).toFixed(3))).join('–')

function SizeTable({ shorts = false, metric = false, className = '' }) {
  const name = shorts ? 'Shorts' : 'T-Shirt'
  return <section className={`size-card ${className}`}>
    <div className="size-masthead">TRAPKINGS</div>
    <h2>SIZE CHART</h2><p className="script-text" aria-hidden="true">Guide</p>
    <table>
      <caption><strong>{name}</strong><span>{metric ? 'CM' : 'IN'}</span></caption>
      <thead><tr>{['Size', 'Length', 'Width', shorts ? 'Leg hole' : 'Sleeve'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{(shorts ? shortsSizes : teeSizes).map(([size, ...values]) => <tr key={size}>
        <th scope="row">{size}</th>{values.map((value, i) => <td key={i}>{metric ? centimeters(value) : value}</td>)}
      </tr>)}</tbody>
    </table>
    <p className="size-units">Sizes in {metric ? 'centimeters' : 'inches'}</p>
  </section>
}

export function SizeChart() {
  return <main className="photo-screen size-screen">
    <h1 className="panel">Size Chart</h1>
    <div className="size-grid">
      <SizeTable /><SizeTable metric />
      <div className="size-art"><img src={image('shorts-size-guide')} alt="" /><SizeTable shorts className="sr-only" /></div>
      <SizeTable shorts metric />
    </div>
  </main>
}

const policies = {
  privacy: { title: 'Privacy Policy', sections: [
    ['Information we collect', 'We use the account details you provide, your delivery information, your order history, and any support messages you send.'],
    ['How we use your information', 'We use your information to process and deliver orders, manage your account, and respond to support requests.'],
    ['Sharing information', 'The store may share order information with shipping partners or disclose it when required by law.'],
    ['Your account', 'Use Profile Info and Shipping Address to update your information. Contact us for help with privacy requests.'],
    ['Security and updates', 'Passwords are stored as hashes. Updates to this policy are posted here.'],
  ] },
  terms: { title: 'Terms & Conditions', sections: [
    ['Orders', 'Please check your selection and delivery details before placing your order. Availability is checked at checkout.'],
    ['Payment', 'The storefront accepts Cash on Delivery. Your cart shows the item subtotal, shipping fee, and order total.'],
    ['Cancellations', 'You may cancel an active order before it ships. Use My Orders to check its status.'],
  ] },
  service: { title: 'Terms of Service', sections: [
    ['Eligibility', 'You must be at least 13 years old and able to enter into a binding agreement to use the service.'],
    ['Account registration', 'Provide accurate account details and keep your password private.'],
    ['Using TRAPKINGS', 'Use the store to browse products, place orders, and manage your account. Do not interfere with other accounts or the operation of the store.'],
    ['Service availability', 'The store may suspend parts of the website while making updates or resolving technical issues.'],
    ['Brand content', 'TRAPKINGS designs, trademarks, logos, and website content require permission for reuse.'],
    ['Questions', 'Use the Contact page to reach the store about an order or your account.'],
  ] },
  returns: { title: 'Return & Exchange Policy', sections: [
    ['Eligible exchanges', 'Request an exchange within seven days if you receive a damaged or defective item, or the wrong product or size. The item must be unworn and unwashed with original tags and packaging. Other sizing requests are reviewed individually.'],
    ['Exchange shipping', 'Customers cover shipping both ways for exchanges unrelated to a store error.'],
    ['Make a request', 'Sign in, open Support/Returns, and send your order number and a description of the issue.'],
  ] },
}

export function Policy({ policy }) {
  const entry = policies[policy]
  if (!entry) return <main className="page"><h1>Policy unavailable</h1><a href="/faq">See FAQs</a></main>
  return <main className="page policy-page">
    <h1>{entry.title}</h1>
    {entry.sections.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}
  </main>
}

const topics = {
  'What’s new?': ['See the latest products and available sizes in the catalog.', '/products', 'Shop products'],
  'How to order?': ['Sign in, choose a size, add the item to your cart, and check out with Cash on Delivery.', '/products', 'Browse products'],
  'Available sizes': ['T-shirts run from S to XXL and shorts from S to XL. Check each listing for stock.', '/size-chart', 'Open Size Chart'],
  'FAQs': ['Find answers about accounts, delivery, and exchanges.', '/faq', 'Read FAQs'],
  'Track order': ['Sign in and open your account to check order status.', '/account', 'My Orders'],
  'Contact support': ['Send a message from the Contact page.', '/contact', 'Contact'],
}

export function TKBot() {
  const { products } = useStore()
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const latest = products[0]
  const answer = topic === 'What’s new?' && latest
    ? [`See ${latest.name}, the latest item in the catalog.`, `/products/${latest.slug}`, 'View product']
    : topics[topic]
  return <aside className="chat-widget" aria-label="Shopping assistant">
    {open && <section id="tkbot" className="chat-window">
      <div className="chat-heading"><strong>TKBot</strong><button aria-label="Close assistant" onClick={() => setOpen(false)}>×</button></div>
      <div className="chat-inner"><p className="chat-message">Hey! I’m TK, the TRAPKINGS shopping assistant. How can I help you?</p>
        {answer && <p className="chat-reply" role="status">{answer[0]} <a href={answer[1]} onClick={() => setOpen(false)}>{answer[2]}</a></p>}
        <div className="chat-topics">{Object.keys(topics).map((label) =>
          <button className="button muted" key={label} onClick={() => setTopic(label)}>{label}</button>)}</div>
      </div>
    </section>}
    <button className="chat-trigger" aria-label={open ? 'Close TKBot' : 'Open TKBot'} aria-expanded={open} aria-controls={open ? 'tkbot' : undefined}
      onClick={() => setOpen(!open)}><img src={image('tkbot')} alt="" /></button>
  </aside>
}
