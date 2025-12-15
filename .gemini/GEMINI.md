# Gray Project - Build Verification Guide

## Pre-Production Checklist

Run these verification steps in order before deploying:

## GitHub Workflow & Checks

We use GitHub Actions for CI/CD. To check the status of builds directly from your terminal:

3. **Check Workflow Status**

   ```bash
   # List recent runs
   gh run list

   # View logs for a specific run (replace ID)
   gh run view <RUN_ID> --log-failed
   ```

   or check on the web: [https://github.com/vstalingrady/gray/actions](https://github.com/vstalingrady/gray/actions)

### 1. Lint Check

```bash
npm run lint
```

- Must exit with code 0
- Must have 0 errors (warnings are acceptable)

### 2. TypeScript Build

```bash
npm run build
```

- Must complete without errors
- Verifies all TypeScript compiles correctly

### 3. Backend Tests

```bash
python -m pytest backend/tests -v
```

- All tests must pass
- Verifies database schema, proactivity engine, reminders

### 4. Full Verification (One Command)

```bash
npm run lint && npm run build && python -m pytest backend/tests -v
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Missing SQLite column | Add to `_ensure_sqlite_table` AND `_ensure_sqlite_columns` in `main.py` |
| ESLint error | Fix code or add eslint-disable with justification |
| TypeScript error | Check types match between frontend and backend |

## After Making Changes (BUT DO THIS ONLY WHEN I TELL YOU TO)

1. Run full verification script
2. Commit with descriptive message
3. Do NOT push until CI passes locally

ssh to production: ~/.ssh/ssh-key-2025-08-25.key
ubuntu@168.110.203.180
home/ubuntu/gray
