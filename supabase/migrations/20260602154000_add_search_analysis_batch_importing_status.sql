ALTER TABLE public.cakegenie_search_analysis_batch_runs
    DROP CONSTRAINT IF EXISTS cakegenie_search_analysis_batch_runs_status_check;

ALTER TABLE public.cakegenie_search_analysis_batch_runs
    ADD CONSTRAINT cakegenie_search_analysis_batch_runs_status_check
    CHECK (status IN ('collecting', 'submitted', 'importing', 'completed', 'completed_with_errors', 'failed'));
