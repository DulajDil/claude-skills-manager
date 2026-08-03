---
name: test
description: Generate thorough unit tests for the specified function or file
version: 1.0.0
---
Write unit tests for the code the user specifies.

1. Identify the testing framework already used in the project (Jest, Vitest, pytest, etc.) — do not introduce a new one.
2. Cover: happy path, boundary conditions, error/exception paths, and any documented edge cases.
3. Each test should have a single assertion focus and a descriptive name that reads like a sentence.
4. Mock only external I/O (network, filesystem, DB) — keep business-logic tests free of mocks where possible.
5. Do not test implementation details; test observable behaviour.
6. Place tests in the appropriate test file location following the project conventions.
