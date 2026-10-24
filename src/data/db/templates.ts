/**
 * Built-in template catalogue (TASK-018).
 *
 * Nine documents that ship with the app, one per category. They are **plain
 * data**: each entry builds its `PromptDocument` through `createBlankDocument`,
 * which normalizes the shape, so a hand-edited catalogue cannot introduce a
 * document the rest of the app rejects (`src/data/db/templates.test.ts` asserts
 * every entry validates).
 *
 * The ids are fixed and permanent. Seeding writes a row only when that id is
 * missing (`seed.ts`), so bumping `SEED_VERSION` adds new templates to an
 * existing install without duplicating or overwriting anything — and the
 * built-ins are immutable once stored (ADR-08).
 *
 * The two templates that shipped in seed v1 keep their original ids and content:
 * an upgrade from v1 finds them present and skips them.
 */

import { createBlankDocument } from '@/domain/promptDocument';
import type { PromptDocument } from '@/domain/types';

/** Stable ids. Renaming an id would create a duplicate row on upgrade. */
export const BUILT_IN_TEMPLATE_IDS = {
  structuredExtraction: 'seed-template-structured-extraction',
  reviewResponse: 'seed-template-review-response',
  intentClassification: 'seed-template-intent-classification',
  meetingSummary: 'seed-template-meeting-summary',
  pullRequestReview: 'seed-template-pull-request-review',
  comparativeAnalysis: 'seed-template-comparative-analysis',
  agentSystemPrompt: 'seed-template-agent-system',
  launchAnnouncement: 'seed-template-launch-announcement',
  jsonTransformation: 'seed-template-json-transformation',
} as const;

export interface BuiltInTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  /** Built at seed time so every seed run produces an equal document. */
  readonly buildContent: () => PromptDocument;
}

/* -------------------------------------------------------------------------- */
/* Seed v1 documents (ids and content unchanged)                              */
/* -------------------------------------------------------------------------- */

function structuredExtractionDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Structured field extraction',
    role: 'Information extractor',
    objective:
      'Convert unstructured source text into a JSON object that matches the requested field list.',
    instructions: [
      'Read the source text and ignore boilerplate.',
      'Return one JSON object using exactly the requested field names.',
      'Use null for a field the text does not answer; never invent values.',
      'Preserve original spelling for names and identifiers.',
    ],
    context: {
      description: 'The caller supplies the source text and the field list to extract.',
    },
    constraints: [
      'Output must be valid JSON with no prose around it.',
      'Do not add fields that were not requested.',
    ],
    variables: [
      {
        name: 'source_text',
        type: 'string',
        required: true,
        description: 'Text to extract from.',
      },
      {
        name: 'fields',
        type: 'json',
        required: true,
        description: 'Array of field names to return.',
      },
    ],
    output: { format: 'json' },
    examples: [
      {
        input: {
          source_text: 'Acme shipped v2.1 on 3 May. Contact: ops@acme.test',
          fields: ['company', 'version', 'released_on', 'contact'],
        },
        output: {
          company: 'Acme',
          version: 'v2.1',
          released_on: '3 May',
          contact: 'ops@acme.test',
        },
      },
    ],
    metadata: { tags: ['extraction', 'starter'] },
  });
}

function reviewResponseDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Review response',
    role: 'Customer support writer',
    objective:
      'Draft a short, specific reply to a customer review that acknowledges the issue and states the next step.',
    instructions: [
      'Open with a direct acknowledgement of the specific complaint.',
      'State what will change, without promising dates that are not supplied.',
      'Close with one clear next step for the customer.',
    ],
    context: { description: 'The caller supplies the review text and the product area.' },
    constraints: [
      'Use plain language and no more than 120 words.',
      'Never promise compensation or timelines.',
      'Do not quote the review back verbatim.',
    ],
    variables: [
      { name: 'review_text', type: 'string', required: true, description: 'The review to answer.' },
      {
        name: 'product_area',
        type: 'string',
        required: false,
        description: 'Area of the product the review concerns.',
      },
    ],
    output: { format: 'text' },
    metadata: { tags: ['writing', 'support', 'starter'] },
  });
}

/* -------------------------------------------------------------------------- */
/* Seed v2 documents                                                          */
/* -------------------------------------------------------------------------- */

function intentClassificationDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Intent classification',
    role: 'Routing classifier',
    objective:
      'Assign one intent label from a fixed list to a customer message and justify the choice in a single clause.',
    instructions: [
      'Read the message and choose exactly one label from the supplied list.',
      'Prefer the most specific label that the message supports.',
      'When two labels fit, choose the one that matches the requested action, not the topic.',
      'Quote the shortest span of the message that supports the label.',
    ],
    context: {
      description:
        'The caller supplies the message and the label list. Labels are closed: nothing outside the list is valid.',
    },
    constraints: [
      'Never invent a label or merge two labels into one answer.',
      'Return JSON only; no explanation outside the object.',
      'If no label fits, use "unmatched" and say which labels were considered.',
    ],
    variables: [
      {
        name: 'message',
        type: 'string',
        required: true,
        description: 'The customer message to classify.',
      },
      {
        name: 'labels',
        type: 'json',
        required: true,
        description: 'Array of allowed label strings.',
      },
      {
        name: 'language',
        type: 'string',
        required: false,
        defaultValue: 'en',
        description: 'Language of the message, for tone-sensitive labels.',
      },
    ],
    output: { format: 'json' },
    examples: [
      {
        input: {
          message: 'I was charged twice this month, please refund the duplicate.',
          labels: ['billing', 'cancellation', 'technical_issue', 'unmatched'],
        },
        output: {
          label: 'billing',
          evidence: 'charged twice this month',
          confidence: 'high',
        },
      },
    ],
    metadata: { tags: ['classification', 'routing', 'starter'] },
  });
}

function meetingSummaryDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Meeting summary',
    role: 'Analyst taking minutes',
    objective:
      'Turn a raw meeting transcript into decisions, owners, and open questions without adding anything that was not said.',
    instructions: [
      'List decisions first, each as one sentence with the reason the group gave.',
      'List action items with the owner exactly as named in the transcript, or "unassigned".',
      'Collect open questions and the person who raised each one.',
      'Drop small talk, scheduling chatter, and repeated points.',
    ],
    context: {
      description:
        'The caller supplies a transcript. Speakers are labelled; timestamps may be present and are not part of the summary.',
    },
    constraints: [
      'Every action item must be traceable to a sentence in the transcript.',
      'Do not infer owners from job titles.',
      'Keep the summary shorter than the transcript.',
    ],
    variables: [
      {
        name: 'transcript',
        type: 'string',
        required: true,
        description: 'Raw meeting transcript with speaker labels.',
      },
      {
        name: 'max_actions',
        type: 'number',
        required: false,
        defaultValue: 8,
        description: 'Upper bound on action items, most important first.',
      },
    ],
    output: { format: 'markdown' },
    metadata: { tags: ['summarization', 'meetings', 'starter'] },
  });
}

function pullRequestReviewDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Pull request review',
    role: 'Senior engineer reviewing a change',
    objective:
      'Review a diff for correctness, safety, and maintainability, and separate blocking problems from optional suggestions.',
    instructions: [
      'Read the diff and the stated intent before commenting.',
      'Report blocking issues first, each with file, line, and a concrete fix.',
      'Mark style-only remarks as suggestions, never as blockers.',
      'Call out missing tests for behaviour the diff changes.',
      'Say explicitly when you found nothing blocking.',
    ],
    context: {
      description:
        'The caller supplies a unified diff, the pull request description, and the language/framework in use.',
    },
    constraints: [
      'Never approve a change that removes a test without replacement.',
      'Do not rewrite the diff in full; quote only the lines you discuss.',
      'No praise padding; be direct and specific.',
    ],
    variables: [
      { name: 'diff', type: 'string', required: true, description: 'Unified diff under review.' },
      {
        name: 'intent',
        type: 'string',
        required: true,
        description: 'What the author says the change does.',
      },
      {
        name: 'language',
        type: 'string',
        required: false,
        defaultValue: 'TypeScript',
        description: 'Primary language, so idioms are judged correctly.',
      },
    ],
    output: { format: 'markdown' },
    examples: [
      {
        input: {
          diff: '+ if (user) { return user.email }',
          intent: 'Return the signed-in user email.',
          language: 'TypeScript',
        },
        output:
          'Blocking: returning `user.email` without a null check on `email` widens the return type to `string | undefined`. Suggest narrowing or documenting the optionality.',
      },
    ],
    metadata: { tags: ['code-review', 'engineering', 'starter'] },
  });
}

function comparativeAnalysisDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Comparative analysis',
    role: 'Decision analyst',
    objective:
      'Compare the supplied options against named criteria and recommend one, with the trade-off stated plainly.',
    instructions: [
      'Restate the criteria and the weight of each before comparing.',
      'Score every option against every criterion; mark unknowns as "unknown", never zero.',
      'Name the option that wins on the weighted criteria and the option that wins on risk.',
      'Give one recommendation and the single condition that would change it.',
    ],
    context: {
      description:
        'The caller supplies the options, the criteria, and any constraints such as budget or timeline.',
    },
    constraints: [
      'Do not invent facts about an option; use "unknown" and say what would resolve it.',
      'Keep the comparison table to the criteria that were supplied.',
      'The recommendation must be one option, not a combination.',
    ],
    variables: [
      {
        name: 'options',
        type: 'json',
        required: true,
        description: 'Array of options, each with a name and a short description.',
      },
      {
        name: 'criteria',
        type: 'json',
        required: true,
        description: 'Array of criteria with optional weights.',
      },
      {
        name: 'constraints',
        type: 'string',
        required: false,
        description: 'Hard limits, for example budget or deadline.',
      },
    ],
    output: { format: 'markdown' },
    metadata: { tags: ['analysis', 'decision', 'starter'] },
  });
}

function agentSystemPromptDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Agent system prompt',
    role: 'System prompt for a tool-using agent',
    objective:
      'Define an agent’s scope, its tools, its stopping conditions, and what it must never do, in language a runtime can enforce.',
    instructions: [
      'State the agent’s single responsibility in one sentence.',
      'List the tools it may call and the precise condition for each.',
      'Describe how it verifies a step succeeded before continuing.',
      'Define when it stops: done, blocked, or needs a human decision.',
      'State what it must never do, including actions it must confirm first.',
    ],
    context: {
      description:
        'The caller supplies the agent name, its available tools, and the environment it runs in.',
    },
    constraints: [
      'Never claim a tool call succeeded without evidence in the transcript.',
      'No instructions that require guessing a user’s intent beyond the stated task.',
      'Refuse and explain when a request falls outside the stated responsibility.',
    ],
    variables: [
      { name: 'agent_name', type: 'string', required: true, description: 'Name shown in logs.' },
      {
        name: 'tools',
        type: 'json',
        required: true,
        description: 'Array of tool names with a one-line description each.',
      },
      {
        name: 'environment',
        type: 'string',
        required: true,
        description: 'Where the agent runs and what it can reach.',
      },
    ],
    output: { format: 'text' },
    examples: [
      {
        input: {
          agent_name: 'repo-maintainer',
          tools: ['read_file', 'run_tests', 'open_pull_request'],
          environment: 'A checkout on the maintainer’s machine, no network access.',
        },
        output:
          'You are repo-maintainer. Your only responsibility is keeping the test suite green. Use read_file to inspect code, run_tests to verify, and open_pull_request only after tests pass twice in a row. Stop and ask when a test failure needs a product decision.',
      },
    ],
    metadata: { tags: ['agents', 'system-prompt', 'starter'] },
  });
}

function launchAnnouncementDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Launch announcement',
    role: 'Product marketer writing for an existing audience',
    objective:
      'Announce a shipped change in plain language: what changed, who it helps, and what to do next.',
    instructions: [
      'Lead with the change, not with the company.',
      'Explain the before and after in one sentence each.',
      'Give exactly one call to action that works today.',
      'Close with where to ask questions.',
    ],
    context: {
      description:
        'The caller supplies the feature name, the audience, and the one benefit that matters most to them.',
    },
    constraints: [
      'No superlatives, no exclamation marks, no invented metrics.',
      'Do not promise dates for anything not yet shipped.',
      'Keep it under 180 words.',
    ],
    variables: [
      {
        name: 'feature',
        type: 'string',
        required: true,
        description: 'Name of the shipped change.',
      },
      {
        name: 'audience',
        type: 'string',
        required: true,
        description: 'Who reads the announcement.',
      },
      {
        name: 'benefit',
        type: 'string',
        required: true,
        description: 'The single benefit to lead with.',
      },
    ],
    output: { format: 'markdown' },
    metadata: { tags: ['content', 'launch', 'starter'] },
  });
}

function jsonTransformationDocument(): PromptDocument {
  return createBlankDocument({
    name: 'JSON shape transformation',
    role: 'Data transformer',
    objective:
      'Rewrite a supplied JSON value into a target shape with explicit field mappings and no silent data loss.',
    instructions: [
      'Apply the supplied mapping in order, from source path to target path.',
      'Keep values that the mapping does not mention only when "preserve_unknown" is true.',
      'Report every source field that was dropped in a separate list.',
      'Keep number and boolean types intact; never coerce them to strings.',
    ],
    context: {
      description:
        'The caller supplies the source value, the mapping, and whether unknown fields should be preserved.',
    },
    constraints: [
      'Output one JSON object with the target shape and a "dropped" array; nothing else.',
      'Never guess a mapping for a field that has none.',
      'If a required target path is unmapped, fail with a message instead of emitting null.',
    ],
    variables: [
      { name: 'source', type: 'json', required: true, description: 'The value to transform.' },
      {
        name: 'mapping',
        type: 'json',
        required: true,
        description: 'Object of target path to source path.',
      },
      {
        name: 'preserve_unknown',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Whether source fields outside the mapping are kept.',
      },
    ],
    output: { format: 'json' },
    examples: [
      {
        input: {
          source: { first_name: 'Ada', last_name: 'Lovelace', role: 'engineer' },
          mapping: { name: 'first_name', id: 'role' },
          preserve_unknown: false,
        },
        output: { name: 'Ada', id: 'engineer', dropped: ['last_name'] },
      },
    ],
    metadata: { tags: ['transformation', 'data', 'starter'] },
  });
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every built-in template, in the order the catalogue presents them.
 *
 * The order is grouping, not authority: the templates screen sorts by category
 * and name, and the dashboard orders built-ins before user templates.
 */
export const BUILT_IN_TEMPLATES: readonly BuiltInTemplate[] = [
  {
    id: BUILT_IN_TEMPLATE_IDS.structuredExtraction,
    name: 'Structured field extraction',
    description: 'Turn unstructured text into a JSON object with a fixed field list.',
    category: 'Extraction',
    buildContent: structuredExtractionDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.reviewResponse,
    name: 'Review response',
    description: 'Draft a short, specific reply to a customer review.',
    category: 'Writing',
    buildContent: reviewResponseDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.intentClassification,
    name: 'Intent classification',
    description: 'Route a message to one label from a closed list, with evidence.',
    category: 'Classification',
    buildContent: intentClassificationDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.meetingSummary,
    name: 'Meeting summary',
    description: 'Extract decisions, owners, and open questions from a transcript.',
    category: 'Summarization',
    buildContent: meetingSummaryDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.pullRequestReview,
    name: 'Pull request review',
    description: 'Separate blocking review findings from optional suggestions in a diff.',
    category: 'Code review',
    buildContent: pullRequestReviewDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.comparativeAnalysis,
    name: 'Comparative analysis',
    description: 'Compare options against weighted criteria and recommend one.',
    category: 'Analysis',
    buildContent: comparativeAnalysisDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.agentSystemPrompt,
    name: 'Agent system prompt',
    description: 'Define an agent’s scope, tools, verification, and stopping conditions.',
    category: 'Agents',
    buildContent: agentSystemPromptDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.launchAnnouncement,
    name: 'Launch announcement',
    description: 'Announce a shipped change in plain language with one call to action.',
    category: 'Content',
    buildContent: launchAnnouncementDocument,
  },
  {
    id: BUILT_IN_TEMPLATE_IDS.jsonTransformation,
    name: 'JSON shape transformation',
    description: 'Repackage a JSON value into a target shape without silent data loss.',
    category: 'Transformation',
    buildContent: jsonTransformationDocument,
  },
];
