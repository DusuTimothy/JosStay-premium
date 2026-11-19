/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@josstay/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
