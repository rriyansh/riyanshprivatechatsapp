import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search as SearchIcon, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type SearchProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
};

const sanitizePostgrestSearch = (value: string) =>
  value.replace(/[,.()%]/g, "").slice(0, 60);

const SearchUsers = () => {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const safeSearch = sanitizePostgrestSearch(debounced);
      if (!safeSearch) {
        setResults([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles_public")
        .select("user_id, username, display_name, avatar_url, bio, followers_count")
        .neq("user_id", user.id)
        .or(`username.ilike.%${safeSearch}%,display_name.ilike.%${safeSearch}%`)
        .limit(30);
      if (cancelled) return;
      if (error) console.error(error);
      setResults(((data ?? []) as unknown) as SearchProfile[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, user?.id]);

  const heading = useMemo(() => (debounced ? "Results" : "Search users"), [debounced]);

  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      <header className="glass sticky top-0 z-20 rounded-b-3xl px-5 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Find people</h1>
        <p className="text-xs text-muted-foreground">Search by username or name</p>
        <div className="relative mt-3">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username or name…"
            autoCapitalize="off"
            autoCorrect="off"
            className="h-12 rounded-2xl bg-background/60 pl-10"
          />
        </div>
      </header>

      <div className="px-3 py-4">
        <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {heading}
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm rounded-3xl glass px-6 py-10 text-center">
            <UserX className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">{debounced ? "No matches" : "Start typing to search"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {debounced ? "Try a different username or name." : "Only real matching users will appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1 animate-fade-in">
            {results.map((p) => (
              <li key={p.user_id}>
                <Link
                  to={`/u/${p.username}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(p.display_name || p.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p.display_name || p.username}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      @{p.username}
                      {p.bio ? ` · ${p.bio}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.followers_count} followers
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SearchUsers;
