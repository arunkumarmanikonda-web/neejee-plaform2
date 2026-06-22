#!/usr/bin/env python3
"""
Wrap ALTER TABLE ... ADD CONSTRAINT statements in DO $$ EXCEPTION WHEN duplicate_object
to make them idempotent.
"""
import re

with open('/home/user/neejee-platform/NEEJEE_CATCHUP_MIGRATION.sql') as f:
    sql = f.read()

# Match ALTER TABLE "x" \n ADD CONSTRAINT "y" ... ; (multi-line, up to terminating ;)
# Need to be careful about ALTER TABLE statements that ADD COLUMN (which we don't want to wrap)
# Pattern: ALTER TABLE "T" + (multiline whitespace) + ADD CONSTRAINT (any chars until ;)
pattern = re.compile(
    r'ALTER TABLE\s+"[^"]+"\s+ADD CONSTRAINT\s+"[^"]+"\s+[^;]+;',
    re.MULTILINE
)

def wrap(m):
    stmt = m.group(0)
    # Indent inside DO block
    indented = '\n'.join('  ' + line for line in stmt.split('\n'))
    return f"""DO $$ BEGIN
{indented}
EXCEPTION WHEN duplicate_object THEN null; END $$;"""

new_sql = pattern.sub(wrap, sql)

# Confirm
count_before = len(pattern.findall(sql))
print(f"Wrapped {count_before} ADD CONSTRAINT statements")

with open('/home/user/neejee-platform/NEEJEE_CATCHUP_MIGRATION.sql', 'w') as f:
    f.write(new_sql)

# Also handle: ALTER TABLE "x" ADD CONSTRAINT "y" UNIQUE/PRIMARY KEY etc.
# (already covered by pattern above since "[^;]+;" matches the whole thing)
print("Done.")
