/* @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ["@cnet/db", "@cnet/api-client", "@cnet/core", "@cnet/engine"],
}

export default nextConfig
