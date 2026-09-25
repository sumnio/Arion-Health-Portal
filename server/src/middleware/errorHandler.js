export function errorHandler(error, _request, response, _next) {
  const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 500;
  response.status(status).json({
    error: {
      code: error.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
      message: status === 500 ? 'An unexpected server error occurred.' : error.message,
    },
  });
}
