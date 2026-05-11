import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Headroom for in-flight payloads (planogram JSON + small client data).
      // The preview PNG is uploaded directly to S3 via a presigned PUT and
      // is NOT sent through this action body.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
