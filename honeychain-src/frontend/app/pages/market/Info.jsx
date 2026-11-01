import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useDocTitle } from '../../hooks';
import { Crumbs } from '../../components/market/parts';

export function HowItWorks() {
  useDocTitle('How it works');
  const steps = [
    ['Collector records a batch', 'In the Producer Portal a collector enters the product, quantity, place and handling, then submits it. The batch gets one ID and one QR code.'],
    ['Centre checks what it can', 'The collection centre can add instrument readings, storage and packaging. Those stay labelled as centre checks. They are not an officer approval.'],
    ['Officer reviews the record', 'An authorised officer approves, asks for a correction, rejects or suspends. That status is written on the same batch.'],
    ['The marketplace reads it live', 'Buyers see the status that is in the database at that moment. A suspension or rejection shows on the next open, with a warning.'],
    ['Buyer asks, seller answers', 'A buyer sends an enquiry or a purchase request. The centre accepts, declines or counters. An accepted request becomes an order. No payment is taken in this prototype.'],
    ['Anyone can scan the QR', 'The code only opens the public record. It does not, by itself, prove the pack is genuine. Unknown IDs are shown as not found.'],
  ];
  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'How it works' }]} />
        <h1>How a batch moves</h1>
        <p>The marketplace does not keep its own copy of a batch. It shows the record the producer and the officer already share.</p>
      </div></div>
      <div className="wrap" style={{ paddingTop: 28 }}>
        <div className="mk-steps">
          {steps.map(([h, p]) => <article className="mk-step" key={h}><h3>{h}</h3><p className="muted">{p}</p></article>)}
        </div>
        <section className="mk-sec">
          <div className="hd"><h2>What a badge does and does not mean</h2></div>
          <div className="mk-feat">
            {[['building', 'Centre checked', 'A collection centre recorded a measurement. It is not a laboratory result and not an officer approval.'],
              ['flask', 'Lab tested', 'Shown only when a laboratory report reference is stored on the batch.'],
              ['shieldcheck', 'Verified by officer', 'An authorised officer approved the evidence on file. It is not a statutory certificate.'],
              ['ban', 'Rejected or suspended', 'The batch stays visible by its ID, with a warning, and cannot take a new purchase request.']].map(([ic, h, p]) => (
              <div key={h}><div className="ic"><Icon name={ic} /></div><h3>{h}</h3><p>{p}</p></div>))}
          </div>
        </section>
        <section className="mk-band">
          <div><h2>Try it with a demo batch</h2><p>AV-WB-HON-0015 is officer-verified with a demo lab note. AV-WB-TAM-0026 is suspended.</p></div>
          <div className="row wrap"><Link className="btn gold" to="/market/verify/AV-WB-HON-0015">Verify honey batch</Link><Link className="btn ghost" to="/market/verify/AV-WB-TAM-0026">Open suspended batch</Link></div>
        </section>
      </div>
    </>
  );
}

export function About() {
  useDocTitle('About AranyaValue');
  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'About' }]} />
        <h1>About AranyaValue</h1>
        <p>A forest produce quality-to-price and traceability platform. West Bengal is the first catalogue. The same structure can hold other states, products and buyer networks.</p>
      </div></div>
      <div className="wrap" style={{ paddingTop: 28 }}>
        <div className="mk-split">
          <section className="mk-panel">
            <h3>What this marketplace is for</h3>
            <p>Buyers can see which batch they are looking at, which centre handled it, what was measured, who measured it, and what an officer decided. Price on a card is indicative. It is not a guaranteed purchase price, and demo prices are labelled illustrative.</p>
            <p className="mt12">Collection and trade of some non-timber forest products is regulated. The catalogue records a permissions note where one is known, and it does not invent a legal position.</p>
          </section>
          <section className="mk-panel">
            <h3>Three things that stay separate</h3>
            <dl className="mk-facts">
              <dt>Government licence</dt><dd>Shown only when a registration number is stored for that centre.</dd>
              <dt>AranyaValue accreditation</dt><dd>A private programme run inside this application. It is not a government licence. A suspended centre loses the accredited mark.</dd>
              <dt>Officer verification</dt><dd>A decision on one batch, by an authorised officer, on the evidence filed for that batch.</dd>
            </dl>
          </section>
        </div>
        <section className="mk-sec">
          <div className="hd"><h2>The three portals</h2></div>
          <div className="mk-feat" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <div><div className="ic"><Icon name="leaf" /></div><h3>Producer</h3><p>Collectors and centres create batches, attach evidence and reply to enquiries from the Marketplace Desk.</p><Link className="btn sm mt12" to="/login?portal=collector">Producer sign in</Link></div>
            <div><div className="ic"><Icon name="shield" /></div><h3>Officer</h3><p>Officers approve, reject, suspend and reinstate. The marketplace has no separate batch table to update.</p><Link className="btn sm mt12" to="/login?portal=officer">Officer sign in</Link></div>
            <div><div className="ic"><Icon name="store" /></div><h3>Marketplace</h3><p>Open to anyone for browsing and QR checks. Buyers sign in, or use the labelled Demo Buyer, to enquire.</p><Link className="btn sm mt12" to="/market/products">Browse produce</Link></div>
          </div>
        </section>
      </div>
    </>
  );
}
