export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function invalid(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

export function notFound(resource) {
  return new ApiError(404, 'NOT_FOUND', 'That ' + resource + ' was not found.');
}
