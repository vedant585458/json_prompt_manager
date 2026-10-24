/**
 * Palette filtering and grouping (TASK-009).
 *
 * Pure functions: the palette renders whatever these return, and the tests
 * exercise them without a DOM. Matching is fuzzy-subsequence with a bias toward
 * word starts and contiguous runs, so "lib" finds "Go to Library" and "rail"
 * finds "Toggle the navigation rail" through its keywords.
 */

import { isCommandAvailable } from '@/lib/commands/registry';
import {
  COMMAND_GROUPS,
  type CommandContext,
  type CommandDefinition,
  type CommandGroup,
} from '@/lib/commands/types';

export const RECENT_GROUP = 'Recent' as const;
export type PaletteGroup = CommandGroup | typeof RECENT_GROUP;

export interface PaletteSection {
  readonly group: PaletteGroup;
  readonly commands: readonly CommandDefinition[];
}

const WORD_BREAK = /[\s/_.-]/;

/**
 * Subsequence score for one candidate string, or null when the query is not a
 * subsequence of it. Higher is better; word starts and adjacent matches count
 * more than scattered characters.
 */
export function subsequenceScore(text: string, query: string): number | null {
  if (query.length === 0) return 0;

  const haystack = text.toLowerCase();
  let index = 0;
  let score = 0;
  let streak = 0;

  for (const char of query) {
    const found = haystack.indexOf(char, index);
    if (found === -1) return null;

    if (found === index && index > 0) {
      streak += 1;
      score += 2 + streak;
    } else {
      streak = 0;
      score += 1;
    }

    const previous = found === 0 ? '' : (haystack[found - 1] ?? '');
    if (found === 0 || WORD_BREAK.test(previous)) score += 4;
    index = found + 1;
  }

  // Short candidates that match almost entirely are better than long ones that
  // merely contain the letters somewhere.
  return score + Math.max(0, 12 - Math.floor(haystack.length / 8));
}

function scoreCommand(command: CommandDefinition, query: string): number | null {
  if (query.length === 0) return 0;

  const titleText = command.title.toLowerCase();
  const titleScore = subsequenceScore(command.title, query);
  if (titleScore !== null) {
    // A literal substring is a much stronger signal than a scattered
    // subsequence ("theme" inside "…and light theme"), and a prefix stronger
    // still ("lib" for "Library").
    const substringBonus = titleText.includes(query) ? 40 : 0;
    const prefixBonus = titleText.startsWith(query) ? 30 : 0;
    return titleScore * 3 + substringBonus + prefixBonus;
  }

  const keywordScores = (command.keywords ?? [])
    .map((keyword) => subsequenceScore(keyword, query))
    .filter((score): score is number => score !== null);
  if (keywordScores.length > 0) return Math.max(...keywordScores) * 2;

  const descriptionScore = subsequenceScore(command.description ?? '', query);
  if (descriptionScore !== null) return descriptionScore;

  const groupScore = subsequenceScore(command.group, query);
  return groupScore === null ? null : groupScore;
}

export interface CommandMatch {
  readonly command: CommandDefinition;
  readonly score: number;
}

/**
 * Commands that are available right now and match the query, best first.
 *
 * Unavailable commands are dropped entirely: the palette only lists actions that
 * would do something if chosen (ADR-50).
 */
export function filterCommands(
  commands: readonly CommandDefinition[],
  query: string,
  context: CommandContext,
): readonly CommandMatch[] {
  const normalized = query.trim().toLowerCase();
  const matches: CommandMatch[] = [];

  for (const command of commands) {
    if (!isCommandAvailable(command, context)) continue;
    const score = scoreCommand(command, normalized);
    if (score === null) continue;
    matches.push({ command, score });
  }

  return matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.command.title.localeCompare(b.command.title) ||
      a.command.id.localeCompare(b.command.id),
  );
}

/**
 * Groups matches for display.
 *
 * With no query, sections follow the canonical group order and the most recently
 * used commands lead. With a query, sections are ordered by their best match so
 * the most relevant group appears first.
 */
export function groupCommands(
  matches: readonly CommandMatch[],
  options: { readonly query: string; readonly recentIds: readonly string[] },
): readonly PaletteSection[] {
  const byId = new Map(matches.map((match) => [match.command.id, match]));
  const sections: PaletteSection[] = [];

  if (options.query.trim().length === 0 && options.recentIds.length > 0) {
    const recent = options.recentIds
      .map((id) => byId.get(id)?.command)
      .filter((command): command is CommandDefinition => command !== undefined);

    if (recent.length > 0) {
      sections.push({ group: RECENT_GROUP, commands: recent });
    }
  }

  const recentSet = new Set(sections[0]?.commands.map((command) => command.id) ?? []);
  const scored: { section: PaletteSection; best: number }[] = [];

  for (const group of COMMAND_GROUPS) {
    const inGroup = matches.filter(
      (match) => match.command.group === group && !recentSet.has(match.command.id),
    );
    if (inGroup.length === 0) continue;

    const sorted = inGroup
      .slice()
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.command.title.localeCompare(b.command.title) ||
          a.command.id.localeCompare(b.command.id),
      );

    scored.push({
      section: { group, commands: sorted.map((match) => match.command) },
      best: sorted[0]?.score ?? 0,
    });
  }

  if (options.query.trim().length > 0) {
    // Searching: the group holding the best match leads.
    scored.sort((a, b) => b.best - a.best);
  }

  for (const entry of scored) sections.push(entry.section);
  return sections;
}
