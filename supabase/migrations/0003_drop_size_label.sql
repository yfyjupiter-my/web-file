-- Migration 0003 — drop the now-unused `size_label` column.
-- Real uploads store `size_bytes` (0002) and the UI derives the label from it,
-- so the free-text label column is dead. Idempotent.

alter table public.files drop column if exists size_label;
