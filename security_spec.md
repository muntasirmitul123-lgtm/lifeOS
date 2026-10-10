# LifeOS Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Zero-Trust Ownership**: Every document in `/user_preferences/{userId}`, `/tasks/{taskId}`, `/calendar_events/{eventId}`, `/knowledge_items/{itemId}`, `/projects_goals/{recordId}`, and `/habits_logs/{logId}` must have `ownerId == request.auth.uid` and `request.auth.token.email_verified == true`.
2. **Path & Identity Binding**: In `/user_preferences/{userId}`, the document ID `{userId}` must strictly match `request.auth.uid` and `incoming().ownerId`.
3. **Strict Schema Enforcement**: Every write (`create` and `update`) must pass `isValid[Entity](incoming())`, enforcing `hasAll` and `hasOnly` key allowlists, strict string length bounds, numeric ranges, enum allowlists, and bounded list sizes.
4. **Temporal & Identity Immutability**: On `create`, `createdAt == request.time` and `updatedAt == request.time`. On `update`, `ownerId == existing().ownerId`, `createdAt == existing().createdAt`, and `updatedAt == request.time`.
5. **Query Isolation**: All `allow list` rules explicitly validate `resource.data.ownerId == request.auth.uid` without delegating filtering to the client or performing `get()`/`exists()` inside list rules.
6. **Terminal Reward Locking**: Documents in `/habits_logs/{logId}` with `logType == 'xp_transaction'` or `logType == 'achievement'` are terminal records and cannot be updated after creation.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create a task in `/tasks/task_1`.
2. **Cross-Tenant Ownership Spoof**: User `uid_attacker` creating `/tasks/task_1` with `ownerId: "uid_victim"`.
3. **Shadow Field Injection (Create)**: User creating `/tasks/task_1` with an extra undeclared property `isAdmin: true`.
4. **Shadow Field Injection (Update)**: User updating `/tasks/task_1` with an undeclared property `hacked: "yes"`.
5. **Owner Mutation on Update**: User updating `/tasks/task_1` to change `ownerId` to another UID.
6. **Timestamp Forgery (Create)**: User creating `/tasks/task_1` with a past or future client-supplied `createdAt` timestamp instead of `request.time`.
7. **Immortal `createdAt` Tampering (Update)**: User updating `/tasks/task_1` and modifying `createdAt`.
8. **Denial-of-Wallet String Overflow**: User creating `/knowledge_items/note_1` with a 50,000-character `content` string (exceeding the 20,000 limit).
9. **Path Poisoning Attack**: User creating `/tasks/bad..id$$$` with invalid characters in the document ID.
10. **Array Overflow Attack**: User creating `/tasks/task_1` with 100 tags (exceeding the 20-tag limit).
11. **Terminal State Bypass**: User attempting to update an earned `/habits_logs/xp_1` document where `logType == 'xp_transaction'` to inflate `xpAmount` to `9999`.
12. **Cross-Tenant List Scraping**: User `uid_attacker` executing an unfiltered `list` query against `/tasks` to read another user's tasks.
