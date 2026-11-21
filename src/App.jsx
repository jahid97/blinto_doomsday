import { useEffect, useMemo, useState } from 'react';
import { Aperture, Film, ListOrdered, Plus, Ticket } from 'lucide-react';
import { api } from './api.js';
import { Booking } from './Booking.jsx';
import { Notice, useCollection } from './components.jsx';
import { MovieDialog, MovieLibrary } from './Movies.jsx';
import { Rewatch } from './Rewatch.jsx';

const views = {
  movies: {
    label: 'Movies',
    title: 'Movies',
    description: 'Build your MCU library, set prerequisites, and track what you’ve watched.',
    icon: Film,
  },
  rewatch: {
    label: 'Rewatch plan',
    title: 'Your rewatch plan',
    description: 'Find out what to watch before your target movie and how much time you’ll need.',
    icon: ListOrdered,
  },
  booking: {
    label: 'Booking',
    title: 'Opening-night booking',
    description: 'Find the fewest seat bundles that fit your watch party exactly.',
    icon: Ticket,
  },
};

function locationView() {
  const hash = window.location.hash.slice(1);
  return Object.hasOwn(views, hash) ? hash : 'rewatch';
}

export function App() {
  const [view, setView] = useState(locationView);
  const movies = useCollection('/movies');
  const cinemas = useCollection('/cinemas');
  const sortedMovies = useMemo(() => [...movies.items].sort((left, right) =>
    left.releaseYear - right.releaseYear || left.id - right.id), [movies.items]);
  const [pending, setPending] = useState(new Set());
  const [watchError, setWatchError] = useState('');
  const [movieDialog, setMovieDialog] = useState(null);

  useEffect(() => {
    const change = () => {
      setView(locationView());
      setWatchError('');
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);

  async function toggle(movie) {
    if (pending.has(movie.id)) return;
    setWatchError('');
    setPending((previous) => new Set(previous).add(movie.id));
    try {
      movies.save(await api('/movies/' + movie.id, { method: 'PATCH', body: { watched: !movie.watched } }));
    } catch (error) {
      setWatchError(error.message);
    } finally {
      setPending((previous) => {
        const next = new Set(previous);
        next.delete(movie.id);
        return next;
      });
    }
  }

  const activeView = views[view];
  const collection = view === 'booking' ? cinemas : movies;
  const watchedControls = { pending, toggle };

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#rewatch">
            <span className="brand-icon"><Aperture size={22} aria-hidden="true" /></span>
            <span>Doomsday<span className="brand-accent"> Ready</span></span>
          </a>
          <nav aria-label="Main navigation">
            {Object.entries(views).map(([key, { label, icon: Icon }]) => (
              <a key={key} href={'#' + key} aria-current={key === view ? 'page' : undefined}>
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        <section className="hero" aria-labelledby="page-title">
          <div className="orbit-decoration" aria-hidden="true"><i /><i /><i /></div>
          <div className="hero-copy">
            <h1 id="page-title">{activeView.title}</h1>
            <p>{activeView.description}</p>
          </div>
          {view === 'movies' && (
            <button className="button button-primary" onClick={() => setMovieDialog({})}
              disabled={collection.loading || Boolean(collection.error)}>
              <Plus size={19} aria-hidden="true" /> Add movie
            </button>
          )}
        </section>

        {watchError && view !== 'booking' && <Notice error>{watchError}</Notice>}
        {collection.loading && <Notice>Loading {view === 'booking' ? 'cinemas' : 'movies'}…</Notice>}
        {collection.error && <Notice error retry={collection.retry}>{collection.error}</Notice>}
        {!collection.loading && !collection.error && view === 'movies' && (
          <MovieLibrary movies={sortedMovies} onEdit={(movie) => setMovieDialog({ movie })} watchedControls={watchedControls} />
        )}
        {!collection.loading && !collection.error && view === 'rewatch' && (
          <Rewatch movies={sortedMovies} watchedControls={watchedControls} />
        )}
        {!collection.loading && !collection.error && view === 'booking' && <Booking cinemas={cinemas.items} />}
      </main>

      {movieDialog && <MovieDialog movie={movieDialog.movie} movies={sortedMovies}
        onSaved={movies.save} onClose={() => setMovieDialog(null)} />}
    </>
  );
}
