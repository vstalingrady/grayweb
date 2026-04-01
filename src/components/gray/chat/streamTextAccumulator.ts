export class StreamTextAccumulator {
  private accumulatedText: string;

  constructor(initialText = "") {
    this.accumulatedText = initialText;
  }

  append(chunk: string | null | undefined): string {
    const nextChunk = typeof chunk === "string" ? chunk : "";
    if (!nextChunk) {
      return this.accumulatedText;
    }

    if (!this.accumulatedText) {
      this.accumulatedText = nextChunk;
      return this.accumulatedText;
    }

    if (nextChunk === this.accumulatedText) {
      return this.accumulatedText;
    }

    // Provider sent cumulative content snapshot.
    if (nextChunk.startsWith(this.accumulatedText)) {
      this.accumulatedText = nextChunk;
      return this.accumulatedText;
    }

    // Default streaming behavior: append token delta.
    this.accumulatedText = this.accumulatedText + nextChunk;
    return this.accumulatedText;
  }

  set(nextValue: string | null | undefined): string {
    this.accumulatedText = nextValue ?? "";
    return this.accumulatedText;
  }

  get(): string {
    return this.accumulatedText;
  }
}
