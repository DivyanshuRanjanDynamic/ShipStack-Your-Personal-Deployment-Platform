// Maps a request path to the ordered S3 keys (relative to the project's output prefix) to try.
// Each candidate is { key, status }: status null passes S3's status through; a number forces it
// (404.html is served as 404, the single-page-app index.html fallback as 200).

// Last path segment has a dot followed by something, e.g. app.js, about.html, robots.txt.
function hasExtension(urlPath) {
    const last = urlPath.slice(urlPath.lastIndexOf('/') + 1);
    return /\.[^.]+$/.test(last);
}

/**
 * Ordered candidates for a request path (query string already stripped, leading "/").
 * Returns null for a path that is not origin-form ("/...") or that tries to leave the project
 * prefix ("." or ".." segments, backslashes, NUL), plain or percent-encoded.
 *
 *   /app.js   -> app.js, then 404.html (404)
 *   /guides/  -> guides/index.html, then 404.html (404), then index.html (200)
 *   /about    -> about.html, about/index.html, about, then 404.html (404), then index.html (200)
 *
 * Asset paths (with an extension) never fall back to index.html: a missing script or image
 * must not be answered with HTML.
 */
function candidateKeys(urlPath) {
    if (!urlPath.startsWith('/')) return null;
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch {
        return null;
    }
    if (decoded.includes('\\') || decoded.includes('\0')) return null;
    if (decoded.split('/').some((segment) => segment === '..' || segment === '.')) return null;

    // Collapse repeated slashes and drop the leading one; keys keep the request's encoding.
    const rel = urlPath.replace(/\/{2,}/g, '/').replace(/^\//, '');

    const primary = [];
    let navigation = true;
    if (rel === '' || rel.endsWith('/')) {
        primary.push(`${rel}index.html`);
    } else if (hasExtension(rel)) {
        primary.push(rel);
        navigation = false;
    } else {
        primary.push(`${rel}.html`, `${rel}/index.html`, rel);
    }

    const candidates = primary.map((key) => ({ key, status: null }));
    candidates.push({ key: '404.html', status: 404 });
    if (navigation) candidates.push({ key: 'index.html', status: 200 });

    // "/" already tries index.html first; keep only the first occurrence of each key.
    const seen = new Set();
    return candidates.filter(({ key }) => !seen.has(key) && seen.add(key));
}

// S3 answers a missing key with 403 on a private bucket and 404 on a public one.
function isMissing(statusCode) {
    return statusCode === 403 || statusCode === 404;
}

module.exports = { candidateKeys, isMissing, hasExtension };
