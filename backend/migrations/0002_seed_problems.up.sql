-- Seed Initial DSA Problems List
INSERT INTO public.problems (title, category, difficulty, description, leetcode_url)
VALUES
(
  'Two Sum',
  'Arrays & Hashing',
  'Easy',
  'Given an array of integers `nums` and an integer `target`, return *indices of the two numbers such that they add up to `target`*.\n\nYou may assume that each input would have ***exactly* one solution**, and you may not use the *same* element twice.\n\nYou can return the answer in any order.',
  'https://leetcode.com/problems/two-sum/'
),
(
  'Valid Anagram',
  'Arrays & Hashing',
  'Easy',
  'Given two strings `s` and `t`, return `true` *if* `t` *is an anagram of* `s`*, and* `false` *otherwise*.\n\nAn **Anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.',
  'https://leetcode.com/problems/valid-anagram/'
),
(
  'Contains Duplicate',
  'Arrays & Hashing',
  'Easy',
  'Given an integer array `nums`, return `true` if any value appears **at least twice** in the array, and return `false` if every element is distinct.',
  'https://leetcode.com/problems/contains-duplicate/'
),
(
  'Valid Palindrome',
  'Two Pointers',
  'Easy',
  'A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.\n\nGiven a string `s`, return `true` *if it is a palindrome, or* `false` *otherwise*.',
  'https://leetcode.com/problems/valid-palindrome/'
),
(
  'Binary Search',
  'Binary Search',
  'Easy',
  'Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index. Otherwise, return `-1`.\n\nYou must write an algorithm with `O(log n)` runtime complexity.',
  'https://leetcode.com/problems/binary-search/'
),
(
  'Invert Binary Tree',
  'Trees',
  'Easy',
  'Given the `root` of a binary tree, invert the tree, and return *its root*.\n\n### Example\n- Input: `root = [4,2,7,1,3,6,9]`\n- Output: `[4,7,2,9,6,3,1]`',
  'https://leetcode.com/problems/invert-binary-tree/'
),
(
  'Reverse Linked List',
  'Linked List',
  'Easy',
  'Given the `head` of a singly linked list, reverse the list, and return *the reversed list*.',
  'https://leetcode.com/problems/reverse-linked-list/'
),
(
  'LRU Cache',
  'Advanced Data Structures',
  'Medium',
  'Design a data structure that follows the constraints of a **Least Recently Used (LRU) cache**.\n\nImplement the `LRUCache` class:\n- `LRUCache(int capacity)` Initialize the LRU cache with positive size `capacity`.\n- `int get(int key)` Return the value of the `key` if the `key` exists, otherwise return `-1`.\n- `void put(int key, int value)` Update the value of the `key` if the `key` exists. Otherwise, add the `key-value` pair to the cache. If the number of keys exceeds the `capacity` from this operation, **evict** the least recently used key.\n\nThe functions `get` and `put` must each run in `O(1)` average time complexity.',
  'https://leetcode.com/problems/lru-cache/'
)
ON CONFLICT (id) DO NOTHING;
