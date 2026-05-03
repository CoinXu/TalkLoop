CREATE TABLE admin_users (
  id bigint PRIMARY KEY,
  login_name text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role = 'super_admin'),
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_by_admin_id bigint,
  updated_by_admin_id bigint,
  last_login_at timestamp,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE UNIQUE INDEX admin_users_login_name_idx ON admin_users (login_name);
CREATE INDEX admin_users_status_role_idx ON admin_users (status, role);

CREATE TABLE admin_sessions (
  id bigint PRIMARY KEY,
  admin_user_id bigint NOT NULL REFERENCES admin_users (id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE INDEX admin_sessions_user_idx ON admin_sessions (admin_user_id);
CREATE INDEX admin_sessions_status_idx ON admin_sessions (status, expires_at);

CREATE TABLE admin_permissions (
  permission_key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamp NOT NULL
);

CREATE TABLE admin_role_permissions (
  id bigint PRIMARY KEY,
  admin_role text NOT NULL CHECK (admin_role = 'super_admin'),
  permission_key text NOT NULL REFERENCES admin_permissions (permission_key),
  created_at timestamp NOT NULL
);

CREATE UNIQUE INDEX admin_role_permissions_role_key_idx ON admin_role_permissions (admin_role, permission_key);

CREATE TABLE admin_audit_logs (
  id bigint PRIMARY KEY,
  admin_user_id bigint REFERENCES admin_users (id),
  admin_role text NOT NULL,
  permission_key text NOT NULL,
  action text NOT NULL,
  object_type text NOT NULL,
  object_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamp NOT NULL
);

CREATE INDEX admin_audit_logs_object_idx ON admin_audit_logs (object_type, object_id);
CREATE INDEX admin_audit_logs_admin_created_idx ON admin_audit_logs (admin_user_id, created_at);

INSERT INTO admin_permissions (permission_key, description, created_at)
VALUES
  ('admin.dashboard.read', 'View admin dashboard and navigation', now()),
  ('admin.accounts.read', 'View administrator accounts', now()),
  ('admin.accounts.write', 'Create, update, disable and reset administrator accounts', now()),
  ('admin.audit.read', 'View audit logs', now()),
  ('admin.word_library.write', 'Manage word library content', now()),
  ('admin.corpus.write', 'Manage corpus, courses and audio content', now()),
  ('admin.annotation.write', 'Review and rerun annotation tasks', now()),
  ('admin.assessment.write', 'Manage assessment configuration and versions', now()),
  ('admin.user_vocabulary.write', 'View and correct user vocabulary runtime state', now()),
  ('admin.practice.write', 'Manage word activation practice rules and records', now()),
  ('admin.task_strategy.write', 'Manage daily task strategy and logs', now()),
  ('admin.listen_repeat.read', 'View listen-repeat practice quality and failures', now()),
  ('admin.course_report.read', 'View course reports and progress statistics', now());

INSERT INTO admin_role_permissions (id, admin_role, permission_key, created_at)
SELECT (1000000 + row_number() OVER (ORDER BY permission_key))::bigint, 'super_admin', permission_key, now()
FROM admin_permissions;
