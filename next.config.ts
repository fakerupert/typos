import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow access to the dev server from other devices on the local network
  // (e.g. a phone viewed on the same Wi-Fi). Add any additional host IPs here.
  allowedDevOrigins: ["10.0.0.16"],
};

export default nextConfig;