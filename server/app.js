import express from 'express';
import { minimumBundles } from './algorithms.js';
import { ApiError, notFound } from './errors.js';
import { cinemaInput, movieInput, positiveQueryInteger } from './validation.js';

const resourceId = (value) => positiveQueryInteger(value, 'ID', Number.MAX_SAFE_INTEGER);

export function createApp(store) {
  const app = express();
  app.disable('x-powered-by');

  const api = express.Router();
  api.use(express.json({ limit: '64kb' }));

  api.get('/movies', (_request, response) => response.json(store.listMovies()));
  api.post('/movies', (request, response) => {
    response.status(201).json(store.createMovie(movieInput(request.body)));
  });
  api.patch('/movies/:id', (request, response) => {
    response.json(store.patchMovie(resourceId(request.params.id), movieInput(request.body, true)));
  });
  api.get('/movies/:id/rewatch-order', (request, response) => {
    response.json(store.plan(resourceId(request.params.id)));
  });

  api.get('/cinemas', (_request, response) => response.json(store.listCinemas()));
  api.post('/cinemas', (request, response) => {
    response.status(201).json(store.createCinema(cinemaInput(request.body)));
  });
  api.get('/cinemas/:id/booking', (request, response) => {
    const groupSize = positiveQueryInteger(request.query.groupSize, 'Group size', 10000);
    const cinema = store.cinema(resourceId(request.params.id));
    response.json({
      cinemaId: cinema.id,
      groupSize,
      ...minimumBundles(cinema.bundleSizes, groupSize),
    });
  });

  api.use((_request, _response, next) => next(notFound('API endpoint')));
  api.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof ApiError) {
      return response.status(error.status).json({ error: { code: error.code, message: error.message } });
    }
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Send valid JSON.' } });
    }
    if (error.status >= 400 && error.status < 500) {
      const message = error.status === 413 ? 'The request body is too large.' : 'The request could not be read.';
      return response.status(error.status).json({ error: { code: 'INVALID_REQUEST', message } });
    }
    console.error(error);
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
  });
  app.use('/api', api);

  return app;
}
