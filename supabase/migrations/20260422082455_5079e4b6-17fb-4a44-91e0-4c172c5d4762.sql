ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct realtime channel messages" ON realtime.messages;
CREATE POLICY "No direct realtime channel messages"
ON realtime.messages
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);