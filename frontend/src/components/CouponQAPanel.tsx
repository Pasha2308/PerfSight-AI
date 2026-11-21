import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, LoaderCircle, Search, ShoppingBag } from 'lucide-react';
import { discoverCouponOffers, runCouponQA } from '../api';

type Category = 'fashion' | 'electronics';
type Offer = { goid: string; merchant: string; title: string; code: string; description: string; store_page: string; verified_on_listing: boolean; listing_success_text: string };
type Outcome = Offer & { product_query: string; verdict: string; coupon_claim: string; retailer_probe?: { url: string; host: string; http_status?: number; title?: string; blocked_or_login_gate?: boolean }; product_probe?: { url: string; http_status?: number; query: string }; product_detail?: { title?: string; http_status?: number }; checkout_probe?: { coupon_accepted: boolean; discount_amount_inr?: number | null; http_status?: number; url?: string }; evidence: Record<string, string> };
type Report = { run_id: string; verdict: string; purchase_performed: boolean; login_attempted: boolean; offers: Outcome[]; evidence: { report: string } };

export function CouponQAPanel() {
  const [category, setCategory] = useState<Category>('fashion');
  const [query, setQuery] = useState('men\'s cotton shirt');
  const [offerQueries, setOfferQueries] = useState<Record<string, string>>({});
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const discover = async (nextCategory = category) => {
    setLoading(true); setError(''); setReport(null); setOffers([]); setSelected([]);
    try {
      const result = await discoverCouponOffers(nextCategory);
      const eligible = (result.offers as Offer[]).filter(x => x.code && !/^ACTIVATE OFFER|DEAL ACTIVATED|NO COUPON REQUIRED$/i.test(x.code));
      setOffers(eligible);
      setSelected(eligible.slice(0, 2).map(x => x.goid));
      setOfferQueries(Object.fromEntries(eligible.map(x => [x.goid, nextCategory === 'fashion' ? 'men\'s cotton shirt' : 'wireless earbuds'])));
    } catch (err: any) { setError(err?.response?.data?.detail || err?.message || 'Could not load GrabOn offers'); }
    finally { setLoading(false); }
  };

  const run = async () => {
    setLoading(true); setError(''); setReport(null);
    try { setReport(await runCouponQA(category, selected.map(goid => ({ goid, product_query: offerQueries[goid] || query })), query)); }
    catch (err: any) { setError(err?.response?.data?.detail || err?.message || 'Coupon QA failed'); }
    finally { setLoading(false); }
  };

  const selectedCount = useMemo(() => selected.length, [selected]);
  const changeCategory = (next: Category) => {
    setCategory(next);
    setQuery(next === 'fashion' ? 'men\'s cotton shirt' : 'wireless earbuds');
    void discover(next);
  };

  return <div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><ShoppingBag size={18} color="var(--feuji-red)" /><strong>GrabOn Coupon QA</strong></div>
    <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.6 }}>Discover current GrabOn offers, choose a product for each offer, then check the code in an isolated retailer cart and checkout. The run stops before sign-in details, shipping information, or payment.</p>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      {(['fashion', 'electronics'] as const).map(item => <button key={item} onClick={() => changeCategory(item)} style={{ padding: '8px 14px', borderRadius: 7, cursor: 'pointer', textTransform: 'capitalize', border: `1px solid ${category === item ? 'var(--feuji-red)' : 'var(--border)'}`, color: category === item ? 'var(--feuji-red)' : 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>{item}</button>)}
      <button className="btn btn-primary" onClick={() => discover()} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{loading ? <LoaderCircle size={14} className="spinner" /> : <Search size={14} />} Discover live offers</button>
    </div>
    <label htmlFor="coupon-product" style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600 }}>Default product query</label>
    <input id="coupon-product" value={query} onChange={e => setQuery(e.target.value)} maxLength={120} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }} />
    {offers.length > 0 && <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11.5 }}><span>Live GrabOn listing · choose up to 8 offers</span><span>{selectedCount} selected</span></div>
      {offers.slice(0, 16).map(offer => <label key={offer.goid} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, border: '1px solid var(--border)', borderRadius: 7, padding: 10, cursor: 'pointer', background: selected.includes(offer.goid) ? 'rgba(224,64,30,.035)' : 'transparent' }}>
        <input type="checkbox" checked={selected.includes(offer.goid)} disabled={!selected.includes(offer.goid) && selected.length >= 8} onChange={e => setSelected(old => e.target.checked ? [...old, offer.goid] : old.filter(id => id !== offer.goid))} style={{ marginTop: 3 }} />
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 600, fontSize: 12.5 }}>{offer.merchant} · {offer.title}</span><span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11.5, marginTop: 3 }}>{offer.code} {offer.listing_success_text ? `· GrabOn: ${offer.listing_success_text}` : ''}</span><span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>{offer.description.slice(0, 220)}</span>{selected.includes(offer.goid) && <input aria-label={`Product query for ${offer.merchant}`} value={offerQueries[offer.goid] || query} onChange={e => setOfferQueries(old => ({ ...old, [offer.goid]: e.target.value }))} maxLength={120} style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 11.5 }} />}</span>
      </label>)}
      <button className="btn btn-primary" onClick={run} disabled={loading || selected.length === 0 || !query.trim()} style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 4 }}>{loading ? <><LoaderCircle size={14} className="spinner" /> Running checks…</> : `Test ${selectedCount} selected offer${selectedCount === 1 ? '' : 's'}`}</button>
    </div>}
    {error && <div role="alert" style={{ marginTop: 14, color: 'var(--feuji-red)', fontSize: 12.5 }}>{error}</div>}
    {report && <div style={{ marginTop: 18 }}>
      <div style={{ padding: 12, borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 12.5 }}><strong>{report.verdict.replaceAll('_', ' ')}</strong><div style={{ color: 'var(--text-muted)', marginTop: 4 }}>One item is added to an isolated cart; the code is submitted at checkout. No login, personal details, or payment are entered.</div></div>
      {report.offers.map(item => <div key={item.goid} style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 9, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 650, fontSize: 12.5 }}>{item.verdict === 'coupon_applied_discount_confirmed' ? <CheckCircle size={14} color="var(--accent-green)" /> : <AlertTriangle size={14} color="var(--feuji-amber)" />}{item.merchant} · {item.code || 'Deal'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {item.verdict.replaceAll('_', ' ')}</span></div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>{item.title} — {item.coupon_claim}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 11.5 }}>
          {item.retailer_probe && <span>Retailer: HTTP {item.retailer_probe.http_status ?? 'n/a'} · {item.retailer_probe.host}</span>}
          {item.product_probe && <span>Product search: HTTP {item.product_probe.http_status ?? 'n/a'}</span>}
          {item.product_detail && <span>Product: {item.product_detail.title} · HTTP {item.product_detail.http_status ?? 'n/a'}</span>}
          {item.checkout_probe && <strong style={{ color: item.checkout_probe.coupon_accepted ? 'var(--accent-green)' : 'var(--feuji-red)' }}>{item.checkout_probe.coupon_accepted ? `Accepted · ₹${item.checkout_probe.discount_amount_inr?.toFixed(2)} off` : 'Not confirmed at checkout'}</strong>}
          {Object.entries(item.evidence).map(([label, path]) => <a key={label} href={`http://localhost:8000${path}`} target="_blank" rel="noreferrer" style={{ color: 'var(--feuji-red)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>{label.replaceAll('_', ' ')} <ExternalLink size={11} /></a>)}
        </div>
      </div>)}
      <a href={`http://localhost:8000${report.evidence.report}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, color: 'var(--feuji-red)', fontSize: 12 }}>Open full JSON report <ExternalLink size={11} /></a>
    </div>}
  </div>;
}
