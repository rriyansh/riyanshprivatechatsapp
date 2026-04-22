DROP TRIGGER IF EXISTS add_group_creator_as_admin_trigger ON public.groups;
CREATE TRIGGER add_group_creator_as_admin_trigger
AFTER INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.add_group_creator_as_admin();