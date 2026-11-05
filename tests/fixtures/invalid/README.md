# Invalid-input regression fixtures

One directory per diagnostic class (P0-10). Each directory is a tiny workspace
that must produce exactly its directory's diagnostic code (plus nothing else).
`tests/integration/invalid-fixtures.test.ts` loads every directory and fails if
a diagnostic code has neither a fixture here nor a documented test elsewhere.
