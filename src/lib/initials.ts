const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function firstGrapheme(word: string): string {
  const [first] = graphemes.segment(word);
  return first.segment.toUpperCase();
}

export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const first = firstGrapheme(words[0]);
  if (words.length === 1) {
    return first;
  }
  return first + firstGrapheme(words[words.length - 1]);
}