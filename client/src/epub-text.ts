import JSZip from 'jszip';

export type EpubChapter = { title: string; paragraphs: string[] };

function xml(source: string): Document {
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('This EPUB has invalid book metadata.');
  return document;
}

function pathFrom(base: string, relative: string) {
  const url = new URL(relative, new URL(encodeURI(base), 'https://bookhaven.invalid/'));
  return decodeURIComponent(url.pathname.slice(1));
}

export async function readEpub(buffer: ArrayBuffer): Promise<EpubChapter[]> {
  const zip = await JSZip.loadAsync(buffer);
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('This file has no EPUB contents.');
  const containerDoc = xml(await container.async('text'));
  const packagePath = containerDoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
  if (!packagePath) throw new Error('This EPUB has no reading order.');
  const packageFile = zip.file(packagePath);
  if (!packageFile) throw new Error('This EPUB has no book metadata.');
  const packageDoc = xml(await packageFile.async('text'));
  const manifest = new Map(Array.from(packageDoc.getElementsByTagName('item')).map(item => [item.getAttribute('id'), {
    href: item.getAttribute('href') || '',
    type: item.getAttribute('media-type'),
    properties: item.getAttribute('properties') || '',
  }]));
  const spine = Array.from(packageDoc.getElementsByTagName('itemref')).slice(0, 300);
  const chapters: EpubChapter[] = [];
  let total = 0;

  for (const item of spine) {
    const entry = manifest.get(item.getAttribute('idref'));
    if (!entry || !['application/xhtml+xml', 'text/html'].includes(entry.type || '') || entry.properties.includes('nav')) continue;
    const file = zip.file(pathFrom(packagePath, entry.href));
    if (!file) continue;
    const source = await file.async('text');
    total += source.length;
    if (source.length > 3_000_000 || total > 25_000_000) throw new Error('This EPUB is too large to read here. You can still download it.');
    // DOMParser creates an inert document. Only extracted text reaches React;
    // scripts, markup, styles and external resources are never rendered.
    const doc = new DOMParser().parseFromString(source, 'text/html');
    doc.querySelectorAll('script, style, nav, svg').forEach(node => node.remove());
    const body = doc.body;
    const blocks = Array.from(body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote'));
    const clean = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();
    const paragraphs = blocks.map(node => clean(node.textContent)).filter(Boolean);
    if (!paragraphs.length) {
      const fallback = clean(body.textContent);
      if (fallback) paragraphs.push(fallback);
    }
    if (!paragraphs.length) continue;
    const title = clean(body.querySelector('h1, h2, h3')?.textContent) || clean(doc.title) || `Section ${chapters.length + 1}`;
    chapters.push({ title, paragraphs });
  }
  if (!chapters.length) throw new Error('This EPUB has no readable text. You can still download it.');
  return chapters;
}
