import { Film, Pencil } from 'lucide-react';
import { api } from './api.js';
import { Dialog, Notice, WatchedBox } from './components.jsx';

export function MovieLibrary({ movies, onEdit, watchedControls }) {
  const titles = new Map(movies.map((movie) => [movie.id, movie.title]));
  const watchedCount = movies.filter((movie) => movie.watched).length;

  return (
    <section className="panel" aria-labelledby="library-title">
      <div className="panel-heading">
        <span className="panel-icon"><Film size={18} aria-hidden="true" /></span>
        <h2 id="library-title">Movie library</h2>
        <span className="panel-meta">{watchedCount} of {movies.length} watched</span>
      </div>
      {movies.length === 0 ? <Notice>Add a movie to start building your library.</Notice> : (
        <ul className="movie-list">
          {movies.map((movie) => (
            <li className="movie-row" key={movie.id}>
              <WatchedBox movie={movie} onChange={watchedControls.toggle} disabled={watchedControls.pending.has(movie.id)} />
              <div className="movie-copy">
                <strong>{movie.title}</strong>
                <span>{movie.releaseYear} · {movie.runtimeMinutes} min</span>
                {movie.prerequisiteIds.length > 0 && (
                  <span className="prerequisite-copy">
                    Watch first · {movie.prerequisiteIds.map((id) => titles.get(id)).join(', ')}
                  </span>
                )}
              </div>
              <button className="icon-button edit-button" onClick={() => onEdit(movie)}
                aria-label={'Edit prerequisites for ' + movie.title} disabled={watchedControls.pending.has(movie.id)}>
                <Pencil size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MovieDialog({ movie, movies, onClose, onSaved }) {
  async function save(form) {
    const prerequisiteIds = form.getAll('prerequisiteIds').map(Number);
    const body = movie ? { prerequisiteIds } : {
      title: form.get('title'),
      releaseYear: Number(form.get('releaseYear')),
      runtimeMinutes: Number(form.get('runtimeMinutes')),
      prerequisiteIds,
      watched: form.has('watched'),
    };
    const saved = await api(movie ? '/movies/' + movie.id : '/movies', {
      method: movie ? 'PATCH' : 'POST',
      body,
    });
    onSaved(saved);
  }

  const options = movies.filter((option) => option.id !== movie?.id);
  return (
    <Dialog title={movie ? 'Edit prerequisites' : 'Add a movie'} onClose={onClose} onSave={save}
      submitLabel={movie ? 'Save changes' : 'Add movie'}>
      {movie ? <p>{movie.title}</p> : (
        <>
          <label className="field">
            <span>Title</span>
            <input name="title" maxLength={160} required autoFocus />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Release year</span>
              <input name="releaseYear" type="number" min="1" max="9999" step="1" required />
            </label>
            <label className="field">
              <span>Runtime (minutes)</span>
              <input name="runtimeMinutes" type="number" min="1" max="300" step="1" required />
            </label>
          </div>
        </>
      )}
      <fieldset className="prerequisites">
        <legend>Prerequisites</legend>
        {options.length ? (
          <div className="prerequisite-options">
            {options.map((option) => (
              <label className="checkbox-label" key={option.id}>
                <input type="checkbox" name="prerequisiteIds" value={option.id}
                  defaultChecked={movie?.prerequisiteIds.includes(option.id)} />
                {option.title}
              </label>
            ))}
          </div>
        ) : <p className="muted">Other movies will appear here once added.</p>}
      </fieldset>
      {!movie && (
        <label className="checkbox-label">
          <input type="checkbox" name="watched" />
          Mark as watched
        </label>
      )}
    </Dialog>
  );
}
