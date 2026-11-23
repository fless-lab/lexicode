import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, readFileSync } from 'fs';
import { Loupi } from '../src/ui/mascot';
const css = readFileSync('/home/claude/lexicode/src/styles.css', 'utf8');
const moods = ['idle', 'think', 'happy', 'sad', 'wow'] as const;
const body = moods.map((m) => `<figure>${renderToStaticMarkup(<Loupi mood={m} size={220} />)}<figcaption>${m}</figcaption></figure>`).join('')
  + `<figure>${renderToStaticMarkup(<Loupi mood="think" bust size={160} />)}<figcaption>bust think</figcaption></figure>`
  + `<figure>${renderToStaticMarkup(<Loupi mood="happy" bust size={160} />)}<figcaption>bust happy</figcaption></figure>`;
writeFileSync('/home/claude/qa/m/sheet.html', `<html><style>${css} body{display:flex;flex-wrap:wrap;gap:10px;padding:20px;background:#1b1e48} figure{margin:0;text-align:center;color:#ccc;font:14px sans-serif} *{animation-play-state:paused!important}</style><body>${body}</body></html>`);
