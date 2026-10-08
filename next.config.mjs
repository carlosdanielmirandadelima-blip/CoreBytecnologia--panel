/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  /**
   * Erros de tipo e lint agora QUEBRAM o build.
   *
   * Antes estavam desligados (`ignoreBuildErrors`/`ignoreDuringBuilds`), e foi
   * exatamente isso que deixou passar o 2FA quebrado (import inexistente do
   * otplib) e o Marketplace enviando um payload que a API não entendia.
   * O build verde dava uma falsa sensação de segurança.
   */
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    // Pacotes nativos/opcionais que não devem ser empacotados pelo webpack.
    serverComponentsExternalPackages: [
      "dockerode",
      "ssh2",
      "ssh2-sftp-client",
      "basic-ftp",
      "megajs",
      "@aws-sdk/client-s3",
      "@aws-sdk/lib-storage",
      "otplib",
      "bcryptjs",
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    config.module.rules.push({
      test: /\.node$/,
      use: "node-loader",
    });
    return config;
  },
};

export default nextConfig;
