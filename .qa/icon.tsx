import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'fs';
import { Loupi } from '../src/ui/mascot';
const inner = renderToStaticMarkup(<Loupi mood="think" bust size={420} />)
  .replace('<svg ', '<svg x="46" y="96" ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111332"/><stop offset="1" stop-color="#333874"/></linearGradient>
    <radialGradient id="lamp" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#ffd27a" stop-opacity=".5"/><stop offset="1" stop-color="#ffb938" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#sky)"/>
  <circle cx="256" cy="270" r="250" fill="url(#lamp)"/>
  <circle cx="420" cy="92" r="22" fill="#f6f0e4" opacity=".9"/>
  <circle cx="92" cy="80" r="3" fill="#f6f0e4"/><circle cx="150" cy="54" r="2" fill="#f6f0e4"/><circle cx="350" cy="58" r="2.4" fill="#f6f0e4"/>
  ${inner}
</svg>`;
writeFileSync('public/icon.svg', svg);
