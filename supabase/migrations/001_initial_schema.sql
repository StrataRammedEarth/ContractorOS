create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  primary key (organization_id, user_id)
);

create table library_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  record_type text not null check (record_type in ('material','resource','assembly','commercial_rule','assumption','validation','source','productivity_record')),
  code text not null,
  status text not null default 'active' check (status in ('pending','active','archived','superseded','withdrawn')),
  confidence text not null check (confidence in ('Locked','Validated','Provisional','Assumption','Unknown')),
  effective_date date,
  source text not null,
  source_url text,
  source_record_id text,
  manifest_id text,
  revision text,
  validation_ref text,
  reviewed_at timestamptz,
  authority text not null default 'requires-review' check (authority in ('canonical','validated','provisional','reference-only','duplicate','superseded','corrected','malformed','requires-review')),
  authority_state text not null default 'staged' check (authority_state in ('staged','exploration_approved','approved_locked','withdrawn_corrected')),
  approval_status text not null default 'staged' check (approval_status in ('draft','staged','approved','rejected','locked','withdrawn')),
  placeholder boolean not null default false,
  owner_approval_required boolean not null default true,
  approver text,
  approved_at timestamptz,
  archived_at timestamptz,
  corrected_at timestamptz,
  corrected_by text,
  correction_reason text,
  supersedes text,
  superseded_by text,
  data jsonb not null,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, record_type, code, status)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_name text not null default '',
  project_name text not null,
  reference text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create table estimate_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  reference text not null,
  version integer not null,
  snapshot jsonb not null,
  status text not null default 'draft' check (status in ('draft','final','accepted','archived')),
  created_at timestamptz not null default now(),
  unique (organization_id, reference, version)
);

create table actual_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  estimate_version_id uuid not null references estimate_versions(id) on delete cascade,
  actual_material numeric not null default 0,
  actual_labour numeric not null default 0,
  actual_final_value numeric not null default 0,
  notes text not null default '',
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','promoted','rejected')),
  created_at timestamptz not null default now()
);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  file_name text not null,
  record_type text not null,
  status text not null default 'review' check (status in ('review','approved','rejected')),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table library_records enable row level security;
alter table projects enable row level security;
alter table estimate_versions enable row level security;
alter table actual_records enable row level security;
alter table import_batches enable row level security;

create function is_org_member(org_id uuid) returns boolean language sql stable security definer as $$
  select exists(select 1 from organization_members where organization_id = org_id and user_id = auth.uid())
$$;

create policy "members read organizations" on organizations for select using (is_org_member(id));
create policy "members read membership" on organization_members for select using (user_id = auth.uid());
create policy "members manage library" on library_records for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage projects" on projects for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage estimates" on estimate_versions for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage actuals" on actual_records for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage imports" on import_batches for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create function bootstrap_owner_organization(org_name text default 'ContractorOS')
returns uuid language plpgsql security definer as $$
declare new_org uuid;
begin
  select organization_id into new_org from organization_members where user_id = auth.uid() limit 1;
  if new_org is not null then return new_org; end if;
  insert into organizations(name) values (org_name) returning id into new_org;
  insert into organization_members(organization_id, user_id, role) values (new_org, auth.uid(), 'owner');
  return new_org;
end;
$$;
