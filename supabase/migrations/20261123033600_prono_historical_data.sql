-- PRONO historical data foundation
-- Educational historical statistics only. No future-result predictions or betting markets.

create table if not exists public.teams (
  sport text not null default 'soccer'
    check (sport in ('soccer', 'basketball', 'hockey')),
  id bigint not null,
  league text not null,
  name text not null,
  updated_at timestamptz not null default now(),
  primary key (sport, id)
);

create table if not exists public.matches (
  event_id text primary key,
  sport text not null default 'soccer'
    check (sport in ('soccer', 'basketball', 'hockey')),
  league text not null,
  season text not null,
  kickoff timestamptz not null,
  home_team bigint not null,
  away_team bigint not null,
  home_goals integer,
  away_goals integer,
  status text not null default 'post',
  stats jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_different_teams check (home_team <> away_team),
  constraint matches_home_goals_nonnegative check (home_goals is null or home_goals >= 0),
  constraint matches_away_goals_nonnegative check (away_goals is null or away_goals >= 0),
  constraint matches_home_team_fk
    foreign key (sport, home_team) references public.teams (sport, id),
  constraint matches_away_team_fk
    foreign key (sport, away_team) references public.teams (sport, id)
);

create index if not exists matches_league_kickoff_idx
  on public.matches (sport, league, kickoff desc);

create index if not exists matches_status_kickoff_idx
  on public.matches (status, kickoff desc);

create index if not exists matches_home_team_kickoff_idx
  on public.matches (sport, home_team, kickoff desc);

create index if not exists matches_away_team_kickoff_idx
  on public.matches (sport, away_team, kickoff desc);

create index if not exists matches_stats_gin_idx
  on public.matches using gin (stats);

alter table public.teams enable row level security;
alter table public.matches enable row level security;

drop policy if exists "teams read historical data" on public.teams;
create policy "teams read historical data"
  on public.teams for select
  to anon, authenticated
  using (true);

drop policy if exists "matches read historical data" on public.matches;
create policy "matches read historical data"
  on public.matches for select
  to anon, authenticated
  using (true);

-- Browser roles receive read-only access. Ingestion writes use the server-side
-- service_role key, which must never be exposed to the browser.
grant select on public.teams, public.matches to anon, authenticated;
grant all on public.teams, public.matches to service_role;

comment on table public.teams is
  'ESPN team identities used for historical educational sports analysis.';
comment on table public.matches is
  'Persisted completed and scheduled events with historical scores and source statistics.';
comment on column public.matches.stats is
  'Source statistics JSON; missing metrics should remain null/absent, never be fabricated.';
