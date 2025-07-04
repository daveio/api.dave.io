---
trigger: always_on
description:
globs:
---

# Standard Finalization Procedure

This document outlines the standard procedure to follow after making any changes to the codebase.

## Testing

- Run the test suite to ensure all tests pass
  ```bash
  mise test
  ```
- If tests fail, fix the issues by either:
  - Updating the code to match the test expectations
  - Updating the tests to match the new code behavior (if the changes were intentional)
- Remember that the codebase requires Python 3.13+

## Code Quality Checks

- Run Trunk checks to identify and fix issues:
  ```bash
  trunk check -a --show-existing
  ```
- Use the `--show-existing` flag to see all issues, including those that might be ignored by default
- For targeted checks on specific files:
  ```bash
  trunk check --show-existing FILENAME
  ```
- Fix issues using appropriate methods:
  - For formatting issues: `trunk fmt FILENAME` or `trunk fmt -a`
  - For linting issues: attempt fix with `trunk check --fix FILENAME` or `trunk check --fix -a`

## Documentation Updates

After any feature changes or additions, update the following documentation files:

1. **README.md**: User-facing documentation with usage examples
2. **CLAUDE.md**: Detailed information for AI assistants to understand the codebase
3. **PROMPT.md**: Analysis of the implementation and prompt guidance

Ensure that all three files remain in sync and provide accurate information about the project structure, features, and usage.

## Sample Directory Management

The `sample` directory is used for testing purposes and can be reset to its original state using:

```bash
mise reset
```

When making changes to the sample files:

1. Update the `.sample-source` directory first
2. Then run the reset script to propagate those changes to the `sample` directory
3. This ensures that users can easily reset to a clean state for testing

## Final Verification

Before considering a change complete:

1. Verify all tests pass
2. Confirm all Trunk checks pass
3. Ensure documentation is updated
4. Check that the sample files are working as expected
5. Manually test the affected functionality

Following these steps ensures high code quality, maintainability, and a positive developer experience.
