
CREATE OR REPLACE FUNCTION public.update_thread_views_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.threads SET views_count = COALESCE(views_count, 0) + 1 WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.threads SET views_count = GREATEST(0, COALESCE(views_count, 0) - 1) WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_thread_view_change
AFTER INSERT OR DELETE ON public.thread_views
FOR EACH ROW EXECUTE FUNCTION public.update_thread_views_count();
