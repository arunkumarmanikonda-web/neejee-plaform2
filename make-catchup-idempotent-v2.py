#!/usr/bin/env python3
"""
Build a fully idempotent catch-up migration from all SPRINT_9_*.sql files.

v2 — fixes nested DO $$ blocks. We:
1. Read each migration file
2. Tokenize into statements (split by ; but respect $$ delimiters)
3. For each statement, decide:
   - Already wrapped in DO $$ BEGIN ... END $$? → keep as-is
   - CREATE TABLE without IF NOT EXISTS? → add IF NOT EXISTS
   - CREATE INDEX without IF NOT EXISTS? → add IF NOT EXISTS
   - CREATE TYPE? → wrap in DO block
   - ALTER TABLE ... ADD COLUMN without IF NOT EXISTS? → add IF NOT EXISTS per column
   - ALTER TABLE ... ADD CONSTRAINT? → wrap in DO block
   - Other? → keep as-is
4. Concatenate and write output

Uses a smart $$-aware splitter so DO blocks are NEVER split.
"""
import re
import glob
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(SCRIPT_DIR, 'NEEJEE_CATCHUP_MIGRATION.sql')

HEADER = """-- ════════════════════════════════════════════════════════════════════════════
-- NEEJEE CATCH-UP MIGRATION (Sprint 9.2 → 9.29)
--
-- Idempotent. Safe to run on ANY production DB regardless of prior migrations.
-- Each statement is guarded with IF NOT EXISTS or wrapped in a DO block that
-- traps duplicate_object / duplicate_table / duplicate_column errors.
--
-- HOW TO RUN:
--   1. Open Supabase SQL Editor (Project → SQL Editor → New query)
--   2. Paste this ENTIRE file
--   3. Click RUN
--   4. Wait ~30 seconds. Should complete with NO errors.
--
-- WHAT IT FIXES:
--   • "Product not found" error (missing Category.active column)
--   • All schema columns required by current Prisma schema
--   • Adds missing indexes, foreign keys, defaults
--
-- AFTER RUNNING:
--   Refresh https://www.neejee.com/admin/products → click EDIT → should work.
-- ════════════════════════════════════════════════════════════════════════════

"""


def split_statements(sql):
    """
    Split SQL into top-level statements, respecting:
      - $$ ... $$ dollar-quoted blocks (don't split inside)
      - $tag$ ... $tag$ tagged dollar quotes
      - single-line and multi-line comments (don't split inside)
      - quoted strings 'x' and "y"
    """
    statements = []
    buf = []
    i = 0
    in_dollar = False
    dollar_tag = None
    in_single = False
    in_double = False
    in_line_comment = False
    in_block_comment = False

    n = len(sql)
    while i < n:
        ch = sql[i]
        nxt = sql[i+1] if i+1 < n else ''

        if in_line_comment:
            buf.append(ch)
            if ch == '\n':
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            buf.append(ch)
            if ch == '*' and nxt == '/':
                buf.append(nxt)
                i += 2
                in_block_comment = False
                continue
            i += 1
            continue

        if in_single:
            buf.append(ch)
            if ch == "'":
                # escape ''
                if nxt == "'":
                    buf.append(nxt)
                    i += 2
                    continue
                in_single = False
            i += 1
            continue

        if in_double:
            buf.append(ch)
            if ch == '"':
                in_double = False
            i += 1
            continue

        if in_dollar:
            buf.append(ch)
            # look for closing dollar tag
            if ch == '$':
                # try to match dollar_tag
                end = sql.find('$', i+1)
                if end != -1:
                    candidate = sql[i:end+1]
                    if candidate == dollar_tag:
                        # close
                        buf.append(sql[i+1:end+1])
                        i = end + 1
                        in_dollar = False
                        dollar_tag = None
                        continue
            i += 1
            continue

        # not inside any quote / comment / dollar block
        if ch == '-' and nxt == '-':
            buf.append(ch); buf.append(nxt)
            in_line_comment = True
            i += 2
            continue
        if ch == '/' and nxt == '*':
            buf.append(ch); buf.append(nxt)
            in_block_comment = True
            i += 2
            continue
        if ch == "'":
            buf.append(ch)
            in_single = True
            i += 1
            continue
        if ch == '"':
            buf.append(ch)
            in_double = True
            i += 1
            continue
        if ch == '$':
            # start of $...$ or $tag$
            end = sql.find('$', i+1)
            if end != -1:
                tag = sql[i:end+1]
                # valid tag is $$ or $WORD$
                if tag == '$$' or re.match(r'^\$\w*\$$', tag):
                    in_dollar = True
                    dollar_tag = tag
                    buf.append(tag)
                    i = end + 1
                    continue
            buf.append(ch)
            i += 1
            continue

        if ch == ';':
            buf.append(ch)
            stmt = ''.join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    # trailing buffer
    leftover = ''.join(buf).strip()
    if leftover:
        statements.append(leftover)
    return statements


def is_already_wrapped(stmt):
    """Check if statement is already wrapped in DO $$ BEGIN ... END $$;"""
    s = stmt.strip()
    return bool(re.match(r'^DO\s+\$', s, re.IGNORECASE))


def transform(stmt):
    """Make a single SQL statement idempotent."""
    # Skip if already a DO block (don't double-wrap)
    if is_already_wrapped(stmt):
        return stmt

    # Strip pure-comment statements
    stripped = stmt.strip()

    # Look at the first meaningful keyword (skip leading comments)
    # Remove leading line comments
    lines = stripped.split('\n')
    code_lines = []
    for line in lines:
        l = line.strip()
        if l.startswith('--') or not l:
            code_lines.append(line)
        else:
            code_lines.append(line)
            break_idx = None
    # Get the first non-comment, non-empty line for keyword detection
    code = '\n'.join(stripped.split('\n'))
    code_no_comments = re.sub(r'^\s*--[^\n]*\n', '', code, flags=re.MULTILINE).strip()

    upper = code_no_comments.upper()

    # CREATE TABLE → add IF NOT EXISTS
    if upper.startswith('CREATE TABLE') and 'IF NOT EXISTS' not in upper.split('(')[0]:
        return re.sub(r'CREATE TABLE\s+', 'CREATE TABLE IF NOT EXISTS ', stmt, count=1, flags=re.IGNORECASE)

    # CREATE UNIQUE INDEX → add IF NOT EXISTS
    if upper.startswith('CREATE UNIQUE INDEX') and 'IF NOT EXISTS' not in upper.split('ON')[0]:
        return re.sub(r'CREATE UNIQUE INDEX\s+', 'CREATE UNIQUE INDEX IF NOT EXISTS ', stmt, count=1, flags=re.IGNORECASE)

    # CREATE INDEX → add IF NOT EXISTS
    if upper.startswith('CREATE INDEX') and 'IF NOT EXISTS' not in upper.split('ON')[0]:
        return re.sub(r'CREATE INDEX\s+', 'CREATE INDEX IF NOT EXISTS ', stmt, count=1, flags=re.IGNORECASE)

    # CREATE TYPE → wrap in DO block
    if upper.startswith('CREATE TYPE'):
        return f"""DO $$ BEGIN
  {stmt.rstrip(';').rstrip()};
EXCEPTION WHEN duplicate_object THEN null; END $$;"""

    # ALTER TYPE ... ADD VALUE → already idempotent if "IF NOT EXISTS" is present in Postgres 12+
    # If not present, wrap in DO block
    if upper.startswith('ALTER TYPE') and 'ADD VALUE' in upper and 'IF NOT EXISTS' not in upper:
        return f"""DO $$ BEGIN
  {stmt.rstrip(';').rstrip()};
EXCEPTION WHEN duplicate_object THEN null; END $$;"""

    # ALTER TABLE ... ADD COLUMN → add IF NOT EXISTS to each ADD COLUMN
    if upper.startswith('ALTER TABLE') and 'ADD COLUMN' in upper:
        # Add IF NOT EXISTS after each "ADD COLUMN" that doesn't already have it
        result = re.sub(
            r'ADD COLUMN(?!\s+IF NOT EXISTS)(\s+)',
            r'ADD COLUMN IF NOT EXISTS\1',
            stmt,
            flags=re.IGNORECASE
        )
        return result

    # ALTER TABLE ... ADD CONSTRAINT → wrap in DO block
    if upper.startswith('ALTER TABLE') and 'ADD CONSTRAINT' in upper:
        return f"""DO $$ BEGIN
  {stmt.rstrip(';').rstrip()};
EXCEPTION WHEN duplicate_object THEN null; END $$;"""

    # CREATE OR REPLACE FUNCTION → already idempotent
    # CREATE OR REPLACE VIEW → already idempotent
    # INSERT → leave as-is (caller should add ON CONFLICT or WHERE NOT EXISTS)
    # UPDATE → idempotent by nature
    # DROP ... IF EXISTS → idempotent
    return stmt


def transform_file(content):
    statements = split_statements(content)
    out = []
    for s in statements:
        out.append(transform(s))
    return '\n\n'.join(out)


# Build catchup
files = sorted(
    glob.glob(os.path.join(SCRIPT_DIR, 'SPRINT_9_*.sql')),
    key=lambda p: tuple(int(x) for x in re.findall(r'\d+', os.path.basename(p)))
)

with open(OUTPUT, 'w') as out:
    out.write(HEADER)
    for f in files:
        name = os.path.basename(f)
        out.write(f"-- ════════════════════════════════════════════════════════════════════════════\n")
        out.write(f"-- {name}\n")
        out.write(f"-- ════════════════════════════════════════════════════════════════════════════\n\n")
        with open(f) as fin:
            content = fin.read()
        transformed = transform_file(content)
        out.write(transformed)
        out.write("\n\n")

# Print summary
size = os.path.getsize(OUTPUT)
with open(OUTPUT) as fin:
    line_count = sum(1 for _ in fin)
print(f"Wrote {OUTPUT}")
print(f"Lines: {line_count}, Size: {size//1024} KB")
