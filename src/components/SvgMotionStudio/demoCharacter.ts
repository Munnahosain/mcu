export const DEMO_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 800 650" width="800" height="650">
  <defs>
    <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="armorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="emblemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#27e39a" />
      <stop offset="100%" stop-color="#16c784" />
    </linearGradient>
    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fcd34d" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Ground Shadow -->
  <g id="shadow" inkscape:label="Ground Shadow">
    <ellipse cx="400" cy="580" rx="140" ry="24" fill="url(#shadowGrad)" />
  </g>

  <!-- Character Master Container -->
  <g id="character-root" inkscape:label="Character">

    <!-- Left Leg -->
    <g id="left-leg" inkscape:label="Left Leg">
      <path d="M360 410 L345 520 L320 545 L355 545 L375 410 Z" fill="url(#armorGrad)" stroke="#334155" stroke-width="3" stroke-linejoin="round" />
      <path d="M320 535 L370 535 L375 550 L315 550 Z" fill="#0f172a" />
      <rect x="338" y="450" width="22" height="6" rx="3" fill="#27e39a" opacity="0.8" />
    </g>

    <!-- Right Leg -->
    <g id="right-leg" inkscape:label="Right Leg">
      <path d="M440 410 L455 520 L480 545 L445 545 L425 410 Z" fill="url(#armorGrad)" stroke="#334155" stroke-width="3" stroke-linejoin="round" />
      <path d="M430 535 L480 535 L485 550 L425 550 Z" fill="#0f172a" />
      <rect x="440" y="450" width="22" height="6" rx="3" fill="#27e39a" opacity="0.8" />
    </g>

    <!-- Left Arm -->
    <g id="left-arm" inkscape:label="Left Arm">
      <!-- Upper arm & shoulder -->
      <path d="M330 260 C290 280 270 330 265 390 C280 395 300 380 310 330 C320 295 330 275 330 260 Z" fill="url(#armorGrad)" stroke="#334155" stroke-width="3" />
      <!-- Left Hand -->
      <circle cx="265" cy="400" r="18" fill="url(#skinGrad)" stroke="#b45309" stroke-width="2" />
      <rect x="290" y="315" width="6" height="24" rx="3" fill="#27e39a" />
    </g>

    <!-- Torso / Body -->
    <g id="body" inkscape:label="Body">
      <!-- Outer Body Suit -->
      <path d="M330 250 L470 250 C480 320 475 390 460 425 L340 425 C325 390 320 320 330 250 Z" fill="url(#bodyGrad)" stroke="#1e40af" stroke-width="3" stroke-linejoin="round" />
      <!-- Chest Armor Plate -->
      <path d="M350 265 L450 265 L440 340 L400 370 L360 340 Z" fill="url(#armorGrad)" stroke="#334155" stroke-width="2" />
      <!-- MCU Glowing Star/Gem Core -->
      <g id="chest-emblem" inkscape:label="Chest Core" filter="url(#neonGlow)">
        <polygon points="400,290 415,315 440,315 420,332 427,358 400,342 373,358 380,332 360,315 385,315" fill="url(#emblemGrad)" />
        <circle cx="400" cy="325" r="7" fill="#ffffff" />
      </g>
      <!-- Belt -->
      <rect x="340" y="405" width="120" height="20" rx="4" fill="#0f172a" stroke="#334155" stroke-width="2" />
      <circle cx="400" cy="415" r="7" fill="#27e39a" />
    </g>

    <!-- Right Arm (Waving Arm) -->
    <g id="right-arm" inkscape:label="Right Arm">
      <!-- Upper arm and forearm raised in wave -->
      <path d="M470 260 C510 270 540 250 560 210 C545 200 525 215 500 240 C485 250 475 255 470 260 Z" fill="url(#armorGrad)" stroke="#334155" stroke-width="3" />
      <!-- Right Hand / Palm -->
      <g id="right-hand" inkscape:label="Right Hand">
        <circle cx="565" cy="200" r="18" fill="url(#skinGrad)" stroke="#b45309" stroke-width="2" />
        <rect x="560" y="175" width="6" height="15" rx="3" fill="url(#skinGrad)" />
        <rect x="570" y="178" width="6" height="14" rx="3" fill="url(#skinGrad)" />
        <rect x="580" y="185" width="6" height="12" rx="3" fill="url(#skinGrad)" />
      </g>
      <rect x="500" y="235" width="6" height="24" rx="3" fill="#27e39a" transform="rotate(-30 500 235)" />
    </g>

    <!-- Head & Face -->
    <g id="head" inkscape:label="Head">
      <!-- Neck -->
      <rect x="382" y="230" width="36" height="26" fill="url(#skinGrad)" stroke="#b45309" stroke-width="2" />

      <!-- Head Base -->
      <ellipse id="head-base" cx="400" cy="180" rx="60" ry="70" fill="url(#skinGrad)" stroke="#b45309" stroke-width="2.5" />

      <!-- Tech Visor / Goggles -->
      <g id="visor" inkscape:label="Visor">
        <path d="M345 160 Q400 150 455 160 Q460 190 445 195 Q400 185 355 195 Z" fill="#0f172a" stroke="#27e39a" stroke-width="2" />
      </g>

      <!-- Eyes -->
      <g id="eyes" inkscape:label="Eyes">
        <!-- Left Eye -->
        <g id="eye-left">
          <ellipse cx="375" cy="175" rx="14" ry="10" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" />
          <circle cx="376" cy="175" r="5" fill="#1e293b" />
          <circle cx="378" cy="172" r="2" fill="#27e39a" />
        </g>
        <!-- Right Eye -->
        <g id="eye-right">
          <ellipse cx="425" cy="175" rx="14" ry="10" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" />
          <circle cx="424" cy="175" r="5" fill="#1e293b" />
          <circle cx="426" cy="172" r="2" fill="#27e39a" />
        </g>
      </g>

      <!-- Mouth -->
      <g id="mouth" inkscape:label="Mouth">
        <path d="M385 215 Q400 226 415 215" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round" />
      </g>

      <!-- Heroic Hair -->
      <g id="hair" inkscape:label="Hair">
        <path d="M340 160 C330 110 370 80 400 75 C430 70 475 90 465 145 C455 125 435 110 405 112 C375 114 355 135 340 160 Z" fill="url(#hairGrad)" stroke="#4338ca" stroke-width="2.5" />
        <path d="M390 85 C410 60 450 70 455 95 C435 85 410 85 390 85 Z" fill="#a78bfa" />
      </g>
    </g>

  </g>
</svg>`;
