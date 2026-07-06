-- Migration 0002 — real binary uploads.
-- `size_bytes` is the authoritative file size (read back from Storage after the
-- client-direct upload); the UI's size label is derived from it. `storage_key`
-- (added in 0001) is the object path within the private `installers` bucket.
-- Idempotent.

alter table public.files
  add column if not exists size_bytes bigint not null default 0;
