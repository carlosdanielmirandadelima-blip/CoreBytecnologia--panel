import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/compose/:path*", "/containers/:path*", "/images/:path*", "/monitoring/:path*", "/volumes/:path*", "/backups/:path*", "/servers/:path*", "/dns/:path*", "/status-pages/:path*", "/clusters/:path*", "/scaling/:path*", "/pipelines/:path*", "/dynamic-dns/:path*", "/builds/:path*", "/migrations/:path*", "/templates/:path*", "/audit-log/:path*", "/api-keys/:path*", "/plugins/:path*", "/teams/:path*", "/settings/:path*"],
};
