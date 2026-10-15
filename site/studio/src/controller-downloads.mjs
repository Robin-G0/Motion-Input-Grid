export const releaseAPI = "https://api.github.com/repos/Robin-G0/Motion-Input-Grid/releases/latest";
export const releasesURL = "https://github.com/Robin-G0/Motion-Input-Grid/releases/latest";
export function controllerDownloads(release) {
    if (!Array.isArray(release?.assets)) return {};
    const result={};
    for (const asset of release.assets) {
        const name=asset.name ?? "";
        if (!/controller/i.test(name) || /sha256|checksum/i.test(name)) continue;
        const platform=/windows.*x64.*\.exe$/i.test(name)?"windows":/linux.*x64.*\.(AppImage|run)$/i.test(name)?"linux":null;
        if (!platform) continue;
        try {
            const url=new URL(asset.browser_download_url);
            if(url.origin!=="https://github.com" || !url.pathname.startsWith("/Robin-G0/Motion-Input-Grid/releases/download/"))continue;
            result[platform]=url.href;
        } catch { /* Unusable release entries never become download links. */ }
    }
    return result;
}

export async function latestControllerDownloads() {
    const response = await fetch(releaseAPI, {signal:AbortSignal.timeout(10000),headers:{Accept:"application/vnd.github+json"}});
    if(!response.ok)throw new Error("release");
    return controllerDownloads(await response.json());
}
