import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, readFileSync } from 'fs';
import { Loupi, type Outfit } from '../src/ui/mascot';
const css = readFileSync('src/styles.css', 'utf8');
const fits: [string, Outfit][] = [
  ['détective', { hat: 'deerstalker', loupe: 'gold' }], ['peintre', { hat: 'beret', neck: 'bowtie' }],
  ['chef de gare', { hat: 'conductor' }], ['gentleman', { hat: 'tophat', neck: 'bowtie', loupe: 'crystal' }],
  ['Noël', { hat: 'santa', neck: 'scarf_xmas' }], ['Cabinet noir', { back: 'cape', hat: 'tophat', loupe: 'steam' }],
];
const body = fits.map(([n, o]) => `<figure>${renderToStaticMarkup(<Loupi mood="idle" size={200} outfit={o} />)}<figcaption>${n}</figcaption></figure>`).join('')
 + `<figure>${renderToStaticMarkup(<Loupi mood="happy" size={200} outfit={{ hat: 'santa', neck: 'scarf_xmas' }} />)}<figcaption>Noël joyeux</figcaption></figure>`
 + `<figure>${renderToStaticMarkup(<Loupi mood="think" size={200} outfit={{ hat: 'deerstalker', loupe: 'steam' }} />)}<figcaption>réflexion</figcaption></figure>`;
writeFileSync('/home/claude/qa/m/outfits.html', `<html><style>${css} body{display:flex;flex-wrap:wrap;gap:6px;padding:16px;background:#222a7c} figure{margin:0;text-align:center;color:#ddd;font:14px sans-serif} *{animation-play-state:paused!important}</style><body>${body}</body></html>`);
