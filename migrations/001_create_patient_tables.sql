-- Run in the Supabase SQL Editor to create the patient data tables.

create table public.patients (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  name text not null,
  nhs_number text not null,
  constraint patients_pkey primary key (id),
  constraint patients_nhs_number_key unique (nhs_number)
) tablespace pg_default;

create table public.appointments (
  id serial primary key,
  created_at timestamp with time zone not null default now(),
  nhs_number text not null references public.patients(nhs_number),
  clinic text not null,
  doctor text not null,
  date text not null,
  time text not null,
  status text not null
) tablespace pg_default;

create table public.prescriptions (
  id serial primary key,
  created_at timestamp with time zone not null default now(),
  nhs_number text not null references public.patients(nhs_number),
  name text not null,
  dosage text not null,
  frequency text not null,
  repeats_left integer not null default 0,
  status text not null
) tablespace pg_default;

create table public.document_scans (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  nhs_number text not null references public.patients(nhs_number),
  raw_text text not null,
  scan_type text not null default 'appointment_letter',
  constraint document_scans_pkey primary key (id)
) tablespace pg_default;

create table public.button_events (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  event_type text not null,
  metadata jsonb,
  constraint button_events_pkey primary key (id)
) tablespace pg_default;

-- Seed data matching the previous mock DATABASE
insert into public.patients (name, nhs_number) values ('Alex', '485 772 2910');

insert into public.appointments (nhs_number, clinic, doctor, date, time, status) values
  ('485 772 2910', 'GP Consultation', 'Dr. Sara Jenkins', 'Oct 12, 2026', '10:30 AM', 'Upcoming'),
  ('485 772 2910', 'Cardiology Follow-up', 'Dr. Alan Turing', 'Nov 05, 2026', '2:15 PM', 'Upcoming'),
  ('485 772 2910', 'Routine Blood Test', 'Nurse Practitioner Team', 'Sep 14, 2025', '09:00 AM', 'Completed');

insert into public.prescriptions (nhs_number, name, dosage, frequency, repeats_left, status) values
  ('485 772 2910', 'Amoxicillin', '500mg', 'Three times a day', 0, 'Active'),
  ('485 772 2910', 'Atorvastatin', '20mg', 'Once daily (evening)', 5, 'Active'),
  ('485 772 2910', 'Paracetamol', '500mg', 'As needed (Max 8/day)', 2, 'As Required');
