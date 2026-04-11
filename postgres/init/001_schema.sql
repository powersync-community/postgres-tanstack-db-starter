CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lists_owner_id ON lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_todos_list_id ON todos(list_id);

ALTER TABLE lists REPLICA IDENTITY FULL;
ALTER TABLE todos REPLICA IDENTITY FULL;

DROP PUBLICATION IF EXISTS powersync;
CREATE PUBLICATION powersync FOR TABLE lists, todos;

INSERT INTO lists (id, owner_id, name, created_at)
VALUES
  ('a9f2b7f4-8381-4dc0-86b3-86c4ff6f14a1', 'demo-user', 'Launch checklist', NOW() - INTERVAL '2 days'),
  ('d23ae72a-ef0d-4b2d-8d0e-c1c58ef7db8d', 'demo-user', 'Ideas inbox', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO todos (id, list_id, description, completed, created_at, completed_at)
VALUES
  (
    '30743df8-bce1-4b10-8559-fd2329ec6ac8',
    'a9f2b7f4-8381-4dc0-86b3-86c4ff6f14a1',
    'Bring up the self-hosted Postgres + PowerSync stack',
    TRUE,
    NOW() - INTERVAL '36 hours',
    NOW() - INTERVAL '35 hours'
  ),
  (
    '8cf0e30f-3e27-4d8d-a540-dfc7d918ed61',
    'a9f2b7f4-8381-4dc0-86b3-86c4ff6f14a1',
    'Wire TanStack DB collections to PowerSync tables',
    FALSE,
    NOW() - INTERVAL '18 hours',
    NULL
  ),
  (
    'ebd10f8f-dfb1-4ded-b7bf-f5635e558f06',
    'd23ae72a-ef0d-4b2d-8d0e-c1c58ef7db8d',
    'Try the app offline and create a new list',
    FALSE,
    NOW() - INTERVAL '6 hours',
    NULL
  )
ON CONFLICT (id) DO NOTHING;
