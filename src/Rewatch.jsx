import { useEffect, useState } from 'react';
import { Clock3, Film, ListOrdered } from 'lucide-react';
import { api } from './api.js';
import { Notice, runtime, Select, WatchedBox } from './components.jsx';

export function Rewatch({ movies, watchedControls }) {
  const [selection, setSelection] = useState('');
  const [plan, setPlan] = useState(null);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const initialMovie = movies.find((movie) => movie.title === 'Avengers: Doomsday') ?? movies.at(-1);
  const targetId = selection || String(initialMovie?.id ?? '');

  useEffect(() => {
    if (!targetId) return undefined;
    const controller = new AbortController();
    api('/movies/' + targetId + '/rewatch-order', { signal: controller.signal })
      .then((result) => {
        setPlan(result);
        setFailure(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setPlan(null);
          setFailure({ targetId, message: error.message });
        }
      });
    return () => controller.abort();
  }, [movies, targetId, attempt]);

  const moviesById = new Map(movies.map((movie) => [movie.id, movie]));
  const current = plan?.targetId === Number(targetId) ? plan : null;
  const error = failure?.targetId === targetId ? failure.message : '';
  const percentage = current?.totalMovies ? Math.round(100 * current.watchedCount / current.totalMovies) : 0;

  return (
    <>
      <section className="panel target-panel" aria-labelledby="target-movie">
        <span className="panel-icon"><Film size={20} aria-hidden="true" /></span>
        <div className="target-copy">
          <label id="target-movie" htmlFor="target-select">Target movie</label>
          <span>Pick the movie you’re getting ready for.</span>
        </div>
        <Select id="target-select" value={targetId} disabled={!targetId}
          onChange={(event) => {
            setFailure(null);
            setSelection(event.target.value);
          }}>
          {!targetId && <option value="">No movies available</option>}
          {movies.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
        </Select>
      </section>

      {!targetId && <Notice>Add a movie in the Movies view to create a rewatch plan.</Notice>}
      {targetId && error && <Notice error retry={() => {
        setFailure(null);
        setAttempt((previous) => previous + 1);
      }}>{error}</Notice>}
      {targetId && !current && !error && <Notice>Loading rewatch order…</Notice>}
      {current && (
        <div className="plan-grid">
          <section className="panel" aria-labelledby="watch-order">
            <div className="panel-heading">
              <span className="panel-icon"><ListOrdered size={19} aria-hidden="true" /></span>
              <h2 id="watch-order">Watch order</h2>
              <span className="panel-meta">{current.totalMovies} {current.totalMovies === 1 ? 'movie' : 'movies'}</span>
            </div>
            {current.totalMovies === 0 ? <Notice>This movie has no prerequisites. You’re ready to watch it.</Notice> : (
              <ol className="movie-list rewatch-list">
                {current.movies.map((movie, index) => (
                  <li className="movie-row" key={movie.id}>
                    <span className="order-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div className="movie-copy">
                      <strong>{movie.title}</strong>
                      <span>{movie.releaseYear} · {movie.runtimeMinutes} min</span>
                    </div>
                    <WatchedBox movie={moviesById.get(movie.id) ?? movie}
                      onChange={watchedControls.toggle} disabled={watchedControls.pending.has(movie.id)} />
                  </li>
                ))}
              </ol>
            )}
          </section>
          <aside className="plan-aside" aria-label="Rewatch summary" aria-live="polite">
            <section className="panel summary-panel">
              <h2>Your progress</h2>
              <div className="progress-caption">
                <strong>{current.watchedCount} <small>of {current.totalMovies} watched</small></strong>
                <span>{percentage}%</span>
              </div>
              <progress max={current.totalMovies || 1} value={current.watchedCount} aria-label="Movies watched" />
            </section>
            <section className="panel summary-panel">
              <div className="runtime-heading">
                <span className="panel-icon"><Clock3 size={18} aria-hidden="true" /></span>
                <h2>Time remaining</h2>
              </div>
              <p className="runtime-value">{runtime(current.unwatchedRuntimeMinutes)}</p>
              <p className="muted">{current.totalMovies - current.watchedCount} movies left to watch</p>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
