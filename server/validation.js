import { invalid } from './errors.js';

function objectWithFields(body, fields) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('Send a JSON object.');
  }
  for (const field of Object.keys(body)) {
    if (!fields.includes(field)) throw invalid('Unknown field: ' + field);
  }
}

function name(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) {
    throw invalid(label + ' must contain 1–160 characters.');
  }
  return value.trim().normalize('NFC');
}

function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw invalid(label + ' must be a whole number from ' + min + ' to ' + max + '.');
  }
  return value;
}

function boolean(value) {
  if (typeof value !== 'boolean') throw invalid('Watched must be true or false.');
  return value;
}

function prerequisiteIds(value) {
  if (!Array.isArray(value)) throw invalid('Prerequisite IDs must be an array.');
  return [...new Set(value.map((id) => integer(id, 'Prerequisite ID', 1, Number.MAX_SAFE_INTEGER)))];
}

export function movieInput(body, partial = false) {
  const fields = {
    title: (value) => name(value, 'Title'),
    releaseYear: (value) => integer(value, 'Release year', 1, 9999),
    runtimeMinutes: (value) => integer(value, 'Runtime', 1, 300),
    watched: boolean,
    prerequisiteIds,
  };
  objectWithFields(body, Object.keys(fields));
  if (partial && Object.keys(body).length === 0) throw invalid('Provide at least one field to update.');
  const input = partial ? {} : { watched: false, prerequisiteIds: [] };
  for (const [field, parse] of Object.entries(fields)) {
    if (Object.hasOwn(body, field)) input[field] = parse(body[field]);
    else if (!partial && !Object.hasOwn(input, field)) throw invalid(field + ' is required.');
  }
  return input;
}

export function cinemaInput(body) {
  objectWithFields(body, ['name', 'bundleSizes']);
  const cinemaName = name(body.name, 'Cinema name');
  if (!Array.isArray(body.bundleSizes) || body.bundleSizes.length < 1 || body.bundleSizes.length > 10) {
    throw invalid('Provide between 1 and 10 bundle sizes.');
  }
  const sizes = body.bundleSizes.map((size) => integer(size, 'Bundle size', 1, 500));
  if (new Set(sizes).size !== sizes.length) throw invalid('Bundle sizes must be different.');
  return { name: cinemaName, bundleSizes: sizes.sort((left, right) => left - right) };
}

export function positiveQueryInteger(value, label, max) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw invalid(label + ' must be a whole number from 1 to ' + max + '.');
  }
  return integer(Number(value), label, 1, max);
}
