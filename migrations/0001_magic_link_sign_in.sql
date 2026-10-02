create table members (
  id bigint generated always as identity primary key,
  email text not null,
  full_name text not null,
  username text not null,
  role text not null check (role in ('admin', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index members_email_key on members (lower(email));
create unique index members_username_key on members (lower(username));

create table magic_links (
  id bigint generated always as identity primary key,
  member_id bigint not null references members (id),
  token_hash text not null unique,
  destination text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table sessions (
  id bigint generated always as identity primary key,
  member_id bigint not null references members (id),
  token_hash text not null unique,
  magic_link_id bigint references magic_links (id) on delete set null,
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz
);

create index sessions_member_id_idx on sessions (member_id);

create table sign_in_requests (
  request_id uuid primary key,
  created_at timestamptz not null default now()
);

create table sign_in_attempts (
  id bigint generated always as identity primary key,
  email_key text not null,
  ip text not null,
  created_at timestamptz not null default now()
);

create index sign_in_attempts_email_key_created_at_idx on sign_in_attempts (email_key, created_at);
create index sign_in_attempts_ip_created_at_idx on sign_in_attempts (ip, created_at);
