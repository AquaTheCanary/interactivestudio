// router.js — Dynamic environment-aware path resolver
(function () {
    const isGitHubIo = window.location.hostname.endsWith('github.io');
    const basePath = isGitHubIo ? '/interactivestudio' : '';

    window.getAppUrl = function (path) {
        if (!path) return basePath || '/';
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        return basePath + cleanPath;
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('a[data-route]').forEach(anchor => {
            const route = anchor.getAttribute('data-route');
            if (route) {
                anchor.href = window.getAppUrl(route);
            }
        });
    });
})();
