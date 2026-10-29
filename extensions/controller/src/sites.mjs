export const SITES = [
    {id:"canva",name:"Canva",hosts:["canva.com"],next:[39],previous:[37]},
    {id:"gamma",name:"Gamma",hosts:["gamma.app"],next:[39],previous:[37]},
    {id:"slides",name:"Google Slides",hosts:["docs.google.com"],next:[39],previous:[37]},
    {id:"powerpoint",name:"PowerPoint web",hosts:["powerpoint.office.com","powerpoint.cloud.microsoft","officeapps.live.com","sharepoint.com","onedrive.live.com"],next:[39],previous:[37]}
];
export function detectSite(url) {
    try {
        const parsed = new URL(url);
        if (!['http:','https:'].includes(parsed.protocol)) return null;
        const site = SITES.find(site => site.hosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
            && (site.id !== "slides" || parsed.pathname.startsWith("/presentation/"))) ?? null;
        if (site?.id === "powerpoint") {
            if (parsed.hostname.endsWith("officeapps.live.com") && !/(^|\.)powerpoint(?:-[^.]+)?\.officeapps\.live\.com$/.test(parsed.hostname)) return null;
            if (/(^|\.)(sharepoint\.com|onedrive\.live\.com)$/.test(parsed.hostname)) {
                const hint = `${decodeURIComponent(parsed.pathname)} ${[...parsed.searchParams.values()].join(" ")}`;
                if (!/(?:\/:p:\/|\.pptx?(?:$|[\s/?#])|powerpoint)/i.test(hint)) return null;
            }
        }
        return site;
    } catch { return null; }
}
