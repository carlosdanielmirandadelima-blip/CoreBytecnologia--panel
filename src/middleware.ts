import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/compose/:path*", "/containers/:path*", "/images/:path*", "/monitoring/:path*", "/volumes/:path*", "/backups/:path*", "/servers/:path*", "/dns/:path*", "/status-pages/:path*", "/teams/:path*", "/settings/:path*"],
};
