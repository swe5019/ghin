/** Tiny in-memory TTL cache. Module-level state — resets on cold start/dev reload, which is fine here. */
export class TtlCache<T> {
  private value: T | null = null;
  private expiresAt = 0;

  constructor(private readonly ttlMs: number) {}

  get(): T | null {
    if (this.value !== null && Date.now() < this.expiresAt) {
      return this.value;
    }
    return null;
  }

  set(value: T): void {
    this.value = value;
    this.expiresAt = Date.now() + this.ttlMs;
  }

  clear(): void {
    this.value = null;
    this.expiresAt = 0;
  }
}
