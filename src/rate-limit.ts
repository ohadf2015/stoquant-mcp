export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async take(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs);
      await new Promise((resolve) => setTimeout(resolve, Math.max(50, waitMs)));
    }
  }

  private refill(): void {
    const now = Date.now();
    const delta = now - this.lastRefill;
    if (delta <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + delta * this.refillPerMs);
    this.lastRefill = now;
  }
}

export function bucketForRpm(rpm: number): TokenBucket {
  return new TokenBucket(rpm, rpm / 60_000);
}
