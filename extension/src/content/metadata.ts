// Isolated world — fetches problem metadata on demand via LeetCode's own GraphQL
// endpoint. Same-origin from a leetcode.com content script, so this rides the
// page's session cookies without needing extra host_permissions.
import type { Difficulty, ProblemMetadata } from '../shared/types';

const QUESTION_DATA_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      difficulty
      topicTags {
        name
      }
    }
  }
`;

interface QuestionDataResponse {
  data?: {
    question?: {
      title: string;
      difficulty: string;
      topicTags: { name: string }[];
    } | null;
  };
}

async function fetchQuestionData(slug: string): Promise<ProblemMetadata> {
  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      query: QUESTION_DATA_QUERY,
      variables: { titleSlug: slug },
      operationName: 'questionData',
    }),
  });

  if (!response.ok) {
    throw new Error(`questionData fetch failed: ${response.status}`);
  }

  const body = (await response.json()) as QuestionDataResponse;
  const question = body.data?.question;
  if (!question) {
    throw new Error(`questionData returned no question for slug "${slug}"`);
  }

  return {
    slug,
    title: question.title,
    difficulty: question.difficulty as Difficulty,
    tags: question.topicTags.map((tag) => tag.name),
  };
}

// One in-flight/resolved fetch per slug per page load — a resubmission on the
// same problem shouldn't re-fetch metadata that can't have changed meanwhile.
// Failed fetches are evicted so a later attempt on the same page can retry.
const cache = new Map<string, Promise<ProblemMetadata>>();

export function getProblemMetadata(slug: string): Promise<ProblemMetadata> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = fetchQuestionData(slug).catch((err) => {
      cache.delete(slug);
      throw err;
    });
    cache.set(slug, pending);
  }
  return pending;
}
