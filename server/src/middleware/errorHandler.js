export function errorHandler(error, _request, response, _next) {
  if (error?.type === 'entity.too.large') {
    return response.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large.',
      },
    });
  }

  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains malformed JSON.',
      },
    });
  }

  const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 500;
  return response.status(status).json({
    error: {
      code: error.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
      message: status === 500 ? 'An unexpected server error occurred.' : error.message,
    },
  });
}
