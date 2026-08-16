import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Standalone Favicon SVG (64x64 viewBox - ultra clear at 16/32/64px)
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Rounded Base Background for Favicon Tab Visibility -->
  <rect width="64" height="64" rx="14" fill="#0f172a"/>
  
  <!-- Pantograph -->
  <path d="M26 14 L32 9 L38 14 M32 9 L32 7 M27 7 L37 7" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Train Body (White/Silver) -->
  <rect x="16" y="14" width="32" height="36" rx="6" fill="#ffffff"/>

  <!-- Windshield -->
  <rect x="19" y="19" width="26" height="13" rx="2.5" fill="#0a0e1a"/>
  <!-- Destination display (Amber LED) -->
  <rect x="23" y="21" width="18" height="2.5" rx="0.5" fill="#f59e0b"/>

  <!-- SBB Red Front Apron -->
  <path d="M16 35 Q16 50 32 50 Q48 50 48 35 Z" fill="#eb0000"/>

  <!-- Headlights -->
  <!-- Top central light -->
  <circle cx="32" cy="16.5" r="1.2" fill="#ffffff"/>
  <!-- Lower left headlight -->
  <circle cx="22" cy="42" r="2.2" fill="#ffffff"/>
  <!-- Lower right headlight -->
  <circle cx="42" cy="42" r="2.2" fill="#ffffff"/>

  <!-- Swiss emblem cross -->
  <rect x="30.5" y="40.5" width="3" height="3" rx="0.5" fill="#ffffff"/>
  <path d="M32 41 L32 43 M31 42 L33 42" stroke="#eb0000" stroke-width="0.8" stroke-linecap="round"/>

  <!-- Ground Rail & Under-chassis -->
  <rect x="22" y="50" width="20" height="3" rx="1" fill="#334155"/>
  <line x1="10" y1="57" x2="54" y2="57" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
</svg>
`;

// 2. Full-scale App Icon SVG (512x512 viewBox)
function createAppIconSvg(size, isAppleTouch = false) {
  const bgCornerRadius = isAppleTouch ? 0 : 112; // Apple touch icons should have solid background (OS handles squircle masking)
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bg-grad" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="60%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    
    <!-- Train Body Gradient -->
    <linearGradient id="body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>

    <!-- Windshield Gradient -->
    <linearGradient id="glass-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>

    <!-- Red Apron Gradient -->
    <linearGradient id="red-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff3333" />
      <stop offset="100%" stop-color="#cc0000" />
    </linearGradient>

    <!-- Headlight Glow Filter -->
    <filter id="headlight-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <radialGradient id="lamp-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
      <stop offset="40%" stop-color="#fef08a" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#eab308" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- App Badge Background -->
  <rect width="512" height="512" rx="${bgCornerRadius}" fill="url(#bg-grad)" />

  <!-- Subtle Outer Clock/Dial Ring (Subtle nod to railway station clock) -->
  <circle cx="256" cy="256" r="236" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="3 9" opacity="0.4" />
  
  <!-- Perspective Rails Behind / Extending Down -->
  <g opacity="0.85">
    <!-- Rails -->
    <line x1="80" y1="460" x2="432" y2="460" stroke="#475569" stroke-width="10" stroke-linecap="round" />
    <line x1="120" y1="486" x2="392" y2="486" stroke="#334155" stroke-width="6" stroke-linecap="round" />
    <!-- Sleepers / Ties -->
    <line x1="110" y1="473" x2="145" y2="473" stroke="#1e293b" stroke-width="6" stroke-linecap="round" />
    <line x1="190" y1="473" x2="225" y2="473" stroke="#1e293b" stroke-width="6" stroke-linecap="round" />
    <line x1="287" y1="473" x2="322" y2="473" stroke="#1e293b" stroke-width="6" stroke-linecap="round" />
    <line x1="367" y1="473" x2="402" y2="473" stroke="#1e293b" stroke-width="6" stroke-linecap="round" />
  </g>

  <!-- Roof Pantograph -->
  <g stroke="#94a3b8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M216 112 L256 68 L296 112" />
    <path d="M256 68 L256 46" />
    <line x1="214" y1="46" x2="298" y2="46" stroke-width="9" />
  </g>

  <!-- Train Shadow on Ground -->
  <ellipse cx="256" cy="425" rx="130" ry="14" fill="#000000" opacity="0.6" filter="blur(8px)" />

  <!-- Main Train Body -->
  <rect x="136" y="108" width="240" height="280" rx="44" fill="url(#body-grad)" stroke="#0a0e1a" stroke-width="2" />

  <!-- Panoramic Windshield -->
  <rect x="158" y="148" width="196" height="96" rx="16" fill="url(#glass-grad)" stroke="#0a0e1a" stroke-width="3" />
  
  <!-- Subtle glass reflection angle -->
  <path d="M162 152 L220 152 L170 240 L162 240 Z" fill="#ffffff" opacity="0.08" />

  <!-- LED Destination Display Board -->
  <rect x="190" y="162" width="132" height="20" rx="4" fill="#020617" stroke="#334155" stroke-width="1.5" />
  <!-- Amber LED matrix line -->
  <line x1="202" y1="172" x2="310" y2="172" stroke="#f59e0b" stroke-width="4.5" stroke-dasharray="6 3" stroke-linecap="round" />

  <!-- SBB Red Front Apron / Nose Section -->
  <path d="M136 270 Q136 388 256 388 Q376 388 376 270 Z" fill="url(#red-grad)" />

  <!-- Center Swiss Cross on Front Shield -->
  <rect x="245" y="304" width="22" height="22" rx="4" fill="#ffffff" />
  <path d="M256 307 L256 323 M248 315 L264 315" stroke="#eb0000" stroke-width="4" stroke-linecap="round" />

  <!-- Headlights (3-point Swiss railway lighting) -->
  <!-- Top 3rd Light -->
  <circle cx="256" cy="126" r="8" fill="#ffffff" filter="url(#headlight-glow)" />
  <circle cx="256" cy="126" r="14" fill="url(#lamp-halo)" opacity="0.6" />

  <!-- Bottom Left Headlight -->
  <circle cx="178" cy="318" r="14" fill="#ffffff" filter="url(#headlight-glow)" />
  <circle cx="178" cy="318" r="6" fill="#fef08a" />
  <circle cx="178" cy="318" r="22" fill="url(#lamp-halo)" opacity="0.5" />

  <!-- Bottom Right Headlight -->
  <circle cx="334" cy="318" r="14" fill="#ffffff" filter="url(#headlight-glow)" />
  <circle cx="334" cy="318" r="6" fill="#fef08a" />
  <circle cx="334" cy="318" r="22" fill="url(#lamp-halo)" opacity="0.5" />

  <!-- Under-chassis Bumper & Bogie / Wheel Accents -->
  <rect x="176" y="388" width="160" height="26" rx="8" fill="#1e293b" />
  <rect x="236" y="402" width="40" height="15" rx="3" fill="#0f172a" />
  <circle cx="160" cy="414" r="10" fill="#334155" />
  <circle cx="352" cy="414" r="10" fill="#334155" />
</svg>
`;
}

async function main() {
  const publicDir = path.join(__dirname, 'public');
  const distDir = path.join(__dirname, 'dist');

  const files = [
    { name: 'favicon.svg', content: faviconSvg },
    { name: 'icon-192.svg', content: createAppIconSvg(192, false) },
    { name: 'icon-512.svg', content: createAppIconSvg(512, false) },
    { name: 'apple-touch-icon.svg', content: createAppIconSvg(180, true) }
  ];

  // Write SVGs to public/
  for (const f of files) {
    fs.writeFileSync(path.join(publicDir, f.name), f.content, 'utf8');
    console.log(`Wrote ${f.name} to public/`);
  }

  // Generate apple-touch-icon.png using Sharp from apple-touch-icon.svg
  const appleSvgContent = createAppIconSvg(512, true);
  await sharp(Buffer.from(appleSvgContent))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated public/apple-touch-icon.png (180x180)');

  // If dist exists, also update dist/
  if (fs.existsSync(distDir)) {
    for (const f of files) {
      fs.writeFileSync(path.join(distDir, f.name), f.content, 'utf8');
      console.log(`Wrote ${f.name} to dist/`);
    }
    await sharp(Buffer.from(appleSvgContent))
      .resize(180, 180)
      .png()
      .toFile(path.join(distDir, 'apple-touch-icon.png'));
    console.log('Generated dist/apple-touch-icon.png (180x180)');
  }

  console.log('All icons generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
