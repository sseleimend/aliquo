/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit and exceljs are Node-only libs that load asset files (fonts, etc.) at
  // runtime; keep them external so they are required rather than bundled/traced.
  serverExternalPackages: ["pdfkit", "exceljs"],
};

export default nextConfig;
