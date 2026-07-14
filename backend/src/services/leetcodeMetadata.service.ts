// Server-side counterpart of extension/src/content/metadata.ts's questionData
// fetch — same public GraphQL query, no LeetCode auth needed. Used by the
// add-a-problem-by-URL flow (services/problems.service.ts) — the only place the
// backend talks to leetcode.com directly.

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

export interface LeetCodeQuestionMetadata {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
}

interface QuestionDataResponse {
  data?: {
    question?: {
      title: string;
      difficulty: string;
      topicTags: { name: string }[];
    } | null;
  };
}

export async function fetchQuestionData(slug: string): Promise<LeetCodeQuestionMetadata> {
  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    difficulty: question.difficulty as 'Easy' | 'Medium' | 'Hard',
    tags: question.topicTags.map((tag) => tag.name),
  };
}
