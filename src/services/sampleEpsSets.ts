/**
 * Curated real EPS icon set datasets with genuine PostScript vector operators
 */

export interface SampleSet {
  id: string;
  name: string;
  category: string;
  iconCount: number;
  description: string;
  filename: string;
  content: string;
}

/**
 * Builds standard PostScript code for geometric icons placed at cell coordinates (cx, cy)
 */
function createIconPostScript(type: string, cx: number, cy: number, size: number = 28): string {
  const r = size / 2;
  switch (type) {
    case 'search':
      return `
% Search
gsave
${cx - 4} ${cy + 4} ${r * 0.55} 0 360 arc stroke
${cx + 3} ${cy - 3} moveto ${cx + 12} ${cy - 12} lineto stroke
grestore`;

    case 'user':
      return `
% User
gsave
${cx} ${cy + 5} ${r * 0.38} 0 360 arc stroke
${cx - 11} ${cy - 12} moveto
${cx - 10} ${cy - 4} ${cx + 10} ${cy - 4} ${cx + 11} ${cy - 12} curveto stroke
grestore`;

    case 'settings':
      return `
% Settings Gear
gsave
${cx} ${cy} ${r * 0.35} 0 360 arc stroke
${cx - 12} ${cy} moveto ${cx + 12} ${cy} lineto stroke
${cx} ${cy - 12} moveto ${cx} ${cy + 12} lineto stroke
${cx - 8} ${cy - 8} moveto ${cx + 8} ${cy + 8} lineto stroke
${cx - 8} ${cy + 8} moveto ${cx + 8} ${cy - 8} lineto stroke
${cx} ${cy} ${r * 0.75} 0 360 arc stroke
grestore`;

    case 'bell':
      return `
% Bell
gsave
${cx - 10} ${cy - 8} moveto
${cx - 8} ${cy + 4} ${cx + 8} ${cy + 4} ${cx + 10} ${cy - 8} curveto
${cx - 12} ${cy - 8} lineto ${cx + 12} ${cy - 8} lineto stroke
${cx} ${cy + 11} ${r * 0.15} 0 360 arc stroke
${cx - 3} ${cy - 11} moveto ${cx + 3} ${cy - 11} lineto stroke
grestore`;

    case 'star':
      return `
% Star
gsave
${cx} ${cy + 12} moveto
${cx + 3} ${cy + 3} lineto
${cx + 12} ${cy + 3} lineto
${cx + 5} ${cy - 3} lineto
${cx + 8} ${cy - 12} lineto
${cx} ${cy - 6} lineto
${cx - 8} ${cy - 12} lineto
${cx - 5} ${cy - 3} lineto
${cx - 12} ${cy + 3} lineto
${cx - 3} ${cy + 3} lineto
closepath stroke
grestore`;

    case 'heart':
      return `
% Heart
gsave
${cx} ${cy - 11} moveto
${cx - 12} ${cy - 2} ${cx - 12} ${cy + 8} ${cx - 5} ${cy + 10} curveto
${cx - 1} ${cy + 11} ${cx} ${cy + 6} ${cx} ${cy + 5} curveto
${cx} ${cy + 6} ${cx + 1} ${cy + 11} ${cx + 5} ${cy + 10} curveto
${cx + 12} ${cy + 8} ${cx + 12} ${cy - 2} ${cx} ${cy - 11} curveto
closepath stroke
grestore`;

    case 'cloud':
      return `
% Cloud
gsave
${cx - 10} ${cy - 5} moveto
${cx - 14} ${cy - 4} ${cx - 14} ${cy + 4} ${cx - 7} ${cy + 6} curveto
${cx - 5} ${cy + 12} ${cx + 5} ${cy + 12} ${cx + 7} ${cy + 6} curveto
${cx + 14} ${cy + 4} ${cx + 14} ${cy - 4} ${cx + 10} ${cy - 5} curveto
closepath stroke
grestore`;

    case 'mail':
      return `
% Mail
gsave
${cx - 12} ${cy - 9} 24 18 rectstroke
${cx - 12} ${cy + 9} moveto ${cx} ${cy} lineto ${cx + 12} ${cy + 9} lineto stroke
grestore`;

    case 'folder':
      return `
% Folder
gsave
${cx - 12} ${cy - 9} moveto
${cx - 12} ${cy + 7} lineto
${cx - 5} ${cy + 7} lineto
${cx - 2} ${cy + 10} lineto
${cx + 12} ${cy + 10} lineto
${cx + 12} ${cy - 9} lineto
closepath stroke
grestore`;

    case 'trash':
      return `
% Trash
gsave
${cx - 8} ${cy - 11} moveto
${cx - 9} ${cy + 4} lineto
${cx + 9} ${cy + 4} lineto
${cx + 8} ${cy - 11} lineto
closepath stroke
${cx - 12} ${cy + 6} moveto ${cx + 12} ${cy + 6} lineto stroke
${cx - 4} ${cy + 9} moveto ${cx + 4} ${cy + 9} lineto stroke
grestore`;

    case 'download':
      return `
% Download
gsave
${cx} ${cy + 11} moveto ${cx} ${cy - 3} lineto stroke
${cx - 5} ${cy + 2} moveto ${cx} ${cy - 3} lineto ${cx + 5} ${cy + 2} lineto stroke
${cx - 11} ${cy - 9} moveto ${cx + 11} ${cy - 9} lineto stroke
grestore`;

    case 'upload':
      return `
% Upload
gsave
${cx} ${cy - 4} moveto ${cx} ${cy + 10} lineto stroke
${cx - 5} ${cy + 5} moveto ${cx} ${cy + 10} lineto ${cx + 5} ${cy + 5} lineto stroke
${cx - 11} ${cy - 9} moveto ${cx + 11} ${cy - 9} lineto stroke
grestore`;

    case 'camera':
      return `
% Camera
gsave
${cx - 12} ${cy - 8} 24 16 rectstroke
${cx - 6} ${cy + 8} moveto ${cx + 6} ${cy + 8} lineto stroke
${cx} ${cy} ${r * 0.35} 0 360 arc stroke
grestore`;

    case 'compass':
      return `
% Compass
gsave
${cx} ${cy} ${r * 0.75} 0 360 arc stroke
${cx - 3} ${cy - 3} moveto ${cx - 1} ${cy + 7} lineto ${cx + 3} ${cy + 3} lineto ${cx + 1} ${cy - 7} lineto closepath stroke
grestore`;

    case 'lock':
      return `
% Lock
gsave
${cx - 9} ${cy - 10} 18 13 rectstroke
${cx - 5} ${cy + 3} moveto
${cx - 5} ${cy + 9} ${cx + 5} ${cy + 9} ${cx + 5} ${cy + 3} curveto stroke
${cx} ${cy - 3} ${r * 0.15} 0 360 arc stroke
grestore`;

    case 'calendar':
      return `
% Calendar
gsave
${cx - 11} ${cy - 10} 22 18 rectstroke
${cx - 11} ${cy + 4} moveto ${cx + 11} ${cy + 4} lineto stroke
${cx - 6} ${cy + 8} moveto ${cx - 6} ${cy + 12} lineto stroke
${cx + 6} ${cy + 8} moveto ${cx + 6} ${cy + 12} lineto stroke
grestore`;

    case 'tag':
      return `
% Tag
gsave
${cx - 11} ${cy - 8} moveto
${cx - 11} ${cy + 4} lineto
${cx - 3} ${cy + 11} lineto
${cx + 10} ${cy - 2} lineto
${cx + 2} ${cy - 9} lineto
closepath stroke
${cx - 6} ${cy + 3} ${r * 0.15} 0 360 arc stroke
grestore`;

    case 'sliders':
      return `
% Sliders
gsave
${cx - 7} ${cy - 10} moveto ${cx - 7} ${cy + 10} lineto stroke
${cx + 7} ${cy - 10} moveto ${cx + 7} ${cy + 10} lineto stroke
${cx - 10} ${cy + 2} 6 4 rectstroke
${cx + 4} ${cy - 4} 6 4 rectstroke
grestore`;

    case 'shield':
      return `
% Shield
gsave
${cx} ${cy + 11} moveto
${cx + 10} ${cy + 7} lineto
${cx + 8} ${cy - 5} lineto
${cx} ${cy - 12} lineto
${cx - 8} ${cy - 5} lineto
${cx - 10} ${cy + 7} lineto
closepath stroke
grestore`;

    case 'terminal':
      return `
% Terminal
gsave
${cx - 12} ${cy - 9} 24 18 rectstroke
${cx - 8} ${cy + 3} moveto ${cx - 4} ${cy} lineto ${cx - 8} ${cy - 3} lineto stroke
${cx - 1} ${cy - 3} moveto ${cx + 5} ${cy - 3} lineto stroke
grestore`;

    case 'bookmark':
      return `
% Bookmark
gsave
${cx - 8} ${cy - 11} moveto
${cx - 8} ${cy + 11} lineto
${cx + 8} ${cy + 11} lineto
${cx + 8} ${cy - 11} lineto
${cx} ${cy - 4} lineto
closepath stroke
grestore`;

    case 'code':
      return `
% Code
gsave
${cx - 3} ${cy + 7} moveto ${cx - 9} ${cy} lineto ${cx - 3} ${cy - 7} lineto stroke
${cx + 3} ${cy + 7} moveto ${cx + 9} ${cy} lineto ${cx + 3} ${cy - 7} lineto stroke
${cx + 2} ${cy + 8} moveto ${cx - 2} ${cy - 8} lineto stroke
grestore`;

    case 'eye':
      return `
% Eye
gsave
${cx - 12} ${cy} moveto
${cx} ${cy + 9} ${cx + 12} ${cy} curveto
${cx} ${cy - 9} ${cx - 12} ${cy} curveto
closepath stroke
${cx} ${cy} ${r * 0.3} 0 360 arc stroke
grestore`;

    case 'paperclip':
      return `
% Paperclip
gsave
${cx - 7} ${cy - 8} moveto
${cx - 7} ${cy + 6} lineto
${cx - 7} ${cy + 11} ${cx - 1} ${cy + 11} ${cx - 1} ${cy + 6} curveto
${cx - 1} ${cy - 6} lineto
${cx - 1} ${cy - 10} ${cx + 5} ${cy - 10} ${cx + 5} ${cy - 6} curveto
${cx + 5} ${cy + 8} lineto stroke
grestore`;

    // Commerce Icons
    case 'cart':
      return `
% Cart
gsave
${cx - 12} ${cy + 8} moveto ${cx - 8} ${cy + 8} lineto ${cx - 4} ${cy - 4} lineto ${cx + 10} ${cy - 4} lineto ${cx + 12} ${cy + 4} lineto ${cx - 6} ${cy + 4} lineto stroke
${cx - 3} ${cy - 9} 3 0 360 arc stroke
${cx + 8} ${cy - 9} 3 0 360 arc stroke
grestore`;

    case 'card':
      return `
% Credit Card
gsave
${cx - 12} ${cy - 8} 24 16 rectstroke
${cx - 12} ${cy + 3} moveto ${cx + 12} ${cy + 3} lineto stroke
${cx - 8} ${cy - 4} 4 2 rectstroke
grestore`;

    case 'wallet':
      return `
% Wallet
gsave
${cx - 12} ${cy - 8} 24 17 rectstroke
${cx + 4} ${cy - 3} 8 6 rectstroke
${cx + 7} ${cy} 1.5 0 360 arc stroke
grestore`;

    case 'gift':
      return `
% Gift
gsave
${cx - 10} ${cy - 9} 20 13 rectstroke
${cx - 11} ${cy + 4} 22 4 rectstroke
${cx} ${cy - 9} moveto ${cx} ${cy + 8} lineto stroke
${cx - 4} ${cy + 8} moveto ${cx - 4} ${cy + 12} ${cx} ${cy + 12} ${cx} ${cy + 8} curveto stroke
${cx + 4} ${cy + 8} moveto ${cx + 4} ${cy + 12} ${cx} ${cy + 12} ${cx} ${cy + 8} curveto stroke
grestore`;

    case 'truck':
      return `
% Truck
gsave
${cx - 12} ${cy - 4} 16 13 rectstroke
${cx + 4} ${cy - 4} 7 9 rectstroke
${cx + 4} ${cy + 5} moveto ${cx + 11} ${cy + 2} lineto stroke
${cx - 7} ${cy - 8} 3 0 360 arc stroke
${cx + 7} ${cy - 8} 3 0 360 arc stroke
grestore`;

    case 'store':
      return `
% Store
gsave
${cx - 12} ${cy + 4} 24 5 rectstroke
${cx - 10} ${cy - 9} 20 13 rectstroke
${cx - 3} ${cy - 9} 6 8 rectstroke
grestore`;

    case 'receipt':
      return `
% Receipt
gsave
${cx - 9} ${cy - 10} moveto
${cx - 9} ${cy + 10} lineto
${cx + 9} ${cy + 10} lineto
${cx + 9} ${cy - 10} lineto
${cx + 4} ${cy - 8} lineto
${cx} ${cy - 10} lineto
${cx - 4} ${cy - 8} lineto
closepath stroke
${cx - 5} ${cy + 5} moveto ${cx + 5} ${cy + 5} lineto stroke
${cx - 5} ${cy} moveto ${cx + 5} ${cy} lineto stroke
${cx - 5} ${cy - 4} moveto ${cx + 1} ${cy - 4} lineto stroke
grestore`;

    case 'discount':
      return `
% Discount Badge
gsave
${cx} ${cy} ${r * 0.75} 0 360 arc stroke
${cx - 5} ${cy - 5} moveto ${cx + 5} ${cy + 5} lineto stroke
${cx - 3} ${cy + 3} 1.5 0 360 arc stroke
${cx + 3} ${cy - 3} 1.5 0 360 arc stroke
grestore`;

    case 'coins':
      return `
% Coins
gsave
${cx - 3} ${cy - 2} ${r * 0.45} 0 360 arc stroke
${cx + 4} ${cy + 3} ${r * 0.45} 0 360 arc stroke
grestore`;

    case 'package':
      return `
% Package
gsave
${cx - 10} ${cy - 8} 20 16 rectstroke
${cx} ${cy - 8} moveto ${cx} ${cy + 8} lineto stroke
${cx - 4} ${cy + 2} 8 4 rectstroke
grestore`;

    case 'barcode':
      return `
% Barcode
gsave
${cx - 11} ${cy - 9} moveto ${cx - 11} ${cy + 9} lineto stroke
${cx - 7} ${cy - 9} moveto ${cx - 7} ${cy + 9} lineto stroke
${cx - 4} ${cy - 9} moveto ${cx - 4} ${cy + 9} lineto stroke
${cx} ${cy - 9} moveto ${cx} ${cy + 9} lineto stroke
${cx + 4} ${cy - 9} moveto ${cx + 4} ${cy + 9} lineto stroke
${cx + 8} ${cy - 9} moveto ${cx + 8} ${cy + 9} lineto stroke
${cx + 11} ${cy - 9} moveto ${cx + 11} ${cy + 9} lineto stroke
grestore`;

    case 'bank':
      return `
% Bank
gsave
${cx - 12} ${cy + 3} moveto ${cx} ${cy + 10} lineto ${cx + 12} ${cy + 3} lineto closepath stroke
${cx - 9} ${cy - 7} 3 10 rectstroke
${cx - 1.5} ${cy - 7} 3 10 rectstroke
${cx + 6} ${cy - 7} 3 10 rectstroke
${cx - 12} ${cy - 10} 24 3 rectstroke
grestore`;

    case 'globe':
      return `
% Globe
gsave
${cx} ${cy} ${r * 0.75} 0 360 arc stroke
${cx - 11} ${cy} moveto ${cx + 11} ${cy} lineto stroke
${cx} ${cy - 11} moveto ${cx} ${cy + 11} lineto stroke
${cx} ${cy} 6 0 360 arc stroke
grestore`;

    case 'qr':
      return `
% QR Code
gsave
${cx - 11} ${cy + 3} 8 8 rectstroke
${cx - 9} ${cy + 5} 4 4 rectstroke
${cx + 3} ${cy + 3} 8 8 rectstroke
${cx + 5} ${cy + 5} 4 4 rectstroke
${cx - 11} ${cy - 11} 8 8 rectstroke
${cx - 9} ${cy - 9} 4 4 rectstroke
${cx + 3} ${cy - 11} 8 8 rectstroke
grestore`;

    case 'safe':
      return `
% Safe
gsave
${cx - 11} ${cy - 10} 22 20 rectstroke
${cx - 2} ${cy} 6 0 360 arc stroke
${cx - 2} ${cy} 2 0 360 arc stroke
${cx + 6} ${cy - 4} 2 8 rectstroke
grestore`;

    case 'dollar':
      return `
% Dollar
gsave
${cx} ${cy} ${r * 0.75} 0 360 arc stroke
${cx} ${cy - 7} moveto ${cx} ${cy + 7} lineto stroke
${cx + 3} ${cy + 4} moveto ${cx - 3} ${cy + 4} lineto ${cx - 3} ${cy} lineto ${cx + 3} ${cy} lineto ${cx + 3} ${cy - 4} lineto ${cx - 3} ${cy - 4} lineto stroke
grestore`;

    // Media & Navigation
    case 'play':
      return `
% Play
gsave
${cx - 6} ${cy - 10} moveto
${cx + 10} ${cy} lineto
${cx - 6} ${cy + 10} lineto
closepath stroke
grestore`;

    case 'pause':
      return `
% Pause
gsave
${cx - 7} ${cy - 9} 4 18 rectstroke
${cx + 3} ${cy - 9} 4 18 rectstroke
grestore`;

    case 'volume':
      return `
% Volume
gsave
${cx - 10} ${cy - 4} 4 8 rectstroke
${cx - 6} ${cy - 4} moveto ${cx} ${cy - 9} lineto ${cx} ${cy + 9} lineto ${cx - 6} ${cy + 4} lineto closepath stroke
${cx + 3} ${cy - 5} moveto ${cx + 6} ${cy} lineto ${cx + 3} ${cy + 5} lineto stroke
${cx + 7} ${cy - 8} moveto ${cx + 11} ${cy} lineto ${cx + 7} ${cy + 8} lineto stroke
grestore`;

    case 'mic':
      return `
% Mic
gsave
${cx - 4} ${cy - 2} 8 12 rectstroke
${cx - 7} ${cy} moveto ${cx - 7} ${cy - 4} ${cx + 7} ${cy - 4} ${cx + 7} ${cy} curveto stroke
${cx} ${cy - 4} moveto ${cx} ${cy - 9} lineto stroke
${cx - 5} ${cy - 9} moveto ${cx + 5} ${cy - 9} lineto stroke
grestore`;

    case 'video':
      return `
% Video
gsave
${cx - 11} ${cy - 7} 14 14 rectstroke
${cx + 3} ${cy - 3} moveto ${cx + 10} ${cy - 7} lineto ${cx + 10} ${cy + 7} lineto ${cx + 3} ${cy + 3} lineto closepath stroke
grestore`;

    case 'music':
      return `
% Music
gsave
${cx - 6} ${cy - 8} 5 4 rectstroke
${cx + 4} ${cy - 6} 5 4 rectstroke
${cx - 1} ${cy - 8} moveto ${cx - 1} ${cy + 9} lineto ${cx + 9} ${cy + 11} lineto ${cx + 9} ${cy - 6} lineto stroke
${cx - 1} ${cy + 6} moveto ${cx + 9} ${cy + 8} lineto stroke
grestore`;

    case 'mappin':
      return `
% Map Pin
gsave
${cx} ${cy - 10} moveto
${cx - 8} ${cy} ${cx - 8} ${cy + 6} ${cx} ${cy + 10} curveto
${cx + 8} ${cy + 6} ${cx + 8} ${cy} ${cx} ${cy - 10} curveto
closepath stroke
${cx} ${cy + 4} 3 0 360 arc stroke
grestore`;

    case 'route':
      return `
% Route
gsave
${cx - 7} ${cy - 7} 3 0 360 arc stroke
${cx + 7} ${cy + 7} 3 0 360 arc stroke
${cx - 5} ${cy - 5} moveto ${cx - 5} ${cy + 3} ${cx + 5} ${cy - 3} ${cx + 5} ${cy + 5} curveto stroke
grestore`;

    case 'navigation':
      return `
% Navigation Arrow
gsave
${cx} ${cy + 11} moveto
${cx + 9} ${cy - 10} lineto
${cx} ${cy - 5} lineto
${cx - 9} ${cy - 10} lineto
closepath stroke
grestore`;

    case 'antenna':
      return `
% Antenna
gsave
${cx} ${cy - 10} moveto ${cx} ${cy + 10} lineto stroke
${cx - 8} ${cy + 6} moveto ${cx} ${cy + 10} lineto ${cx + 8} ${cy + 6} lineto stroke
${cx - 6} ${cy + 2} moveto ${cx} ${cy + 6} lineto ${cx + 6} ${cy + 2} lineto stroke
grestore`;

    case 'wifi':
      return `
% Wifi
gsave
${cx} ${cy - 7} 2 0 360 arc stroke
${cx - 5} ${cy - 3} moveto ${cx} ${cy} ${cx + 5} ${cy - 3} curveto stroke
${cx - 9} ${cy + 2} moveto ${cx} ${cy + 6} ${cx + 9} ${cy + 2} curveto stroke
${cx - 12} ${cy + 7} moveto ${cx} ${cy + 11} ${cx + 12} ${cy + 7} curveto stroke
grestore`;

    case 'battery':
      return `
% Battery
gsave
${cx - 11} ${cy - 7} 20 14 rectstroke
${cx + 9} ${cy - 3} 3 6 rectstroke
${cx - 7} ${cy - 4} 4 8 rectstroke
${cx - 1} ${cy - 4} 4 8 rectstroke
grestore`;

    default:
      return `
% Default Box
gsave
${cx - 10} ${cy - 10} 20 20 rectstroke
grestore`;
  }
}

/**
 * Builds a valid PostScript EPS string from an icon list arranged in a matrix
 */
function buildSampleEPS(
  title: string,
  icons: string[],
  cols: number,
  rows: number,
  cellW: number = 100,
  cellH: number = 100
): string {
  const width = cols * cellW;
  const height = rows * cellH;

  let postscriptBody = '';
  icons.forEach((type, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = col * cellW + cellW / 2;
    // In PostScript, row 0 is at top, so cy is height - (row * cellH + cellH / 2)
    const cy = height - (row * cellH + cellH / 2);
    postscriptBody += createIconPostScript(type, cx, cy, 32);
  });

  return `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: IconSplit Creative Studio
%%Title: ${title}
%%BoundingBox: 0 0 ${width} ${height}
%%HiResBoundingBox: 0 0 ${width} ${height}
%%Pages: 1
%%DocumentData: Clean7Bit
%%EndComments
%%BeginProlog
/rectstroke {
  /rh exch def
  /rw exch def
  /ry exch def
  /rx exch def
  rx ry moveto
  rw 0 rlineto
  0 rh rlineto
  rw neg 0 rlineto
  closepath stroke
} bind def
%%EndProlog
%%Page: 1 1
save
0.12 0.14 0.18 setrgbcolor
2 setlinewidth
1 setlinecap
1 setlinejoin
${postscriptBody}
restore
showpage
%%EOF
`;
}

// 1. Tech & UI Essentials (24 icons: 6 cols x 4 rows)
const UI_ICONS = [
  'search',
  'user',
  'settings',
  'bell',
  'star',
  'heart',
  'cloud',
  'mail',
  'folder',
  'trash',
  'download',
  'upload',
  'camera',
  'compass',
  'lock',
  'calendar',
  'tag',
  'sliders',
  'shield',
  'terminal',
  'bookmark',
  'code',
  'eye',
  'paperclip',
];

// 2. Commerce & Payment (16 icons: 4 cols x 4 rows)
const COMMERCE_ICONS = [
  'cart',
  'card',
  'wallet',
  'gift',
  'truck',
  'store',
  'receipt',
  'discount',
  'coins',
  'package',
  'barcode',
  'bank',
  'globe',
  'qr',
  'safe',
  'dollar',
];

// 3. Media & Navigation (12 icons: 4 cols x 3 rows)
const MEDIA_ICONS = [
  'play',
  'pause',
  'volume',
  'mic',
  'video',
  'music',
  'mappin',
  'route',
  'navigation',
  'antenna',
  'wifi',
  'battery',
];

export const SAMPLE_EPS_SETS: SampleSet[] = [
  {
    id: 'ui-essentials-24',
    name: 'Modern UI Essentials',
    category: 'Interface & Tech',
    iconCount: 24,
    description: '24 vector icons arranged in a 6x4 layout: search, user, bell, folders, locks, settings.',
    filename: 'ui-essentials-set.eps',
    content: buildSampleEPS('Modern UI Essentials Icon Set', UI_ICONS, 6, 4, 110, 110),
  },
  {
    id: 'ecommerce-16',
    name: 'E-Commerce & Finance',
    category: 'Commerce',
    iconCount: 16,
    description: '16 commerce vectors: cart, credit card, wallet, gift, package, bank, discount badge.',
    filename: 'ecommerce-payment-set.eps',
    content: buildSampleEPS('E-Commerce and Payment Vector Set', COMMERCE_ICONS, 4, 4, 120, 120),
  },
  {
    id: 'media-navigation-12',
    name: 'Media & Navigation',
    category: 'Audio / Video & Maps',
    iconCount: 12,
    description: '12 media controls and navigation icons: play, pause, volume, mic, map pin, route, wifi.',
    filename: 'media-navigation-set.eps',
    content: buildSampleEPS('Media and Navigation Vector Set', MEDIA_ICONS, 4, 3, 120, 120),
  },
];
