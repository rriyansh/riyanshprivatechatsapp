import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ShareLink = () => {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["share-link", username],
    enabled: !!username,
    queryFn: async () => {
      const clean = (username || "").toLowerCase().replace(/^@/, "");
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", clean)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    document.title = `Chat with @${username} · PrivateChats`;
  }, [username]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.user_id) {
    return <Navigate to="/search" replace />;
  }

  if (user && data.user_id === user.id) {
    return <Navigate to="/me" replace />;
  }

  return <Navigate to={`/chat/${data.user_id}`} replace />;
};

export default ShareLink;
