import { useState } from 'react';
import { Armchair, Ticket } from 'lucide-react';
import { api } from './api.js';
import { Notice, Select } from './components.jsx';

export function Booking({ cinemas }) {
  const [selection, setSelection] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cinemaId = selection || String(cinemas[0]?.id ?? '');
  const cinema = cinemas.find(({ id }) => id === Number(cinemaId));

  function clearQuote() {
    setQuote(null);
    setError('');
  }

  async function getQuote(event) {
    event.preventDefault();
    const groupSize = new FormData(event.currentTarget).get('groupSize');
    clearQuote();
    setLoading(true);
    try {
      setQuote(await api('/cinemas/' + cinemaId + '/booking?' + new URLSearchParams({ groupSize })));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="plan-grid booking-grid">
      <section className="panel" aria-labelledby="booking-title">
        <div className="panel-heading">
          <span className="panel-icon"><Ticket size={19} aria-hidden="true" /></span>
          <h2 id="booking-title">Booking quote</h2>
        </div>
        <form className="booking-form" onSubmit={getQuote}>
          <div className="field">
            <label htmlFor="cinema-select">Cinema</label>
            <Select id="cinema-select" value={cinemaId} disabled={loading || !cinemas.length}
              onChange={(event) => {
                setSelection(event.target.value);
                clearQuote();
              }}>
              {!cinemas.length && <option value="">No cinemas available</option>}
              {cinemas.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </div>
          {cinema && (
            <div className="bundle-options">
              <span>Available bundles</span>
              <div>{cinema.bundleSizes.map((size) => <span className="bundle-tag" key={size}>{size} seats</span>)}</div>
            </div>
          )}
          <label className="field">
            <span>Group size</span>
            <input name="groupSize" type="number" min="1" max="10000" step="1" placeholder="e.g. 6"
              onChange={clearQuote} disabled={loading || !cinema} required />
          </label>
          <button className="button button-primary" disabled={loading || !cinema}>
            <Ticket size={17} aria-hidden="true" />
            {loading ? 'Finding bundles…' : 'Get booking quote'}
          </button>
          {error && <Notice error>{error}</Notice>}
        </form>
      </section>

      <section className="panel quote-panel" aria-labelledby="quote-title" aria-live="polite">
        <div className="panel-heading">
          <span className="panel-icon"><Armchair size={19} aria-hidden="true" /></span>
          <h2 id="quote-title">Your bundles</h2>
        </div>
        {!quote && <Notice>{cinema ? 'Enter a group size to see your seat bundles.' : 'Create a cinema through the API to get started.'}</Notice>}
        {quote && !quote.possible && (
          <div className="quote-content">
            <strong>Not possible</strong>
            <p className="muted">This cinema’s bundles cannot seat exactly {quote.groupSize.toLocaleString()} people.</p>
          </div>
        )}
        {quote?.possible && (
          <div className="quote-content">
            <strong>{quote.totalBundles.toLocaleString()} {quote.totalBundles === 1 ? 'bundle' : 'bundles'}</strong>
            <p className="muted">{quote.groupSize.toLocaleString()} seats at {cinema.name}</p>
            <ul className="quote-list">
              {quote.bundles.map(({ size, count }) => (
                <li key={size}><span>{size}-seat {count === 1 ? 'bundle' : 'bundles'}</span><strong>× {count.toLocaleString()}</strong></li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
