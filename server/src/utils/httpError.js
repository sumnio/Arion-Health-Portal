export function httpError(status, code, message, details = undefined) {
  return Object.assign(new Error(message), { status, code, ...(details === undefined ? {} : { details }) });
}
