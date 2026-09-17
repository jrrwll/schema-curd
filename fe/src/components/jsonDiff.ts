import { diffChars, diffLines } from 'diff';

export interface JsonDiffLine {
  kind: 'context' | 'added' | 'removed';
  oldLine?: number;
  newLine?: number;
  text: string;
  segments?: JsonDiffSegment[];
}

export interface JsonDiffSegment {
  changed: boolean;
  text: string;
}

export interface JsonDiffResult {
  rows: JsonDiffLine[];
  additions: number;
  deletions: number;
  before: string;
  after: string;
  structured: boolean;
  formattingOnly: boolean;
}

export function linesOf(value: string) {
  const lines = value.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

export function prettyJson(source: string) {
  return JSON.stringify(JSON.parse(source), null, 2);
}

function inlineSegments(before: string, after: string) {
  const beforeSegments: JsonDiffSegment[] = [];
  const afterSegments: JsonDiffSegment[] = [];
  for (const part of diffChars(before, after)) {
    if (!part.added) beforeSegments.push({ changed: Boolean(part.removed), text: part.value });
    if (!part.removed) afterSegments.push({ changed: Boolean(part.added), text: part.value });
  }
  return { beforeSegments, afterSegments };
}

function diffRows(before: string, after: string) {
  const blocks = diffLines(before, after).map((part) => ({
    kind: (part.added ? 'added' : part.removed ? 'removed' : 'context') as JsonDiffLine['kind'],
    lines: linesOf(part.value),
  }));
  let oldLine = 1;
  let newLine = 1;
  const rows: JsonDiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    if (block.kind === 'removed' && blocks[blockIndex + 1]?.kind === 'added') {
      const addedBlock = blocks[blockIndex + 1];
      const pairedCount = Math.min(block.lines.length, addedBlock.lines.length);
      const pairedSegments = Array.from({ length: pairedCount }, (_, index) => (
        inlineSegments(block.lines[index], addedBlock.lines[index])
      ));
      block.lines.forEach((text, index) => {
        rows.push({ kind: 'removed', oldLine: oldLine++, text, segments: pairedSegments[index]?.beforeSegments });
        deletions += 1;
      });
      addedBlock.lines.forEach((text, index) => {
        rows.push({ kind: 'added', newLine: newLine++, text, segments: pairedSegments[index]?.afterSegments });
        additions += 1;
      });
      blockIndex += 1;
      continue;
    }

    for (const text of block.lines) {
      if (block.kind === 'added') {
        rows.push({ kind: block.kind, newLine: newLine++, text });
        additions += 1;
      } else if (block.kind === 'removed') {
        rows.push({ kind: block.kind, oldLine: oldLine++, text });
        deletions += 1;
      } else {
        rows.push({ kind: block.kind, oldLine: oldLine++, newLine: newLine++, text });
      }
    }
  }

  return { rows, additions, deletions };
}

export function buildJsonDiff(initialSource: string, currentSource: string, mode: 'structured' | 'raw'): JsonDiffResult {
  let before = initialSource;
  let after = currentSource;
  let structured = false;
  if (mode === 'structured') {
    try {
      before = prettyJson(before);
      after = prettyJson(after);
      structured = true;
    } catch {
      // Invalid JSON can still be inspected as source text.
    }
  }
  return {
    ...diffRows(before, after),
    before,
    after,
    structured,
    formattingOnly: structured && before === after && initialSource !== currentSource,
  };
}
