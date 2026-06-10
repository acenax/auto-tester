/** @type {import('next').NextConfig} */
const nextConfig = {
  // คำสั่งนี้บอก Next.js ว่าห้าม Bundle ไลบรารีเหล่านี้เด็ดขาด
  serverExternalPackages: [
    'playwright',
    'playwright-extra',
    'puppeteer-extra-plugin-stealth'
  ]
};

export default nextConfig;