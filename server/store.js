import { DatabaseSync } from 'node:sqlite';
import { rewatchOrder } from './algorithms.js';
import { ApiError, invalid, notFound } from './errors.js';

const demoMovies = [
  ['Iron Man', 2008, 126, []],
  ['Captain America: The First Avenger', 2011, 124, []],
  ['The Avengers', 2012, 143, [0, 1]],
  ['Captain America: Civil War', 2016, 147, [2]],
  ['Thor: Ragnarok', 2017, 130, []],
  ['Avengers: Infinity War', 2018, 149, [3, 4]],
  ['Avengers: Endgame', 2019, 181, [5]],
  ['Avengers: Doomsday', 2026, 150, [6]],
];

const demoCinemas = [
  { name: 'Quantum Cinema', bundleSizes: [1, 3, 4] },
  { name: 'Starlight Theatre', bundleSizes: [2, 5] },
  { name: 'Cosmic Multiplex', bundleSizes: [6, 9, 20] },
  { name: 'Midtown Picture House', bundleSizes: [4, 6] },
];

const movieSelect = `
  SELECT id, title, release_year AS releaseYear, runtime_minutes AS runtimeMinutes, watched,
    (SELECT json_group_array(prerequisite_id ORDER BY prerequisite_id)
      FROM movie_prerequisites WHERE movie_id = movies.id) AS prerequisiteIds
  FROM movies`;

const cinemaSelect = `
  SELECT id, name,
    (SELECT json_group_array(size ORDER BY size)
      FROM cinema_bundle_sizes WHERE cinema_id = cinemas.id) AS bundleSizes
  FROM cinemas`;

function readMovie(row) {
  return { ...row, watched: Boolean(row.watched), prerequisiteIds: JSON.parse(row.prerequisiteIds) };
}

function readCinema(row) {
  return { ...row, bundleSizes: JSON.parse(row.bundleSizes) };
}

export function createStore(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      title_key TEXT NOT NULL UNIQUE,
      release_year INTEGER NOT NULL CHECK (release_year BETWEEN 1 AND 9999),
      runtime_minutes INTEGER NOT NULL CHECK (runtime_minutes BETWEEN 1 AND 300),
      watched INTEGER NOT NULL DEFAULT 0 CHECK (watched IN (0, 1))
    ) STRICT;

    CREATE TABLE IF NOT EXISTS movie_prerequisites (
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      prerequisite_id INTEGER NOT NULL REFERENCES movies(id),
      PRIMARY KEY (movie_id, prerequisite_id),
      CHECK (movie_id <> prerequisite_id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS cinemas (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE
    ) STRICT;

    CREATE TABLE IF NOT EXISTS cinema_bundle_sizes (
      cinema_id INTEGER NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
      size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 500),
      PRIMARY KEY (cinema_id, size)
    ) STRICT;
  `);

  const movieById = db.prepare(movieSelect + ' WHERE id = ?');
  const allMovies = db.prepare(movieSelect + ' ORDER BY release_year, id');
  const insertMovie = db.prepare(`
    INSERT INTO movies (title, title_key, release_year, runtime_minutes, watched) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (title_key) DO NOTHING`);
  const updateMovie = db.prepare(`
    UPDATE movies SET title = ?, title_key = ?, release_year = ?, runtime_minutes = ?, watched = ? WHERE id = ?`);
  const titleOwner = db.prepare('SELECT id FROM movies WHERE title_key = ?');
  const removePrerequisites = db.prepare('DELETE FROM movie_prerequisites WHERE movie_id = ?');
  const addPrerequisite = db.prepare('INSERT INTO movie_prerequisites VALUES (?, ?)');

  const cinemaById = db.prepare(cinemaSelect + ' WHERE id = ?');
  const allCinemas = db.prepare(cinemaSelect + ' ORDER BY id');
  const insertCinema = db.prepare(`
    INSERT INTO cinemas (name, name_key) VALUES (?, ?) ON CONFLICT (name_key) DO NOTHING`);
  const addBundleSize = db.prepare('INSERT INTO cinema_bundle_sizes VALUES (?, ?)');

  function transaction(operation) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function listMovies() {
    return allMovies.all().map(readMovie);
  }

  function movieGraph() {
    return new Map(listMovies().map((movie) => [movie.id, movie]));
  }

  function verifyPrerequisites(movie) {
    const graph = movieGraph();
    for (const id of movie.prerequisiteIds) {
      if (!graph.has(id)) throw invalid('Prerequisite movie ' + id + ' does not exist.');
    }
    graph.set(movie.id, movie);
    rewatchOrder(graph, movie.id);
  }

  function readOneMovie(id) {
    const row = movieById.get(id);
    if (!row) throw notFound('movie');
    return readMovie(row);
  }

  function insertMovieRow(movie) {
    const result = insertMovie.run(movie.title, movie.title.toLowerCase(), movie.releaseYear,
      movie.runtimeMinutes, Number(movie.watched));
    if (result.changes === 0) throw new ApiError(409, 'DUPLICATE_TITLE', 'A movie already has that title.');
    return Number(result.lastInsertRowid);
  }

  function createMovie(movie) {
    return transaction(() => {
      const id = insertMovieRow(movie);
      if (movie.prerequisiteIds.length) verifyPrerequisites({ ...movie, id });
      for (const prerequisite of movie.prerequisiteIds) addPrerequisite.run(id, prerequisite);
      return readOneMovie(id);
    });
  }

  function patchMovie(id, update) {
    return transaction(() => {
      const movie = { ...readOneMovie(id), ...update };
      if (Object.hasOwn(update, 'prerequisiteIds')) verifyPrerequisites(movie);

      const titleKey = movie.title.toLowerCase();
      const owner = titleOwner.get(titleKey);
      if (owner && owner.id !== id) throw new ApiError(409, 'DUPLICATE_TITLE', 'A movie already has that title.');
      updateMovie.run(movie.title, titleKey, movie.releaseYear, movie.runtimeMinutes, Number(movie.watched), id);
      if (Object.hasOwn(update, 'prerequisiteIds')) {
        removePrerequisites.run(id);
        for (const prerequisite of movie.prerequisiteIds) addPrerequisite.run(id, prerequisite);
      }
      return readOneMovie(id);
    });
  }

  function plan(id) {
    const graph = movieGraph();
    if (!graph.has(id)) throw notFound('movie');
    const movies = rewatchOrder(graph, id);
    let watchedCount = 0;
    let unwatchedRuntimeMinutes = 0;
    for (const movie of movies) {
      if (movie.watched) watchedCount++;
      else unwatchedRuntimeMinutes += movie.runtimeMinutes;
    }

    return { targetId: id, movies, watchedCount, totalMovies: movies.length, unwatchedRuntimeMinutes };
  }

  function readOneCinema(id) {
    const row = cinemaById.get(id);
    if (!row) throw notFound('cinema');
    return readCinema(row);
  }

  function insertCinemaWithBundles(cinema) {
    const result = insertCinema.run(cinema.name, cinema.name.toLowerCase());
    if (result.changes === 0) throw new ApiError(409, 'DUPLICATE_NAME', 'A cinema already has that name.');
    const id = Number(result.lastInsertRowid);
    for (const size of cinema.bundleSizes) addBundleSize.run(id, size);
    return id;
  }

  function seed() {
    const hasMovies = db.prepare('SELECT 1 FROM movies LIMIT 1');
    const hasCinemas = db.prepare('SELECT 1 FROM cinemas LIMIT 1');
    transaction(() => {
      if (hasMovies.get() || hasCinemas.get()) return;
      const ids = [];
      for (const [title, releaseYear, runtimeMinutes, prerequisiteIndexes] of demoMovies) {
        const id = insertMovieRow({ title, releaseYear, runtimeMinutes, watched: false });
        for (const index of prerequisiteIndexes) addPrerequisite.run(id, ids[index]);
        ids.push(id);
      }
      for (const cinema of demoCinemas) insertCinemaWithBundles(cinema);
    });
  }

  return {
    listMovies,
    createMovie,
    patchMovie,
    plan,
    listCinemas: () => allCinemas.all().map(readCinema),
    cinema: readOneCinema,
    createCinema: (cinema) => transaction(() => readOneCinema(insertCinemaWithBundles(cinema))),
    seed,
    close: () => db.close(),
  };
}
