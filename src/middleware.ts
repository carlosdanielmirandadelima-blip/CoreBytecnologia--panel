import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/compose/:path*", "/containers/:path*", "/images/:path*", "/monitoring/:path*", "/volumes/:path*", "/teams/:path*", "/settings/:path*"],
};
