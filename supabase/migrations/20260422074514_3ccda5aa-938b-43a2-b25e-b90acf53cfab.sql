DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'add_group_creator_as_admin_trigger'
  ) THEN
    CREATE TRIGGER add_group_creator_as_admin_trigger
    AFTER INSERT ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.add_group_creator_as_admin();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_groups_updated_at'
  ) THEN
    CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins or self can add members" ON public.group_members;

CREATE POLICY "Admins can add members and users can join during room creation"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_group_admin(group_id, auth.uid())
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
  )
);