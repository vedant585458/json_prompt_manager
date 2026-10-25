#!/usr/bin/env node
/**
 * Documentation link check (TASK-031).
 *
 * Walks the Markdown that ships in this repository and verifies that:
 *
 * - every relative link points at a file that exists;
 * - every `#anchor` (own file or cross-file) matches a real heading;
 * - every document in `docs/` is linked from the README's documentation index.
 *
 * External `http(s)` links are counted and reported, never fetched: this script
 * runs offline and will not claim a remote page is alive.
 *
 * Exit code 1 on any broken link or unreferenced document. Usage: `npm run check:links`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const INDEX_FILE = 'README.md';
const SCAN = ['README.md', 'tasks.md'];

/** Markdown files to scan: the two root files plus everything in `docs/`. */
function markdownFiles() {
  const docs = readdirSync(join(ROOT, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`);
  return [...SCAN, ...docs];
}

/**
 * GitHub's heading slug: lowercase, drop everything that is not a letter, digit,
 * space, hyphen, or underscore, then turn spaces into hyphens. Falls back to
 * `section` for headings that are pure punctuation so the anchor is still valid.
 */
function slug(text) {
  const base = text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .replace(/ /g, '-');
  return base.length > 0 ? base : 'section';
}

/** Every anchor a file defines, including `-1`, `-2` suffixes for repeats. */
function anchorsIn(file) {
  const text = readFileSync(file, 'utf8');
  const seen = new Map();
  const anchors = new Set();
  let inFence = false;

  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (!heading) continue;

    // Trailing `#`s are optional closing syntax; strip them before slugging.
    const title = heading[1].replace(/\s+#+\s*$/, '').trim();
    const base = slug(title);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  return anchors;
}

/** Markdown links, ignoring images and links inside fenced code blocks. */
function linksIn(file) {
  const text = readFileSync(file, 'utf8');
  const links = [];
  let inFence = false;

  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const match of line.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      links.push(match[1]);
    }
  }

  return links;
}

function isExternal(target) {
  return /^(https?:|mailto:|tel:)/.test(target);
}

function main() {
  const files = markdownFiles();
  const errors = [];
  const external = new Set();
  const docsLinkedFromIndex = new Set();
  let checked = 0;

  const anchorCache = new Map();
  const anchorsFor = (file) => {
    if (!anchorCache.has(file)) anchorCache.set(file, anchorsIn(file));
    return anchorCache.get(file);
  };

  for (const file of files) {
    const absolute = join(ROOT, file);

    for (const rawTarget of linksIn(absolute)) {
      if (isExternal(rawTarget)) {
        external.add(rawTarget);
        continue;
      }

      // Same-document anchors are checked, not skipped.
      const [pathPart, anchorPart] = rawTarget.split('#');
      checked += 1;

      const targetFile =
        pathPart === undefined || pathPart === ''
          ? file
          : relative(ROOT, resolve(dirname(absolute), pathPart));

      if (!pathPart || pathPart === '') {
        if (anchorPart && !anchorsFor(file).has(anchorPart)) {
          errors.push(`${file}: link "${rawTarget}" — no heading for #${anchorPart}`);
        }
        continue;
      }

      let exists;
      try {
        exists = statSync(join(ROOT, targetFile)).isFile();
      } catch {
        exists = false;
      }

      if (!exists) {
        errors.push(`${file}: link "${rawTarget}" — ${targetFile} does not exist`);
        continue;
      }

      if (file === INDEX_FILE && targetFile.startsWith('docs/')) {
        docsLinkedFromIndex.add(targetFile);
      }

      if (anchorPart && targetFile.endsWith('.md')) {
        if (!anchorsFor(targetFile).has(anchorPart)) {
          errors.push(`${file}: link "${rawTarget}" — ${targetFile} has no heading #${anchorPart}`);
        }
      }
    }
  }

  const docs = files.filter((file) => file.startsWith('docs/'));
  for (const doc of docs) {
    if (!docsLinkedFromIndex.has(doc)) {
      errors.push(
        `${INDEX_FILE}: docs/${doc.replace(/^docs\//, '')} is not linked from the documentation index`,
      );
    }
  }

  for (const error of errors) console.error(`✗ ${error}`);
  for (const url of [...external].sort()) console.log(`… external, not fetched: ${url}`);

  const summary =
    `${checked} internal links across ${files.length} Markdown files, ` +
    `${external.size} external links (not fetched), ${errors.length} problem(s)`;

  if (errors.length > 0) {
    console.error(`\nLink check failed: ${summary}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nLink check passed: ${summary}.`);
}

main();
