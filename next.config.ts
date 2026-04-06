import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'spfpgzdkaxpnptkymboc.supabase.co',
      },
    ],
  },
};

export default nextConfig;