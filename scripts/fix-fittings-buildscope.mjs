import fs from 'node:fs';

const file = 'src/components/EstimatePage.tsx';
let s = fs.readFileSync(file, 'utf8');

const buildScopeStart = s.indexOf('function buildScope');
if (buildScopeStart < 0) throw new Error('buildScope not found');
const buildLabourStart = s.indexOf('\n}\n\nfunction buildLabour', buildScopeStart);
if (buildLabourStart < 0) throw new Error('buildScope end not found');

const buildScopeBody = s.slice(buildScopeStart, buildLabourStart);
const returnInBody = buildScopeBody.indexOf('\n\n  return lines;');
if (returnInBody < 0) throw new Error('buildScope return not found');

const beforeReturn = buildScopeBody.slice(0, returnInBody);

if (!beforeReturn.includes('fittingLines.forEach')) {
  const insertAt = buildScopeStart + returnInBody;
  const fittingBlock = [
    '',
    '  fittingLines.forEach((fl, i) => {',
    '    if (fl.quantity <= 0) return;',
    '    lines.push({',
    '      id:`CF${String(i+1).padStart(2,"0")}`,',
    '      code: fl.materialCode,',
    '      description: fl.description,',
    '      qty: fl.quantity,',
    '      unit:"ea",',
    '      unitPrice: fl.unitPrice,',
    '      conf: fl.grade,',
    '      total: fl.quantity * fl.unitPrice,',
    '      supplier: fl.supplier,',
    '      derivation: `${fl.quantity} × R${fl.unitPrice} (${fl.sizeGroup} compression fitting · Plumblink ${fl.plumblinkCode || fl.materialCode})`,',
    '      mode:"Supply",',
    '    });',
    '  });',
  ].join('\n');

  s = s.slice(0, insertAt) + fittingBlock + s.slice(insertAt);
  fs.writeFileSync(file, s);
  console.log('Fittings pricing block inserted before buildScope return.');
} else {
  console.log('Fittings pricing block already before buildScope return.');
}
