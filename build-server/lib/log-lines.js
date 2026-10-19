/**
 * Splits streamed output into whole lines, buffering a partial last line between chunks.
 * push(chunk) returns the complete lines in that chunk (a trailing CR is trimmed);
 * flush() returns whatever partial line is left at end of stream ('' if none).
 */
function createLineBuffer() {
    let buffer = '';
    const trimCr = (line) => (line.endsWith('\r') ? line.slice(0, -1) : line);
    return {
        push(chunk) {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            return lines.map(trimCr);
        },
        flush() {
            const remaining = buffer;
            buffer = '';
            return trimCr(remaining);
        },
    };
}

module.exports = { createLineBuffer };
