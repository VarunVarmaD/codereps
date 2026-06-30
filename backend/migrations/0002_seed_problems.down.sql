-- Rollback Seeded Problems
DELETE FROM public.problems
WHERE title IN (
  'Two Sum',
  'Valid Anagram',
  'Contains Duplicate',
  'Valid Palindrome',
  'Binary Search',
  'Invert Binary Tree',
  'Reverse Linked List',
  'LRU Cache'
);
