/**
 * Decides the deployment status transition for a single build-log message.
 *
 * Status-text matches (IN_PROGRESS, SUCCESS, and the text form of FAILURE) are only honored
 * on PLATFORM lines — messages the build-server publishes without a `step`. Build-step output
 * is published WITH a `step`, so a user's own build printing e.g. "Uploading to S3 Done!!!!!!"
 * cannot spoof its deployment's status. A failed step is still authoritative: `event === 'step_end'`
 * with a non-zero `exit_code` is set by the build-server itself, not by user stdout.
 *
 * Returns 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE' | null.
 */
function statusTransitionFor({ log, step, event, exit_code }) {
    const text = typeof log === 'string' ? log : '';
    const isPlatformLine = !step;

    if (isPlatformLine && text.includes('Starting the build process......')) {
        return 'IN_PROGRESS';
    }
    if (isPlatformLine && text.includes('Uploading to S3 Done!!!!!!')) {
        return 'SUCCESS';
    }
    const failedByText = isPlatformLine && (text.includes('Build process failed!') || text.includes('Error: Neither'));
    const failedByStep = event === 'step_end' && typeof exit_code === 'number' && exit_code !== 0;
    if (failedByText || failedByStep) {
        return 'FAILURE';
    }
    return null;
}

module.exports = { statusTransitionFor };
