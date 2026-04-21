import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { MyProfileProvider } from "@/hooks/useMyProfile";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/ProtectedRoute";
import { BottomNav } from "@/components/BottomNav";
import { AppLockGate } from "@/components/AppLockGate";
import { CallProvider } from "@/components/call/CallProvider";
import { IntroSplash, markIntroPlayed, shouldPlayIntro } from "@/components/IntroSplash";
import Auth from "./pages/Auth";
import Welcome from "./pages/Welcome";
import ResetPassword from "./pages/ResetPassword";
import Chats from "./pages/Chats";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Settings from "./pages/Settings";
import AppLockSettings from "./pages/AppLockSettings";
import BlockedUsers from "./pages/BlockedUsers";
import PublicProfile from "./pages/PublicProfile";
import SearchUsers from "./pages/SearchUsers";
import Groups from "./pages/Groups";
import RoomChat from "./pages/RoomChat";
import ShareLink from "./pages/ShareLink";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

/**
 * Plays the VeltoChat intro after every successful login.
 * Tracks the previously seen userId so a fresh sign-in re-triggers it.
 */
const IntroGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && shouldPlayIntro()) {
      setShowIntro(true);
    }
  }, [user?.id, loading]);

  return (
    <>
      {children}
      {showIntro && (
        <IntroSplash
          onDone={() => {
            markIntroPlayed();
            setShowIntro(false);
          }}
        />
      )}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" richColors closeButton />
        <BrowserRouter>
          <AuthProvider>
            <MyProfileProvider>
              <CallProvider>
                <IntroGate>
                  <AppLockGate>
                    <Routes>
                      <Route
                        path="/auth"
                        element={
                          <PublicOnlyRoute>
                            <Auth />
                          </PublicOnlyRoute>
                        }
                      />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/terms" element={<Terms />} />

                      <Route
                        path="/welcome"
                        element={
                          <ProtectedRoute>
                            <Welcome />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <Chats />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/chat/:partnerId"
                        element={
                          <ProtectedRoute>
                            <Chat />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/rooms"
                        element={
                          <ProtectedRoute>
                            <Groups />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/room/:groupId"
                        element={
                          <ProtectedRoute>
                            <RoomChat />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/me"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/u/:username"
                        element={
                          <ProtectedRoute>
                            <PublicProfile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/search"
                        element={
                          <ProtectedRoute>
                            <SearchUsers />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute>
                            <Settings />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/profile"
                        element={
                          <ProtectedRoute>
                            <EditProfile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/blocked"
                        element={
                          <ProtectedRoute>
                            <BlockedUsers />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings/app-lock"
                        element={
                          <ProtectedRoute>
                            <AppLockSettings />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/pc/:username"
                        element={
                          <ProtectedRoute>
                            <ShareLink />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <BottomNav />
                  </AppLockGate>
                </IntroGate>
              </CallProvider>
            </MyProfileProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
