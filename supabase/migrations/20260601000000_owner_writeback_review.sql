-- Allow project owners to approve or reject their own writeback requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'project_writeback_requests' 
      AND policyname = 'project_writeback_requests_owner_review_update'
  ) THEN
    CREATE POLICY "project_writeback_requests_owner_review_update" ON public.project_writeback_requests
      FOR UPDATE
      USING (
        status = 'submitted'
        AND EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = project_writeback_requests.project_id
            AND projects.user_id = auth.uid()
        )
      )
      WITH CHECK (
        status IN ('approved', 'rejected')
        AND EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = project_writeback_requests.project_id
            AND projects.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
