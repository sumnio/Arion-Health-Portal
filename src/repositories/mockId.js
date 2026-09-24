// Mock repositories own temporary identifiers. Pages never create entity IDs.
export function createMockId() {
  return crypto.randomUUID();
}

