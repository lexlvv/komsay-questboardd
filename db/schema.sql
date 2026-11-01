-- KOMSAY Questboard (PostgreSQL: Supabase or Neon). Run once in the SQL editor.
create table if not exists participants (
  id serial primary key,
  name varchar(120) not null,
  email varchar(180) not null unique,
  date_joined date not null default current_date,
  total_points int not null default 0 check (total_points >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists point_transactions (
  id serial primary key,
  participant_id int not null references participants(id) on delete cascade,
  points int not null,            -- positive = award, negative = deduction
  reason varchar(255),
  awarded_at timestamptz not null default now(),
  created_by varchar(120)
);
create index if not exists idx_pt_awarded on point_transactions(awarded_at);
create index if not exists idx_pt_participant on point_transactions(participant_id);
create table if not exists admins (
  id serial primary key,
  email varchar(180) not null unique,
  password_hash varchar(255) not null,
  created_at timestamptz not null default now()
);
insert into admins (email, password_hash) values
  ('csso.comrecs.2025@gmail.com', '$2y$10$m3GyXFjNC4JoRPFSWdlslOYsvyWfh2m5DaOKgm6BJY0lQ5iLys5ke')
on conflict (email) do nothing;
