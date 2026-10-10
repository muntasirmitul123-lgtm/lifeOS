/**
 * Firestore Security Rules Test Suite (Dirty Dozen Verification)
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'create' | 'update' | 'list' | 'get';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    payload: { ownerId: 'user_1', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant Ownership Spoof',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'create',
    auth: { uid: 'user_attacker', email_verified: true },
    payload: { ownerId: 'user_victim', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Create',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Test', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Update',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Updated', ghostField: 123 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Mutation on Update',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_2', title: 'Transferred' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Timestamp Forgery on Create',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Test', createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immortal createdAt Tampering on Update',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Denial-of-Wallet String Overflow',
    collection: 'knowledge_items',
    docId: 'note_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', content: 'x'.repeat(25000) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path Poisoning Attack',
    collection: 'tasks',
    docId: 'invalid..id$$$',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Array Overflow Attack',
    collection: 'tasks',
    docId: 'task_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', tags: new Array(25).fill('tag') },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Bypass on XP Transaction',
    collection: 'habits_logs',
    docId: 'xp_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', logType: 'xp_transaction', xpAmount: 999999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-Tenant List Scraping',
    collection: 'tasks',
    docId: '*',
    operation: 'list',
    auth: { uid: 'user_attacker', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
