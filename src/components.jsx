import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CircleAlert, X } from 'lucide-react';
import { api } from './api.js';

export function useCollection(path) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then(setItems)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, attempt]);

  return {
    items,
    error,
    loading,
    retry() {
      setError('');
      setLoading(true);
      setAttempt((current) => current + 1);
    },
    save(item) {
      setItems((current) => current.some(({ id }) => id === item.id)
        ? current.map((entry) => entry.id === item.id ? item : entry)
        : [...current, item]);
    },
  };
}

export function Notice({ children, error = false, retry }) {
  return (
    <div className={error ? 'notice notice-error' : 'notice'} role={error ? 'alert' : 'status'}>
      {error && <CircleAlert size={18} aria-hidden="true" />}
      <span>{children}</span>
      {retry && <button className="button button-quiet" onClick={retry}>Retry</button>}
    </div>
  );
}

export function Select({ id, children, ...props }) {
  return (
    <div className="select-wrap">
      <select id={id} {...props}>{children}</select>
      <ChevronDown size={18} aria-hidden="true" />
    </div>
  );
}

export function WatchedBox({ movie, onChange, disabled }) {
  return (
    <label className="watched-box" title={movie.watched ? 'Mark as unwatched' : 'Mark as watched'}>
      <input type="checkbox" aria-label={movie.title + ' watched'} checked={movie.watched}
        onChange={() => onChange(movie)} disabled={disabled} />
      <span><Check size={15} strokeWidth={3} aria-hidden="true" /></span>
    </label>
  );
}

export function Dialog({ title, onClose, onSave, submitLabel, children }) {
  const dialog = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(new FormData(event.currentTarget));
      onClose();
    } catch (failure) {
      setError(failure.message);
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="dialog-title" onCancel={(event) => {
      event.preventDefault();
      if (!saving) onClose();
    }}>
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" type="button" aria-label="Close" onClick={onClose} disabled={saving}>
          <X size={21} aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={submit}>
        <fieldset className="dialog-fields" disabled={saving}>{children}</fieldset>
        {error && <Notice error>{error}</Notice>}
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </dialog>
  );
}

export function runtime(minutes) {
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours + 'h' + (remainder ? ' ' + remainder + 'm' : '');
}
