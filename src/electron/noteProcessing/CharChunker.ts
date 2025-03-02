interface ChunkerOptions {
  maxCharsPerChunk: number;
  overlap?: number;
}

export class CharChunker {
  private maxCharsPerChunk: number;
  private overlap: number;

  constructor(options: ChunkerOptions) {
    this.maxCharsPerChunk = options.maxCharsPerChunk;
    this.overlap = options.overlap || 0;
  }

  createChunks(text: string, noteTitle: string): string[] {
    const titlePrefix = `Title: ${noteTitle}\n\nContent: `;
    const effectiveMaxChars = this.maxCharsPerChunk - titlePrefix.length;

    if (effectiveMaxChars <= 0) {
      throw new Error(
        "Max chunk size is too small to accommodate the title prefix",
      );
    }

    const chunks: string[] = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
      // Calculate the potential end position for this chunk
      let endPosition = currentPosition + effectiveMaxChars;

      // If we're at the end of the text, just take the rest
      if (endPosition >= text.length) {
        chunks.push(titlePrefix + text.slice(currentPosition));
        break;
      }

      // Look backwards for the last whitespace within the chunk
      let lastWhitespace = text.lastIndexOf(" ", endPosition);

      // If no whitespace found in the chunk, look forward for the next whitespace
      if (lastWhitespace <= currentPosition) {
        lastWhitespace = text.indexOf(" ", endPosition);
        // If no whitespace found after either, take the whole remaining text
        if (lastWhitespace === -1) {
          chunks.push(titlePrefix + text.slice(currentPosition));
          break;
        }
      }

      // Add the chunk up to the last whitespace
      chunks.push(titlePrefix + text.slice(currentPosition, lastWhitespace));

      // Move the position for the next chunk, considering overlap
      currentPosition = lastWhitespace + 1;
      if (this.overlap > 0) {
        currentPosition = Math.max(currentPosition - this.overlap, 0);
      }
    }

    return chunks;
  }
}
