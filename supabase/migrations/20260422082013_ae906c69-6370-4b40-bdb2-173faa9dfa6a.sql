-- Prevent direct probing of block relationships between unrelated users while preserving RLS usage
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND auth.uid() <> _a AND auth.uid() <> _b THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = _a AND blocked_id = _b)
         OR (blocker_id = _b AND blocked_id = _a)
    )
  END;
$function$;

-- Remove self-join privilege escalation from private rooms
DROP POLICY IF EXISTS "Admins can add members and users can join during room creation" ON public.group_members;
CREATE POLICY "Admins and room creators can add members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_group_admin(group_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
  )
);

-- Enforce immutable chat message fields and role-specific update permissions
CREATE OR REPLACE FUNCTION public.validate_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.media_path IS DISTINCT FROM OLD.media_path
    OR NEW.media_duration_ms IS DISTINCT FROM OLD.media_duration_ms THEN
    RAISE EXCEPTION 'Protected message fields cannot be changed';
  END IF;

  IF auth.uid() = OLD.receiver_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content
      OR NEW.deleted_for_sender IS DISTINCT FROM OLD.deleted_for_sender
      OR NEW.deleted_for_everyone IS DISTINCT FROM OLD.deleted_for_everyone THEN
      RAISE EXCEPTION 'Receivers can only update message delivery state';
    END IF;
  ELSIF auth.uid() = OLD.sender_id THEN
    IF NEW.seen IS DISTINCT FROM OLD.seen
      OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
      RAISE EXCEPTION 'Senders cannot update receiver delivery state';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not allowed to update this message';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_message_update_trigger ON public.messages;
CREATE TRIGGER validate_message_update_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_message_update();